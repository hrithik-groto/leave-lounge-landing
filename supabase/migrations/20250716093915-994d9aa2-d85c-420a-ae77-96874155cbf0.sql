-- Create a trigger function to handle leave status changes
CREATE OR REPLACE FUNCTION public.handle_leave_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on status changes to approved or rejected
  IF OLD.status IS DISTINCT FROM NEW.status AND 
     NEW.status IN ('approved', 'rejected') THEN
    
    -- Call the edge function to send notifications
    PERFORM
      net.http_post(
        url := 'https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/leave-status-notification',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYwNzM0OCwiZXhwIjoyMDY0MTgzMzQ4fQ.Wn5U8w9Ur_VxOmjPl0X_POvNGFUODrMCzS6ckfMZGQQ"}'::jsonb,
        body := json_build_object(
          'leave_request_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'user_id', NEW.user_id,
          'approved_by', NEW.approved_by
        )::jsonb
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER leave_status_change_trigger
  AFTER UPDATE ON public.leave_applied_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_status_change();