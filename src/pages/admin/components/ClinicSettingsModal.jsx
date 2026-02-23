import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import {
    Activity, Smartphone, Globe, AlertCircle, RefreshCw,
    Settings, Bot, Save, Copy, Key, Facebook, X
} from 'lucide-react';

const API_URL = (window.location.port === '5173' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : window.location.origin;

const ClinicSettingsModal = ({ isOpen, onClose, clinic }) => {
    const toast = useToast();
    const [status, setStatus] = useState('disconnected');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [authToken, setAuthToken] = useState(null);

    // Automation Config
    const [config, setConfig] = useState({
        phone_number_id: '',
        access_token: '',
        verify_token: '',
        webhook_url: API_URL + '/api/whatsapp/webhook',
        telegram_token: '',
        messenger_token: '',
        messenger_page_id: '',
        messenger_verify_token: '',
        messenger_webhook_url: API_URL + '/api/messenger/webhook'
    });

    const [systemPrompt, setSystemPrompt] = useState('');

    useEffect(() => {
        if (!isOpen || !clinic) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                setAuthToken(session.access_token);

                // Fetch current prompt from DB
                const { data: clinicData } = await supabase
                    .from('clinics')
                    .select('system_prompt')
                    .eq('id', clinic.id)
                    .single();

                setSystemPrompt(clinicData?.system_prompt || '');

                // Fetch Automation Status & Config from Backend
                const res = await fetch(`${API_URL}/api/whatsapp/status?clinicId=${clinic.id}`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setStatus(data.status);
                    setConfig(prev => ({
                        ...prev,
                        phone_number_id: data.phone_number_id || '',
                        access_token: data.access_token ? 'MASKED_TOKEN' : '',
                        verify_token: data.verify_token || '',
                        webhook_url: API_URL + '/api/whatsapp/webhook',
                        telegram_token: data.telegram_token || '',
                        messenger_token: data.messenger_token || '',
                        messenger_page_id: data.messenger_page_id || '',
                        messenger_verify_token: data.messenger_verify_token || '',
                        messenger_webhook_url: API_URL + '/api/messenger/webhook?clinicId=' + clinic.id
                    }));
                }
            } catch (error) {
                console.error('Error fetching clinic settings:', error);
                toast.error('فشل تحميل الإعدادات');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, clinic]);

    if (!isOpen || !clinic) return null;

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            const payload = { ...config };
            if (payload.access_token === 'MASKED_TOKEN') {
                delete payload.access_token; // Don't overwrite with placeholder if it wasn't edited
            }

            const res = await fetch(`${API_URL}/api/whatsapp/connect?clinicId=${clinic.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                setStatus(data.status);
                toast.success('تم حفظ إعدادات الواتساب بنجاح');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            toast.error('حدث خطأ أثناء حفظ الإعدادات');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePrompt = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('clinics')
                .update({ system_prompt: systemPrompt })
                .eq('id', clinic.id);
            if (error) throw error;
            toast.success('تم تحديث تعليمات البوت');
        } catch (error) {
            toast.error('فشل حفظ التعليمات');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTG = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/whatsapp/telegram-token?clinicId=${clinic.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: config.telegram_token })
            });
            if (res.ok) toast.success('تم تفعيل بوت التليجرام بنجاح');
            else throw new Error();
        } catch (error) {
            toast.error('فشل في حفظ توكن التليجرام');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveMessenger = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/whatsapp/messenger-config?clinicId=${clinic.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messenger_token: config.messenger_token,
                    messenger_page_id: config.messenger_page_id,
                    messenger_verify_token: config.messenger_verify_token
                })
            });
            if (res.ok) toast.success('تم تفعيل بوت الماسنجر بنجاح');
            else throw new Error();
        } catch (error) {
            toast.error('فشل في حفظ إعدادات الماسنجر');
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('تم النسخ للمحافظة');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl relative" dir="rtl">

                {/* Header */}
                <div className="sticky top-0 bg-slate-900/80 backdrop-blur-md p-6 border-b border-white/5 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <Bot className="text-emerald-500 w-8 h-8" />
                            إعدادات الربط والذكاء الاصطناعي - {clinic.clinic_name}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">إدارة قنوات الاتصال وتعليمات العميل لعيادة {clinic.clinic_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <RefreshCw className="animate-spin text-emerald-500 w-12 h-12" />
                            <p className="text-slate-400 font-bold">جاري تحميل البيانات...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Right: AI Logic */}
                            <div className="space-y-6">
                                <section className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Settings className="text-sky-400 w-5 h-5" />
                                        <h3 className="text-xl font-bold text-white">تعليمات المساعد الذكي</h3>
                                    </div>
                                    <textarea
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        className="w-full h-[300px] bg-black/40 border border-slate-800 rounded-2xl p-6 text-white text-sm leading-relaxed focus:border-emerald-500 outline-none resize-none transition-all shadow-inner"
                                        placeholder="اكتب هنا تعليمات المساعد الذكي للبوت..."
                                    />
                                    <button
                                        onClick={handleSavePrompt}
                                        disabled={saving}
                                        className="w-full py-4 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        <Save size={18} />
                                        تحديث تعليمات البوت
                                    </button>
                                </section>

                                <div className={`p-6 rounded-2xl border-2 transition-all flex items-center gap-4 ${status === 'connected' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900 border-slate-800'}`}>
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${status === 'connected' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                                        {status === 'connected' ? <Smartphone size={28} /> : <Activity size={28} />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">حالة الخدمة الحالية</h4>
                                        <p className={`text-sm mt-0.5 ${status === 'connected' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {status === 'connected' ? 'متصل وجاهز للعمل' : 'بانتظار إعداد بيانات الربط الرسمي'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Left: Configuration */}
                            <div className="space-y-6">
                                {/* WhatsApp */}
                                <section className="glass-panel p-6 rounded-2xl border border-white/5 bg-slate-800/20 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Globe className="text-sky-400 w-5 h-5" />
                                        <h3 className="text-lg font-bold text-white">إعدادات WhatsApp Official API</h3>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 mb-1 block px-1 uppercase tracking-wider">Webhook URL</label>
                                            <div className="flex gap-2">
                                                <input readOnly value={config.webhook_url} className="flex-1 bg-slate-950 border border-slate-700/50 rounded-xl px-4 py-2 text-slate-400 text-xs font-mono" />
                                                <button onClick={() => copyToClipboard(config.webhook_url)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors">
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <input
                                            type="text"
                                            value={config.phone_number_id}
                                            onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                                            placeholder="Phone Number ID"
                                            autoComplete="off"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/50"
                                        />
                                        <input
                                            type="password"
                                            value={config.access_token}
                                            onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
                                            placeholder={config.access_token ? "••••••••••••••••" : "Access Token (Permanent)"}
                                            autoComplete="new-password"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/50"
                                        />
                                        <input
                                            type="text"
                                            value={config.verify_token}
                                            onChange={(e) => setConfig({ ...config, verify_token: e.target.value })}
                                            placeholder="Verify Token (From Choice)"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/50"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSaveConfig}
                                        disabled={saving}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                                    >
                                        {saving ? <RefreshCw className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                                        حفظ إعدادات الواتساب الرسمية
                                    </button>
                                </section>

                                {/* Messenger */}
                                <section className="glass-panel p-6 rounded-2xl border border-white/5 bg-slate-800/20 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Facebook className="text-blue-500 w-5 h-5" />
                                        <h3 className="text-lg font-bold text-white">فيسبوك ماسنجر</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 mb-1 block px-1 uppercase tracking-wider">Messenger Webhook</label>
                                            <div className="flex gap-2">
                                                <input readOnly value={config.messenger_webhook_url} className="flex-1 bg-slate-950 border border-slate-700/50 rounded-xl px-4 py-2 text-slate-400 text-xs font-mono" />
                                                <button onClick={() => copyToClipboard(config.messenger_webhook_url)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors">
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <input
                                            type="password"
                                            value={config.messenger_token}
                                            onChange={(e) => setConfig({ ...config, messenger_token: e.target.value })}
                                            placeholder="Page Access Token"
                                            autoComplete="off"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50"
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                value={config.messenger_page_id}
                                                onChange={(e) => setConfig({ ...config, messenger_page_id: e.target.value })}
                                                placeholder="Page ID"
                                                autoComplete="off"
                                                className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={config.messenger_verify_token}
                                                onChange={(e) => setConfig({ ...config, messenger_verify_token: e.target.value })}
                                                placeholder="Verify Token"
                                                autoComplete="off"
                                                className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSaveMessenger}
                                        disabled={saving}
                                        className="w-full py-3 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 rounded-xl font-bold transition-all text-sm"
                                    >
                                        تفعيل بوت الماسنجر
                                    </button>
                                </section>

                                {/* Telegram */}
                                <section className="glass-panel p-6 rounded-2xl border border-white/5 bg-slate-800/20 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Smartphone className="text-sky-400 w-5 h-5" />
                                        <h3 className="text-lg font-bold text-white">بوت التليجرام</h3>
                                    </div>
                                    <input
                                        type="text"
                                        value={config.telegram_token}
                                        onChange={(e) => setConfig({ ...config, telegram_token: e.target.value })}
                                        placeholder="Bot API Token (from BotFather)"
                                        autoComplete="off"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-sky-500/50"
                                    />
                                    <button
                                        onClick={handleSaveTG}
                                        disabled={saving}
                                        className="w-full py-3 bg-sky-600/10 hover:bg-sky-600 text-sky-400 hover:text-white border border-sky-500/20 rounded-xl font-bold transition-all text-sm"
                                    >
                                        تفعيل التليجرام
                                    </button>
                                </section>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
                    >
                        إغلاق النافذة
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClinicSettingsModal;
