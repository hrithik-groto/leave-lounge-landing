
-- Fix the trigger function to properly calculate days used and handle all edge cases
CREATE OR REPLACE FUNCTION public.update_monthly_balance_on_leave_change()
RETURNS TRIGGER AS $$
DECLARE
    v_leave_type_label TEXT;
    v_days_used NUMERIC;
    v_old_days_used NUMERIC := 0;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = COALESCE(NEW.leave_type_id, OLD.leave_type_id);
    
    -- Only process for Paid Leave
    IF v_leave_type_label != 'Paid Leave' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate days used based on leave duration and half-day flag
    IF NEW IS NOT NULL THEN
        IF COALESCE(NEW.is_half_day, false) = true THEN
            v_days_used := 0.5;
        ELSE
            -- Fix: Use simple date subtraction for single day leaves
            v_days_used := (NEW.end_date - NEW.start_date) + 1;
        END IF;
        NEW.actual_days_used := v_days_used;
    END IF;
    
    -- Get old days used for updates (use actual_days_used if available)
    IF OLD IS NOT NULL THEN
        IF OLD.actual_days_used IS NOT NULL THEN
            v_old_days_used := OLD.actual_days_used;
        ELSIF OLD.is_half_day = true THEN
            v_old_days_used := 0.5;
        ELSE
            v_old_days_used := (OLD.end_date - OLD.start_date) + 1;
        END IF;
    END IF;
    
    -- Handle INSERT (new leave application)
    IF TG_OP = 'INSERT' AND NEW.status IN ('approved', 'pending') THEN
        -- First ensure monthly balance exists by calling the function
        PERFORM get_or_create_monthly_balance(
            NEW.user_id, 
            NEW.leave_type_id, 
            EXTRACT(YEAR FROM NEW.start_date)::INTEGER,
            EXTRACT(MONTH FROM NEW.start_date)::INTEGER
        );
        
        -- Now update the balance with proper NULL handling
        UPDATE user_monthly_leave_balances 
        SET used_balance = COALESCE(used_balance, 0) + v_days_used,
            updated_at = now()
        WHERE user_id = NEW.user_id 
            AND leave_type_id = NEW.leave_type_id
            AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER
            AND month = EXTRACT(MONTH FROM NEW.start_date)::INTEGER;
            
        -- If no rows were updated, create the balance record manually
        IF NOT FOUND THEN
            INSERT INTO user_monthly_leave_balances (
                user_id, leave_type_id, year, month,
                allocated_balance, used_balance, carried_forward
            ) VALUES (
                NEW.user_id, NEW.leave_type_id,
                EXTRACT(YEAR FROM NEW.start_date)::INTEGER,
                EXTRACT(MONTH FROM NEW.start_date)::INTEGER,
                1.5, v_days_used, 0
            );
        END IF;
    END IF;
    
    -- Handle UPDATE (status change or modification)
    IF TG_OP = 'UPDATE' THEN
        -- If status changed from pending/approved to rejected, subtract the days
        IF OLD.status IN ('approved', 'pending') AND NEW.status = 'rejected' THEN
            UPDATE user_monthly_leave_balances 
            SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - v_old_days_used),
                updated_at = now()
            WHERE user_id = NEW.user_id 
                AND leave_type_id = NEW.leave_type_id
                AND year = EXTRACT(YEAR FROM OLD.start_date)::INTEGER
                AND month = EXTRACT(MONTH FROM OLD.start_date)::INTEGER;
        END IF;
        
        -- If status changed from rejected to approved/pending, add the days
        IF OLD.status = 'rejected' AND NEW.status IN ('approved', 'pending') THEN
            -- Ensure monthly balance exists first
            PERFORM get_or_create_monthly_balance(
                NEW.user_id, 
                NEW.leave_type_id, 
                EXTRACT(YEAR FROM NEW.start_date)::INTEGER,
                EXTRACT(MONTH FROM NEW.start_date)::INTEGER
            );
            
            UPDATE user_monthly_leave_balances 
            SET used_balance = COALESCE(used_balance, 0) + v_days_used,
                updated_at = now()
            WHERE user_id = NEW.user_id 
                AND leave_type_id = NEW.leave_type_id
                AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER
                AND month = EXTRACT(MONTH FROM NEW.start_date)::INTEGER;
        END IF;
        
        -- If days changed (half-day toggle or date change), update the difference
        IF OLD.status IN ('approved', 'pending') AND NEW.status IN ('approved', 'pending') 
           AND v_old_days_used != v_days_used THEN
            UPDATE user_monthly_leave_balances 
            SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - v_old_days_used + v_days_used),
                updated_at = now()
            WHERE user_id = NEW.user_id 
                AND leave_type_id = NEW.leave_type_id
                AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER
                AND month = EXTRACT(MONTH FROM NEW.start_date)::INTEGER;
        END IF;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' AND OLD.status IN ('approved', 'pending') THEN
        UPDATE user_monthly_leave_balances 
        SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - v_old_days_used),
            updated_at = now()
        WHERE user_id = OLD.user_id 
            AND leave_type_id = OLD.leave_type_id
            AND year = EXTRACT(YEAR FROM OLD.start_date)::INTEGER
            AND month = EXTRACT(MONTH FROM OLD.start_date)::INTEGER;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the monthly leave limit validation function
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
        v_new_request_days := (NEW.end_date - NEW.start_date) + 1;
    END IF;
    
    -- Get current month's usage (excluding current record for updates)
    SELECT COALESCE(SUM(
        CASE 
            WHEN lau.is_half_day THEN 0.5
            ELSE (lau.end_date - lau.start_date) + 1
        END
    ), 0)
    INTO v_current_used
    FROM leave_applied_users lau
    WHERE lau.user_id = NEW.user_id 
        AND lau.leave_type_id = NEW.leave_type_id
        AND EXTRACT(MONTH FROM lau.start_date) = EXTRACT(MONTH FROM NEW.start_date)
        AND EXTRACT(YEAR FROM lau.start_date) = EXTRACT(YEAR FROM NEW.start_date)
        AND lau.status IN ('approved', 'pending')
        AND lau.id != COALESCE(NEW.id, gen_random_uuid());
    
    v_total_after_request := v_current_used + v_new_request_days;
    
    -- Check if the request would exceed monthly limit
    IF v_total_after_request > v_monthly_allowance THEN
        RAISE EXCEPTION 'Paid leave request exceeds monthly limit. You have %.1f days remaining this month (requested: %.1f days)', 
            (v_monthly_allowance - v_current_used), v_new_request_days;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_monthly_leave_balance function to use consistent calculation
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
    v_monthly_allowance NUMERIC := 1.5;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = p_leave_type_id;
    
    -- For Paid Leave, calculate from actual leave applications
    IF v_leave_type_label = 'Paid Leave' THEN
        -- Calculate actual usage for this month from leave applications
        SELECT COALESCE(SUM(
            CASE 
                WHEN lau.is_half_day THEN 0.5
                ELSE (lau.end_date - lau.start_date) + 1
            END
        ), 0)
        INTO v_used_this_month
        FROM leave_applied_users lau
        WHERE lau.user_id = p_user_id 
            AND lau.leave_type_id = p_leave_type_id
            AND EXTRACT(MONTH FROM lau.start_date) = p_month
            AND EXTRACT(YEAR FROM lau.start_date) = p_year
            AND lau.status IN ('approved', 'pending');
        
        -- Try to get or create monthly balance record
        SELECT get_or_create_monthly_balance(p_user_id, p_leave_type_id, p_year, p_month) 
        INTO v_balance_data;
        
        -- Update the balance record to match actual usage
        UPDATE user_monthly_leave_balances 
        SET used_balance = v_used_this_month,
            updated_at = now()
        WHERE user_id = p_user_id 
            AND leave_type_id = p_leave_type_id
            AND year = p_year
            AND month = p_month;
        
        RETURN jsonb_build_object(
            'leave_type', v_leave_type_label,
            'duration_type', 'days',
            'monthly_allowance', v_monthly_allowance,
            'used_this_month', v_used_this_month,
            'remaining_this_month', GREATEST(0, v_monthly_allowance - v_used_this_month),
            'carried_forward', (v_balance_data->>'carried_forward')::numeric
        );
    ELSE
        -- Keep existing logic for other leave types
        DECLARE
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
                    ELSE SUM((end_date - start_date) + 1)
                END, 0
            )
            INTO v_used_this_month
            FROM leave_applied_users
            WHERE user_id = p_user_id 
                AND leave_type_id = p_leave_type_id
                AND EXTRACT(MONTH FROM start_date) = p_month
                AND EXTRACT(YEAR FROM start_date) = p_year
                AND status IN ('approved', 'pending');

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

-- Fix any existing incorrect balance records by recalculating from actual leave applications
DO $$
DECLARE
    balance_record RECORD;
    actual_usage NUMERIC;
    paid_leave_type_id UUID;
BEGIN
    -- Get Paid Leave type ID
    SELECT id INTO paid_leave_type_id FROM leave_types WHERE label = 'Paid Leave';
    
    -- Loop through all monthly balance records for Paid Leave
    FOR balance_record IN 
        SELECT * FROM user_monthly_leave_balances 
        WHERE leave_type_id = paid_leave_type_id
    LOOP
        -- Calculate actual usage from leave applications
        SELECT COALESCE(SUM(
            CASE 
                WHEN lau.is_half_day THEN 0.5
                ELSE (lau.end_date - lau.start_date) + 1
            END
        ), 0)
        INTO actual_usage
        FROM leave_applied_users lau
        WHERE lau.user_id = balance_record.user_id
            AND lau.leave_type_id = balance_record.leave_type_id
            AND EXTRACT(MONTH FROM lau.start_date) = balance_record.month
            AND EXTRACT(YEAR FROM lau.start_date) = balance_record.year
            AND lau.status IN ('approved', 'pending');
        
        -- Update the balance record if it's different
        IF actual_usage != balance_record.used_balance THEN
            UPDATE user_monthly_leave_balances 
            SET used_balance = actual_usage,
                updated_at = now()
            WHERE id = balance_record.id;
        END IF;
    END LOOP;
END;
$$;
