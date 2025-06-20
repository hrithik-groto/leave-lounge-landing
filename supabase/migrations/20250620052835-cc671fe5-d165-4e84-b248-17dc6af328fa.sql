
-- First, let's check and fix the data types compatibility
-- The profiles table id is text, so we need to keep user_id as text in leave_applied_users

-- Remove the previous foreign key constraint if it exists
ALTER TABLE leave_applied_users 
DROP CONSTRAINT IF EXISTS fk_leave_applied_users_user_id;

-- Ensure user_id is text type to match profiles.id
ALTER TABLE leave_applied_users 
ALTER COLUMN user_id TYPE text;

-- Now add the proper foreign key constraint
ALTER TABLE leave_applied_users 
ADD CONSTRAINT fk_leave_applied_users_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Also fix the notifications table user_id to match profiles.id type
ALTER TABLE notifications 
ALTER COLUMN user_id TYPE text;

-- Add foreign key constraint for notifications
ALTER TABLE notifications 
ADD CONSTRAINT fk_notifications_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Enable RLS on the leave_applied_users table
ALTER TABLE leave_applied_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Users can insert their own leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Admins can view all leave applications" ON leave_applied_users;
DROP POLICY IF EXISTS "Admins can update leave applications" ON leave_applied_users;

-- Create RLS policies for leave_applied_users
CREATE POLICY "Users can view their own leave applications" 
ON leave_applied_users FOR SELECT 
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own leave applications" 
ON leave_applied_users FOR INSERT 
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Admins can view all leave applications" 
ON leave_applied_users FOR SELECT 
USING (auth.uid()::text = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');

CREATE POLICY "Admins can update leave applications" 
ON leave_applied_users FOR UPDATE 
USING (auth.uid()::text = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can insert notifications for any user" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON notifications FOR SELECT 
USING (user_id = auth.uid()::text);

CREATE POLICY "Admins can insert notifications for any user" 
ON notifications FOR INSERT 
WITH CHECK (auth.uid()::text = 'user_2xwywE2Bl76vs7l68dhj6nIcCPV');

-- Create policy for users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" 
ON notifications FOR UPDATE 
USING (user_id = auth.uid()::text);

-- Enable realtime for both tables
ALTER TABLE leave_applied_users REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Only add notifications to realtime publication (leave_applied_users is already there)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
