-- Clean up all existing HTTP functions and triggers to fix the conflicts
DROP FUNCTION IF EXISTS public.http_post(text, json, json) CASCADE;
DROP FUNCTION IF EXISTS public.http_post(url text, headers json, body json) CASCADE;
DROP FUNCTION IF EXISTS public.http_post_json(url text, headers text, body text) CASCADE;
DROP FUNCTION IF EXISTS public.http_request(method text, url text, headers json, body text) CASCADE;
DROP FUNCTION IF EXISTS public.notify_slack_leave() CASCADE;
DROP FUNCTION IF EXISTS public.notify_slack_on_leave() CASCADE;
DROP FUNCTION IF EXISTS public.call_slack_webhook() CASCADE;

-- Remove any triggers that might be calling these functions
DROP TRIGGER IF EXISTS notify_slack_on_leave_trigger ON leave_applied_users;
DROP TRIGGER IF EXISTS slack_notification_trigger ON leave_applied_users;
DROP TRIGGER IF EXISTS call_slack_webhook_trigger ON leave_applied_users;

-- The leave application should work through the Edge Function only
-- No database triggers needed since we handle Slack notifications in the application code