const express = require('express');
const router = express.Router();
const whatsappManager = require('../services/whatsappService');

// Init WhatsApp Session
router.post('/whatsapp/init', async (req, res) => {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'Workspace ID is required' });
    try {
        await whatsappManager.initSession(workspaceId);
        res.json({ message: `Session initialization started for ${workspaceId}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook Verification (GET)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === 'my_test_token') { // Replace with env var
            console.log('Webhook Verified!');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400); // Bad Request if no mode/token
    }
});

// Webhook for receiving messages
router.post('/webhook', async (req, res) => {
    try {
        await whatsappManager.handleIncomingWebHook(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook Error:', error);
        res.sendStatus(200); // Always return 200 to Meta to prevent retries on logic errors
    }
});

module.exports = router;
