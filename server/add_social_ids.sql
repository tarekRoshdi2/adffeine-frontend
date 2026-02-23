-- SQL Migration: Add Social IDs to Patients table
-- Run this in your Supabase SQL Editor

ALTER TABLE patients ADD COLUMN IF NOT EXISTS telegram_id TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_id TEXT;

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_patients_telegram_id ON patients(clinic_id, telegram_id);
CREATE INDEX IF NOT EXISTS idx_patients_whatsapp_id ON patients(clinic_id, whatsapp_id);

-- Optional: If you want to prevent one Telegram ID from being registered multiple times in the same clinic
-- ALTER TABLE patients ADD CONSTRAINT unique_telegram_per_clinic UNIQUE (clinic_id, telegram_id);
-- ALTER TABLE patients ADD CONSTRAINT unique_whatsapp_per_clinic UNIQUE (clinic_id, whatsapp_id);
