-- Add platform column to messages table
-- This tracks which channel (whatsapp/telegram/messenger) each message came from,
-- enabling smart routing of manual doctor replies to the patient's last active channel.

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'whatsapp';

-- Optional: Add a comment for documentation
COMMENT ON COLUMN messages.platform IS 'The messaging platform this message was sent/received via: whatsapp, telegram, messenger';
