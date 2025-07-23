
-- Fix the trigger function to ensure used_balance is never null
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
        
        -- Now update the balance with proper NULL handling, ensuring used_balance is never null
        UPDATE user_monthly_leave_balances 
        SET used_balance = COALESCE(used_balance, 0) + COALESCE(v_days_used, 0),
            updated_at = now()
        WHERE user_id = NEW.user_id 
            AND leave_type_id = NEW.leave_type_id
            AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER
            AND month = EXTRACT(MONTH FROM NEW.start_date)::INTEGER;
            
        -- If no rows were updated, create the balance record manually with non-null values
        IF NOT FOUND THEN
            INSERT INTO user_monthly_leave_balances (
                user_id, leave_type_id, year, month,
                allocated_balance, used_balance, carried_forward
            ) VALUES (
                NEW.user_id, NEW.leave_type_id,
                EXTRACT(YEAR FROM NEW.start_date)::INTEGER,
                EXTRACT(MONTH FROM NEW.start_date)::INTEGER,
                1.5, COALESCE(v_days_used, 0), 0
            );
        END IF;
    END IF;
    
    -- Handle UPDATE (status change or modification)
    IF TG_OP = 'UPDATE' THEN
        -- If status changed from pending/approved to rejected, subtract the days
        IF OLD.status IN ('approved', 'pending') AND NEW.status = 'rejected' THEN
            UPDATE user_monthly_leave_balances 
            SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - COALESCE(v_old_days_used, 0)),
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
            SET used_balance = COALESCE(used_balance, 0) + COALESCE(v_days_used, 0),
                updated_at = now()
            WHERE user_id = NEW.user_id 
                AND leave_type_id = NEW.leave_type_id
                AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER
                AND month = EXTRACT(MONTH FROM NEW.start_date)::INTEGER;
        END IF;
        
        -- If days changed (half-day toggle or date change), update the difference
        IF OLD.status IN ('approved', 'pending') AND NEW.status IN ('approved', 'pending') 
           AND COALESCE(v_old_days_used, 0) != COALESCE(v_days_used, 0) THEN
            UPDATE user_monthly_leave_balances 
            SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - COALESCE(v_old_days_used, 0) + COALESCE(v_days_used, 0)),
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
        SET used_balance = GREATEST(0, COALESCE(used_balance, 0) - COALESCE(v_old_days_used, 0)),
            updated_at = now()
        WHERE user_id = OLD.user_id 
            AND leave_type_id = OLD.leave_type_id
            AND year = EXTRACT(YEAR FROM OLD.start_date)::INTEGER
            AND month = EXTRACT(MONTH FROM OLD.start_date)::INTEGER;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the get_or_create_monthly_balance function to ensure it never returns null values
CREATE OR REPLACE FUNCTION public.get_or_create_monthly_balance(
    p_user_id TEXT,
    p_leave_type_id UUID,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance RECORD;
    v_prev_balance RECORD;
    v_monthly_allocation NUMERIC := 1.5; -- For paid leave
    v_leave_type_label TEXT;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = p_leave_type_id;
    
    -- Only process for Paid Leave
    IF v_leave_type_label != 'Paid Leave' THEN
        RETURN jsonb_build_object(
            'error', 'This function only handles Paid Leave',
            'leave_type', v_leave_type_label
        );
    END IF;
    
    -- Try to get existing balance
    SELECT * INTO v_balance
    FROM user_monthly_leave_balances
    WHERE user_id = p_user_id 
        AND leave_type_id = p_leave_type_id
        AND year = p_year 
        AND month = p_month;
    
    -- If balance doesn't exist, create it
    IF v_balance IS NULL THEN
        -- Get previous month's balance for carryforward calculation
        SELECT * INTO v_prev_balance
        FROM user_monthly_leave_balances
        WHERE user_id = p_user_id 
            AND leave_type_id = p_leave_type_id
            AND (
                (year = p_year AND month = p_month - 1) OR
                (year = p_year - 1 AND month = 12 AND p_month = 1)
            );
        
        -- Calculate carryforward (unused balance from previous month)
        DECLARE
            v_carryforward NUMERIC := 0;
        BEGIN
            IF v_prev_balance IS NOT NULL THEN
                v_carryforward := GREATEST(0, COALESCE(v_prev_balance.allocated_balance, 0) - COALESCE(v_prev_balance.used_balance, 0));
            END IF;
            
            -- Insert new monthly balance with proper NULL handling, ensuring no null values
            INSERT INTO user_monthly_leave_balances (
                user_id, leave_type_id, year, month, 
                allocated_balance, used_balance, carried_forward
            ) VALUES (
                p_user_id, p_leave_type_id, p_year, p_month,
                COALESCE(v_monthly_allocation + v_carryforward, 1.5), 
                0, -- Always start with 0 used balance
                COALESCE(v_carryforward, 0)
            );
            
            -- Get the newly created balance
            SELECT * INTO v_balance
            FROM user_monthly_leave_balances
            WHERE user_id = p_user_id 
                AND leave_type_id = p_leave_type_id
                AND year = p_year 
                AND month = p_month;
        END;
    END IF;
    
    RETURN jsonb_build_object(
        'allocated_balance', COALESCE(v_balance.allocated_balance, 0),
        'used_balance', COALESCE(v_balance.used_balance, 0),
        'remaining_balance', COALESCE(v_balance.allocated_balance, 0) - COALESCE(v_balance.used_balance, 0),
        'carried_forward', COALESCE(v_balance.carried_forward, 0),
        'monthly_allocation', v_monthly_allocation,
        'year', COALESCE(v_balance.year, p_year),
        'month', COALESCE(v_balance.month, p_month)
    );
END;
$$;
