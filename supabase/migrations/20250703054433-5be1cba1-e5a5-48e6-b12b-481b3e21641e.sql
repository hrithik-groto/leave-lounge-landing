-- Create table to store user Slack information
CREATE TABLE IF NOT EXISTS public.user_slack_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  slack_team_id TEXT NOT NULL,
  access_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, slack_team_id)
);

-- Enable RLS
ALTER TABLE public.user_slack_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own Slack integrations" 
ON public.user_slack_integrations 
FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own Slack integrations" 
ON public.user_slack_integrations 
FOR UPDATE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own Slack integrations" 
ON public.user_slack_integrations 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_user_slack_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_slack_integrations_updated_at
BEFORE UPDATE ON public.user_slack_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_user_slack_integrations_updated_at();