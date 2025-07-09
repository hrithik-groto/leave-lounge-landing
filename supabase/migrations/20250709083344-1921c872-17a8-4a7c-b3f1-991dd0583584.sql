-- Drop existing table and recreate with fixed RLS policies
DROP TABLE IF EXISTS public.leave_requests_additional CASCADE;
DROP TABLE IF EXISTS public.admin_granted_leaves CASCADE;

-- Create leave requests table for additional leave requests when user has exhausted balance
CREATE TABLE public.leave_requests_additional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  leave_type_id UUID NOT NULL,
  requested_amount NUMERIC NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add foreign key relationships
ALTER TABLE public.leave_requests_additional 
ADD CONSTRAINT fk_leave_requests_additional_leave_type_id 
FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.leave_requests_additional ENABLE ROW LEVEL SECURITY;

-- Create policies with proper auth context
CREATE POLICY "Users can view their own leave requests" 
ON public.leave_requests_additional 
FOR SELECT 
USING (user_id = (auth.uid())::text);

CREATE POLICY "Users can insert their own leave requests" 
ON public.leave_requests_additional 
FOR INSERT 
WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "Admins can view all leave requests" 
ON public.leave_requests_additional 
FOR SELECT 
USING ((auth.uid())::text = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');

CREATE POLICY "Admins can update leave requests" 
ON public.leave_requests_additional 
FOR UPDATE 
USING ((auth.uid())::text = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');

-- Create table for admin-granted additional leaves
CREATE TABLE public.admin_granted_leaves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  leave_type_id UUID NOT NULL,
  granted_amount NUMERIC NOT NULL DEFAULT 1,
  granted_by TEXT NOT NULL,
  reason TEXT,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add foreign key relationships for admin granted leaves
ALTER TABLE public.admin_granted_leaves 
ADD CONSTRAINT fk_admin_granted_leaves_leave_type_id 
FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;

-- Enable RLS for admin granted leaves
ALTER TABLE public.admin_granted_leaves ENABLE ROW LEVEL SECURITY;

-- Create policies for admin granted leaves
CREATE POLICY "Users can view their own granted leaves" 
ON public.admin_granted_leaves 
FOR SELECT 
USING (user_id = (auth.uid())::text);

CREATE POLICY "Admins can manage all granted leaves" 
ON public.admin_granted_leaves 
FOR ALL 
USING ((auth.uid())::text = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');