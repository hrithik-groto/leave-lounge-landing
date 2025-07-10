-- First, let's clear existing leave types and policies to start fresh
DELETE FROM public.leave_policies;
DELETE FROM public.leave_types;

-- Create the new leave types with proper configuration
INSERT INTO public.leave_types (id, label, color, accrual_rule, requires_approval, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Paid Leave', '#10B981', 'monthly', true, true),
('550e8400-e29b-41d4-a716-446655440002', 'Work From Home', '#3B82F6', 'monthly', false, true),
('550e8400-e29b-41d4-a716-446655440003', 'Short Leave', '#F59E0B', 'monthly', false, true);

-- Create leave policies for each type with monthly allowances
INSERT INTO public.leave_policies (leave_type_id, annual_allowance, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 18, true), -- 1.5 per month * 12 months = 18 days
('550e8400-e29b-41d4-a716-446655440002', 24, true), -- 2 per month * 12 months = 24 days  
('550e8400-e29b-41d4-a716-446655440003', 48, true); -- 4 per month * 12 months = 48 hours

-- Add new columns to leave_applied_users for better leave tracking
ALTER TABLE public.leave_applied_users 
ADD COLUMN IF NOT EXISTS leave_duration_type VARCHAR(10) DEFAULT 'days' CHECK (leave_duration_type IN ('days', 'hours')),
ADD COLUMN IF NOT EXISTS leave_time_start TIME,
ADD COLUMN IF NOT EXISTS leave_time_end TIME;

-- Create a function to calculate monthly leave balance
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
    v_monthly_allowance NUMERIC;
    v_used_this_month NUMERIC := 0;
    v_leave_type_label TEXT;
    v_duration_type TEXT;
BEGIN
    -- Get leave type info and monthly allowance
    SELECT 
        lt.label,
        CASE 
            WHEN lt.label = 'Short Leave' THEN 'hours'
            ELSE 'days'
        END,
        CASE 
            WHEN lt.label = 'Paid Leave' THEN 1.5
            WHEN lt.label = 'Work From Home' THEN 2
            WHEN lt.label = 'Short Leave' THEN 4
            ELSE 0
        END
    INTO v_leave_type_label, v_duration_type, v_monthly_allowance
    FROM leave_types lt
    WHERE lt.id = p_leave_type_id;

    -- Calculate used leave for this month
    SELECT COALESCE(
        CASE 
            WHEN v_duration_type = 'hours' THEN SUM(COALESCE(hours_requested, 1))
            ELSE SUM(EXTRACT(DAY FROM (end_date - start_date)) + 1)
        END, 0
    )
    INTO v_used_this_month
    FROM leave_applied_users
    WHERE user_id = p_user_id 
        AND leave_type_id = p_leave_type_id
        AND EXTRACT(MONTH FROM start_date) = p_month
        AND EXTRACT(YEAR FROM start_date) = p_year
        AND status != 'rejected';

    RETURN jsonb_build_object(
        'leave_type', v_leave_type_label,
        'duration_type', v_duration_type,
        'monthly_allowance', v_monthly_allowance,
        'used_this_month', v_used_this_month,
        'remaining_this_month', v_monthly_allowance - v_used_this_month
    );
END;
$$;