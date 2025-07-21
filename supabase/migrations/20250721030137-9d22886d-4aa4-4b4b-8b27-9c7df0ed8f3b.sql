
-- Create a trigger function to send email notifications when leave is approved
CREATE OR REPLACE FUNCTION public.handle_leave_approval_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to approved
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved' THEN
    -- Call the edge function to send approval email
    PERFORM
      net.http_post(
        url := 'https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/send-leave-approval-email',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYwNzM0OCwiZXhwIjoyMDY0MTgzMzQ4fQ.Wn5U8w9Ur_VxOmjPl0X_POvNGFUODrMCzS6ckfMZGQQ"}'::jsonb,
        body := json_build_object(
          'leave_request_id', NEW.id,
          'user_id', NEW.user_id,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date,
          'leave_type_id', NEW.leave_type_id,
          'reason', NEW.reason
        )::jsonb
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger for leave approval emails
CREATE TRIGGER leave_approval_email_trigger
  AFTER UPDATE ON public.leave_applied_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_approval_email();
