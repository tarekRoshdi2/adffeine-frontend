const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require('@supabase/supabase-js');
const calendarService = require('./services/calendarService');

// Pre-defined templates for clinic services based on specialties (Synced with client)
const SERVICE_TEMPLATES = {
    'أسنان': ['كشف', 'استشارة', 'خلع', 'حشو عصب', 'حشو عادي', 'زراعة أسنان', 'تقويم أسنان', 'تبييض أسنان', 'تنظيف جير', 'طقم أسنان'],
    'عيون': ['كشف نظر', 'استشارة', 'فحص قاع عين', 'قياس ضغط العين', 'عملية ليزك', 'عملية مياه بيضاء', 'عملية مياه زرقاء'],
    'أطفال': ['كشف عام', 'استشارة', 'متابعة نمو', 'تطعيمات', 'حساسية صدر'],
    'جلدية وتجميل': ['كشف', 'استشارة', 'جلسة ليزر', 'تنظيف بشرة', 'حقن بوتكس', 'حقن فيلر', 'حقن بلازما', 'تقشير كيميائي', 'علاج تساقط الشعر'],
    'باطنة': ['كشف عام', 'استشارة', 'رسم قلب', 'متابعة سكر', 'متابعة ضغط'],
    'نسا وتوليد': ['كشف ومتابعة حمل', 'استشارة', 'سونار 3D/4D', 'ولادة طبيعية', 'ولادة قيصرية', 'تركيب لولب', 'حقن مجهري'],
    'عظام': ['كشف', 'استشارة', 'رد كسر', 'جبس', 'حقن مفصل', 'عملية غضروف'],
    'أنف وأذن وحنجرة': ['كشف', 'استشارة', 'غسيل أذن', 'منظار أنف', 'عملية لوز'],
    'مخ وأعصاب': ['كشف', 'استشارة', 'رسم مخ'],
    'علاج طبيعي': ['كشف', 'تأهيل بعد الإصابة', 'علاج آلام الظهر', 'علاج الانزلاق الغضروفي', 'جلسات كهرباء']
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Validates an Egyptian mobile number.
 * Valid: 11 digits, starts with 010, 011, 012, or 015.
 */
function isValidEgyptianPhone(phone) {
    if (!phone) return false;
    let cleaned = String(phone).replace(/[\s-]/g, '');
    if (cleaned.startsWith('+20')) cleaned = '0' + cleaned.slice(3);
    else if (cleaned.startsWith('20') && cleaned.length === 12) cleaned = '0' + cleaned.slice(2);
    return /^0(10|11|12|15)\d{8}$/.test(cleaned);
}

function normalizeEgyptianPhone(phone) {
    if (!phone) return phone;
    let cleaned = String(phone).replace(/[\s-]/g, '');
    if (cleaned.startsWith('+20')) cleaned = '0' + cleaned.slice(3);
    else if (cleaned.startsWith('20') && cleaned.length === 12) cleaned = '0' + cleaned.slice(2);
    return cleaned;
}

// Define Gemini Tools (Function Declarations)
const checkAvailabilityTool = {
    name: "check_availability",
    description: "Check available appointment slots for a specific date or date range.",
    parameters: {
        type: "OBJECT",
        properties: {
            date: {
                type: "STRING",
                description: "The requested date in YYYY-MM-DD format. If the user says 'tomorrow', calculate tomorrow's date.",
            }
        },
        required: ["date"],
    },
};

const bookAppointmentTool = {
    name: "book_appointment",
    description: "Book an appointment once the user has agreed to a specific Date and Time and provided necessary information.",
    parameters: {
        type: "OBJECT",
        properties: {
            date: { type: "STRING", description: "Date in YYYY-MM-DD format" },
            time: { type: "STRING", description: "Time in HH:MM format (24-hour)" },
            patientName: { type: "STRING", description: "The full name of the patient." },
            phoneNumber: { type: "STRING", description: "Egyptian mobile number. Must be 11 digits starting with 010, 011, 012, or 015 ONLY. Reject anything else and ask again." },
            age: { type: "NUMBER", description: "Patient's age" },
            address: { type: "STRING", description: "Patient's address" },
            weight: { type: "NUMBER", description: "Patient's weight in kg" },
            bloodType: { type: "STRING", description: "Patient's blood type (e.g., A+, O-)" },
            allergies: { type: "STRING", description: "Any known allergies" },
            chronicConditions: { type: "STRING", description: "Any chronic conditions (Diabetes, Hypertension, etc.)" },
            reasonForVisit: { type: "STRING", description: "The reason for the appointment - what the patient is complaining about in their own words (e.g., chest pain, follow-up, fever)." },
            visitType: { type: "STRING", description: "The TYPE of visit chosen from the available services list (e.g., كشف عام, استشارة, متابعة كشف). This is the service category, different from the complaint." },
            isFollowup: { type: "BOOLEAN", description: "True if this is a follow-up visit, false if it's a new consultation" },
            service_name: { type: "STRING", description: "Must match EXACTLY one of the available services from the clinic's list. This is the official service name used for billing." }
        },
        required: ["date", "time", "patientName", "phoneNumber", "reasonForVisit", "service_name"],
    },
};

const requestDoctorTool = {
    name: "request_doctor",
    description: "Call this tool ONLY when the patient explicitly asks to speak with the doctor directly, or says something like 'I want to talk to the doctor', 'connect me with the doctor', 'كلم الدكتور', 'عاوز اكلم الدكتور', etc. Do NOT call for normal inquiries.",
    parameters: {
        type: "OBJECT",
        properties: {
            reason: { type: "STRING", description: "Brief reason the patient wants to contact the doctor, in their words." }
        },
        required: []
    },
};

class AIAgentRouter {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using Gemini 2.0 Flash as instructed
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            tools: [{ functionDeclarations: [checkAvailabilityTool, bookAppointmentTool, requestDoctorTool] }]
        });

        // Context caches (15 min expiry)
        this.clinicContextCache = new Map();

        // Chat Session Cache: Map<string, { chat: ChatSession, lastUsed: number }>
        // Key: clinicId_sender
        this.sessions = new Map();
    }

    async getClinicContext(clinicId) {
        if (this.clinicContextCache.has(clinicId)) {
            return this.clinicContextCache.get(clinicId);
        }

        const { data: clinic, error } = await supabase
            .from('clinics')
            .select('*, clinic_services(name)')
            .eq('id', clinicId)
            .single();

        if (error) {
            console.error("[AI Router] ❌ Error fetching clinic context for ID:", clinicId, "Details:", error);
        }

        if (clinic) {
            this.clinicContextCache.set(clinicId, clinic);
            // Invalidate cache after 15 mins
            setTimeout(() => this.clinicContextCache.delete(clinicId), 15 * 60 * 1000);
            return clinic;
        }

        console.warn("[AI Router] ⚠️ No clinic found for ID:", clinicId);
        return null;
    }

    async getOrCreatePatientContext(clinicId, sender, platform = 'telegram') {
        try {
            // sender is the raw ID (tg_123, msg_123, or +20123...)
            let socialIdField = 'whatsapp_id';
            if (platform === 'telegram') socialIdField = 'telegram_id';
            if (platform === 'messenger') socialIdField = 'messenger_id';

            const cleanSocialId = sender.replace(/^(tg_|msg_)/, ''); // Remove prefix if present

            console.log(`[AI Router] Searching by ${socialIdField}: ${cleanSocialId}`);

            // 1. First attempt: Search by Social ID
            let { data: patient, error: fetchError } = await supabase
                .from('patients')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq(socialIdField, cleanSocialId)
                .maybeSingle();

            if (patient) {
                // Ensure source is captured if missing
                if (!patient.source) {
                    await supabase.from('patients').update({ source: platform }).eq('id', patient.id);
                }
                return patient;
            }

            // 2. Second attempt: Search by Phone Number (to catch manually added or previous records)
            const cleanPhone = sender.replace(/[^0-9]/g, '');
            const phoneSearch = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

            if (phoneSearch.length >= 8) {
                console.log(`[AI Router] Social ID not found, searching by phone: %${phoneSearch}`);
                let { data: dataByPhone, error: errorByPhone } = await supabase
                    .from('patients')
                    .select('*')
                    .eq('clinic_id', clinicId)
                    .ilike('phone_number', `%${phoneSearch}%`)
                    .maybeSingle();

                if (dataByPhone) {
                    // Link this social ID to the existing phone record!
                    console.log(`[AI Router] Found record by phone. Linking ${socialIdField}...`);
                    const { data: linkedPatient } = await supabase
                        .from('patients')
                        .update({ [socialIdField]: cleanSocialId })
                        .eq('id', dataByPhone.id)
                        .select().single();

                    return linkedPatient || dataByPhone;
                }
            }

            // 3. Create a lead if not found by either
            console.log(`[AI Router] Patient not found, creating new lead for: ${sender}`);
            const { data: newPatient, error: insertError } = await supabase
                .from('patients')
                .insert({
                    clinic_id: clinicId,
                    full_name: 'مريض جديد', // Simplified: No platform in name
                    phone_number: cleanPhone || sender,
                    [socialIdField]: cleanSocialId,
                    source: platform,
                    medical_history: 'تم الإنشاء تلقائياً عبر البوت.',
                    is_lead: true
                }).select().single();

            if (insertError) {
                console.error("[AI Router] Error creating patient lead:", insertError);
                return { id: null, full_name: 'مريض جديد', medical_history: '' };
            }

            return newPatient;
        } catch (err) {
            console.error("[AI Router] getOrCreatePatientContext Exception:", err);
            return { id: null, full_name: 'مريض جديد', medical_history: '' };
        }
    }

    async executeTool(name, args, clinic, patient) {
        console.log(`[Tool Call execution]: ${name}`, args);
        try {
            if (name === 'check_availability') {
                const requestedDate = args.date;
                const dateObj = new Date(requestedDate);
                const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

                console.log(`[AI Router] Checking slots for ${requestedDate} (${dayOfWeek})`);

                // 1. Get Clinic Config
                const duration = clinic.booking_duration || 30; // default 30 mins
                const hours = clinic.working_hours?.[dayOfWeek];

                // Note: database uses 'enabled: true/false' or sometimes a status string
                if (!hours || (hours.enabled === false) || (hours.status === 'closed')) {
                    return JSON.stringify({ error: `العيادة مغلقة يوم ${dayOfWeek}.` });
                }

                // 2. Get existing appointments for that day
                const nextDay = new Date(dateObj);
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDayStr = nextDay.toISOString().split('T')[0];

                const { data: existingAppts } = await supabase
                    .from('appointments')
                    .select('appointment_date')
                    .eq('clinic_id', clinic.id)
                    .gte('appointment_date', requestedDate)
                    .lt('appointment_date', nextDayStr)
                    .not('status', 'eq', 'cancelled');

                const takenTimes = existingAppts ? existingAppts.map(a => {
                    const d = new Date(a.appointment_date);
                    return d.toTimeString().slice(0, 5);
                }) : [];

                // 3. Generate slots
                const start = hours.start; // e.g., "09:00"
                let end = hours.end;       // e.g., "17:00" or "00:00"

                // If end is 00:00, it means the end of the day (23:59) for calculation
                if (end === '00:00') end = '23:59';

                const slots = [];
                const now = new Date();
                const isToday = requestedDate === now.toISOString().split('T')[0];

                let current = new Date(`${requestedDate}T${start}`);
                const endTime = new Date(`${requestedDate}T${end}`);

                while (current < endTime) {
                    const timeString = current.toTimeString().slice(0, 5);

                    // Filter out past times if checking for today
                    if (!isToday || current > now) {
                        if (!takenTimes.includes(timeString)) {
                            slots.push(timeString);
                        }
                    }
                    current.setMinutes(current.getMinutes() + duration);
                }

                return JSON.stringify({
                    date: requestedDate,
                    day: dayOfWeek,
                    available_slots: slots.slice(0, 10), // Return top 10
                    message: slots.length > 0 ? "إليك المواعيد المتاحة." : "عذراً، لا توجد مواعيد متاحة في هذا اليوم."
                });
            }

            if (name === 'request_doctor') {
                console.log(`[AI Router] 🔔 Patient requested doctor contact. Reason: ${args.reason || 'unspecified'}`);
                if (patient && patient.id) {
                    await supabase.from('patients')
                        .update({ needs_doctor_attention: true, last_interaction: new Date().toISOString() })
                        .eq('id', patient.id);
                }
                return JSON.stringify({
                    success: true,
                    message: 'تم إشعار الدكتور. سيتواصل معك في أقرب وقت.'
                });
            }

            if (name === 'book_appointment') {
                // Server-side Egyptian phone validation — belt-and-suspenders
                if (args.phoneNumber && !isValidEgyptianPhone(args.phoneNumber)) {
                    console.warn(`[AI Router] book_appointment blocked: invalid Egyptian phone "${args.phoneNumber}"`);
                    return JSON.stringify({
                        error: 'رقم الموبايل غير صحيح. لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015.',
                        action: 'اطلب من المريض إعادة إدخال رقم موبايل مصري صحيح.'
                    });
                }

                // Update patient demographics and mark as actual patient (not a lead)
                const updateFields = { is_lead: false };
                if (args.patientName) updateFields.full_name = args.patientName;
                if (args.phoneNumber) updateFields.phone_number = normalizeEgyptianPhone(args.phoneNumber); // normalize format
                if (args.age) updateFields.age = parseInt(args.age);
                if (args.address) updateFields.address = args.address;
                if (args.weight) updateFields.weight = parseFloat(args.weight);
                if (args.bloodType) updateFields.blood_type = args.bloodType;
                if (args.allergies) updateFields.allergies = args.allergies;
                if (args.chronicConditions) updateFields.chronic_conditions = args.chronicConditions;

                if (args.reasonForVisit && patient) {
                    const defaultMsg = 'تم الإنشاء تلقائياً عبر البوت.';
                    if (!patient.medical_history || patient.medical_history.trim() === defaultMsg) {
                        updateFields.medical_history = args.reasonForVisit;
                    }
                }

                if (Object.keys(updateFields).length > 0 && patient && patient.id) {
                    if (args.phoneNumber) {
                        const cleanPhone = args.phoneNumber.replace(/[^0-9]/g, '');
                        const phoneSearch = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

                        const { data: existingOther } = await supabase
                            .from('patients')
                            .select('*')
                            .eq('clinic_id', clinic.id)
                            .ilike('phone_number', `%${phoneSearch}%`)
                            .neq('id', patient.id)
                            .maybeSingle();

                        if (existingOther) {
                            console.log(`[AI Router] Duplicate phone found (${existingOther.id}). Merging lead ${patient.id} into existing record...`);

                            const updatePayload = {
                                ...updateFields,
                                last_interaction: new Date().toISOString()
                            };
                            if (patient.telegram_id && !existingOther.telegram_id) updatePayload.telegram_id = patient.telegram_id;
                            if (patient.whatsapp_id && !existingOther.whatsapp_id) updatePayload.whatsapp_id = patient.whatsapp_id;

                            const { error: updErr } = await supabase.from('patients').update(updatePayload).eq('id', existingOther.id);
                            if (updErr) {
                                console.error("[AI Router] Merge Update Error:", updErr);
                                throw new Error("عذراً، فشل تحديث بياناتك المسجلة مسبقاً. حاول مرة أخرى.");
                            }

                            // Move linked data
                            await supabase.from('messages').update({ patient_id: existingOther.id }).eq('patient_id', patient.id);
                            await supabase.from('appointments').update({ patient_id: existingOther.id }).eq('patient_id', patient.id);

                            // Switch reference and cleanup lead
                            const oldId = patient.id;
                            patient = existingOther;
                            await supabase.from('patients').delete().eq('id', oldId);
                        } else {
                            const { error: patientError } = await supabase.from('patients').update(updateFields).eq('id', patient.id);
                            if (patientError) {
                                console.error("[AI Router] Patient Update Error:", patientError);
                                throw patientError;
                            }
                        }
                    } else {
                        const { error: patientError } = await supabase.from('patients').update(updateFields).eq('id', patient.id);
                        if (patientError) {
                            console.error("[AI Router] Patient Update Error:", patientError);
                            throw patientError;
                        }
                    }
                }

                const appointmentDate = new Date(`${args.date}T${args.time}`);

                if (!patient || !patient.id) {
                    return JSON.stringify({ error: "عذراً، لم نتمكن من تحديد هوية المريض لإتمام الحجز." });
                }

                const { data: appt, error } = await supabase
                    .from('appointments')
                    .insert({
                        clinic_id: clinic.id,
                        patient_id: patient.id,
                        appointment_date: appointmentDate.toISOString(),
                        status: 'pending',
                        chief_complaint: args.reasonForVisit || 'كشف محجوز عبر المساعد الذكي',
                        source: `ai_${args.platform || 'api'}`,
                        consultation_details: {
                            reason: args.reasonForVisit,
                            type: args.isFollowup ? 'follow-up' : 'new',
                            service_name: args.service_name || 'غير محدد'
                        }
                    }).select().single();

                if (error) throw error;

                return JSON.stringify({
                    success: true,
                    appointment_id: appt.id,
                    message: "تم تسجيل البيانات وحجز الموعد بنجاح."
                });
            }
        } catch (e) {
            console.error(`[AI Router] Tool Execution Error [${name}]:`, e);
            return JSON.stringify({ error: e.message || "An unknown error occurred during tool execution." });
        }
    }

    async handleIncomingMessage({ clinicId, sender, text, platform = 'telegram' }) {
        try {
            console.log(`[AI Router] 📥 Incoming (${platform}): "${text}" from ${sender}`);

            const clinic = await this.getClinicContext(clinicId);
            if (!clinic) return null;

            const patient = await this.getOrCreatePatientContext(clinicId, sender, platform);

            if (patient.id) {
                await supabase.from('messages').insert({
                    clinic_id: clinicId,
                    patient_id: patient.id,
                    sender_type: 'user',
                    content: text,
                    platform: platform,
                    is_read: false
                });

                await supabase.from('patients')
                    .update({ last_interaction: new Date().toISOString() })
                    .eq('id', patient.id);

                // ⚡ Real-time phone detection & instant merge
                // If patient is a new lead, scan their message for an Egyptian phone number.
                // If found and matches an existing patient → merge immediately.
                const isLead = patient.is_lead === true || !patient.full_name || patient.full_name === 'مريض جديد';
                const hasNoPhone = !isValidEgyptianPhone(patient.phone_number);

                if (isLead && hasNoPhone) {
                    const phoneMatch = text.match(/0(10|11|12|15)\d{8}/g);
                    if (phoneMatch && phoneMatch.length > 0) {
                        const detectedPhone = normalizeEgyptianPhone(phoneMatch[0]);
                        console.log(`[AI Router] 📞 Detected Egyptian phone in message: ${detectedPhone}`);

                        // Try to find existing patient with this phone (excluding current lead)
                        const last10 = detectedPhone.slice(-10);
                        const { data: existingPatient } = await supabase
                            .from('patients')
                            .select('*')
                            .eq('clinic_id', clinicId)
                            .ilike('phone_number', `%${last10}%`)
                            .neq('id', patient.id)
                            .maybeSingle();

                        if (existingPatient) {
                            console.log(`[AI Router] ✅ Phone matched existing patient: ${existingPatient.full_name}. Merging lead → existing record.`);
                            // Link the social ID (telegram/messenger/whatsapp) to the existing record
                            let socialIdField = platform === 'telegram' ? 'telegram_id' :
                                platform === 'messenger' ? 'messenger_id' : 'whatsapp_id';
                            const cleanSocialId = sender.replace(/^(tg_|msg_)/, '');

                            // Update existing patient to add social ID from this platform
                            await supabase.from('patients')
                                .update({
                                    [socialIdField]: cleanSocialId,
                                    last_interaction: new Date().toISOString()
                                })
                                .eq('id', existingPatient.id);

                            // Move messages from the lead to the existing patient record
                            await supabase.from('messages')
                                .update({ patient_id: existingPatient.id })
                                .eq('patient_id', patient.id);

                            // Delete the lead
                            await supabase.from('patients').delete().eq('id', patient.id);

                            console.log(`[AI Router] 🔀 Merge complete. Resetting AI session to load correct patient context.`);
                            // Reset AI session so it reloads with the real patient's data on next message
                            const sessionKey = `${clinicId}_${sender}`;
                            this.sessions.delete(sessionKey);
                        } else {
                            // No existing match — just update the lead's phone number
                            await supabase.from('patients')
                                .update({ phone_number: detectedPhone })
                                .eq('id', patient.id);
                            console.log(`[AI Router] 📱 Updated lead phone to: ${detectedPhone}`);
                        }
                    }
                }
            }

            const sessionKey = `${clinicId}_${sender}`;
            let session = this.sessions.get(sessionKey);

            if (!session || (Date.now() - session.lastUsed > 30 * 60 * 1000)) {
                // Format services available
                let servicesList = clinic.clinic_services && clinic.clinic_services.length > 0
                    ? clinic.clinic_services.map(s => s.name).join('، ')
                    : '';

                // FALLBACK: If database is empty, use specialty templates
                if (!servicesList) {
                    const templates = SERVICE_TEMPLATES[clinic.specialty] || [];
                    if (templates.length > 0) {
                        servicesList = templates.join('، ');
                    } else {
                        servicesList = 'الكشف العام (لم يتم تحديد خدمات متخصصة بعد)';
                    }
                }

                const isNewPatient = !patient.full_name || patient.full_name === 'مريض جديد';
                const hasValidPhone = isValidEgyptianPhone(patient.phone_number);

                const systemInstruction = `
                    أنت السكرتير الطبي الذكي لـ "${clinic.clinic_name}".
                    تعليمات الطبيب: "${clinic.system_prompt}"
                    
                    🌟 الخدمات المتاحة بهذه العيادة:
                    [${servicesList}]
                    
                    📋 بيانات المريض المسجلة:
                    - الاسم: ${patient.full_name || 'غير معروف'}
                    - رقم الموبايل: ${hasValidPhone ? 'مسجل ✓' : 'غير مسجل'}
                    - التاريخ الطبي: ${patient.medical_history || 'لا يوجد'}
                    
                    🎯 تسلسل الترحيب:
                    ${isNewPatient
                        ? '• مريض جديد: قدم نفسك باختصار واطلب اسمه أولاً.'
                        : `• مريض معروف: رحب بـ "${patient.full_name}" مباشرةً باسمه.`
                    }
                    ${!hasValidPhone ? '• رقم الموبايل غير مسجل: اطلبه قبل الحجز.' : ''}
                    
                    � تعليمات خاصة بالأدوات:
                    - إذا طلب المريض التواصل مع الدكتور أو سألك "عاوز أكلم الدكتور"، استخدم أداة "request_doctor".
                    - لا تقم بالحجز إلا بعد التأكد من (اليوم، الوقت، واسم المريض).
                    - تأكد من صحة رقم الموبايل المصري (11 رقم) قبل الحجز.
                    
                    �🛑 قواعد الحوار:
                    - ممنوع إظهار أرقام الموبايل في الشات.
                    - لا تقبل حجز أي خدمة غير موجودة في القائمة أعلاه.
                    - لا تكرر الأسئلة عن بيانات موجودة مسبقاً.
                    - اقبل رقم الموبايل كما يعطيه المريض بدون تحقق - النظام سيتحقق تلقائياً.
                    - عند الحجز اجمع معلومتين منفصلتين:
                      1. نوع الكشف: اختر من قائمة الخدمات المتاحة (هو الخدمة الرسمية).
                      2. سبب الزيارة: ما يشتكي منه المريض بكلامه هو (مثل: ألم في الصدر، حمة، متابعة).
                    - استخدم check_availability و book_appointment. مرر نوع الكشف في visitType و service_name، ومرر شكوى المريض في reasonForVisit.
                `;

                const chat = this.model.startChat({
                    history: [
                        { role: "user", parts: [{ text: "ما هي تعليماتك؟" }] },
                        { role: "model", parts: [{ text: systemInstruction }] },
                    ]
                });

                session = { chat, lastUsed: Date.now() };
                this.sessions.set(sessionKey, session);
            } else {
                session.lastUsed = Date.now();
            }

            const now = new Date();
            const dateContext = `[التاريخ: ${now.toLocaleDateString('ar-EG')}، الوقت: ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}]`;

            let result = await session.chat.sendMessage(`${dateContext}\n\n${text}`);
            let response = result.response;

            let toolIter = 0;
            while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && toolIter < 3) {
                const parts = response.candidates[0].content.parts;
                const functionCallPart = parts.find(p => p.functionCall);

                if (functionCallPart) {
                    const { name, args } = functionCallPart.functionCall;
                    // Inject platform into args for tool
                    args.platform = platform;
                    const apiResponse = await this.executeTool(name, args, clinic, patient);

                    result = await session.chat.sendMessage([{
                        functionResponse: {
                            name: name,
                            response: { content: apiResponse }
                        }
                    }]);
                    response = result.response;
                }
                toolIter++;
            }

            const finalAiText = response.text ? response.text() : "تمت العملية بنجاح.";

            if (patient.id) {
                await supabase.from('messages').insert({
                    clinic_id: clinicId,
                    patient_id: patient.id,
                    sender_type: 'doctor',
                    content: finalAiText,
                    is_read: true
                });
            }

            return finalAiText;

        } catch (error) {
            console.error(`[AI Router Fatal Error]:`, error);
            return "عذراً يا فندم، حصلت مشكلة تقنية بسيطة. ثواني وهحاول تاني.";
        }
    }
}

module.exports = new AIAgentRouter();
