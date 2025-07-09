-- Enable realtime for leave_applied_users table
ALTER TABLE public.leave_applied_users REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_applied_users;