-- Set up cron jobs for Slack notifications

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily notifications at 10:30 AM IST (5:00 AM UTC)
SELECT cron.schedule(
  'daily-slack-notifications',
  '0 5 * * *', -- 5:00 AM UTC = 10:30 AM IST
  $$
  select
    net.http_post(
        url:='https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-daily-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MDczNDgsImV4cCI6MjA2NDE4MzM0OH0.Yf93RMh47SeULrhm3qHgHu54DtYiH__6DAFf90iJ5A4"}'::jsonb,
        body:='{"time": "daily"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule mid-day notifications every 30 minutes during working hours (5:00 AM to 12:00 PM UTC = 10:30 AM to 5:30 PM IST)
SELECT cron.schedule(
  'midday-slack-notifications',
  '*/30 5-12 * * 1-5', -- Every 30 minutes from 5:00 AM to 12:00 PM UTC, Monday to Friday
  $$
  select
    net.http_post(
        url:='https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/slack-midday-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MDczNDgsImV4cCI6MjA2NDE4MzM0OH0.Yf93RMh47SeULrhm3qHgHu54DtYiH__6DAFf90iJ5A4"}'::jsonb,
        body:='{"time": "midday"}'::jsonb
    ) as request_id;
  $$
);

-- Check existing cron jobs
SELECT * FROM cron.job;