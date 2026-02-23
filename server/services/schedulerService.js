const cron = require('node-cron');
const supabaseAdmin = require('../lib/supabase');
const whatsappManager = require('./whatsappService');

class SchedulerService {
    constructor() {
        // Schedule task to run daily at 8:00 PM
        this.job = cron.schedule('0 20 * * *', async () => {
            console.log('[Scheduler] Running daily appointment reminders...');
            await this.sendReminders();
        }, {
            scheduled: false // Don't start immediately
        });
    }

    start() {
        this.job.start();
        console.log('[Scheduler] Appointment reminder service started.');
    }

    async sendReminders() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startOfDay = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();

        try {
            // 1. Fetch appointments for tomorrow
            const { data: appointments, error } = await supabaseAdmin
                .from('appointments')
                .select(`
                    *,
                    patients (full_name, phone_number),
                    clinics (clinic_name)
                `)
                .gte('appointment_date', startOfDay)
                .lte('appointment_date', endOfDay)
                .eq('status', 'confirmed');

            if (error) throw error;

            console.log(`[Scheduler] Found ${appointments.length} appointments for tomorrow.`);

            // 2. Send WhatsApp Reminders
            for (const appt of appointments) {
                const clinicId = appt.clinic_id;
                const session = whatsappManager.getSession(clinicId);

                if (session) {
                    const patientName = appt.patients.full_name || 'عزيزي المريض';
                    const time = new Date(appt.appointment_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                    const clinicName = appt.clinics.clinic_name;

                    const message = `مرحباً ${patientName}،\nنذكركم بموعدكم غداً في ${clinicName} الساعة ${time}.\nنتمنى لكم الشفاء العاجل.`;

                    try {
                        const jid = appt.patients.phone_number.includes('@s.whatsapp.net')
                            ? appt.patients.phone_number
                            : `${appt.patients.phone_number}@s.whatsapp.net`;

                        await session.sendMessage(jid, { text: message });
                        console.log(`[Scheduler] Sent reminder to ${appt.patients.phone_number}`);
                    } catch (sendError) {
                        console.error(`[Scheduler] Failed to send to ${appt.patients.phone_number}:`, sendError);
                    }
                } else {
                    console.warn(`[Scheduler] No active WhatsApp session for clinic ${clinicId}`);
                }
            }

        } catch (err) {
            console.error('[Scheduler] Error in sendReminders:', err);
        }
    }
}

module.exports = new SchedulerService();
