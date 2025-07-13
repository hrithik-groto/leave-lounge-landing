-- Enable pg_cron and pg_net extensions for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to send daily leave notifications at 10:30 AM IST (5:00 AM UTC)
-- Note: Cron times are in UTC, so 10:30 AM IST = 5:00 AM UTC
SELECT cron.schedule(
  'daily-leave-notifications',
  '30 5 * * 1-6',  -- 5:30 AM UTC (11:00 AM IST) Monday to Saturday (excludes Sunday)
  $$
  SELECT
    net.http_post(
        url:='https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-daily-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MDczNDgsImV4cCI6MjA2NDE4MzM0OH0.Yf93RMh47SeULrhm3qHgHu54DtYiH__6DAFf90iJ5A4"}'::jsonb,
        body:='{"trigger": "cron", "time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);