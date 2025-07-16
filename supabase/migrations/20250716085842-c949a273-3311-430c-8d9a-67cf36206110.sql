-- Insert some sample company holidays for testing
INSERT INTO public.company_holidays (name, date, description, is_active) VALUES
('New Year''s Day', '2025-01-01', 'New Year celebration', true),
('Republic Day', '2025-01-26', 'Indian Republic Day', true),
('Holi', '2025-03-14', 'Festival of Colors', true),
('Good Friday', '2025-04-18', 'Christian holiday', true),
('Eid al-Fitr', '2025-05-01', 'End of Ramadan', true),
('Independence Day', '2025-08-15', 'Indian Independence Day', true),
('Gandhi Jayanti', '2025-10-02', 'Mahatma Gandhi''s Birthday', true),
('Diwali', '2025-10-20', 'Festival of Lights', true),
('Christmas Day', '2025-12-25', 'Christian holiday', true)
ON CONFLICT (date, name) DO NOTHING;