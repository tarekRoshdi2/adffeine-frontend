const express = require('express');
const router = express.Router();
const doctorAgentService = require('../services/DoctorAgentService');

// Test Route
router.get('/health', (req, res) => {
    res.json({ status: 'AI Module Active', model: 'Gemini 2.0 Flash' });
});

// Doctor Chat Endpoint
router.post('/doctor-chat', async (req, res) => {
    try {
        const { query, clinicId } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Default clinic ID for now if not passed
        let activeClinicId = clinicId;
        if (!activeClinicId) {
             const { data: clinic } = await require('../lib/supabase').from('clinics').select('id').limit(1).single();
             activeClinicId = clinic?.id;
             console.log("Auto-detected Clinic ID:", activeClinicId);
        }

        const response = await doctorAgentService.generateResponse(query, activeClinicId);
        res.json({ response });

    } catch (error) {
        console.error("AI Route Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
