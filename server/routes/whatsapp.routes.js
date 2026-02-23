const express = require('express');
const router = express.Router();
const whatsappManager = require('../WhatsAppManager');
const { createClient } = require('@supabase/supabase-js');

// Helper to init supabase for auth checks
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to verify Clinic Owner or Admin token
const verifyClinicAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Auth Header' });

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) throw error;

        // Check user role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const role = profile?.role || 'doctor';

        // If Admin, they can pass any clinicId in query or body
        if (role === 'admin') {
            const clinicId = req.query.clinicId || req.body.clinicId;
            if (!clinicId) return res.status(400).json({ error: 'clinicId is required for admin' });

            req.user = user;
            req.clinicId = clinicId;
            req.isAdmin = true;
            return next();
        }

        // If Doctor, find their own clinic
        const { data: clinic } = await supabase
            .from('clinics')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!clinic) return res.status(403).json({ error: 'No clinic found for user' });

        req.user = user;
        req.clinicId = clinic.id;
        req.isAdmin = false;
        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err);
        return res.status(401).json({ error: 'Invalid Token' });
    }
};


/**
 * GET /api/whatsapp/status
 * Fetches the current connection status from DB / Memory
 */
router.get('/status', verifyClinicAuth, async (req, res) => {
    try {
        // Generate URLs first - these don't depend on DB success
        const webhook_url = '/api/whatsapp/webhook';
        const messenger_webhook_url = `/api/messenger/webhook?clinicId=${req.clinicId}`;

        // Fetch session (might not exist)
        const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .eq('clinic_id', req.clinicId)
            .single();

        // Fetch clinic config (might not exist or be empty)
        const { data: clinicData } = await supabase
            .from('clinics')
            .select('telegram_token, messenger_token, messenger_page_id, messenger_verify_token')
            .eq('id', req.clinicId)
            .single();

        res.json({
            status: session?.status || 'disconnected',
            phone_number_id: session?.phone_number_id || null,
            access_token: session?.access_token ? true : false,
            verify_token: session?.verify_token || null,
            telegram_token: clinicData?.telegram_token || null,
            messenger_token: clinicData?.messenger_token || null,
            messenger_page_id: clinicData?.messenger_page_id || null,
            messenger_verify_token: clinicData?.messenger_verify_token || null,
            webhook_url,
            messenger_webhook_url,
            last_connected_at: session?.last_connected_at || null
        });
    } catch (error) {
        console.error('Error fetching WA status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/whatsapp/connect
 * Initiates a session and returns a QR code if scanning is needed
 */
router.post('/connect', verifyClinicAuth, async (req, res) => {
    try {
        const { phone_number_id, access_token, verify_token } = req.body;

        const updateData = {
            clinic_id: req.clinicId,
            phone_number_id,
            verify_token,
            status: 'connected'
        };

        if (access_token) {
            updateData.access_token = access_token;
        }

        const { error } = await supabase
            .from('whatsapp_sessions')
            .upsert(updateData, { onConflict: 'clinic_id' });

        if (error) throw error;

        res.json({ status: 'connected', message: 'WhatsApp Cloud API configured successfully!' });

    } catch (error) {
        console.error('Error saving WhatsApp config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

/**
 * POST /api/whatsapp/logout
 * Securesly logs out and wipes the session from DB & Baileys
 */
router.post('/logout', verifyClinicAuth, async (req, res) => {
    try {
        await whatsappManager.logoutSession(req.clinicId);
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error logging out WA:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

/**
 * POST /api/whatsapp/messenger-config
 * Saves the Messenger configuration and reloads the service
 */
router.post('/messenger-config', verifyClinicAuth, async (req, res) => {
    try {
        const { messenger_token, messenger_page_id, messenger_verify_token } = req.body;

        const { error } = await supabase
            .from('clinics')
            .update({
                messenger_token,
                messenger_page_id,
                messenger_verify_token
            })
            .eq('id', req.clinicId);

        if (error) throw error;

        // Reload the service configuration in memory
        const messengerManager = require('../MessengerManager');
        messengerManager.init(); // Refresh all clinic configs

        res.json({ success: true, message: 'Messenger configuration saved!' });
    } catch (error) {
        console.error('Error saving Messenger config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

/**
 * POST /api/whatsapp/telegram-token
 * Saves the Telegram token and starts the bot
 */
router.post('/telegram-token', verifyClinicAuth, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        const { error } = await supabase
            .from('clinics')
            .update({ telegram_token: token })
            .eq('id', req.clinicId);

        if (error) throw error;

        // Start/Restart the bot in memory
        const telegramManager = require('../TelegramManager');
        telegramManager.startBot(req.clinicId, token);

        res.json({ success: true, message: 'Telegram token saved and bot started!' });
    } catch (error) {
        console.error('Error saving TG token:', error);
        res.status(500).json({ error: 'Failed to save token' });
    }
});

module.exports = router;
