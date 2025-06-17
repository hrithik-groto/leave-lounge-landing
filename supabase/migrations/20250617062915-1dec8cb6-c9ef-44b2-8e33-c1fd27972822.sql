
-- First, let's create the new leave types with their specific rules
INSERT INTO public.leave_types (label, color, requires_approval, accrual_rule) VALUES 
-- Deductible leaves
('Paid Leave', '#10B981', true, 'monthly'),
('Bereavement Leave', '#EF4444', true, 'annual'),
('Restricted Holiday', '#F59E0B', true, 'annual'),
('Short Leave', '#6366F1', false, 'monthly'),
('Work From Home', '#8B5CF6', true, 'monthly'),
-- Non-deductible leaves
('Additional Work From Home', '#06B6D4', true, 'annual'),
('Comp-offs', '#EC4899', true, 'annual'),
('Special Leave', '#F97316', true, 'annual');

-- Create leave policies for each leave type
INSERT INTO public.leave_policies (leave_type_id, annual_allowance, carry_forward_limit) 
SELECT 
  lt.id,
  CASE 
    WHEN lt.label = 'Paid Leave' THEN 18 -- 1.5 * 12 months
    WHEN lt.label = 'Bereavement Leave' THEN 5
    WHEN lt.label = 'Restricted Holiday' THEN 2
    WHEN lt.label = 'Short Leave' THEN 48 -- 4 hours * 12 months
    WHEN lt.label = 'Work From Home' THEN 24 -- 2 * 12 months
    WHEN lt.label = 'Additional Work From Home' THEN 24
    WHEN lt.label = 'Comp-offs' THEN 999 -- Unlimited
    WHEN lt.label = 'Special Leave' THEN 999 -- Unlimited but restricted
  END as annual_allowance,
  CASE 
    WHEN lt.label = 'Paid Leave' THEN 6
    WHEN lt.label = 'Work From Home' THEN 24
    ELSE 0
  END as carry_forward_limit
FROM public.leave_types lt
WHERE lt.label IN ('Paid Leave', 'Bereavement Leave', 'Restricted Holiday', 'Short Leave', 'Work From Home', 'Additional Work From Home', 'Comp-offs', 'Special Leave');

-- Create holiday calendar table for Indian holidays
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some Indian holidays for 2024
INSERT INTO public.company_holidays (date, name, description) VALUES
('2024-01-26', 'Republic Day', 'National Holiday'),
('2024-03-08', 'Holi', 'Festival of Colors'),
('2024-03-29', 'Good Friday', 'Christian Holiday'),
('2024-04-11', 'Eid ul-Fitr', 'Islamic Holiday'),
('2024-08-15', 'Independence Day', 'National Holiday'),
('2024-10-02', 'Gandhi Jayanti', 'National Holiday'),
('2024-10-24', 'Dussehra', 'Hindu Festival'),
('2024-11-12', 'Diwali', 'Festival of Lights'),
('2024-12-25', 'Christmas Day', 'Christian Holiday');

-- Update leave_applied_users table to include leave type and additional fields
ALTER TABLE public.leave_applied_users 
ADD COLUMN IF NOT EXISTS leave_type_id UUID REFERENCES public.leave_types(id),
ADD COLUMN IF NOT EXISTS hours_requested NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS holiday_name TEXT,
ADD COLUMN IF NOT EXISTS meeting_details TEXT,
ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false;

-- Create user leave balances table to track individual balances
CREATE TABLE IF NOT EXISTS public.user_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id),
  allocated_days NUMERIC DEFAULT 0,
  used_days NUMERIC DEFAULT 0,
  carried_forward_days NUMERIC DEFAULT 0,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, leave_type_id, year)
);

-- Enable RLS on new tables
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_leave_balances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_holidays (readable by all authenticated users)
CREATE POLICY "Anyone can view company holidays" ON public.company_holidays FOR SELECT USING (auth.role() = 'authenticated');

-- Create RLS policies for user_leave_balances
CREATE POLICY "Users can view their own leave balances" ON public.user_leave_balances FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own leave balances" ON public.user_leave_balances FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own leave balances" ON public.user_leave_balances FOR UPDATE USING (auth.uid()::text = user_id);

-- Admin policies for leave balances
CREATE POLICY "Admin can manage all leave balances" ON public.user_leave_balances FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid()::text 
    AND id = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV'
  )
);
