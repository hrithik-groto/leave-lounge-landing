
-- Create table to track token updates if it doesn't exist
CREATE TABLE IF NOT EXISTS public.slack_token_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  old_token TEXT,
  new_token TEXT NOT NULL,
  refresh_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'pending_update',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.slack_token_updates ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view token updates
CREATE POLICY "Admins can view token updates" 
  ON public.slack_token_updates 
  FOR SELECT 
  USING (true); -- You may want to restrict this to admin users only

-- Schedule automatic Slack token refresh every 10 hours
SELECT cron.schedule(
  'refresh-slack-token-job',
  '0 */10 * * *', -- Every 10 hours
  $$
  select
    net.http_post(
        url:='https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/refresh-slack-token',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYwNzM0OCwiZXhwIjoyMDY0MTgzMzQ4fQ.Wn5U8w9Ur_VxOmjPl0X_POvNGFUODrMCzS6ckfMZGQQ"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Check existing cron jobs to verify the job was created
SELECT * FROM cron.job WHERE jobname = 'refresh-slack-token-job';
