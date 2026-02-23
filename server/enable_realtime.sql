-- Run these one by one in the SQL Editor. 
-- If a table is already added, you might get an error - you can safely ignore it and move to the next.

-- 1. Enable Realtime for the new 'appointments' table
ALTER publication supabase_realtime ADD TABLE appointments;

-- 2. Ensure identity is set to FULL for all tables (Safe to run multiple times)
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE patients REPLICA IDENTITY FULL;
ALTER TABLE appointments REPLICA IDENTITY FULL;
