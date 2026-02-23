const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

class WhatsAppManager {
    constructor() {
        // No more local sessions or sockets needed
    }

    /**
     * Send a message through the Official WhatsApp Cloud API
     * @param {string} clinicId - To fetch the specific API keys
     * @param {string} to - Recipient phone number
     * @param {string} text - Message content
     */
    async sendMessage(clinicId, to, text) {
        try {
            // 1. Fetch clinic's WhatsApp Config from DB
            const { data: config, error } = await supabase
                .from('whatsapp_sessions')
                .select('phone_number_id, access_token')
                .eq('clinic_id', clinicId)
                .single();

            if (error || !config?.access_token || !config?.phone_number_id) {
                console.error(`[WhatsAppManager] Config missing for clinic ${clinicId}`);
                return false;
            }

            // 2. Call Meta Cloud API
            const url = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;

            const response = await axios.post(url, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: to,
                type: "text",
                text: { body: text }
            }, {
                headers: {
                    'Authorization': `Bearer ${config.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`[WhatsAppManager] Message sent to ${to}: ${response.status}`);
            return true;

        } catch (error) {
            console.error(`[WhatsAppManager] Error sending message via Cloud API:`, error.response?.data || error.message);
            return false;
        }
    }

    // Helper to verify status for frontend
    async getSessionStatus(clinicId) {
        const { data } = await supabase
            .from('whatsapp_sessions')
            .select('status')
            .eq('clinic_id', clinicId)
            .single();
        return data?.status || 'disconnected';
    }
}

module.exports = new WhatsAppManager();
