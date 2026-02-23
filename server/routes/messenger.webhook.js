const express = require('express');
const router = express.Router();
const messengerManager = require('../MessengerManager');

// 1. GET: Webhook Verification (Handshake with Facebook)
router.get('/', (req, res) => {
    // These are from Facebook's request
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // We don't have the clinicId here, so we might need a generic verify token 
    // or a page-specific one if we include it in the URL
    // For now, let's allow setting it via query param: /api/messenger/webhook?clinicId=...
    const clinicId = req.query.clinicId;

    if (mode && token) {
        if (mode === 'subscribe') {
            const config = messengerManager.clinicConfigs.get(clinicId);
            if (config && token === config.verifyToken) {
                console.log(`[Messenger Webhook] Verification successful for clinic ${clinicId}`);
                res.status(200).send(challenge);
            } else {
                console.error(`[Messenger Webhook] Verification failed for clinic ${clinicId}`);
                res.sendStatus(403);
            }
        }
    } else {
        res.sendStatus(400);
    }
});

// 2. POST: Webhook Events (Messages)
router.post('/', (req, res) => {
    const body = req.body;
    const clinicId = req.query.clinicId;

    if (body.object === 'page') {
        body.entry.forEach(entry => {
            const webhook_event = entry.messaging[0];
            if (clinicId) {
                messengerManager.handleWebhookEvent(clinicId, webhook_event);
            }
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

module.exports = router;
