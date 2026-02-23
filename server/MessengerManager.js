const axios = require('axios');
const aiRouter = require('./AIAgentRouter');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

class MessengerManager {
    constructor() {
        this.clinicConfigs = new Map(); // Map of clinicId -> { token, pageId, verifyToken }
    }

    /**
     * Initialize clinic configurations from the database
     */
    async init() {
        console.log("[MessengerManager] 💬 Initializing Messenger Service...");
        try {
            const { data: clinics, error } = await supabase
                .from('clinics')
                .select('id, messenger_token, messenger_page_id, messenger_verify_token')
                .not('messenger_token', 'is', null);

            if (error) {
                console.error("[MessengerManager] Error fetching clinic configs:", error);
                return;
            }

            for (const clinic of clinics) {
                this.clinicConfigs.set(clinic.id, {
                    token: clinic.messenger_token,
                    pageId: clinic.messenger_page_id,
                    verifyToken: clinic.messenger_verify_token
                });
            }
            console.log(`[MessengerManager] Loaded configs for ${clinics.length} clinics.`);
        } catch (err) {
            console.error("[MessengerManager] Fatal Init Error:", err);
        }
    }

    /**
     * Send a message via Facebook Graph API
     */
    async sendMessage(clinicId, recipientId, text) {
        const config = this.clinicConfigs.get(clinicId);
        if (!config || !config.token) {
            console.error(`[MessengerManager] No config found for clinic ${clinicId}`);
            return false;
        }

        try {
            const safeToken = config.token.trim();
            const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${safeToken}`;
            const response = await axios.post(url, {
                recipient: { id: recipientId },
                message: { text: text },
                messaging_type: "RESPONSE"
            });

            console.log(`[MessengerManager] Message sent to ${recipientId}:`, response.data);
            return true;
        } catch (error) {
            console.error(`[MessengerManager] Error sending message:`, error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Handle incoming webhook events
     */
    async handleWebhookEvent(clinicId, event) {
        if (!event.message || event.message.is_echo) return;

        const senderId = event.sender.id;
        const text = event.message.text;

        if (!text) return;

        console.log(`[Messenger] New Msg for clinic ${clinicId} from ${senderId}: ${text}`);

        try {
            // Route to AI Brain
            const aiResponse = await aiRouter.handleIncomingMessage({
                clinicId,
                sender: `msg_${senderId}`, // Prefix for Messenger
                text,
                platform: 'messenger'
            });

            if (aiResponse) {
                await this.sendMessage(clinicId, senderId, aiResponse);
            }
        } catch (err) {
            console.error("[MessengerManager] AI Response Error:", err);
            await this.sendMessage(clinicId, senderId, "عذراً، المساعد الذكي يواجه صعوبة في الرد حالياً.");
        }
    }
}

module.exports = new MessengerManager();
