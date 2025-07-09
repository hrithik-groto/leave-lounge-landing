-- Ensure realtime is properly configured for leave_applied_users table
ALTER TABLE public.leave_applied_users REPLICA IDENTITY FULL;