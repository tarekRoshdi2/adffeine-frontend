import React, { useState, useEffect } from 'react';
import { Save, Building, Phone, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SettingsView = () => {
    const [loading, setLoading] = useState(false);
    const [clinic, setClinic] = useState({
        clinic_name: '', specialty: '', system_prompt: '', bot_token: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Fetch clinic owned by this user
                const { data } = await supabase
                    .from('clinics')
                    .select('*')
                    .eq('owner_id', user.id)
                    .single();

                if (data) setClinic(data);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        setClinic({ ...clinic, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('clinics')
                .update(clinic)
                .eq('id', clinic.id);

            if (error) throw error;
            alert('تم حفظ الإعدادات بنجاح');
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('حدث خطأ أثناء الحفظ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl">
            <header className="mb-8">
                <h1 className="text-2xl font-bold">إعدادات العيادة</h1>
                <p className="text-slate-400">تحكم في بيانات العيادة وشخصية المساعد الذكي</p>
            </header>

            <div className="space-y-6">
                {/* Basic Info */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Building size={20} className="text-sky-400" />
                        البيانات الأساسية
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">اسم العيادة</label>
                            <input
                                type="text"
                                name="clinic_name"
                                value={clinic.clinic_name}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">التخصص</label>
                            <input
                                type="text"
                                name="specialty"
                                value={clinic.specialty}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* AI Configuration */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] text-white">AI</span>
                        إعدادات الذكاء الاصطناعي
                    </h2>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">تعليمات المساعد (System Prompt)</label>
                        <p className="text-xs text-slate-500 mb-2">هنا تكتب شخصية البوت، الأسعار، والعنوان بالتفصيل.</p>
                        <textarea
                            rows="6"
                            name="system_prompt"
                            value={clinic.system_prompt}
                            onChange={handleChange}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-sky-500 outline-none leading-relaxed"
                            placeholder="أنت مساعد ذكي لعيادة دكتور فلان... العنوان هو... سعر الكشف..."
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-sky-600 hover:bg-sky-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        <Save size={20} />
                        {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
