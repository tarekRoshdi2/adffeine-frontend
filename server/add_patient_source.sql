-- SQL Migration: Add Registration Source to Patients
-- Run this in your Supabase SQL Editor

ALTER TABLE patients ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Optional: Create an index for filtering/analytics
CREATE INDEX IF NOT EXISTS idx_patients_source ON patients(clinic_id, source);
