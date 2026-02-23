import React, { useState } from 'react';
import { Save, Settings, ShieldAlert, DollarSign } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const AdminSettings = () => {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        basePrice: 1500,
        globalAiPrompt: 'يجب دائمًا الرد باحترام ومهنية، وعدم إعطاء أي تشخيصات طبية قاطعة، وتوجيه المريض لزيارة العيادة.'
    });

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Simulated save for MVP
            await new Promise(resolve => setTimeout(resolve, 800));
            toast.success('تم حفظ الإعدادات العامة بنجاح');
        } catch (error) {
            toast.error('حدث خطأ أثناء حفظ الإعدادات');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <header className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                    <Settings size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">الإعدادات العامة (Global Settings)</h1>
                    <p className="text-slate-400">تحكم بالمتغيرات الأساسية للنظام بأكمله</p>
                </div>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Billing Settings */}
                <div className="glass-panel p-6 border border-white/5 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-4">
                        <DollarSign size={20} />
                        <h2>إعدادات التسعير والاشتراكات</h2>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">تسعيرة الاشتراك الشهري الافتراضية للعيادات (ج.م)</label>
                        <input
                            type="number"
                            name="basePrice"
                            value={settings.basePrice}
                            onChange={handleChange}
                            className="w-full sm:w-1/2 bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-2">تُستخدم هذه القيمة لحساب الأرباح المتوقعة (MRR) في لوحة التحكم.</p>
                    </div>
                </div>

                {/* AI Safety Settings */}
                <div className="glass-panel p-6 border border-white/5 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 text-sky-400 font-bold mb-4">
                        <ShieldAlert size={20} />
                        <h2>قيود الأمان للذكاء الاصطناعي (AI Safety Guardrails)</h2>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">التعليمات المركزية (تُطبق على كل العيادات إجبارياً)</label>
                        <textarea
                            name="globalAiPrompt"
                            value={settings.globalAiPrompt}
                            onChange={handleChange}
                            rows="4"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:border-purple-500 outline-none text-right placeholder-slate-600"
                        ></textarea>
                        <p className="text-xs text-slate-500 mt-2">مهما قام الطبيب بتغيير الـ System Prompt الخاص به، سيتم إدراج هذه التعليمات في النهاية لضمان عدم خروج البوت عن النص.</p>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
                    >
                        {loading ? 'جاري الحفظ...' : (
                            <>
                                <Save size={20} />
                                حفظ جميع الإعدادات
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminSettings;
