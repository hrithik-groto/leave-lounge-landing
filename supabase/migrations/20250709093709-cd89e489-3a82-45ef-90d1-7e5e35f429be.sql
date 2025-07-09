-- Update the get_monthly_leave_balance function to properly handle the new 7.5 leaves/month system
CREATE OR REPLACE FUNCTION public.get_monthly_leave_balance(
    p_user_id text, 
    p_leave_type_id uuid, 
    p_month integer DEFAULT EXTRACT(month FROM CURRENT_DATE), 
    p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- Create a function to get total remaining leaves for a user across all leave types
CREATE OR REPLACE FUNCTION public.get_total_remaining_leaves(
    p_user_id text, 
    p_month integer DEFAULT EXTRACT(month FROM CURRENT_DATE), 
    p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_total_remaining NUMERIC := 0;
    v_leave_type RECORD;
    v_balance jsonb;
BEGIN
    -- Loop through all active leave types
    FOR v_leave_type IN 
        SELECT id, label FROM leave_types WHERE is_active = true
    LOOP
        -- Get balance for this leave type
        SELECT public.get_monthly_leave_balance(p_user_id, v_leave_type.id, p_month, p_year)
        INTO v_balance;
        
        -- Add to total remaining (convert hours to days for calculation: 8 hours = 1 day)
        IF (v_balance->>'duration_type') = 'hours' THEN
            v_total_remaining := v_total_remaining + (COALESCE((v_balance->>'remaining_this_month')::numeric, 0) / 8);
        ELSE
            v_total_remaining := v_total_remaining + COALESCE((v_balance->>'remaining_this_month')::numeric, 0);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'total_remaining_days', v_total_remaining,
        'all_exhausted', v_total_remaining <= 0
    );
END;
$function$;