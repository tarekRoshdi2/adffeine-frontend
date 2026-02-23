-- 1. Create clinic_services table
CREATE TABLE IF NOT EXISTS clinic_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure a service name is unique per clinic
    UNIQUE(clinic_id, name)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE clinic_services ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Doctors can manage services for their own clinic
DROP POLICY IF EXISTS "Doctors can manage their own clinic services" ON clinic_services;
CREATE POLICY "Doctors can manage their own clinic services" ON clinic_services
    FOR ALL USING (
        EXISTS (SELECT 1 FROM clinics WHERE id = clinic_services.clinic_id AND owner_id = auth.uid())
    );

-- Super Admins can view/manage all services
DROP POLICY IF EXISTS "Super Admins can view all clinic services" ON clinic_services;
CREATE POLICY "Super Admins can view all clinic services" ON clinic_services
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Allow public to read services (for AI booking context or landing pages if needed)
DROP POLICY IF EXISTS "Services are readable by all" ON clinic_services;
CREATE POLICY "Services are readable by all" ON clinic_services
    FOR SELECT USING (true);
