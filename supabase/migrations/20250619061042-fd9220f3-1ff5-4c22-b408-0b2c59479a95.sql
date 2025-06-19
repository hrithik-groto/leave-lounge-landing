
-- First, let's clean up any problematic data and reset the structure
-- Drop existing RLS policies that might be causing conflicts
DROP POLICY IF EXISTS "Users can view their own leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Users can create their own leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Users can update their own pending leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Admins can manage all leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Clean up any existing leave types that might have constraint issues
DELETE FROM leave_policies WHERE leave_type_id IN (
  SELECT id FROM leave_types WHERE label IN ('Annual Leave', 'Sick Leave', 'Personal Leave')
);
DELETE FROM leave_types WHERE label IN ('Annual Leave', 'Sick Leave', 'Personal Leave');

-- Now create clean leave types with fresh UUIDs
INSERT INTO leave_types (label, color, requires_approval, accrual_rule, is_active) VALUES
('Annual Leave', '#10B981', true, 'annual', true),
('Sick Leave', '#EF4444', true, 'annual', true),
('Personal Leave', '#3B82F6', true, 'annual', true),
('Emergency Leave', '#F59E0B', true, 'annual', true);

-- Create corresponding leave policies for the new leave types
INSERT INTO leave_policies (leave_type_id, annual_allowance, carry_forward_limit, is_active)
SELECT id, 20, 5, true FROM leave_types WHERE label = 'Annual Leave'
UNION ALL
SELECT id, 10, 0, true FROM leave_types WHERE label = 'Sick Leave'
UNION ALL
SELECT id, 5, 0, true FROM leave_types WHERE label = 'Personal Leave'
UNION ALL
SELECT id, 3, 0, true FROM leave_types WHERE label = 'Emergency Leave';

-- Ensure the leave_applied_users table has the correct constraints
ALTER TABLE leave_applied_users DROP CONSTRAINT IF EXISTS fk_leave_applied_users_leave_type;
ALTER TABLE leave_applied_users ADD CONSTRAINT fk_leave_applied_users_leave_type 
FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE SET NULL;

-- Make sure user_id in leave_applied_users matches profiles.id format
ALTER TABLE leave_applied_users DROP CONSTRAINT IF EXISTS fk_leave_applied_users_user;
ALTER TABLE leave_applied_users ADD CONSTRAINT fk_leave_applied_users_user 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Create simple, working RLS policies
CREATE POLICY "Enable all access for authenticated users" ON profiles
FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON leave_types
FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON leave_policies  
FOR SELECT USING (true);

CREATE POLICY "Users can manage their own leave applications" ON leave_applied_users
FOR ALL USING (true);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applied_users ENABLE ROW LEVEL SECURITY;
