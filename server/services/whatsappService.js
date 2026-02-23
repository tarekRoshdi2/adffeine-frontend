const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const path = require('path');
const fs = require('fs');
const geminiService = require('./geminiService');
const supabaseAdmin = require('../lib/supabase');

class WhatsAppService {
    constructor() {
        this.sessions = new Map();
        this.sessionsDir = path.join(__dirname, '../../sessions'); // Fix path to sessions dir
        if (!fs.existsSync(this.sessionsDir)) {
            // Using recursive mkdir for safety, though sessions dir likely exists
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    async initSession(workspaceId) {
        if (this.sessions.has(workspaceId)) {
            return this.sessions.get(workspaceId);
        }

        const sessionPath = path.join(this.sessionsDir, workspaceId);
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
        });

        this.sessions.set(workspaceId, sock);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) console.log(`[QR] Session ${workspaceId} needs scan.`);

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error instanceof Boom) &&
                    (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);
                if (shouldReconnect) this.initSession(workspaceId);
                else this.sessions.delete(workspaceId);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                for (const msg of m.messages) {
                    if (!msg.key.fromMe && msg.message) {
                        const sender = msg.key.remoteJid;
                        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

                        // 1. Fetch Clinic Context (Essential for AI)
                        let clinicContext = null;
                        let googleTokens = null;

                        try {
                            const { data: clinic, error } = await supabaseAdmin
                                .from('clinics')
                                .select('*')
                                .eq('id', workspaceId)
                                .single();

                            if (error || !clinic) {
                                console.error(`Clinic not found for ID: ${workspaceId}`, error);
                                continue;
                            }

                            clinicContext = {
                                name: clinic.clinic_name,
                                details: `${clinic.specialty} - ${clinic.system_prompt || ''}`,
                                id: clinic.id
                            };
                            googleTokens = clinic.google_calendar_token || {};

                        } catch (err) {
                            console.error("Error fetching clinic context:", err);
                            continue;
                        }

                        // 2. Sync Patient (Find or Create)
                        const { data: patient, error: patientError } = await supabaseAdmin
                            .from('patients')
                            .upsert({
                                clinic_id: workspaceId,
                                phone_number: sender.replace('@s.whatsapp.net', ''),
                                last_interaction: new Date().toISOString()
                            }, { onConflict: 'clinic_id, phone_number' })
                            .select()
                            .single();

                        if (patient) {
                            // 3. Save User Message
                            await supabaseAdmin.from('messages').insert({
                                clinic_id: workspaceId,
                                patient_id: patient.id,
                                sender_type: 'user',
                                content: text,
                                is_read: false
                            });

                            // 4. Generate AI Response
                            const aiResponse = await geminiService.handleMessage({
                                workspaceId,
                                sender: patient.phone_number,
                                text,
                                clinicContext,
                                googleTokens
                            });

                            // 5. Send Response
                            await sock.sendMessage(sender, { text: aiResponse });

                            // 6. Save Bot Message
                            await supabaseAdmin.from('messages').insert({
                                clinic_id: workspaceId,
                                patient_id: patient.id,
                                sender_type: 'bot',
                                content: aiResponse,
                                is_read: true
                            });
                        }
                    }
                }
            }
        });

        return sock;
    }

    getSession(workspaceId) {
        return this.sessions.get(workspaceId);
    }
}

module.exports = new WhatsAppService();
