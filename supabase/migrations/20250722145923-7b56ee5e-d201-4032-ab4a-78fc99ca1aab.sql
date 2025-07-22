
-- Fix the trigger function to handle NULL values and ensure balance exists before update
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
        IF NEW.is_half_day THEN
            v_days_used := 0.5;
        ELSE
            v_days_used := EXTRACT(DAY FROM (NEW.end_date - NEW.start_date)) + 1;
        END IF;
        NEW.actual_days_used := v_days_used;
    END IF;
    
    -- Get old days used for updates
    IF OLD IS NOT NULL AND OLD.actual_days_used IS NOT NULL THEN
        v_old_days_used := OLD.actual_days_used;
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
        
        -- Now update the balance
        UPDATE user_monthly_leave_balances 
        SET used_balance = COALESCE(used_balance, 0) + v_days_used,
            updated_at = now()
        WHERE user_id = NEW.user_id 
            AND leave_type_id = NEW.leave_type_id
            AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER
            AND month = EXTRACT(MONTH FROM NEW.start_date)::INTEGER;
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

-- Drop and recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS monthly_balance_trigger ON leave_applied_users;
CREATE TRIGGER monthly_balance_trigger
    AFTER INSERT OR UPDATE OR DELETE ON leave_applied_users
    FOR EACH ROW
    EXECUTE FUNCTION update_monthly_balance_on_leave_change();
