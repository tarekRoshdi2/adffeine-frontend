-- 1. Add 'source' column to patients table if it doesn't exist
ALTER TABLE patients ADD COLUMN IF NOT EXISTS source TEXT;

-- 2. Populate 'source' for existing patients based on IDs
UPDATE patients 
SET source = 'telegram' 
WHERE telegram_id IS NOT NULL AND source IS NULL;

UPDATE patients 
SET source = 'whatsapp' 
WHERE (whatsapp_id IS NOT NULL OR phone_number IS NOT NULL) AND source IS NULL AND telegram_id IS NULL;
