-- Create trigger function to create notifications when leave status changes
CREATE OR REPLACE FUNCTION create_leave_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for leave application creation
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      NEW.user_id,
      'Your leave application has been submitted and is pending approval.',
      'info'
    );
    RETURN NEW;
  END IF;

  -- Insert notification for leave status updates
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN
        INSERT INTO notifications (user_id, message, type)
        VALUES (
          NEW.user_id,
          'Great news! Your leave application has been approved.',
          'success'
        );
      WHEN 'rejected' THEN
        INSERT INTO notifications (user_id, message, type)
        VALUES (
          NEW.user_id,
          'Your leave application has been rejected. Please contact your manager for details.',
          'error'
        );
    END CASE;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for leave application notifications
DROP TRIGGER IF EXISTS leave_notification_trigger ON leave_applied_users;
CREATE TRIGGER leave_notification_trigger
  AFTER INSERT OR UPDATE ON leave_applied_users
  FOR EACH ROW
  EXECUTE FUNCTION create_leave_notification();

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;