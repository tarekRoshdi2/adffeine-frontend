const { GoogleGenerativeAI } = require("@google/generative-ai");
const calendarService = require('./calendarService');
const supabaseAdmin = require('../lib/supabase');

class GeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    }

    async handleMessage({ workspaceId, sender, text, clinicContext, googleTokens }) {
        try {
            console.log(`[Gemini Service] Processing for ${workspaceId}, User: ${sender}`);

            // 1. Sync Patient Data (Upsert)
            // We use sender (phone number) and workspaceId (clinic_id) to find/create patient
            const { data: patient, error: patientError } = await supabaseAdmin
                .from('patients')
                .upsert({
                    clinic_id: workspaceId,
                    phone_number: sender,
                    last_interaction: new Date().toISOString()
                }, { onConflict: 'clinic_id, phone_number' })
                .select()
                .single();

            if (patientError) console.error("Error syncing patient:", patientError);

            const systemPrompt = `
                You are a smart medical receptionist for "${clinicContext.name}".
                Clinic Details: ${clinicContext.details}.
                Patient ID: ${sender}.
                
                Your Goal: Help the patient book an appointment or answer their questions.

                Available Tools (Trigger these by specific keywords if needed):
                - [CHECK_SLOTS]: If patient asks for availability.
                - [BOOK_SLOT|datetime]: If patient agrees on a specific time.

                Rules:
                1. Answer questions about location, price, and services first.
                2. Be polite and professional in Arabic (Egyptian dialect).
                3. Today's date is: ${new Date().toLocaleDateString('ar-EG')}.
                4. Do NOT hallucinate availability. Always check first.
            `;

            // Simple Intent Parser via Keyword/Pattern (Refine with Function Calling later)
            // A. Availability Check
            if (text.includes("مواعيد") || text.includes("فاضي") || text.includes("حجز")) {
                const slots = await calendarService.listSlots(googleTokens);
                if (slots.length === 0) return "عذراً، لا توجد مواعيد متاحة حالياً.";

                const slotsInfo = slots.map(s => {
                    const d = new Date(s.start.dateTime);
                    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', weekday: 'long' });
                }).join("، ");

                return `المواعيد المتاحة هي: ${slotsInfo}. تحب أحجزلك حاجة منهم؟`;
            }

            // B. Booking Action (Regex for "Book [Time]") - This is a simplification
            // In a real agent, we would use multi-turn conversation state.
            // For now, let's keep it conversational.

            const chat = this.model.startChat({
                history: [], // Fetch history from Supabase if needed
                generationConfig: { maxOutputTokens: 500 },
            });

            const result = await chat.sendMessage(`System: ${systemPrompt}\nPatient: ${text}`);
            const response = await result.response;
            let aiText = response.text();

            // Check for Tool Calls (Simulated)
            const bookMatch = aiText.match(/\[BOOK_SLOT\|(.*?)\]/);
            if (bookMatch) {
                const requestedTime = bookMatch[1];
                try {
                    // 1. Create Google Calendar Event
                    // In a real app, calculate end time (e.g., +30 mins)
                    const startTime = new Date(requestedTime);
                    const endTime = new Date(startTime.getTime() + 30 * 60000);

                    const event = await calendarService.createEvent(googleTokens, {
                        summary: patient.full_name || 'New Patient',
                        startDateTime: startTime.toISOString(),
                        endDateTime: endTime.toISOString(),
                        patientPhone: sender
                    });

                    // 2. Save to Supabase
                    const { error: dbError } = await supabaseAdmin
                        .from('appointments')
                        .insert({
                            clinic_id: workspaceId,
                            patient_id: patient.id,
                            appointment_date: startTime.toISOString(),
                            google_event_id: event.id,
                            status: 'confirmed',
                            source: 'bot'
                        });

                    if (dbError) throw dbError;

                    return `تمام يا فندم، تم تأكيد حجزك يوم ${startTime.toLocaleDateString('ar-EG')} الساعة ${startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}.`;

                } catch (bookingError) {
                    console.error("Booking Error:", bookingError);
                    return "عذراً، حصلت مشكلة أثناء تأكيد الحجز. ممكن نحاول تاني؟";
                }
            }

            return aiText;

        } catch (error) {
            console.error(`[Gemini Service Error]:`, error);
            return "عذراً، واجهت مشكلة تقنية بسيطة. يرجى المحاولة لاحقاً.";
        }
    }
}

module.exports = new GeminiService();
