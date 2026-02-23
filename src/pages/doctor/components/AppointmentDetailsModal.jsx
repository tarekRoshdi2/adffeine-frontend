import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Clock, Calendar, User, FileText, Phone, Save, Trash2, MessageCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';

const AppointmentDetailsModal = ({ isOpen, onClose, appointment, onUpdate }) => {
    const toast = useToast();
    const navigate = useNavigate();

    // Local state for editing
    const [status, setStatus] = useState(appointment?.status || 'pending');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [complaint, setComplaint] = useState(appointment?.chief_complaint || '');
    const [visitType, setVisitType] = useState(appointment?.service_name || '');
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState([]);
    const [fetchingServices, setFetchingServices] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Fetch clinic services on mount
    useEffect(() => {
        const fetchClinicServices = async () => {
            setFetchingServices(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: clinic } = await supabase
                    .from('clinics').select('id').eq('owner_id', user.id).single();
                if (clinic) {
                    const { data: servicesData } = await supabase
                        .from('clinic_services').select('name')
                        .eq('clinic_id', clinic.id).order('name');
                    setServices(servicesData || []);
                }
            } catch (e) {
                console.error('Error fetching clinic services:', e);
            } finally {
                setFetchingServices(false);
            }
        };
        fetchClinicServices();
    }, []);

    useEffect(() => {
        if (appointment) {
            setStatus(appointment.status);
            const d = new Date(appointment.appointment_date);
            setDate(d.toISOString().split('T')[0]);
            const timeString = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            setTime(timeString);
            setComplaint(appointment.chief_complaint || '');
            setVisitType(appointment.service_name || '');
        }
    }, [appointment]);

    if (!isOpen || !appointment) return null;

    const patient = appointment.patients || {};

    const handleSave = async () => {
        setLoading(true);
        try {
            if (!date || !time) {
                toast.error('يرجى تحديد التاريخ والوقت');
                setLoading(false);
                return;
            }

            const newDateTime = new Date(`${date}T${time}`);
            const updatePayload = {
                status: status,
                appointment_date: newDateTime.toISOString(),
                chief_complaint: complaint,
            };

            // Try saving with service_name (column might not exist on older DBs)
            let { error } = await supabase
                .from('appointments')
                .update({ ...updatePayload, service_name: visitType || null })
                .eq('id', appointment.id);

            // If error mentions service_name column, retry without it
            if (error && (error.message?.includes('service_name') || error.code === '42703')) {
                console.warn('[AppointmentModal] service_name column not found, saving without it.');
                const { error: error2 } = await supabase
                    .from('appointments')
                    .update(updatePayload)
                    .eq('id', appointment.id);
                if (error2) throw error2;
            } else if (error) {
                throw error;
            }

            toast.success('تم تحديث الموعد بنجاح');
            if (onUpdate) onUpdate();
            window.location.reload();
        } catch (error) {
            console.error('Error updating appointment:', error);
            toast.error('حدث خطأ أثناء التحديث');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', appointment.id);
            if (error) throw error;
            toast.success('تم حذف الموعد بنجاح');
            setShowDeleteConfirm(false);
            if (onUpdate) onUpdate();
            onClose();
            setTimeout(() => window.location.reload(), 300);
        } catch (error) {
            console.error('Error deleting appointment:', error);
            toast.error('حدث خطأ أثناء الحذف');
        } finally {
            setLoading(false);
        }
    };

    const handleGoToChat = () => {
        if (!patient.id) {
            toast.error('المريض غير مسجل في نظام الدردشة');
            return;
        }
        navigate('/dashboard/messages', { state: { patientId: patient.id } });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl">
                    <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl shadow-red-900/20" dir="rtl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                <Trash2 size={20} className="text-red-400" />
                            </div>
                            <h3 className="text-white font-bold text-lg">حذف الموعد</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                            هل أنت متأكد من حذف موعد <span className="text-white font-semibold">{appointment?.patients?.full_name || 'هذا المريض'}</span>؟<br />
                            <span className="text-red-400/80 text-xs mt-1 block">هذا الإجراء لا يمكن التراجع عنه.</span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors font-bold text-sm"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} />
                                {loading ? 'جاري الحذف...' : 'حذف نهائياً'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]" dir="rtl">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calendar className="text-sky-500" />
                        إدارة الموعد (تعديل)
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-1.5 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

                    {/* Patient Info (Read Only) */}
                    <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                <User size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">{patient.full_name || 'مريض غير مسجل'}</h3>
                                <div className="flex items-center gap-3 text-slate-400 text-sm mt-1">
                                    <span className="flex items-center gap-1"><Phone size={14} /> {patient.phone_number}</span>
                                </div>
                            </div>
                        </div>

                        {/* Patient Action Buttons */}
                        <div className="flex items-center gap-2">
                            {/* Go to Chat — only for platform-linked patients */}
                            {appointment.source && appointment.source !== 'manual' && (
                                <button
                                    onClick={handleGoToChat}
                                    className="bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 p-2.5 rounded-xl border border-sky-600/30 transition-all flex items-center gap-2 group"
                                    title="الانتقال للمحادثة"
                                >
                                    <MessageCircle size={18} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-sm font-bold">محادثة</span>
                                </button>
                            )}
                            {/* Go to Profile */}
                            {patient.id && (
                                <button
                                    onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
                                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 p-2.5 rounded-xl border border-emerald-600/30 transition-all flex items-center gap-2 group"
                                    title="عرض الملف الطبي"
                                >
                                    <FileText size={18} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-sm font-bold">الملف</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Editable Fields */}
                    <div className="space-y-4">
                        {/* Status */}
                        <div>
                            <label className="text-sm text-slate-400 font-bold mb-2 block">حالة الموعد</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 outline-none"
                            >
                                <option value="pending">⏳ قيد الانتظار</option>
                                <option value="confirmed">📅 مؤكد</option>
                                <option value="arrived">🏥 وصل العيادة</option>
                                <option value="in-progress">🩺 جاري الكشف</option>
                                <option value="completed">✅ تم الكشف</option>
                                <option value="cancelled">🚫 ملغي</option>
                                <option value="no-show">👻 لم يحضر</option>
                            </select>
                        </div>

                        {/* Date & Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-slate-400 font-bold mb-2 block">التاريخ</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 font-bold mb-2 block">الوقت</label>
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Visit Type */}
                        <div>
                            <label className="text-sm text-slate-400 font-bold mb-2 block">نوع الكشف / الخدمة</label>
                            <select
                                value={visitType}
                                onChange={(e) => setVisitType(e.target.value)}
                                disabled={fetchingServices}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 outline-none"
                            >
                                {fetchingServices ? (
                                    <option>جاري تحميل الخدمات...</option>
                                ) : services.length > 0 ? (
                                    <>
                                        <option value="">-- اختر نوع الكشف --</option>
                                        {/* If current visit type not in list (e.g. old data), show it */}
                                        {visitType && !services.find(s => s.name === visitType) && (
                                            <option value={visitType}>{visitType}</option>
                                        )}
                                        {services.map((s, idx) => (
                                            <option key={idx} value={s.name}>{s.name}</option>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <option value="">-- اختر نوع الكشف --</option>
                                        <option value="كشف جديد">كشف جديد</option>
                                        <option value="إعادة / استشارة">إعادة / استشارة</option>
                                        <option value="حالة طارئة">حالة طارئة</option>
                                    </>
                                )}
                            </select>
                        </div>

                        {/* Complaint / Notes */}
                        <div>
                            <label className="text-sm text-slate-400 font-bold mb-2 block">الشكوى / سبب الزيارة</label>
                            <textarea
                                value={complaint}
                                onChange={(e) => setComplaint(e.target.value)}
                                className="w-full h-28 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 outline-none resize-none"
                                placeholder="اكتب تفاصيل الشكوى هنا..."
                            ></textarea>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex justify-between items-center text-xs text-slate-600 pt-4 border-t border-white/5">
                        <span>المصدر: {appointment.source}</span>
                        <span>آخر تحديث: {new Date().toLocaleDateString('ar-EG')}</span>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-950/80 border-t border-white/5 flex gap-3">
                    {/* Delete Button */}
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={loading}
                        className="p-3 rounded-xl border border-red-800/40 text-red-500 hover:bg-red-950/50 transition-colors"
                        title="حذف الموعد"
                    >
                        <Trash2 size={18} />
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors font-bold"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-[2] bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20"
                    >
                        {loading ? 'جاري الحفظ...' : (
                            <>
                                <Save size={18} />
                                حفظ التعديلات
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppointmentDetailsModal;
