-- Update RLS policies for user_slack_integrations to allow system insertions

-- Drop existing restrictive policies that might be blocking insertions
DROP POLICY IF EXISTS "Users can insert their own Slack integrations" ON public.user_slack_integrations;
DROP POLICY IF EXISTS "Users can view their own Slack integrations" ON public.user_slack_integrations;
DROP POLICY IF EXISTS "Users can update their own Slack integrations" ON public.user_slack_integrations;

-- Create new policies that work with the OAuth flow
CREATE POLICY "Allow insertions for Slack OAuth" 
ON public.user_slack_integrations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own Slack integrations" 
ON public.user_slack_integrations 
FOR SELECT 
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own Slack integrations" 
ON public.user_slack_integrations 
FOR UPDATE 
USING (user_id = auth.uid()::text);