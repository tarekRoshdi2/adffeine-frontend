-- FIX: Infinite Recursion in Profiles RLS
-- Run this in Supabase SQL Editor

-- 1. Create a security-definer function to check admin status
-- This bypasses RLS on the profiles table during the check itself.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Profiles Policy to use the function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (
    auth.uid() = id
    OR
    public.is_admin()
);

-- 3. Update other recursive-prone policies
DROP POLICY IF EXISTS "Super Admins can manage all clinics" ON clinics;
CREATE POLICY "Super Admins can manage all clinics" ON clinics
FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Super Admins can manage all patients" ON patients;
CREATE POLICY "Super Admins can manage all patients" ON patients
FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Super Admins can manage all appointments" ON appointments;
CREATE POLICY "Super Admins can manage all appointments" ON appointments
FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage all services" ON clinic_services;
CREATE POLICY "Admins manage all services" ON clinic_services
FOR ALL USING (public.is_admin());
