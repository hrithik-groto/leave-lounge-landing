-- Enable realtime for leave_applied_users table
ALTER TABLE public.leave_applied_users REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_applied_users;

-- Create index for better performance on leave queries
CREATE INDEX IF NOT EXISTS idx_leave_applied_users_date_range 
ON public.leave_applied_users (start_date, end_date, status);

-- Create index for user leave queries
CREATE INDEX IF NOT EXISTS idx_leave_applied_users_user_status 
ON public.leave_applied_users (user_id, status, start_date, end_date);

-- Create index for monthly leave queries
CREATE INDEX IF NOT EXISTS idx_leave_applied_users_month_status 
ON public.leave_applied_users (status, start_date, end_date) 
WHERE status IN ('approved', 'pending');