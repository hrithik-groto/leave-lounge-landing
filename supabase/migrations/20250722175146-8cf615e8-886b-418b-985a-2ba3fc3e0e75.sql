
-- Clear paid leave records for hrithik@letsgroto.com
DELETE FROM leave_applied_users 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'hrithik@letsgroto.com')
AND leave_type_id = (SELECT id FROM leave_types WHERE label = 'Paid Leave');

-- Also clear any monthly balance records for paid leave for this user
DELETE FROM user_monthly_leave_balances 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'hrithik@letsgroto.com')
AND leave_type_id = (SELECT id FROM leave_types WHERE label = 'Paid Leave');
