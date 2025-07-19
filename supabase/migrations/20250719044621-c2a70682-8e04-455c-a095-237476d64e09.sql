-- Create table to track Slack token updates
CREATE TABLE IF NOT EXISTS public.slack_token_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_token TEXT NOT NULL,
  new_token TEXT NOT NULL,
  refresh_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_update',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.slack_token_updates ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only
CREATE POLICY "Admin can manage token updates" 
ON public.slack_token_updates 
FOR ALL 
USING ((auth.uid())::text = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');

-- Create admin invites table
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on admin invites
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Create policies for admin invites
CREATE POLICY "Admin can manage invites" 
ON public.admin_invites 
FOR ALL 
USING ((auth.uid())::text = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');

CREATE POLICY "Users can view their own invites" 
ON public.admin_invites 
FOR SELECT 
USING (email = (SELECT email FROM profiles WHERE id = (auth.uid())::text));

-- Create function to schedule Slack token refresh
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the refresh function to run every 10 hours
SELECT cron.schedule(
  'slack-token-refresh',
  '0 */10 * * *', -- Every 10 hours
  $$
  SELECT net.http_post(
    url := 'https://ppuyedxxfcijdfeqpwfj.supabase.co/functions/v1/refresh-slack-token',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXllZHh4ZmNpamRmZXFwd2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYwNzM0OCwiZXhwIjoyMDY0MTgzMzQ4fQ.Wn5U8w9Ur_VxOmjPl0X_POvNGFUODrMCzS6ckfMZGQQ"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) as request_id;
  $$
);