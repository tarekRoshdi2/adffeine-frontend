const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../lib/supabase');

// ─── Admin Auth Middleware ───────────────────────────────────────────────────
// Verifies that the request is made by an authenticated user with role 'admin'.
const verifyAdminAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization Header' });

    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('[AdminRoutes] Auth Error:', err);
        return res.status(500).json({ error: 'Internal Server Error during auth check' });
    }
};
// ────────────────────────────────────────────────────────────────────────────

// Create a new doctor user (Auth) securely
router.post('/create-user', verifyAdminAuth, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Use the Admin API to create the user without signing out the current admin
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true // Auto-confirm for MVP
        });

        if (error) {
            console.error('Supabase Admin createUser Error:', error);
            return res.status(400).json({ error: error.message });
        }

        // Must create a profile so clinics.owner_id can reference it!
        // We use upsert here in case a DB trigger already created a profile automatically
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert([{ id: data.user.id, email: email, role: 'doctor' }], { onConflict: 'id' });

        if (profileError) {
            console.error('Profile Creation Error details:', profileError);
            // Rollback auth user if profile creation fails for any other reason
            await supabaseAdmin.auth.admin.deleteUser(data.user.id);
            return res.status(400).json({
                error: 'Failed to create doctor profile.',
                details: profileError.message
            });
        }

        res.status(201).json({ user: data.user });
    } catch (err) {
        console.error('Create User Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update a user (Email/Password) securely
router.post('/update-user', verifyAdminAuth, async (req, res) => {
    const { userId, email, password } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const updateData = {};
        if (email) updateData.email = email;
        if (password) updateData.password = password;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No data to update' });
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);

        if (error) {
            console.error('Supabase Admin updateUser Error:', error);
            return res.status(400).json({ error: error.message });
        }

        // If email was updated, also update the profile
        if (email) {
            await supabaseAdmin.from('profiles').update({ email }).eq('id', userId);
        }

        res.status(200).json({ success: true, user: data.user });
    } catch (err) {
        console.error('Update User Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete a clinic AND its services AND its owner user
router.delete('/delete-clinic/:clinicId', verifyAdminAuth, async (req, res) => {
    const { clinicId } = req.params;

    try {
        // 1. Get the owner_id first
        const { data: clinic, error: fetchError } = await supabaseAdmin
            .from('clinics')
            .select('owner_id')
            .eq('id', clinicId)
            .single();

        if (fetchError || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const ownerId = clinic.owner_id;

        // 2. Delete the clinic (on delete cascade should handle patients/appointments/services if set up, but let's be safe)
        const { error: deleteError } = await supabaseAdmin
            .from('clinics')
            .delete()
            .eq('id', clinicId);

        if (deleteError) {
            return res.status(400).json({ error: 'Failed to delete clinic record' });
        }

        // 3. Delete the auth user
        if (ownerId) {
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(ownerId);
            if (authError) {
                console.error('Auth User Delete Error (Non-blocking):', authError.message);
                // We don't fail the whole request because the clinic is already gone
            }
        }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Full Delete Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete a user (Auth) securely (legacy/rollback helper)
router.delete('/delete-user/:userId', verifyAdminAuth, async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
            console.error('Supabase Admin deleteUser Error:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Delete User Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
