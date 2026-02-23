import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Save, Calendar, Clock, User, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

const AddAppointmentModal = ({ isOpen, onClose, onAppointmentAdded, initialData }) => {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [foundPatient, setFoundPatient] = useState(null);
    const [formData, setFormData] = useState({
        patient_name: '',
        phone_number: '',
        gender: 'male',
        address: '',
        age: '',
        blood_type: '',
        weight: '',
        allergies: '',
        chronic_conditions: '',
        date: '',
        time: '',
        chief_complaint: '',
        type: '' // Will be filled from services
    });
    const [services, setServices] = useState([]);
    const [fetchingServices, setFetchingServices] = useState(false);
    const [phoneError, setPhoneError] = useState('');

    // Egyptian phone validator
    const isValidEgyptianPhone = (phone) => {
        if (!phone) return false;
        let cleaned = String(phone).replace(/[\s-]/g, '');
        if (cleaned.startsWith('+20')) cleaned = '0' + cleaned.slice(3);
        else if (cleaned.startsWith('20') && cleaned.length === 12) cleaned = '0' + cleaned.slice(2);
        return /^0(10|11|12|15)\d{8}$/.test(cleaned);
    };

    const getPhoneError = (phone) => {
        if (!phone) return '';
        const cleaned = phone.replace(/[\s-]/g, '');
        if (cleaned.length < 11) return `الرقم ناقص — عندك ${cleaned.length} رقم والمفروض 11 رقم`;
        if (cleaned.length > 11) return `الرقم زيادة — عندك ${cleaned.length} رقم والمفروض 11 رقم بس`;
        if (!isValidEgyptianPhone(cleaned)) return 'الرقم لازم يبدأ بـ 010 أو 011 أو 012 أو 015 فقط';
        return '';
    };

    useEffect(() => {
        if (isOpen) {
            setFoundPatient(null);
            if (initialData) {
                setFormData(prev => ({
                    ...prev,
                    date: initialData.date || '',
                    time: initialData.time || ''
                }));
            } else {
                setFormData({
                    patient_name: '',
                    phone_number: '',
                    gender: 'male',
                    address: '',
                    age: '',
                    blood_type: '',
                    weight: '',
                    allergies: '',
                    chronic_conditions: '',
                    date: new Date().toISOString().split('T')[0],
                    time: '12:00',
                    chief_complaint: '',
                    type: ''
                });
            }

            // Fetch Clinic Services
            const fetchClinicData = async () => {
                setFetchingServices(true);
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    const { data: clinic } = await supabase
                        .from('clinics')
                        .select('id')
                        .eq('owner_id', user.id)
                        .single();

                    if (clinic) {
                        const { data: servicesData } = await supabase
                            .from('clinic_services')
                            .select('name')
                            .eq('clinic_id', clinic.id)
                            .order('name');

                        setServices(servicesData || []);
                        if (servicesData?.length > 0 && !formData.type) {
                            setFormData(prev => ({ ...prev, type: servicesData[0].name }));
                        }
                    }
                } catch (error) {
                    console.error('Error fetching clinic services:', error);
                } finally {
                    setFetchingServices(false);
                }
            };
            fetchClinicData();
        }
    }, [isOpen, initialData]);

    // Smart Lookup Effect
    useEffect(() => {
        const lookupPatient = async () => {
            if (formData.phone_number.length < 10) return; // Wait for a valid length

            setLookupLoading(true);
            try {
                const { data, error } = await supabase
                    .from('patients')
                    .select('*')
                    .eq('phone_number', formData.phone_number)
                    .single();

                if (data) {
                    setFoundPatient(data);
                    // Auto-fill name if empty or if needed
                    setFormData(prev => ({ ...prev, patient_name: data.full_name }));
                } else {
                    setFoundPatient(null);
                }
            } catch (err) {
                // Ignore "Row not found" errors essentially
                setFoundPatient(null);
            } finally {
                setLookupLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            lookupPatient();
        }, 500); // Debounce 500ms

        return () => clearTimeout(timeoutId);
    }, [formData.phone_number]);


    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (name === 'phone_number') {
            setPhoneError(getPhoneError(value));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Egyptian phone validation before anything
        const pErr = getPhoneError(formData.phone_number);
        if (pErr) {
            setPhoneError(pErr);
            return;
        }

        setLoading(true);
        try {
            // 0. Get Clinic ID & Working Hours
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const { data: clinic } = await supabase
                .from('clinics')
                .select('id, working_hours')
                .eq('owner_id', user.id)
                .single();

            if (!clinic) throw new Error('Clinic not found');
            const clinicId = clinic.id;

            // --- WORKING HOURS VALIDATION ---
            if (clinic.working_hours) {
                const appointmentDate = new Date(formData.date);
                const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const dayName = daysMap[appointmentDate.getDay()];
                const dayConfig = clinic.working_hours[dayName];

                if (dayConfig) {
                    if (!dayConfig.enabled) {
                        toast.error(`عذراً، العيادة مغلقة في يوم ${dayConfig.label || dayName}.`);
                        setLoading(false);
                        return;
                    }

                    // Helper to convert time ("HH:mm" or "hh:mm PM") to minutes
                    const timeToMinutes = (timeStr) => {
                        if (!timeStr) return 0;
                        const lower = timeStr.toLowerCase().trim();
                        const isPM = lower.includes('pm') || lower.includes('م');
                        const isAM = lower.includes('am') || lower.includes('ص');

                        let [h, m] = lower.replace(/[^0-9:]/g, '').split(':');
                        let hour = parseInt(h, 10);
                        let minute = parseInt(m, 10) || 0;

                        if (isPM && hour < 12) hour += 12;
                        if (isAM && hour === 12) hour = 0;

                        return hour * 60 + minute;
                    };

                    const selectedMinutes = timeToMinutes(formData.time);
                    const startMinutes = timeToMinutes(dayConfig.start);
                    let endMinutes = timeToMinutes(dayConfig.end);

                    // Handle midnight wrapping for end time if needed (e.g. 00:00 end means next day)
                    // If end is 0 (midnight) and start is non-zero, assume end is 24:00 (1440 mins)
                    if (endMinutes === 0 && startMinutes > 0) endMinutes = 24 * 60;

                    if (selectedMinutes < startMinutes || selectedMinutes > endMinutes) {
                        toast.error(`عذراً، هذا الموعد خارج ساعات العمل (${dayConfig.start} - ${dayConfig.end}).`);
                        setLoading(false);
                        return;
                    }
                }
            }
            // --------------------------------

            // 1. Upsert Patient (Find or Create)
            let patientId;

            if (foundPatient) {
                patientId = foundPatient.id;
            } else {
                // Create new patient
                const { data: newPatient, error: createError } = await supabase
                    .from('patients')
                    .insert([{
                        clinic_id: clinicId,
                        full_name: formData.patient_name,
                        phone_number: formData.phone_number,
                        gender: formData.gender,
                        address: formData.address,
                        age: formData.age ? parseInt(formData.age) : null,
                        weight: formData.weight ? parseFloat(formData.weight) : null,
                        blood_type: formData.blood_type || null,
                        allergies: formData.allergies || null,
                        chronic_conditions: formData.chronic_conditions || null,
                        source: 'manual',
                        last_interaction: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (createError) throw createError;
                patientId = newPatient.id;
            }

            // 2. Create Appointment
            const appointmentDate = new Date(`${formData.date}T${formData.time}`);

            const { data: appointment, error: apptError } = await supabase
                .from('appointments')
                .insert([{
                    patient_id: patientId,
                    appointment_date: appointmentDate.toISOString(),
                    status: 'confirmed',
                    clinic_id: clinicId,
                    chief_complaint: formData.chief_complaint || formData.type || 'كشف عادي',
                    service_name: formData.type || null,
                    source: 'manual'
                }])
                .select(`*, patients(full_name, phone_number)`)
                .single();

            if (apptError) throw apptError;

            onAppointmentAdded(appointment);
            onClose();

        } catch (error) {
            console.error('Error adding appointment:', error);
            toast.error('حدث خطأ أثناء حجز الموعد: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className={`bg-slate-900 border border-white/10 rounded-2xl w-full p-6 shadow-2xl relative transition-all duration-300 ${foundPatient ? 'max-w-lg' : 'max-w-2xl'}`} dir="rtl">
                <button
                    onClick={onClose}
                    className="absolute left-4 top-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-6 text-white text-center">
                    {foundPatient ? 'حجز موعد لمريض حالي' : 'تسجيل مريض وحجز جديد'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Column 1: Patient Info */}
                        <div className="space-y-4">
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3 relative overflow-hidden h-full">
                                {foundPatient && (
                                    <div className="absolute top-0 left-0 bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded-br-lg border-b border-r border-emerald-500/20 flex items-center gap-1">
                                        <User size={12} />
                                        مريض مسجل
                                    </div>
                                )}

                                <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-4">
                                    <User size={16} />بيانات المريض
                                </h3>

                                {/* Phone - Always Visible */}
                                <div className="relative">
                                    <label className="text-xs text-slate-500 mb-1 block">رقم الهاتف</label>
                                    <input
                                        required
                                        type="tel"
                                        name="phone_number"
                                        value={formData.phone_number}
                                        onChange={handleChange}
                                        className={`w-full bg-slate-900 border rounded-lg p-3 focus:border-sky-500 outline-none text-left pl-10 transition-colors
                                        ${foundPatient ? 'border-emerald-500/50' : 'border-slate-700'}`}
                                        placeholder="01xxxxxxxxx"
                                        autoComplete="off"
                                    />
                                    {lookupLoading && (
                                        <div className="absolute left-3 top-[34px]">
                                            <div className="w-4 h-4 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    {foundPatient && !lookupLoading && (
                                        <div className="absolute left-3 top-[34px] text-emerald-400">
                                            <CheckCircle2 size={18} />
                                        </div>
                                    )}
                                </div>
                                {/* Phone Error */}
                                {phoneError && (
                                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                        <span>⚠️</span> {phoneError}
                                    </p>
                                )}

                                {/* Name - Readonly if found */}
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">اسم المريض</label>
                                    <input
                                        required
                                        type="text"
                                        name="patient_name"
                                        value={formData.patient_name}
                                        onChange={handleChange}
                                        readOnly={!!foundPatient}
                                        className={`w-full bg-slate-900 border rounded-lg p-3 focus:border-sky-500 outline-none transition-colors
                                            ${foundPatient ? 'border-emerald-500/50 text-emerald-100 bg-emerald-500/5 cursor-not-allowed' : 'border-slate-700'}`}
                                        placeholder="اسم المريض بالكامل"
                                    />
                                </div>

                                {/* Extra Fields - ONLY for New Patients */}
                                {!foundPatient && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="flex gap-3">
                                            <div className="w-1/2">
                                                <label className="text-xs text-slate-500 mb-1 block">السن</label>
                                                <input
                                                    type="number"
                                                    name="age"
                                                    value={formData.age}
                                                    onChange={handleChange}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                                    placeholder="مثال: 30"
                                                />
                                            </div>
                                            <div className="w-1/2">
                                                <label className="text-xs text-slate-500 mb-1 block">النوع</label>
                                                <select
                                                    name="gender"
                                                    value={formData.gender}
                                                    onChange={handleChange}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                                >
                                                    <option value="male">ذكر</option>
                                                    <option value="female">أنثى</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">العنوان (اختياري)</label>
                                            <input
                                                type="text"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleChange}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                                placeholder="العنوان بالتفصيل"
                                            />
                                        </div>

                                        <div className="flex gap-3">
                                            <div className="w-1/2">
                                                <label className="text-xs text-slate-500 mb-1 block">فصيلة الدم</label>
                                                <select
                                                    name="blood_type"
                                                    value={formData.blood_type}
                                                    onChange={handleChange}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                                >
                                                    <option value="">غير محدد</option>
                                                    <option value="A+">A+</option>
                                                    <option value="A-">A-</option>
                                                    <option value="B+">B+</option>
                                                    <option value="B-">B-</option>
                                                    <option value="AB+">AB+</option>
                                                    <option value="AB-">AB-</option>
                                                    <option value="O+">O+</option>
                                                    <option value="O-">O-</option>
                                                </select>
                                            </div>
                                            <div className="w-1/2">
                                                <label className="text-xs text-slate-500 mb-1 block">الوزن (kg)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    name="weight"
                                                    value={formData.weight}
                                                    onChange={handleChange}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                                    placeholder="مثال: 75.5"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-rose-500 mb-1 block">الحساسية (اختياري)</label>
                                            <input
                                                type="text"
                                                name="allergies"
                                                value={formData.allergies}
                                                onChange={handleChange}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-rose-500 outline-none"
                                                placeholder="أدوية أو أطعمة..."
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-orange-500 mb-1 block">أمراض مزمنة (اختياري)</label>
                                            <input
                                                type="text"
                                                name="chronic_conditions"
                                                value={formData.chronic_conditions}
                                                onChange={handleChange}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-orange-500 outline-none"
                                                placeholder="ضغط، سكري..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Appointment Info */}
                        <div className="space-y-4">
                            {/* Date & Time */}
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                                <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-4">
                                    <Calendar size={16} />تفاصيل الحجز
                                </h3>
                                <div className="flex gap-3">
                                    <div className="w-1/2">
                                        <label className="text-xs text-slate-500 mb-1 block">التاريخ</label>
                                        <input
                                            required
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                        />
                                    </div>
                                    <div className="w-1/2">
                                        <label className="text-xs text-slate-500 mb-1 block">الوقت</label>
                                        <input
                                            required
                                            type="time"
                                            name="time"
                                            value={formData.time}
                                            onChange={handleChange}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Additional Details */}
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">نوع الكشف</label>
                                    <select
                                        name="type"
                                        value={formData.type}
                                        onChange={handleChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                        disabled={fetchingServices}
                                    >
                                        {fetchingServices ? (
                                            <option>جاري تحميل الخدمات...</option>
                                        ) : services.length > 0 ? (
                                            services.map((s, idx) => (
                                                <option key={idx} value={s.name}>{s.name}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="checkup">كشف جديد</option>
                                                <option value="followup">إعادة / استشارة</option>
                                                <option value="emergency">حالة طارئة</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">سبب الزيارة (اختياري)</label>
                                    <input
                                        type="text"
                                        name="chief_complaint"
                                        value={formData.chief_complaint || ''}
                                        onChange={handleChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                                        placeholder="مثال: ألم في المعدة (اختياري)"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-8 py-2 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 text-white shadow-lg
                                ${foundPatient ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
                        >
                            {loading ? 'جاري الحجز...' : (
                                <>
                                    <Save size={18} />
                                    {foundPatient ? 'تأكيد الحجز السريع' : 'تسجيل وحجز'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddAppointmentModal;
