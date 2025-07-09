
-- Update the leave balance functions to handle specific monthly allowances per leave type
CREATE OR REPLACE FUNCTION public.get_monthly_leave_balance(
    p_user_id text, 
    p_leave_type_id uuid, 
    p_month integer DEFAULT EXTRACT(month FROM CURRENT_DATE)::integer, 
    p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_used_this_month NUMERIC := 0;
    v_leave_type_label TEXT;
    v_duration_type TEXT;
    v_monthly_allowance NUMERIC;
BEGIN
    -- Get leave type info and set specific monthly allowances
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

    -- Calculate used leave for this specific leave type this month
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
$$;

-- Update the total remaining leaves function
CREATE OR REPLACE FUNCTION public.get_total_remaining_leaves(
    p_user_id text, 
    p_month integer DEFAULT EXTRACT(month FROM CURRENT_DATE)::integer, 
    p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_paid_leave_used NUMERIC := 0;
    v_wfh_used NUMERIC := 0;
    v_short_leave_used NUMERIC := 0;
    v_total_allowance NUMERIC := 7.5; -- 1.5 + 2 + 4 = 7.5
    v_total_used NUMERIC := 0;
BEGIN
    -- Get Paid Leave usage (convert to days)
    SELECT COALESCE(SUM(EXTRACT(DAY FROM (end_date::date - start_date::date)) + 1), 0)
    INTO v_paid_leave_used
    FROM leave_applied_users lau
    JOIN leave_types lt ON lau.leave_type_id = lt.id
    WHERE lau.user_id = p_user_id 
        AND lt.label = 'Paid Leave'
        AND EXTRACT(MONTH FROM lau.start_date::date)::integer = p_month
        AND EXTRACT(YEAR FROM lau.start_date::date)::integer = p_year
        AND lau.status != 'rejected';

    -- Get Work From Home usage (convert to days)
    SELECT COALESCE(SUM(EXTRACT(DAY FROM (end_date::date - start_date::date)) + 1), 0)
    INTO v_wfh_used
    FROM leave_applied_users lau
    JOIN leave_types lt ON lau.leave_type_id = lt.id
    WHERE lau.user_id = p_user_id 
        AND lt.label = 'Work From Home'
        AND EXTRACT(MONTH FROM lau.start_date::date)::integer = p_month
        AND EXTRACT(YEAR FROM lau.start_date::date)::integer = p_year
        AND lau.status != 'rejected';

    -- Get Short Leave usage (convert hours to days: 8 hours = 1 day)
    SELECT COALESCE(SUM(COALESCE(lau.hours_requested, 1)) / 8.0, 0)
    INTO v_short_leave_used
    FROM leave_applied_users lau
    JOIN leave_types lt ON lau.leave_type_id = lt.id
    WHERE lau.user_id = p_user_id 
        AND lt.label = 'Short Leave'
        AND EXTRACT(MONTH FROM lau.start_date::date)::integer = p_month
        AND EXTRACT(YEAR FROM lau.start_date::date)::integer = p_year
        AND lau.status != 'rejected';

    v_total_used := v_paid_leave_used + v_wfh_used + v_short_leave_used;

    RETURN jsonb_build_object(
        'total_remaining_days', GREATEST(0, v_total_allowance - v_total_used),
        'total_used_days', v_total_used,
        'total_allowance', v_total_allowance,
        'paid_leave_used', v_paid_leave_used,
        'wfh_used', v_wfh_used,
        'short_leave_used', v_short_leave_used,
        'paid_leave_remaining', GREATEST(0, 1.5 - v_paid_leave_used),
        'wfh_remaining', GREATEST(0, 2 - v_wfh_used),
        'short_leave_remaining', GREATEST(0, 4 - (v_short_leave_used * 8)),
        'all_exhausted', v_total_used >= v_total_allowance
    );
END;
$$;
