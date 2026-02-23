const TelegramBot = require('node-telegram-bot-api');
const aiRouter = require('./AIAgentRouter');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

class TelegramManager {
    constructor() {
        this.bots = new Map(); // Map of clinicId -> Bot instance
    }

    /**
     * Initialize all clinic bots from the database
     */
    async init() {
        console.log("[TelegramManager] 🤖 Initializing Telegram Bots Service...");
        try {
            const { data: clinics, error } = await supabase
                .from('clinics')
                .select('id, telegram_token')
                .not('telegram_token', 'is', null);

            if (error) {
                console.error("[TelegramManager] Error fetching clinic tokens:", error);
                return;
            }

            for (const clinic of clinics) {
                if (clinic.telegram_token) {
                    this.startBot(clinic.id, clinic.telegram_token);
                }
            }
        } catch (err) {
            console.error("[TelegramManager] Fatal Init Error:", err);
        }
    }

    /**
     * Start/Restart a specific bot for a clinic
     */
    startBot(clinicId, token) {
        if (this.bots.has(clinicId)) {
            console.log(`[TelegramManager] Bot for clinic ${clinicId} already running. Stopping old instance...`);
            try {
                this.bots.get(clinicId).stopPolling();
            } catch (e) { }
            this.bots.delete(clinicId);
        }

        try {
            const bot = new TelegramBot(token, { polling: true });

            bot.on('message', async (msg) => {
                const chatId = msg.chat.id;
                const text = msg.text;

                // Ignore empty messages, non-text, or other bots
                if (!text || msg.from?.is_bot) return;

                // Allow /start but don't pass to AI
                if (text === '/start') {
                    return bot.sendMessage(chatId, "أهلاً بك في المساعد الطبي الذكي. كيف يمكنني مساعدتك اليوم؟");
                }

                console.log(`[Telegram] New Msg for clinic ${clinicId} from ${chatId}: ${text}`);

                try {
                    // Send typing indicator
                    bot.sendChatAction(chatId, 'typing');

                    // Route to AI Brain
                    const aiResponse = await aiRouter.handleIncomingMessage({
                        clinicId,
                        sender: `tg_${chatId}`, // Prefix to avoid collisions with WhatsApp
                        text,
                        platform: 'telegram'
                    });

                    if (aiResponse) {
                        bot.sendMessage(chatId, aiResponse);
                    }
                } catch (err) {
                    console.error("[TelegramManager] AI Response Error:", err);
                    bot.sendMessage(chatId, "عذراً، المساعد الذكي يواجه صعوبة في الرد حالياً. يرجى المحاولة لاحقاً.");
                }
            });

            bot.on('polling_error', (error) => {
                // To avoid flooding logs with common connection timeouts
                if (error.code === 'EFATAL') {
                    console.error(`[TelegramManager] Fatal Polling Error for ${clinicId}:`, error.message);
                }
            });

            this.bots.set(clinicId, bot);
            console.log(`[TelegramManager] ✅ Bot started for clinic ${clinicId}`);
        } catch (err) {
            console.error(`[TelegramManager] ❌ Failed to start bot for clinic ${clinicId}:`, err.message);
        }
    }

    stopBot(clinicId) {
        if (this.bots.has(clinicId)) {
            try {
                this.bots.get(clinicId).stopPolling();
            } catch (e) { }
            this.bots.delete(clinicId);
            console.log(`[TelegramManager] Bot stopped for clinic ${clinicId}`);
        }
    }

    /**
     * Send a manual message via a specific clinic's bot
     */
    async sendMessage(clinicId, chatId, text) {
        const bot = this.bots.get(clinicId);
        if (!bot) {
            console.error(`[TelegramManager] No bot found for clinic ${clinicId}`);
            return false;
        }
        try {
            await bot.sendMessage(chatId, text);
            return true;
        } catch (err) {
            console.error(`[TelegramManager] Error sending message:`, err);
            return false;
        }
    }
}

module.exports = new TelegramManager();
