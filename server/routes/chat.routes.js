const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const whatsappManager = require('../WhatsAppManager');
const telegramManager = require('../TelegramManager');
const messengerManager = require('../MessengerManager');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Middleware to verify Admin/Clinic Owner token (same as whatsapp.routes.js)
const verifyClinicAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Auth Header' });

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) throw error;

        const { data: clinic } = await supabase
            .from('clinics')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!clinic) return res.status(403).json({ error: 'No clinic found for user' });

        req.clinicId = clinic.id;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid Token' });
    }
};

/**
 * POST /api/chat/send
 * Sends a manual message from the doctor to a patient
 */
router.post('/send', verifyClinicAuth, async (req, res) => {
    const { patientId, text } = req.body;

    if (!patientId || !text) {
        return res.status(400).json({ error: 'Missing patientId or text' });
    }

    try {
        // 1. Get patient details (phone, telegram_id, etc.)
        const { data: patient, error: pError } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .eq('clinic_id', req.clinicId)
            .single();

        if (pError || !patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        let success = false;

        // ✅ Smart Routing: Reply via the platform of the patient's LAST message
        // Wrapped in try-catch in case the 'platform' column doesn't exist yet in DB.
        let lastPlatform = patient.source || 'whatsapp'; // Default fallback
        try {
            const { data: lastMsg, error: msgErr } = await supabase
                .from('messages')
                .select('platform')
                .eq('patient_id', patientId)
                .eq('sender_type', 'user')
                .not('platform', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!msgErr && lastMsg?.platform) {
                lastPlatform = lastMsg.platform;
            }
        } catch (e) {
            console.warn('[ChatRoute] Could not read message platform (column may not exist yet), using fallback:', lastPlatform);
        }

        console.log(`[ChatRoute] Routing reply for patient ${patientId} via: ${lastPlatform}`);

        // 2. Route to correct platform based on last interaction
        // Note: always check if the required ID exists before sending
        if (lastPlatform === 'telegram' && patient.telegram_id) {
            console.log(`[ChatRoute] → Telegram → ${patient.telegram_id}`);
            success = await telegramManager.sendMessage(req.clinicId, patient.telegram_id, text);
        } else if (lastPlatform === 'messenger' && patient.messenger_id) {
            console.log(`[ChatRoute] → Messenger → ${patient.messenger_id}`);
            success = await messengerManager.sendMessage(req.clinicId, patient.messenger_id, text);
        } else if (patient.phone_number) {
            // Fallback: WhatsApp (also handles lastPlatform='whatsapp' explicitly)
            console.log(`[ChatRoute] → WhatsApp → ${patient.phone_number}`);
            success = await whatsappManager.sendMessage(req.clinicId, patient.phone_number, text);
        } else if (patient.telegram_id) {
            // Last resort: try telegram if no phone_number
            console.log(`[ChatRoute] → Telegram fallback → ${patient.telegram_id}`);
            success = await telegramManager.sendMessage(req.clinicId, patient.telegram_id, text);
        } else {
            console.error(`[ChatRoute] No valid channel found for patient ${patientId}`);
            return res.status(400).json({ error: 'No messaging channel available for this patient' });
        }

        if (success) {
            // 3. Save doctor reply to messages table
            const insertData = {
                clinic_id: req.clinicId,
                patient_id: patientId,
                sender_type: 'doctor',
                content: text,
                is_read: true
            };
            // Only include platform if column likely exists (non-null lastPlatform from DB query)
            try {
                await supabase.from('messages').insert({ ...insertData, platform: lastPlatform });
            } catch (e) {
                // Fallback: insert without platform column if it doesn't exist yet
                await supabase.from('messages').insert(insertData);
            }

            // Update last interaction
            await supabase.from('patients')
                .update({ last_interaction: new Date().toISOString() })
                .eq('id', patientId);

            return res.json({ success: true });
        } else {
            return res.status(500).json({ error: 'Failed to send message via platform' });
        }

    } catch (err) {
        console.error("[ChatRoute] catch error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETE /api/chat/messages/:patientId
 * Clears chat history for a specific patient
 */
router.delete('/messages/:patientId', verifyClinicAuth, async (req, res) => {
    const { patientId } = req.params;

    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('patient_id', patientId)
            .eq('clinic_id', req.clinicId);

        if (error) throw error;

        res.json({ success: true, message: 'Chat history cleared' });
    } catch (err) {
        console.error("[ChatRoute] Delete Error:", err);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

/**
 * DELETE /api/chat/patient/:patientId
 * Deletes the patient record (and cascades to messages)
 */
router.delete('/patient/:patientId', verifyClinicAuth, async (req, res) => {
    const { patientId } = req.params;

    try {
        // Note: If DB schema has CASCADE, messages will be deleted automatically.
        // To be safe, we delete messages first.
        await supabase
            .from('messages')
            .delete()
            .eq('patient_id', patientId)
            .eq('clinic_id', req.clinicId);

        const { error } = await supabase
            .from('patients')
            .delete()
            .eq('id', patientId)
            .eq('clinic_id', req.clinicId);

        if (error) throw error;

        res.json({ success: true, message: 'Patient and history deleted' });
    } catch (err) {
        console.error("[ChatRoute] Delete Patient Error:", err);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

module.exports = router;
