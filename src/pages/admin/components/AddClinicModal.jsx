import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Save } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { SPECIALTIES, SERVICE_TEMPLATES } from '../../../lib/serviceTemplates';
import { API_URL } from '../../../lib/api';

const AddClinicModal = ({ isOpen, onClose, onClinicAdded }) => {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        clinic_name: '',
        specialty: '', // Will start from select or text
        phone_number: '',
        status: 'active',
        system_prompt: 'أنت مساعد ذكي لجدولة المواعيد. قم بجمع اسم المريض وشكواه الرئيسية.',
        booking_duration: 30,
        bot_token: '',
        calendar_id: '',
        doctorEmail: '',
        doctorPassword: ''
    });

    // New State for Services Feature
    const [useCustomServices, setUseCustomServices] = useState(false);
    const [selectedServices, setSelectedServices] = useState([]);
    const [customServiceInput, setCustomServiceInput] = useState('');
    const [isOtherSpecialty, setIsOtherSpecialty] = useState(false);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Handle Specialty Selection logic
        if (name === 'specialty') {
            if (value === 'أخرى') {
                setIsOtherSpecialty(true);
                setFormData(prev => ({ ...prev, specialty: '' })); // Clear for manual text input
            } else {
                setIsOtherSpecialty(false);
            }
            // Reset services if specialty changes
            setSelectedServices([]);
        }
    };

    const handleServiceToggle = (serviceName) => {
        if (selectedServices.includes(serviceName)) {
            setSelectedServices(selectedServices.filter(s => s !== serviceName));
        } else {
            setSelectedServices([...selectedServices, serviceName]);
        }
    };

    const handleAddCustomService = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (customServiceInput.trim() && !selectedServices.includes(customServiceInput.trim())) {
            setSelectedServices([...selectedServices, customServiceInput.trim()]);
            setCustomServiceInput('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Get session for auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('يرجى تسجيل الدخول كمسؤول');

            // 1. Create the Doctor's Auth Account securely via our backend admin route
            const response = await fetch(`${API_URL}/api/admin/create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    email: formData.doctorEmail,
                    password: formData.doctorPassword
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details || data.error || 'فشل إنشاء حساب الطبيب');
            }

            const newOwnerId = data.user.id;

            // 2. Prepare payload (exclude email/password from the DB row)
            const payload = {
                clinic_name: formData.clinic_name,
                specialty: formData.specialty,
                phone_number: formData.phone_number,
                status: formData.status,
                system_prompt: formData.system_prompt,
                booking_duration: formData.booking_duration,
                bot_token: formData.bot_token,
                calendar_id: formData.calendar_id,
                owner_id: newOwnerId
            };

            // 3. Insert Clinic
            let clinicData, clinicError;
            try {
                const res = await supabase
                    .from('clinics')
                    .insert([payload])
                    .select();
                clinicData = res.data;
                clinicError = res.error;

                if (clinicError) {
                    throw clinicError;
                }
            } catch (err) {
                // Rollback: Delete the user we just created
                console.error("Clinic creation failed, deleting auth user:", newOwnerId);
                await fetch(`${API_URL}/api/admin/delete-user/${newOwnerId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                }).catch(e => console.error("Rollback failed:", e));

                throw err;
            }

            const newClinic = clinicData[0];

            // 4. Insert Clinic Services (if enabled and requested, OR insert defaults for specialty)
            const servicesToInsert = useCustomServices
                ? selectedServices
                : (SERVICE_TEMPLATES[formData.specialty] || []);

            if (servicesToInsert.length > 0) {
                const servicesPayload = servicesToInsert.map(serviceName => ({
                    clinic_id: newClinic.id,
                    name: serviceName
                }));

                const { error: servicesError } = await supabase
                    .from('clinic_services')
                    .insert(servicesPayload);

                if (servicesError) {
                    console.error('Error adding clinic services:', servicesError);
                    toast.error('تم إنشاء العيادة، لكن حدث خطأ أثناء إضافة الخدمات.');
                }
            }

            onClinicAdded(newClinic);
            onClose();
            // Reset form
            setFormData({
                clinic_name: '',
                specialty: '',
                phone_number: '',
                subscription_status: 'active',
                system_prompt: 'أنت مساعد ذكي لجدولة المواعيد. قم بجمع اسم المريض وشكواه الرئيسية.',
                booking_duration: 30,
                bot_token: '',
                calendar_id: '',
                doctorEmail: '',
                doctorPassword: ''
            });
            setUseCustomServices(false);
            setSelectedServices([]);
            setCustomServiceInput('');
            setIsOtherSpecialty(false);
        } catch (error) {
            console.error('Error adding clinic:', error);
            toast.error('حدث خطأ أثناء إضافة العيادة: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative" dir="rtl">
                <button
                    onClick={onClose}
                    className="absolute left-4 top-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-6 text-white">إضافة عيادة جديدة</h2>

                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-2 pb-4 styled-scrollbar">

                    {/* --- Authentication Details --- */}
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-4 mb-6">
                        <h3 className="text-purple-400 font-bold mb-2">بيانات دخول الطبيب (سجل الدخول)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">البريد الإلكتروني</label>
                                <input
                                    required
                                    type="email"
                                    name="doctorEmail"
                                    value={formData.doctorEmail}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                                    placeholder="doctor@clinic.com"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">كلمة المرور</label>
                                <input
                                    required
                                    type="text"
                                    name="doctorPassword"
                                    value={formData.doctorPassword}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                                    placeholder="******"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>

                    {/* --- Clinic Details --- */}
                    <h3 className="text-slate-300 font-bold mb-2 border-b border-white/10 pb-2">بيانات العيادة</h3>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">اسم العيادة</label>
                        <input
                            required
                            type="text"
                            name="clinic_name"
                            value={formData.clinic_name}
                            onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none"
                            placeholder="مثال: عيادة النور التخصصية"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">التخصص</label>
                        {!isOtherSpecialty ? (
                            <select
                                required
                                name="specialty"
                                value={formData.specialty}
                                onChange={handleChange}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none appearance-none"
                            >
                                <option value="" disabled>اختر التخصص...</option>
                                {SPECIALTIES.map(spec => (
                                    <option key={spec} value={spec}>{spec}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="flex gap-2 relative">
                                <input
                                    required
                                    type="text"
                                    name="specialty"
                                    value={formData.specialty}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none"
                                    placeholder="اكتب التخصص يدوياً..."
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOtherSpecialty(false);
                                        setFormData(prev => ({ ...prev, specialty: '' }));
                                    }}
                                    className="px-3 bg-slate-800 text-slate-400 rounded-xl hover:text-white"
                                    title="رجوع للقائمة"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* --- Services Section --- */}
                    {formData.specialty && formData.specialty !== 'أخرى' && (
                        <div className="mt-4 p-4 rounded-xl border border-slate-700 bg-slate-900/50">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-white font-bold">إعدادات خدمات العيادة</h4>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className="text-sm text-slate-400">تخصيص خدمات البوت؟</span>
                                    <input
                                        type="checkbox"
                                        checked={useCustomServices}
                                        onChange={(e) => setUseCustomServices(e.target.checked)}
                                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-800 border-slate-600"
                                    />
                                </label>
                            </div>

                            {useCustomServices && (
                                <div className="space-y-4">
                                    <p className="text-xs text-slate-400">
                                        اختر الخدمات التي تقدمها هذه العيادة ليستخدمها المساعد الذكي أثناء الحجز. المستبعد لن يتم حجزه.
                                    </p>

                                    {/* Templates Checkboxes */}
                                    {SERVICE_TEMPLATES[formData.specialty] && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {SERVICE_TEMPLATES[formData.specialty].map(service => (
                                                <label key={service} className="flex items-center gap-2 cursor-pointer bg-slate-800/50 border border-slate-700/50 p-2 rounded-lg hover:bg-slate-800 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedServices.includes(service)}
                                                        onChange={() => handleServiceToggle(service)}
                                                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-950 border-slate-600"
                                                    />
                                                    <span className="text-sm text-slate-300">{service}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {/* Custom Service Adder */}
                                    <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                                        <input
                                            type="text"
                                            value={customServiceInput}
                                            onChange={(e) => setCustomServiceInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomService(e); }}
                                            placeholder="إضافة خدمة غير موجودة بالقائمة..."
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddCustomService}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            إضافة
                                        </button>
                                    </div>

                                    {/* Selected non-template services tags */}
                                    {selectedServices
                                        .filter(s => !(SERVICE_TEMPLATES[formData.specialty] || []).includes(s))
                                        .length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {selectedServices
                                                    .filter(s => !(SERVICE_TEMPLATES[formData.specialty] || []).includes(s))
                                                    .map(service => (
                                                        <div key={service} className="flex items-center gap-1 bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs">
                                                            <span>{service}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleServiceToggle(service)}
                                                                className="hover:text-white"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">رقم الهاتف</label>
                        <input
                            type="tel"
                            name="phone_number"
                            value={formData.phone_number}
                            onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                            placeholder="+20..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">مدة الكشف (بالدقائق)</label>
                        <input
                            required
                            type="number"
                            name="booking_duration"
                            value={formData.booking_duration}
                            onChange={handleChange}
                            min="5"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">تعليمات الذكاء الاصطناعي (System Prompt)</label>
                        <textarea
                            required
                            name="system_prompt"
                            value={formData.system_prompt}
                            onChange={handleChange}
                            rows="3"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-right placeholder-slate-600"
                            placeholder="مثال: أنت مساعد طبيب أسنان، اسأل المريض عن نوع الألم..."
                        ></textarea>
                        <p className="text-xs text-slate-500 mt-1">هذه هي التعليمات التي سيلتزم بها البوت عند التحدث مع مرضى هذه العيادة.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Bot Token (اختياري)</label>
                            <input
                                type="text"
                                name="bot_token"
                                value={formData.bot_token}
                                onChange={handleChange}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left placeholder-slate-600"
                                placeholder="Token..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Calendar ID (اختياري)</label>
                            <input
                                type="text"
                                name="calendar_id"
                                value={formData.calendar_id}
                                onChange={handleChange}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left placeholder-slate-600"
                                placeholder="ID..."
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
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
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {loading ? 'جاري الحفظ...' : (
                                <>
                                    <Save size={18} />
                                    حفظ العيادة
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddClinicModal;
