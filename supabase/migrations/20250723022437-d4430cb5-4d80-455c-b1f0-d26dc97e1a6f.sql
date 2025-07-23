
-- Fix the trigger function to properly calculate days used
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
            -- Fix: Use DATE arithmetic instead of EXTRACT(DAY FROM interval)
            v_days_used := (NEW.end_date - NEW.start_date) + 1;
        END IF;
        NEW.actual_days_used := v_days_used;
    END IF;
    
    -- Get old days used for updates
    IF OLD IS NOT NULL THEN
        v_old_days_used := COALESCE(OLD.actual_days_used, 1);
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
        SET used_balance = COALESCE(used_balance, 0) + COALESCE(v_days_used, 1),
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
                1.5, COALESCE(v_days_used, 1), 0
            );
        END IF;
    END IF;
    
    -- Handle UPDATE (status change or modification)
    IF TG_OP = 'UPDATE' THEN
        -- If status changed from pending/approved to rejected, subtract the days
        IF OLD.status IN ('approved', 'pending') AND NEW.status = 'rejected' THEN
            UPDATE user_monthly_leave_balances 
            SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - COALESCE(v_old_days_used, 1)),
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
            SET used_balance = COALESCE(used_balance, 0) + COALESCE(v_days_used, 1),
                updated_at = now()
            WHERE user_id = NEW.user_id 
                AND leave_type_id = NEW.leave_type_id
                AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER
                AND month = EXTRACT(MONTH FROM NEW.start_date)::INTEGER;
        END IF;
        
        -- If days changed (half-day toggle or date change), update the difference
        IF OLD.status IN ('approved', 'pending') AND NEW.status IN ('approved', 'pending') 
           AND COALESCE(v_old_days_used, 1) != COALESCE(v_days_used, 1) THEN
            UPDATE user_monthly_leave_balances 
            SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - COALESCE(v_old_days_used, 1) + COALESCE(v_days_used, 1)),
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
        SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - COALESCE(v_old_days_used, 1)),
            updated_at = now()
        WHERE user_id = OLD.user_id 
            AND leave_type_id = OLD.leave_type_id
            AND year = EXTRACT(YEAR FROM OLD.start_date)::INTEGER
            AND month = EXTRACT(MONTH FROM OLD.start_date)::INTEGER;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the monthly leave limit validation function
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
    
    -- Calculate days for this request - Fix the calculation here too
    IF NEW.is_half_day THEN
        v_new_request_days := 0.5;
    ELSE
        -- Fix: Use DATE arithmetic instead of EXTRACT(DAY FROM interval)
        v_new_request_days := (NEW.end_date - NEW.start_date) + 1;
    END IF;
    
    -- Get current month's usage
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

-- Fix the existing balance record to show correct value
UPDATE user_monthly_leave_balances 
SET used_balance = 1 
WHERE used_balance = 2 
  AND allocated_balance = 1.5
  AND year = 2025 
  AND month = 7;
