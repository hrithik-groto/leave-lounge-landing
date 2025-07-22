
-- Add a new leave type for Annual Leave if it doesn't exist
INSERT INTO public.leave_types (id, label, color, accrual_rule, requires_approval, is_active) 
VALUES ('550e8400-e29b-41d4-a716-446655440004', 'Annual Leave', '#8B5CF6', 'annual', true, true)
ON CONFLICT (id) DO NOTHING;

-- Create leave policy for Annual Leave with 18 days allowance
INSERT INTO public.leave_policies (leave_type_id, annual_allowance, is_active) 
VALUES ('550e8400-e29b-41d4-a716-446655440004', 18, true)
ON CONFLICT (leave_type_id) DO NOTHING;

-- Create a new table to track annual leave balances for each user
CREATE TABLE IF NOT EXISTS public.user_annual_leave_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  allocated_balance NUMERIC NOT NULL DEFAULT 18, -- 18 annual leaves per year
  used_balance NUMERIC NOT NULL DEFAULT 0,
  remaining_balance NUMERIC GENERATED ALWAYS AS (allocated_balance - used_balance) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_type_id, year)
);

-- Enable RLS
ALTER TABLE public.user_annual_leave_balances ENABLE ROW LEVEL SECURITY;

-- Create policies for annual leave balances
CREATE POLICY "Users can view their own annual leave balances" 
  ON public.user_annual_leave_balances 
  FOR SELECT 
  USING (user_id = (auth.uid())::text);

CREATE POLICY "System can manage annual leave balances" 
  ON public.user_annual_leave_balances 
  FOR ALL 
  USING (true);

-- Function to initialize annual leave balance for a user
CREATE OR REPLACE FUNCTION public.get_or_create_annual_balance(
    p_user_id TEXT,
    p_leave_type_id UUID,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance RECORD;
    v_leave_type_label TEXT;
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = p_leave_type_id;
    
    -- Only process for Annual Leave
    IF v_leave_type_label != 'Annual Leave' THEN
        RETURN jsonb_build_object(
            'error', 'This function only handles Annual Leave',
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
            p_user_id, p_leave_type_id, p_year, 18, 0
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
        'remaining_balance', v_balance.remaining_balance,
        'year', v_balance.year
    );
END;
$$;

-- Function to update annual leave balance when leave is applied/approved
CREATE OR REPLACE FUNCTION public.update_annual_balance_on_leave_change()
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
    
    -- Only process for Annual Leave
    IF v_leave_type_label != 'Annual Leave' THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for annual balance updates
DROP TRIGGER IF EXISTS annual_balance_trigger ON leave_applied_users;
CREATE TRIGGER annual_balance_trigger
    AFTER INSERT OR UPDATE OR DELETE ON leave_applied_users
    FOR EACH ROW
    EXECUTE FUNCTION update_annual_balance_on_leave_change();

-- Update the get_monthly_leave_balance function to handle Annual Leave
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
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = p_leave_type_id;
    
    -- For Annual Leave, use the new annual balance system
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
