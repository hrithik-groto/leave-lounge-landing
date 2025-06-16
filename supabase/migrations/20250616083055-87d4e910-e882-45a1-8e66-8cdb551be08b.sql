
-- Create profiles table to store user data from Clerk
CREATE TABLE public.profiles (
  id TEXT PRIMARY KEY, -- Clerk user ID as text
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Leave Applied Users table
CREATE TABLE public.leave_applied_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by TEXT REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create organizations table for Clerk organizations
CREATE TABLE public.organizations (
  id TEXT PRIMARY KEY, -- Clerk organization ID as text
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organization members table
CREATE TABLE public.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_applied_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (true);

-- RLS Policies for leave_applied_users
CREATE POLICY "Users can view their own leave applications" ON public.leave_applied_users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own leave applications" ON public.leave_applied_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own leave applications" ON public.leave_applied_users FOR UPDATE USING (true);

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they belong to" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Users can create organizations" ON public.organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "Organization creators can update their organizations" ON public.organizations FOR UPDATE USING (true);

-- RLS Policies for organization_members
CREATE POLICY "Users can view organization members" ON public.organization_members FOR SELECT USING (true);
CREATE POLICY "Organization admins can manage members" ON public.organization_members FOR ALL USING (true);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (true);
