require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const webhookRoutes = require('./routes/webhookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const calendarService = require('./services/calendarService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['https://ehr.adffeine.com', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-clinic-id'],
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api', webhookRoutes);
app.use('/api/ai', require('./routes/ai.routes'));
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp', require('./routes/whatsapp.routes'));
app.use('/api/whatsapp/webhook', require('./routes/whatsapp.webhook'));
app.use('/api/messenger/webhook', require('./routes/messenger.webhook'));
app.use('/api/chat', require('./routes/chat.routes'));

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: 'Smart Medical Secretary AI API is running...' });
});

// --- Google Calendar OAuth Routes ---
// Moved logic to controller/route eventually, but keeping here for simplicity of migration for now
app.get('/api/auth/google', (req, res) => {
    const { workspaceId } = req.query;
    const url = calendarService.getAuthUrl(workspaceId);
    res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res) => {
    const { code, state: workspaceId } = req.query;
    try {
        const tokens = await calendarService.getTokens(code);
        // In prod, save tokens to Supabase for this workspaceId
        console.log(`Saved tokens for ${workspaceId}:`, tokens);
        res.send("تم ربط التقويم بنجاح! يمكنك العودة للوحة التحكم.");
    } catch (error) {
        res.status(500).send("خطأ في ربط التقويم.");
    }
});

// Initialize Services (WhatsApp, Telegram, Scheduler)
const schedulerService = require('./services/schedulerService');
const telegramManager = require('./TelegramManager');
const messengerManager = require('./MessengerManager');

schedulerService.start();
telegramManager.init();
messengerManager.init();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
