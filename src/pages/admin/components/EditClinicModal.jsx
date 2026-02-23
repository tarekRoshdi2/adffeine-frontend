import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Save, Plus } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { API_URL } from '../../../lib/api';

const EditClinicModal = ({ isOpen, onClose, clinic, onClinicUpdated }) => {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        clinic_name: '',
        specialty: '',
        phone_number: '',
        status: 'active',
        system_prompt: '',
        booking_duration: 30,
        bot_token: '',
        calendar_id: '',
        doctorEmail: '',
        doctorPassword: ''
    });
    const [services, setServices] = useState([]);
    const [newServiceInput, setNewServiceInput] = useState('');
    const [fetchingServices, setFetchingServices] = useState(false);

    useEffect(() => {
        if (clinic) {
            setFormData({
                clinic_name: clinic.clinic_name || '',
                specialty: clinic.specialty || '',
                phone_number: clinic.phone_number || '',
                status: clinic.status || 'active',
                system_prompt: clinic.system_prompt || '',
                booking_duration: clinic.booking_duration || 30,
                bot_token: clinic.bot_token || '',
                calendar_id: clinic.calendar_id || '',
                doctorEmail: '', // Will fetch or stay empty
                doctorPassword: ''
            });

            // Fetch Doctor Email from profiles
            const fetchDoctorEmail = async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('id', clinic.owner_id)
                    .single();
                if (data) {
                    setFormData(prev => ({ ...prev, doctorEmail: data.email }));
                }
            };
            fetchDoctorEmail();

            // Fetch Clinic Services
            const fetchServices = async () => {
                setFetchingServices(true);
                try {
                    const { data, error } = await supabase
                        .from('clinic_services')
                        .select('*')
                        .eq('clinic_id', clinic.id)
                        .order('created_at', { ascending: true });

                    if (error) throw error;
                    setServices(data || []);
                } catch (error) {
                    console.error('Error fetching services:', error);
                    toast.error('فشل جلب خدمات العيادة');
                } finally {
                    setFetchingServices(false);
                }
            };

            fetchServices();
        } else {
            setServices([]);
        }
    }, [clinic]);

    if (!isOpen || !clinic) return null;

    const handleAddService = async (e) => {
        e.preventDefault();
        const serviceName = newServiceInput.trim();
        if (!serviceName) return;

        // Optimistic UI check (not strictly necessary but good for UX)
        if (services.some(s => s.name === serviceName)) {
            toast.error('هذه الخدمة مضافة مسبقاً');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('clinic_services')
                .insert([{ clinic_id: clinic.id, name: serviceName }])
                .select();

            if (error) throw error;

            setServices([...services, data[0]]);
            setNewServiceInput('');
            toast.success('تم إضافة الخدمة للعيادة');
        } catch (error) {
            console.error('Error adding service:', error);
            toast.error('فشل إضافة الخدمة');
        }
    };

    const handleDeleteService = async (serviceId) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;

        try {
            const { error } = await supabase
                .from('clinic_services')
                .delete()
                .eq('id', serviceId);

            if (error) throw error;

            setServices(services.filter(s => s.id !== serviceId));
            toast.success('تم حذف الخدمة بنجاح');
        } catch (error) {
            console.error('Error deleting service:', error);
            toast.error('فشل حذف الخدمة');
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Update User Credentials if changed
            if (formData.doctorEmail || formData.doctorPassword) {
                const updateRes = await fetch(`${API_URL}/api/admin/update-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: clinic.owner_id,
                        email: formData.doctorEmail,
                        password: formData.doctorPassword
                    })
                });
                const updateData = await updateRes.json();
                if (!updateRes.ok) {
                    throw new Error(updateData.error || 'فشل تحديث بيانات الدخول');
                }
            }

            // 2. Update Clinic Data
            const { doctorEmail, doctorPassword, ...clinicPayload } = formData;
            const { data, error } = await supabase
                .from('clinics')
                .update(clinicPayload)
                .eq('id', clinic.id)
                .select();

            if (error) throw error;

            onClinicUpdated(data[0]);
            onClose();
            toast.success('تم تحديث بيانات العيادة بنجاح');
        } catch (error) {
            console.error('Error updating clinic:', error);
            toast.error('حدث خطأ أثناء التحديث: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" dir="rtl">
                <button
                    onClick={onClose}
                    className="absolute left-4 top-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-6 text-white">تعديل بيانات العيادة</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">اسم العيادة</label>
                        <input
                            required
                            type="text"
                            name="clinic_name"
                            value={formData.clinic_name}
                            onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">التخصص</label>
                        <input
                            required
                            type="text"
                            name="specialty"
                            value={formData.specialty}
                            onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">حالة الاشتراك</label>
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-right"
                        >
                            <option value="active">نشط</option>
                            <option value="inactive">غير نشط</option>
                            <option value="suspended">موقوف</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">رقم الهاتف</label>
                        <input
                            type="tel"
                            name="phone_number"
                            value={formData.phone_number}
                            onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                            dir="ltr"
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
                            rows="4"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-right placeholder-slate-600 styled-scrollbar"
                        ></textarea>
                    </div>

                    {/* --- Service Management UI --- */}
                    <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/50 mt-4">
                        <h4 className="text-white font-bold mb-4">إدارة خدمات العيادة</h4>

                        {/* Current Services List */}
                        <div className="mb-4">
                            {fetchingServices ? (
                                <p className="text-sm text-slate-500">جاري التحميل...</p>
                            ) : services.length === 0 ? (
                                <p className="text-sm text-slate-500">لا توجد خدمات مخصصة لهذه العيادة.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {services.map((service) => (
                                        <div key={service.id} className="flex items-center gap-2 bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-lg text-sm border border-purple-500/30">
                                            <span>{service.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteService(service.id)}
                                                className="hover:text-red-400 p-0.5 rounded transition-colors"
                                                title="حذف الخدمة"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add New Service Input */}
                        <div className="flex gap-2 border-t border-slate-700/50 pt-4">
                            <input
                                type="text"
                                value={newServiceInput}
                                onChange={(e) => setNewServiceInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddService(e); }}
                                placeholder="اسم الخدمة الجديدة..."
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAddService}
                                disabled={!newServiceInput.trim()}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                <Plus size={16} />
                                إضافة
                            </button>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/50 mt-4 space-y-4">
                        <h4 className="text-white font-bold mb-2">بيانات الدخول (الطبيب)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">البريد الإلكتروني</label>
                                <input
                                    type="email"
                                    name="doctorEmail"
                                    value={formData.doctorEmail}
                                    onChange={handleChange}
                                    placeholder="Leave blank to keep current"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">كلمة المرور الجديدة</label>
                                <input
                                    type="password"
                                    name="doctorPassword"
                                    value={formData.doctorPassword}
                                    onChange={handleChange}
                                    placeholder="اتركه فارغاً للحفاظ على الحالية"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Bot Token</label>
                            <input
                                type="text"
                                name="bot_token"
                                value={formData.bot_token}
                                onChange={handleChange}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Calendar ID</label>
                            <input
                                type="text"
                                name="calendar_id"
                                value={formData.calendar_id}
                                onChange={handleChange}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-left"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-slate-900 border-t border-slate-800 mt-4 rounded-b-2xl">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 mt-2 rounded-xl text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 mt-2 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {loading ? 'جاري الحفظ...' : (
                                <>
                                    <Save size={18} />
                                    حفظ التعديلات
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditClinicModal;
