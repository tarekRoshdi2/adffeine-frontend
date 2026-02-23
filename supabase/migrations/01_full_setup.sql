-- ============================================================
-- FULL SETUP MIGRATION — ClinicSystem Admin Panel
-- شغّله كاملاً في Supabase SQL Editor مرة واحدة
-- ============================================================

-- ─── 1. صلاحيات الأدمن على جدول clinics ──────────────────────
DROP POLICY IF EXISTS "Super Admins can manage all clinics" ON public.clinics;
CREATE POLICY "Super Admins can manage all clinics" ON public.clinics
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ─── 2. صلاحيات الأدمن على جدول clinic_services ──────────────
DROP POLICY IF EXISTS "Super Admins can manage all clinic services" ON public.clinic_services;
CREATE POLICY "Super Admins can manage all clinic services" ON public.clinic_services
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ─── 3. صلاحيات الأدمن على جدول whatsapp_sessions ───────────
DROP POLICY IF EXISTS "Admins can manage all whatsapp sessions" ON public.whatsapp_sessions;
CREATE POLICY "Admins can manage all whatsapp sessions" ON public.whatsapp_sessions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ─── 4. صلاحيات الأدمن على جدول profiles (لعرض إيميلات الدكاترة) ─
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
        OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- ─── 5. جدول admin_settings (الإعدادات العامة) ──────────────
CREATE TABLE IF NOT EXISTS public.admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;
CREATE POLICY "Admins can manage settings" ON public.admin_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- قيم افتراضية
INSERT INTO public.admin_settings (key, value) VALUES
    ('base_price', '1500'),
    ('global_ai_prompt', 'يجب دائمًا الرد باحترام ومهنية، وعدم إعطاء أي تشخيصات طبية قاطعة، وتوجيه المريض لزيارة العيادة.')
ON CONFLICT (key) DO NOTHING;

-- ─── 6. تعيين حساب الأدمن ────────────────────────────────────
-- استبدل 'YOUR_ADMIN_EMAIL' بإيميلك الفعلي
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- جلب الـ ID من auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'tarekroshdi@gmail.com';

    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, email, role)
        VALUES (v_user_id, 'tarekroshdi@gmail.com', 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin';

        RAISE NOTICE 'تم تعيين المستخدم % أدمناً بنجاح', 'tarekroshdi@gmail.com';
    ELSE
        RAISE WARNING 'لم يتم إيجاد المستخدم tarekroshdi@gmail.com في auth.users';
    END IF;
END $$;
