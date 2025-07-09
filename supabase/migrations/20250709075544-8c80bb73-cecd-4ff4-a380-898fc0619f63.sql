-- Allow all authenticated users to view leave applications from all users for calendar display
DROP POLICY IF EXISTS "Users can view all leave applications for calendar" ON leave_applied_users;

CREATE POLICY "Users can view all leave applications for calendar" 
ON leave_applied_users 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- This policy allows users to see all approved and pending leaves for calendar display
-- while still maintaining security through authentication