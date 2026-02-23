const express = require('express');
const router = express.Router();
const aiRouter = require('../AIAgentRouter');
const whatsappManager = require('../WhatsAppManager');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Webhook Verification (GET) - Required by Meta
router.get('/', async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe') {
        // Validate token against all clinic sessions in DB
        const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('clinic_id, verify_token')
            .eq('verify_token', token)
            .maybeSingle();

        if (session) {
            console.log('[WA Webhook] Verification successful for clinic:', session.clinic_id);
            return res.status(200).send(challenge);
        } else {
            console.error('[WA Webhook] Verification failed: token does not match any clinic');
            return res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// 2. Receive Messages (POST)
router.post('/', async (req, res) => {
    try {
        const body = req.body;

        // Check if it's a valid WhatsApp message object
        if (body.object === 'whatsapp_business_account') {
            if (body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const from = message.from; // Patient phone number
                const text = message.text?.body;
                const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;

                if (!text) return res.sendStatus(200);

                console.log(`[Webhook] Incoming from ${from}: ${text}`);

                // Find the clinic that owns this Phone Number ID
                const { data: session } = await supabase
                    .from('whatsapp_sessions')
                    .select('clinic_id')
                    .eq('phone_number_id', phoneNumberId)
                    .single();

                if (!session) {
                    console.error(`[Webhook] No clinic found for Phone Number ID: ${phoneNumberId}`);
                    return res.sendStatus(200);
                }

                const clinicId = session.clinic_id;

                // Send to AI Brain
                const aiResponse = await aiRouter.handleIncomingMessage({
                    clinicId,
                    sender: from, // Using raw phone number as sender ID for WhatsApp
                    text,
                    platform: 'whatsapp'
                });

                if (aiResponse) {
                    await whatsappManager.sendMessage(clinicId, from, aiResponse);
                }
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('[Webhook] Error:', error);
        res.sendStatus(500);
    }
});

module.exports = router;
