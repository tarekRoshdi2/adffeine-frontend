-- SQL Migration: Update whatsapp_sessions for Cloud API
-- Run this in your Supabase SQL Editor

ALTER TABLE whatsapp_sessions 
ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS verify_token TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure unique constraint for upsert
-- ALTER TABLE whatsapp_sessions ADD CONSTRAINT whatsapp_sessions_clinic_id_key UNIQUE (clinic_id);
-- (Note: If clinic_id is already the primary key, this is not needed)
