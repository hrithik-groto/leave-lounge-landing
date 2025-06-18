
-- Drop existing policies on user_leave_balances that depend on user_id
DROP POLICY IF EXISTS "Users can view their own leave balances" ON user_leave_balances;
DROP POLICY IF EXISTS "Users can insert their own leave balances" ON user_leave_balances;
DROP POLICY IF EXISTS "Users can update their own leave balances" ON user_leave_balances;

-- Drop existing policies on leave_applied_users that depend on user_id
DROP POLICY IF EXISTS "Users can view their own leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Users can insert their own leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Users can update their own leave applications" ON leave_applied_users;

-- Drop existing policies on notifications that depend on user_id
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Clear existing leave types and policies to start fresh
DELETE FROM leave_policies;
DELETE FROM leave_types;

-- Insert the specific leave types as per your requirements
INSERT INTO leave_types (id, label, color, requires_approval, accrual_rule) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Paid Leave', '#3B82F6', true, 'monthly'),
('550e8400-e29b-41d4-a716-446655440002', 'Bereavement Leave', '#EF4444', true, 'annual'),
('550e8400-e29b-41d4-a716-446655440003', 'Restricted Holiday', '#F59E0B', true, 'annual'),
('550e8400-e29b-41d4-a716-446655440004', 'Short Leave', '#10B981', true, 'monthly'),
('550e8400-e29b-41d4-a716-446655440005', 'Work From Home', '#8B5CF6', true, 'monthly');

-- Insert corresponding leave policies with exact allocations
INSERT INTO leave_policies (leave_type_id, annual_allowance, carry_forward_limit) VALUES
('550e8400-e29b-41d4-a716-446655440001', 18, 18),   -- Paid Leave: 1.5 days/month = 18/year, carries forward
('550e8400-e29b-41d4-a716-446655440002', 5, 0),     -- Bereavement Leave: 5 days/year, no carry forward
('550e8400-e29b-41d4-a716-446655440003', 2, 0),     -- Restricted Holiday: 2 days/year, no carry forward
('550e8400-e29b-41d4-a716-446655440004', 48, 0),    -- Short Leave: 4 hours/month = 48 hours/year, no carry forward
('550e8400-e29b-41d4-a716-446655440005', 24, 24);   -- Work From Home: 2 days/month = 24/year, carries forward

-- Add holiday_name column to leave_applied_users for restricted holidays
ALTER TABLE leave_applied_users 
ADD COLUMN IF NOT EXISTS holiday_name TEXT;

-- Create admin user profile if not exists
INSERT INTO profiles (id, email, name) VALUES
('user_2xwywE2Bl76vs7l68dhj6nIcCPV', 'hrithik@letsgroto.com', 'Hrithik (Admin)')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name;

-- Function to initialize user leave balances for all leave types
CREATE OR REPLACE FUNCTION initialize_user_leave_balances(user_uuid TEXT)
RETURNS VOID AS $$
DECLARE
    leave_type_record RECORD;
    current_year INTEGER := EXTRACT(year FROM now());
BEGIN
    -- Loop through all active leave types
    FOR leave_type_record IN 
        SELECT lt.id as leave_type_id, lp.annual_allowance
        FROM leave_types lt
        JOIN leave_policies lp ON lt.id = lp.leave_type_id
        WHERE lt.is_active = true
    LOOP
        -- Insert balance record if it doesn't exist
        INSERT INTO user_leave_balances (
            user_id, 
            leave_type_id, 
            year, 
            allocated_days, 
            used_days, 
            carried_forward_days
        ) VALUES (
            user_uuid, 
            leave_type_record.leave_type_id, 
            current_year, 
            leave_type_record.annual_allowance, 
            0, 
            0
        ) ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
