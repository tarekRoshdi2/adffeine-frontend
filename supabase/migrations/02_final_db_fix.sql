-- 1. FIX: Remove conflicting legacy columns with CASCADE (This solves the dependency issue)
DO $$ 
BEGIN
    -- Drop workspace_id for patients (CASCADE will drop dependent policies)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'workspace_id') THEN
        ALTER TABLE patients DROP COLUMN workspace_id CASCADE;
    END IF;

    -- Drop workspace_id for appointments (CASCADE will drop dependent policies)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'workspace_id') THEN
        ALTER TABLE appointments DROP COLUMN workspace_id CASCADE;
    END IF;

    -- Ensure clinic_id exists (for patients)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'clinic_id') THEN
        ALTER TABLE patients ADD COLUMN clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;
    END IF;
    
    -- Ensure other columns exist (for patients)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'full_name') THEN
        ALTER TABLE patients ADD COLUMN full_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'age') THEN
        ALTER TABLE patients ADD COLUMN age INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'medical_history') THEN
        ALTER TABLE patients ADD COLUMN medical_history TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'last_interaction') THEN
        ALTER TABLE patients ADD COLUMN last_interaction TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
    
     -- Ensure clinic_id exists (for appointments)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'clinic_id') THEN
        ALTER TABLE appointments ADD COLUMN clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;
    END IF;
    
    -- Ensure other columns exist (for appointments) -- MISSING ONES ADDED HERE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'chief_complaint') THEN
        ALTER TABLE appointments ADD COLUMN chief_complaint TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'source') THEN
        ALTER TABLE appointments ADD COLUMN source TEXT DEFAULT 'bot';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'status') THEN
        ALTER TABLE appointments ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;

END $$;

-- 2. RECREATE POLICIES (Since CASCADE might have dropped them)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doctors can view their own patients" ON patients;
CREATE POLICY "Doctors can view their own patients" ON patients 
FOR ALL USING (
    EXISTS (SELECT 1 FROM clinics WHERE id = patients.clinic_id AND (owner_id = auth.uid() OR owner_id IS NULL))
);

DROP POLICY IF EXISTS "Doctors can manage their appointments" ON appointments;
CREATE POLICY "Doctors can manage their appointments" ON appointments 
FOR ALL USING (
    EXISTS (SELECT 1 FROM clinics WHERE id = appointments.clinic_id AND (owner_id = auth.uid() OR owner_id IS NULL))
);

-- 3. Ensure Messages Table Exists
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  sender_type TEXT CHECK (sender_type IN ('user', 'bot', 'doctor')),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_read BOOLEAN DEFAULT false
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Doctors can view clinic messages" ON messages;
CREATE POLICY "Doctors can view clinic messages" ON messages 
FOR ALL USING (
    EXISTS (SELECT 1 FROM clinics WHERE id = messages.clinic_id AND (owner_id = auth.uid() OR owner_id IS NULL))
);
