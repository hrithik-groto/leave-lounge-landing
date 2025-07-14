-- Test the daily Slack notification function by manually triggering it
-- This will show us any errors in the function
SELECT
  net.http_post(
      url:='https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-daily-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MDczNDgsImV4cCI6MjA2NDE4MzM0OH0.Yf93RMh47SeULrhm3qHgHu54DtYiH__6DAFf90iJ5A4"}'::jsonb,
      body:='{"trigger": "manual_test"}'::jsonb
  ) as test_request_id;