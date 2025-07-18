-- Create a trigger to automatically send Slack notifications when leave applications are created or updated
CREATE OR REPLACE FUNCTION public.handle_slack_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    leave_app_with_details RECORD;
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

    -- For new applications (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Send notification for new application (pending status)
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
        RETURN NEW;
    END IF;

    -- For status updates (UPDATE)
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
                'sendToAllUsersChannel', false
            )::jsonb
        );
        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS slack_notification_trigger ON leave_applied_users;

-- Create the trigger for both INSERT and UPDATE operations
CREATE TRIGGER slack_notification_trigger
    AFTER INSERT OR UPDATE ON leave_applied_users
    FOR EACH ROW
    EXECUTE FUNCTION handle_slack_notification_trigger();