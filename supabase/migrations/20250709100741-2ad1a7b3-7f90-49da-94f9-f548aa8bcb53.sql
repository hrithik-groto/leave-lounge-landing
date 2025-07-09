-- Update the get_monthly_leave_balance function to use a unified 7.5 leaves per month system
DROP FUNCTION IF EXISTS public.get_monthly_leave_balance(text, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_monthly_leave_balance(
    p_user_id text, 
    p_leave_type_id uuid, 
    p_month integer DEFAULT EXTRACT(month FROM CURRENT_DATE)::integer, 
    p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_used_this_month NUMERIC := 0;
    v_leave_type_label TEXT;
    v_duration_type TEXT;
    v_total_monthly_allowance NUMERIC := 7.5; -- Total 7.5 days per month for all leave types combined
    v_total_used_all_types NUMERIC := 0;
BEGIN
    -- Get leave type info
    SELECT 
        lt.label,
        CASE 
            WHEN lt.label = 'Short Leave' THEN 'hours'
            ELSE 'days'
        END
    INTO v_leave_type_label, v_duration_type
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

    -- Calculate total used across all leave types this month (convert hours to days: 8 hours = 1 day)
    SELECT COALESCE(
        SUM(
            CASE 
                WHEN lau.leave_duration_type = 'hours' THEN COALESCE(lau.hours_requested, 1) / 8.0
                ELSE EXTRACT(DAY FROM (lau.end_date::date - lau.start_date::date)) + 1
            END
        ), 0
    )
    INTO v_total_used_all_types
    FROM leave_applied_users lau
    WHERE lau.user_id = p_user_id 
        AND EXTRACT(MONTH FROM lau.start_date::date)::integer = p_month
        AND EXTRACT(YEAR FROM lau.start_date::date)::integer = p_year
        AND lau.status != 'rejected';

    RETURN jsonb_build_object(
        'leave_type', v_leave_type_label,
        'duration_type', v_duration_type,
        'monthly_allowance', v_total_monthly_allowance,
        'used_this_month', 
        CASE 
            WHEN v_duration_type = 'hours' THEN v_used_this_month
            ELSE v_used_this_month
        END,
        'remaining_this_month', GREATEST(0, v_total_monthly_allowance - v_total_used_all_types),
        'total_used_all_types', v_total_used_all_types
    );
END;
$function$;

-- Update the get_total_remaining_leaves function to work with the unified 7.5 system
DROP FUNCTION IF EXISTS public.get_total_remaining_leaves(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_total_remaining_leaves(
    p_user_id text, 
    p_month integer DEFAULT EXTRACT(month FROM CURRENT_DATE)::integer, 
    p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_total_monthly_allowance NUMERIC := 7.5; -- Total 7.5 days per month for all leave types combined
    v_total_used_all_types NUMERIC := 0;
BEGIN
    -- Calculate total used across all leave types this month (convert hours to days: 8 hours = 1 day)
    SELECT COALESCE(
        SUM(
            CASE 
                WHEN lau.leave_duration_type = 'hours' THEN COALESCE(lau.hours_requested, 1) / 8.0
                ELSE EXTRACT(DAY FROM (lau.end_date::date - lau.start_date::date)) + 1
            END
        ), 0
    )
    INTO v_total_used_all_types
    FROM leave_applied_users lau
    WHERE lau.user_id = p_user_id 
        AND EXTRACT(MONTH FROM lau.start_date::date)::integer = p_month
        AND EXTRACT(YEAR FROM lau.start_date::date)::integer = p_year
        AND lau.status != 'rejected';

    RETURN jsonb_build_object(
        'total_remaining_days', GREATEST(0, v_total_monthly_allowance - v_total_used_all_types),
        'total_used_days', v_total_used_all_types,
        'total_allowance', v_total_monthly_allowance,
        'all_exhausted', v_total_used_all_types >= v_total_monthly_allowance
    );
END;
$function$;