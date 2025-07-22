
-- First, let's update the Annual Leave type to have the correct policy
UPDATE public.leave_policies 
SET annual_allowance = 18 
WHERE leave_type_id = '550e8400-e29b-41d4-a716-446655440004';

-- Create a function to initialize annual leave balances for all existing users
CREATE OR REPLACE FUNCTION public.initialize_all_users_annual_leave()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    annual_leave_type_id UUID;
    current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
    -- Get Annual Leave type ID
    SELECT id INTO annual_leave_type_id
    FROM leave_types 
    WHERE label = 'Annual Leave'
    LIMIT 1;
    
    IF annual_leave_type_id IS NULL THEN
        RAISE EXCEPTION 'Annual Leave type not found';
    END IF;
    
    -- Initialize annual leave balance for all users
    FOR user_record IN 
        SELECT DISTINCT id FROM profiles
    LOOP
        INSERT INTO user_annual_leave_balances (
            user_id, 
            leave_type_id, 
            year, 
            allocated_balance, 
            used_balance
        ) VALUES (
            user_record.id,
            annual_leave_type_id,
            current_year,
            18,
            0
        ) ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
    END LOOP;
END;
$$;

-- Run the initialization function
SELECT initialize_all_users_annual_leave();

-- Update the monthly balance validation to enforce strict monthly limits
CREATE OR REPLACE FUNCTION public.validate_monthly_leave_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_leave_type_label TEXT;
    v_monthly_allowance NUMERIC := 1.5;
    v_current_used NUMERIC := 0;
    v_new_request_days NUMERIC;
    v_total_after_request NUMERIC;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = NEW.leave_type_id;
    
    -- Only validate for Paid Leave
    IF v_leave_type_label != 'Paid Leave' THEN
        RETURN NEW;
    END IF;
    
    -- Calculate days for this request
    IF NEW.is_half_day THEN
        v_new_request_days := 0.5;
    ELSE
        v_new_request_days := GREATEST(1, EXTRACT(DAY FROM (NEW.end_date - NEW.start_date)) + 1);
    END IF;
    
    -- Get current month's usage
    SELECT COALESCE(SUM(
        CASE 
            WHEN lau.is_half_day THEN 0.5
            ELSE GREATEST(1, EXTRACT(DAY FROM (lau.end_date - lau.start_date)) + 1)
        END
    ), 0)
    INTO v_current_used
    FROM leave_applied_users lau
    WHERE lau.user_id = NEW.user_id 
        AND lau.leave_type_id = NEW.leave_type_id
        AND EXTRACT(MONTH FROM lau.start_date) = EXTRACT(MONTH FROM NEW.start_date)
        AND EXTRACT(YEAR FROM lau.start_date) = EXTRACT(YEAR FROM NEW.start_date)
        AND lau.status IN ('approved', 'pending')
        AND lau.id != COALESCE(NEW.id, gen_random_uuid()); -- Exclude current record for updates
    
    v_total_after_request := v_current_used + v_new_request_days;
    
    -- Check if the request would exceed monthly limit
    IF v_total_after_request > v_monthly_allowance THEN
        RAISE EXCEPTION 'Paid leave request exceeds monthly limit. You have %.1f days remaining this month (requested: %.1f days)', 
            (v_monthly_allowance - v_current_used), v_new_request_days;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for monthly limit validation
DROP TRIGGER IF EXISTS validate_monthly_leave_limit_trigger ON leave_applied_users;
CREATE TRIGGER validate_monthly_leave_limit_trigger
    BEFORE INSERT OR UPDATE ON leave_applied_users
    FOR EACH ROW
    EXECUTE FUNCTION validate_monthly_leave_limit();

-- Update the get_monthly_leave_balance function to properly handle the 1.5 monthly allocation
CREATE OR REPLACE FUNCTION public.get_monthly_leave_balance(
    p_user_id TEXT,
    p_leave_type_id UUID,
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_leave_type_label TEXT;
    v_balance_data JSONB;
    v_used_this_month NUMERIC := 0;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = p_leave_type_id;
    
    -- For Annual Leave, use the annual balance system
    IF v_leave_type_label = 'Annual Leave' THEN
        SELECT get_or_create_annual_balance(p_user_id, p_leave_type_id, p_year) 
        INTO v_balance_data;
        
        RETURN jsonb_build_object(
            'leave_type', v_leave_type_label,
            'duration_type', 'days',
            'monthly_allowance', (v_balance_data->>'allocated_balance')::numeric,
            'used_this_month', (v_balance_data->>'used_balance')::numeric,
            'remaining_this_month', (v_balance_data->>'remaining_balance')::numeric,
            'annual_allowance', (v_balance_data->>'allocated_balance')::numeric
        );
    -- For Paid Leave, use monthly allocation of 1.5 days
    ELSIF v_leave_type_label = 'Paid Leave' THEN
        -- Calculate actual usage for this month from leave_applied_users
        SELECT COALESCE(SUM(
            CASE 
                WHEN lau.is_half_day THEN 0.5
                ELSE GREATEST(1, EXTRACT(DAY FROM (lau.end_date - lau.start_date)) + 1)
            END
        ), 0)
        INTO v_used_this_month
        FROM leave_applied_users lau
        WHERE lau.user_id = p_user_id 
            AND lau.leave_type_id = p_leave_type_id
            AND EXTRACT(MONTH FROM lau.start_date) = p_month
            AND EXTRACT(YEAR FROM lau.start_date) = p_year
            AND lau.status IN ('approved', 'pending');
        
        RETURN jsonb_build_object(
            'leave_type', v_leave_type_label,
            'duration_type', 'days',
            'monthly_allowance', 1.5,
            'used_this_month', v_used_this_month,
            'remaining_this_month', GREATEST(0, 1.5 - v_used_this_month)
        );
    ELSE
        -- Keep existing logic for other leave types
        DECLARE
            v_monthly_allowance NUMERIC;
            v_duration_type TEXT;
        BEGIN
            SELECT 
                CASE 
                    WHEN lt.label = 'Short Leave' THEN 'hours'
                    ELSE 'days'
                END,
                CASE 
                    WHEN lt.label = 'Work From Home' THEN 2
                    WHEN lt.label = 'Short Leave' THEN 4
                    ELSE 0
                END
            INTO v_duration_type, v_monthly_allowance
            FROM leave_types lt
            WHERE lt.id = p_leave_type_id;

            -- Calculate used leave for this month
            SELECT COALESCE(
                CASE 
                    WHEN v_duration_type = 'hours' THEN SUM(COALESCE(hours_requested, 1))
                    ELSE SUM(EXTRACT(DAY FROM (end_date::date - start_date::date)) + 1)
                END, 0
            )
            INTO v_used_this_month
            FROM leave_applied_users
            WHERE user_id = p_user_id 
                AND leave_type_id = p_leave_type_id
                AND EXTRACT(MONTH FROM start_date::date)::integer = p_month
                AND EXTRACT(YEAR FROM start_date::date)::integer = p_year
                AND status != 'rejected';

            RETURN jsonb_build_object(
                'leave_type', v_leave_type_label,
                'duration_type', v_duration_type,
                'monthly_allowance', v_monthly_allowance,
                'used_this_month', v_used_this_month,
                'remaining_this_month', GREATEST(0, v_monthly_allowance - v_used_this_month)
            );
        END;
    END IF;
END;
$$;
