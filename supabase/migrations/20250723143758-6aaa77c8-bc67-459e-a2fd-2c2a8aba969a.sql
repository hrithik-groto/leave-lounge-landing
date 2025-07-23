
-- Update the leave policy for Additional work from home to have 24 annual allowance
UPDATE public.leave_policies 
SET annual_allowance = 24 
WHERE leave_type_id = '550e8400-e29b-41d4-a716-446655440004';

-- Update the get_monthly_leave_balance function to handle Annual Additional WFH
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
    v_wfh_remaining NUMERIC := 0;
    v_annual_used NUMERIC := 0;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = p_leave_type_id;
    
    -- For Additional work from home, check if regular WFH is exhausted AND check annual balance
    IF v_leave_type_label = 'Additional work from home' THEN
        -- Get Work From Home leave type ID
        DECLARE
            v_wfh_leave_type_id UUID;
        BEGIN
            SELECT id INTO v_wfh_leave_type_id
            FROM leave_types
            WHERE label = 'Work From Home';
            
            -- Check remaining WFH balance
            SELECT (get_monthly_leave_balance(p_user_id, v_wfh_leave_type_id, p_month, p_year)->>'remaining_this_month')::numeric
            INTO v_wfh_remaining;
            
            -- Calculate used Additional WFH for this YEAR
            SELECT COALESCE(SUM(
                CASE 
                    WHEN is_half_day THEN 0.5
                    WHEN actual_days_used IS NOT NULL THEN actual_days_used
                    ELSE EXTRACT(DAY FROM (end_date::date - start_date::date)) + 1
                END
            ), 0)
            INTO v_annual_used
            FROM leave_applied_users
            WHERE user_id = p_user_id 
                AND leave_type_id = p_leave_type_id
                AND EXTRACT(YEAR FROM start_date::date)::integer = p_year
                AND status IN ('approved', 'pending');
                
            RETURN jsonb_build_object(
                'leave_type', v_leave_type_label,
                'duration_type', 'days',
                'annual_allowance', 24,
                'used_this_year', v_annual_used,
                'remaining_this_year', GREATEST(0, 24 - v_annual_used),
                'can_apply', (v_wfh_remaining <= 0 AND v_annual_used < 24),
                'wfh_remaining', v_wfh_remaining
            );
        END;
    
    -- For Annual Leave, use the new annual balance system
    ELSIF v_leave_type_label = 'Annual Leave' THEN
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
    -- For Paid Leave, use the existing monthly balance system
    ELSIF v_leave_type_label = 'Paid Leave' THEN
        SELECT get_or_create_monthly_balance(p_user_id, p_leave_type_id, p_year, p_month) 
        INTO v_balance_data;
        
        RETURN jsonb_build_object(
            'leave_type', v_leave_type_label,
            'duration_type', 'days',
            'monthly_allowance', (v_balance_data->>'allocated_balance')::numeric,
            'used_this_month', (v_balance_data->>'used_balance')::numeric,
            'remaining_this_month', (v_balance_data->>'remaining_balance')::numeric,
            'carried_forward', (v_balance_data->>'carried_forward')::numeric
        );
    ELSE
        -- Keep existing logic for other leave types
        DECLARE
            v_monthly_allowance NUMERIC;
            v_used_this_month NUMERIC := 0;
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

-- Create a trigger to update Additional WFH annual balance
CREATE OR REPLACE FUNCTION public.update_additional_wfh_annual_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_leave_type_label TEXT;
    v_days_used NUMERIC;
    v_old_days_used NUMERIC := 0;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = COALESCE(NEW.leave_type_id, OLD.leave_type_id);
    
    -- Only process for Additional work from home
    IF v_leave_type_label != 'Additional work from home' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate days used based on leave duration and half-day flag
    IF NEW IS NOT NULL THEN
        IF NEW.is_half_day THEN
            v_days_used := 0.5;
        ELSIF NEW.actual_days_used IS NOT NULL THEN
            v_days_used := NEW.actual_days_used;
        ELSE
            v_days_used := EXTRACT(DAY FROM (NEW.end_date - NEW.start_date)) + 1;
        END IF;
        NEW.actual_days_used := v_days_used;
    END IF;
    
    -- Get old days used for updates
    IF OLD IS NOT NULL THEN
        IF OLD.actual_days_used IS NOT NULL THEN
            v_old_days_used := OLD.actual_days_used;
        ELSIF OLD.is_half_day THEN
            v_old_days_used := 0.5;
        ELSE
            v_old_days_used := EXTRACT(DAY FROM (OLD.end_date - OLD.start_date)) + 1;
        END IF;
    END IF;
    
    -- Handle INSERT (new leave application)
    IF TG_OP = 'INSERT' AND NEW.status IN ('approved', 'pending') THEN
        -- Ensure annual balance exists first
        PERFORM get_or_create_annual_balance(
            NEW.user_id, 
            NEW.leave_type_id, 
            EXTRACT(YEAR FROM NEW.start_date)::INTEGER
        );
        
        -- Update the balance
        UPDATE user_annual_leave_balances 
        SET used_balance = COALESCE(used_balance, 0) + v_days_used,
            updated_at = now()
        WHERE user_id = NEW.user_id 
            AND leave_type_id = NEW.leave_type_id
            AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
            
        -- If no balance record exists, create one
        IF NOT FOUND THEN
            INSERT INTO user_annual_leave_balances (
                user_id, leave_type_id, year, allocated_balance, used_balance
            ) VALUES (
                NEW.user_id, NEW.leave_type_id, 
                EXTRACT(YEAR FROM NEW.start_date)::INTEGER, 
                24, v_days_used
            );
        END IF;
    END IF;
    
    -- Handle UPDATE (status change or modification)
    IF TG_OP = 'UPDATE' THEN
        -- If status changed from pending/approved to rejected, subtract the days
        IF OLD.status IN ('approved', 'pending') AND NEW.status = 'rejected' THEN
            UPDATE user_annual_leave_balances 
            SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - v_old_days_used),
                updated_at = now()
            WHERE user_id = NEW.user_id 
                AND leave_type_id = NEW.leave_type_id
                AND year = EXTRACT(YEAR FROM OLD.start_date)::INTEGER;
        END IF;
        
        -- If status changed from rejected to approved/pending, add the days
        IF OLD.status = 'rejected' AND NEW.status IN ('approved', 'pending') THEN
            -- Ensure annual balance exists first
            PERFORM get_or_create_annual_balance(
                NEW.user_id, 
                NEW.leave_type_id, 
                EXTRACT(YEAR FROM NEW.start_date)::INTEGER
            );
            
            UPDATE user_annual_leave_balances 
            SET used_balance = COALESCE(used_balance, 0) + v_days_used,
                updated_at = now()
            WHERE user_id = NEW.user_id 
                AND leave_type_id = NEW.leave_type_id
                AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
        END IF;
        
        -- If days changed (half-day toggle or date change), update the difference
        IF OLD.status IN ('approved', 'pending') AND NEW.status IN ('approved', 'pending') 
           AND v_old_days_used != v_days_used THEN
            UPDATE user_annual_leave_balances 
            SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - v_old_days_used + v_days_used),
                updated_at = now()
            WHERE user_id = NEW.user_id 
                AND leave_type_id = NEW.leave_type_id
                AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
        END IF;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' AND OLD.status IN ('approved', 'pending') THEN
        UPDATE user_annual_leave_balances 
        SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - v_old_days_used),
            updated_at = now()
        WHERE user_id = OLD.user_id 
            AND leave_type_id = OLD.leave_type_id
            AND year = EXTRACT(YEAR FROM OLD.start_date)::INTEGER;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for Additional WFH annual balance management
DROP TRIGGER IF EXISTS trigger_update_additional_wfh_annual_balance ON leave_applied_users;
CREATE TRIGGER trigger_update_additional_wfh_annual_balance
    BEFORE INSERT OR UPDATE OR DELETE ON leave_applied_users
    FOR EACH ROW
    EXECUTE FUNCTION update_additional_wfh_annual_balance();

-- Update the get_or_create_annual_balance function to handle Additional WFH
CREATE OR REPLACE FUNCTION public.get_or_create_annual_balance(p_user_id text, p_leave_type_id uuid, p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE))
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_balance RECORD;
    v_leave_type_label TEXT;
    v_annual_allowance NUMERIC;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = p_leave_type_id;
    
    -- Set annual allowance based on leave type
    IF v_leave_type_label = 'Annual Leave' THEN
        v_annual_allowance := 18;
    ELSIF v_leave_type_label = 'Additional work from home' THEN
        v_annual_allowance := 24;
    ELSE
        RETURN jsonb_build_object(
            'error', 'This function only handles Annual Leave and Additional work from home',
            'leave_type', v_leave_type_label
        );
    END IF;
    
    -- Try to get existing balance
    SELECT * INTO v_balance
    FROM user_annual_leave_balances
    WHERE user_id = p_user_id 
        AND leave_type_id = p_leave_type_id
        AND year = p_year;
    
    -- If balance doesn't exist, create it
    IF v_balance IS NULL THEN
        INSERT INTO user_annual_leave_balances (
            user_id, leave_type_id, year, allocated_balance, used_balance
        ) VALUES (
            p_user_id, p_leave_type_id, p_year, v_annual_allowance, 0
        );
        
        -- Get the newly created balance
        SELECT * INTO v_balance
        FROM user_annual_leave_balances
        WHERE user_id = p_user_id 
            AND leave_type_id = p_leave_type_id
            AND year = p_year;
    END IF;
    
    RETURN jsonb_build_object(
        'allocated_balance', v_balance.allocated_balance,
        'used_balance', v_balance.used_balance,
        'remaining_balance', v_balance.allocated_balance - v_balance.used_balance,
        'year', v_balance.year
    );
END;
$$;
