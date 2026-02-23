import React, { useState, useEffect } from 'react';
import { Save, Clock, Building, Check, Zap } from 'lucide-react';
import WhatsAppSettings from './WhatsAppSettings';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

const Settings = () => {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [activeTab, setActiveTab] = useState('basic');
    const [clinic, setClinic] = useState({
        id: '',
        clinic_name: '',
        specialty: '',
        working_hours: null
    });

    const [workingHours, setWorkingHours] = useState({
        sunday: { enabled: true, start: "09:00", end: "17:00", label: "الأحد" },
        monday: { enabled: true, start: "09:00", end: "17:00", label: "الاثنين" },
        tuesday: { enabled: true, start: "09:00", end: "17:00", label: "الثلاثاء" },
        wednesday: { enabled: true, start: "09:00", end: "17:00", label: "الأربعاء" },
        thursday: { enabled: true, start: "09:00", end: "17:00", label: "الخميس" },
        friday: { enabled: false, start: "09:00", end: "17:00", label: "الجمعة" },
        saturday: { enabled: false, start: "09:00", end: "17:00", label: "السبت" }
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: clinicData, error } = await supabase
                .from('clinics')
                .select('*')
                .eq('owner_id', session.user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (clinicData) {
                setClinic(clinicData);
                if (clinicData.working_hours) {
                    const merged = { ...workingHours };
                    Object.keys(clinicData.working_hours).forEach(day => {
                        if (merged[day]) {
                            merged[day] = { ...merged[day], ...clinicData.working_hours[day] };
                        }
                    });
                    setWorkingHours(merged);
                }
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (!clinic.id) return;
            const updates = {
                clinic_name: clinic.clinic_name,
                specialty: clinic.specialty,
                working_hours: workingHours
            };
            const { error } = await supabase
                .from('clinics')
                .update(updates)
                .eq('id', clinic.id);
            if (error) throw error;
            toast.success('تم حفظ الإعدادات بنجاح');
        } catch (error) {
            toast.error('حدث خطأ أثناء الحفظ');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => setClinic({ ...clinic, [e.target.name]: e.target.value });
    const toggleDay = (day) => setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }));
    const updateTime = (day, field, value) => setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));

    if (loading) return <div className="text-center text-slate-400 py-20">جاري التحميل...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">الإعدادات</h1>
                    <p className="text-slate-400 text-sm">إدارة بيانات العيادة وساعات العمل الخاصة بك</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-sky-900/20 disabled:opacity-50"
                >
                    {saving ? 'جاري الحفظ...' : <><Save size={18} /> حفظ التغييرات</>}
                </button>
            </header>

            <div className="flex gap-4 border-b border-white/10 mb-8">
                <button
                    onClick={() => setActiveTab('basic')}
                    className={`pb-4 px-1 md:px-2 font-bold transition-all relative text-sm md:text-base ${activeTab === 'basic' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Building size={16} className="md:w-[18px] md:h-[18px]" />
                        البيانات الأساسية
                    </div>
                    {activeTab === 'basic' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('automation')}
                    className={`pb-4 px-1 md:px-2 font-bold transition-all relative text-sm md:text-base ${activeTab === 'automation' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Zap size={16} className="md:w-[18px] md:h-[18px]" />
                        الأتمتة والربط
                    </div>
                    {activeTab === 'automation' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
                </button>
            </div>

            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-1">
                {activeTab === 'basic' ? (
                    <>
                        <div className="glass-panel p-4 md:p-8 rounded-2xl border border-white/5 space-y-6">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                                <Building className="text-sky-500" />
                                البيانات الأساسية للعيادة
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div>
                                    <label className="block text-xs md:text-sm text-slate-400 mb-2 font-bold">اسم العيادة</label>
                                    <input
                                        type="text"
                                        name="clinic_name"
                                        value={clinic.clinic_name || ''}
                                        onChange={handleChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 outline-none text-sm md:text-base"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs md:text-sm text-slate-400 mb-2 font-bold">التخصص</label>
                                    <input
                                        type="text"
                                        name="specialty"
                                        value={clinic.specialty || ''}
                                        onChange={handleChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 outline-none text-sm md:text-base"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel p-4 md:p-8 rounded-2xl border border-white/5 space-y-6">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><Clock className="text-sky-500" /> ساعات العمل والمواعيد</h2>
                            <div className="space-y-3 md:space-y-4">
                                {Object.entries(workingHours).map(([key, day]) => (
                                    <div key={key} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border transition-all ${day.enabled ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-900/30 border-white/5 opacity-60'}`}>
                                        <div className="flex items-center justify-between sm:justify-start gap-4 sm:w-40">
                                            <div className="flex items-center gap-3">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" checked={day.enabled} onChange={() => toggleDay(key)} />
                                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                                                </label>
                                                <span className={`font-bold ${day.enabled ? 'text-white' : 'text-slate-500'}`}>{day.label}</span>
                                            </div>
                                            <div className="sm:hidden text-xs">{day.enabled ? <span className="text-emerald-400 flex items-center gap-1"><Check size={12} /> مفعل</span> : <span className="text-slate-500">مغلق</span>}</div>
                                        </div>
                                        <div className="hidden sm:block flex-1 text-sm">{day.enabled ? <span className="text-emerald-400 flex items-center gap-1"><Check size={14} /> يوم عمل مفعل</span> : <span className="text-slate-500">مغلق</span>}</div>
                                        <div className={`flex items-center justify-between sm:justify-end gap-2 md:gap-4 ${!day.enabled && 'pointer-events-none opacity-50'}`}>
                                            <div className="flex items-center gap-2 flex-1 sm:flex-none">
                                                <span className="text-[10px] text-slate-500 sm:hidden">من</span>
                                                <input type="time" value={day.start} onChange={(e) => updateTime(key, 'start', e.target.value)} className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg px-2 md:px-3 py-2 text-white text-xs md:text-sm focus:border-sky-500 outline-none" />
                                            </div>
                                            <div className="flex items-center gap-2 flex-1 sm:flex-none">
                                                <span className="text-[10px] text-slate-500 sm:hidden">إلى</span>
                                                <input type="time" value={day.end} onChange={(e) => updateTime(key, 'end', e.target.value)} className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg px-2 md:px-3 py-2 text-white text-xs md:text-sm focus:border-sky-500 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <WhatsAppSettings clinic={clinic} />
                )}
            </div>
        </div>
    );
};

export default Settings;

