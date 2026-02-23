-- SQL Migration: Add Facebook Messenger Support
-- Run this in your Supabase SQL Editor

-- 1. Add messenger columns to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS messenger_id TEXT;
CREATE INDEX IF NOT EXISTS idx_patients_messenger_id ON patients(clinic_id, messenger_id);

-- 2. Add messenger config columns to clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS messenger_token TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS messenger_page_id TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS messenger_verify_token TEXT;

-- 3. Update appointments table for messenger source (optional, but good for tracking)
-- The 'source' column is already text, so we can just use 'messenger' as a value.

-- Example Filter Update for Realtime (if using individual channels)
-- ALTER TABLE messages REPLICA IDENTITY FULL; -- Already done
