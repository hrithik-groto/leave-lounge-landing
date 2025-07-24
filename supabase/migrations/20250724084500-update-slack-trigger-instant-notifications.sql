
-- Update the Slack notification trigger to send instant notifications to all users channel
-- when someone applies for leave during working hours

DROP TRIGGER IF EXISTS slack_notification_trigger ON leave_applied_users;
DROP FUNCTION IF EXISTS public.handle_slack_notification_trigger();

CREATE OR REPLACE FUNCTION public.handle_slack_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    leave_app_with_details RECORD;
    current_ist_time TIME;
    current_day TEXT;
    is_working_hours BOOLEAN;
BEGIN
    -- Get the leave application with related data
    SELECT 
        lau.*,
        p.name as user_name,
        p.email as user_email,
        lt.label as leave_type_label,
        lt.color as leave_type_color
    INTO leave_app_with_details
    FROM leave_applied_users lau
    LEFT JOIN profiles p ON lau.user_id = p.id
    LEFT JOIN leave_types lt ON lau.leave_type_id = lt.id
    WHERE lau.id = COALESCE(NEW.id, OLD.id);

    -- Check if it's working hours in IST (10:30 AM - 5:30 PM, Monday-Friday)
    current_ist_time := (now() AT TIME ZONE 'Asia/Kolkata')::TIME;
    current_day := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'Day');
    
    is_working_hours := (
        current_ist_time >= '10:30'::TIME AND 
        current_ist_time <= '17:30'::TIME AND 
        TRIM(current_day) NOT IN ('Saturday', 'Sunday')
    );

    -- For new applications (INSERT) - send instant notification to all users channel
    IF TG_OP = 'INSERT' THEN
        -- Always send admin notification
        PERFORM net.http_post(
            url := 'https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-notify',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYwNzM0OCwiZXhwIjoyMDY0MTgzMzQ4fQ.Wn5U8w9Ur_VxOmjPl0X_POvNGFUODrMCzS6ckfMZGQQ"}'::jsonb,
            body := json_build_object(
                'leaveApplication', to_jsonb(leave_app_with_details),
                'isApprovalUpdate', false,
                'sendToAdminChannel', true,
                'sendToUser', false,
                'sendToAllUsersChannel', false
            )::jsonb
        );

        -- Send instant notification to all users channel if it's working hours
        IF is_working_hours THEN
            PERFORM net.http_post(
                url := 'https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-midday-notifications',
                headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYwNzM0OCwiZXhwIjoyMDY0MTgzMzQ4fQ.Wn5U8w9Ur_VxOmjPl0X_POvNGFUODrMCzS6ckfMZGQQ"}'::jsonb,
                body := json_build_object(
                    'leaveApplication', to_jsonb(leave_app_with_details),
                    'isInstantNotification', true
                )::jsonb
            );
        END IF;
        
        RETURN NEW;
    END IF;

    -- For status updates (UPDATE) - handle approval/rejection notifications
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Send notification for status change (approved/rejected)
        PERFORM net.http_post(
            url := 'https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-notify',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYwNzM0OCwiZXhwIjoyMDY0MTgzMzQ4fQ.Wn5U8w9Ur_VxOmjPl0X_POvNGFUODrMCzS6ckfMZGQQ"}'::jsonb,
            body := json_build_object(
                'leaveApplication', to_jsonb(leave_app_with_details),
                'isApprovalUpdate', true,
                'sendToAdminChannel', true,
                'sendToUser', true,
                'sendToAllUsersChannel', (NEW.status = 'approved')
            )::jsonb
        );
        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the trigger
CREATE TRIGGER slack_notification_trigger
    AFTER INSERT OR UPDATE ON leave_applied_users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_slack_notification_trigger();
