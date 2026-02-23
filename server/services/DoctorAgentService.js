const { GoogleGenerativeAI } = require("@google/generative-ai");
const supabase = require('../lib/supabase');
const calendarService = require('../GoogleCalendarService');

class DoctorAgentService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    }

    async generateResponse(query, clinicId) {
        try {
            // 1. Gather Context
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            // Fetch appointments for context
            const { data: appointments } = await supabase
                .from('appointments')
                .select('*, patients(full_name, medical_history)')
                .eq('clinic_id', clinicId)
                .gte('appointment_date', todayStart.toISOString())
                .lte('appointment_date', todayEnd.toISOString())
                .order('appointment_date', { ascending: true });

            // Calculate stats
            const waitingCount = appointments?.filter(a => a.status === 'arrived').length || 0;
            const completedCount = appointments?.filter(a => a.status === 'completed').length || 0;
            const nextPatient = appointments?.find(a => a.status === 'arrived' || a.status === 'in-progress' || a.status === 'confirmed');

            const context = {
                date: new Date().toLocaleDateString('ar-EG'),
                waiting: waitingCount,
                completed: completedCount,
                nextPatient: nextPatient ? `${nextPatient.patients?.full_name} (${new Date(nextPatient.appointment_date).toLocaleTimeString('ar-EG')})` : "لا يوجد",
                appointments: appointments?.map(a => {
                    const time = new Date(a.appointment_date).toLocaleTimeString('ar-EG');
                    const name = a.patients?.full_name || 'مريض غير مسجل';
                    const status = a.status;
                    return `- ${time}: ${name} (${status})`;
                }).join('\n')
            };

            const systemPrompt = `
                You are the intelligent assistant for the doctor in a smart clinic.
                
                **Current Status:**
                - Date: ${context.date}
                - Waiting Room: ${context.waiting} patients
                - Completed: ${context.completed}
                - Next Patient: ${context.nextPatient}
                
                **Schedule Today:**
                ${context.appointments}

                **Instructions:**
                - Answer the doctor's query based on this data.
                - If asked about "Next Patient", give details about ${context.nextPatient}.
                - If asked "Summary", give a brief of waiting vs total.
                - Be professional, concise, and helpful.
                - Reply in Arabic.
            `;

            const chat = this.model.startChat({
                history: [],
            });

            const result = await chat.sendMessage(`System: ${systemPrompt}\nDoctor: ${query}`);
            return result.response.text();

        } catch (error) {
            console.error("DoctorAgent Error:", error);
            return "عذراً، حدث خطأ في معالجة طلبك.";
        }
    }
}

module.exports = new DoctorAgentService();
