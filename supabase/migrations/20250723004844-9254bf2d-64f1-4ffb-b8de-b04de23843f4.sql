
-- Insert the new leave type 'Additional work from home'
INSERT INTO public.leave_types (id, label, color, accrual_rule, requires_approval, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440004', 'Additional work from home', '#8B5CF6', 'monthly', true, true);

-- Create leave policy for Additional work from home (no monthly limit, set to a high number)
INSERT INTO public.leave_policies (leave_type_id, annual_allowance, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440004', 999, true);

-- Update the get_monthly_leave_balance function to handle Additional work from home
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
BEGIN
    -- Get leave type info
    SELECT label INTO v_leave_type_label
    FROM leave_types 
    WHERE id = p_leave_type_id;
    
    -- For Additional work from home, check if regular WFH is exhausted
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
            
            -- Calculate used Additional WFH for this month
            DECLARE
                v_used_additional_wfh NUMERIC := 0;
            BEGIN
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN is_half_day THEN 0.5
                        ELSE EXTRACT(DAY FROM (end_date::date - start_date::date)) + 1
                    END
                ), 0)
                INTO v_used_additional_wfh
                FROM leave_applied_users
                WHERE user_id = p_user_id 
                    AND leave_type_id = p_leave_type_id
                    AND EXTRACT(MONTH FROM start_date::date)::integer = p_month
                    AND EXTRACT(YEAR FROM start_date::date)::integer = p_year
                    AND status IN ('approved', 'pending');
                
                RETURN jsonb_build_object(
                    'leave_type', v_leave_type_label,
                    'duration_type', 'days',
                    'monthly_allowance', 999,
                    'used_this_month', v_used_additional_wfh,
                    'remaining_this_month', 999,
                    'can_apply', (v_wfh_remaining <= 0),
                    'wfh_remaining', v_wfh_remaining
                );
            END;
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
