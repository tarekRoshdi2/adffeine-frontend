-- SQL Migration: Add Source to Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Optional: Index for analytics
CREATE INDEX IF NOT EXISTS idx_appointments_source ON appointments(clinic_id, source);
