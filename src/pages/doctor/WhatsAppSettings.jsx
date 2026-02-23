import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Activity, Smartphone, Globe, AlertCircle, RefreshCw, Settings, Bot, Save, Copy, Key, Facebook } from 'lucide-react';

const API_URL = (window.location.port === '5173' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : window.location.origin;

const WhatsAppSettings = () => {
    const toast = useToast();
    const [clinic, setClinic] = useState(null);
    const [status, setStatus] = useState('disconnected');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Cloud API Fields
    const [config, setConfig] = useState({
        phone_number_id: '',
        access_token: '',
        verify_token: '',
        webhook_url: API_URL + '/api/whatsapp/webhook',
        telegram_token: '',
        messenger_token: '',
        messenger_page_id: '',
        messenger_verify_token: '',
        messenger_webhook_url: API_URL + '/api/messenger/webhook' // clinicId appended after fetch
    });

    const [systemPrompt, setSystemPrompt] = useState('');
    const [authToken, setAuthToken] = useState(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                setAuthToken(session.access_token);

                const { data: clinicData } = await supabase
                    .from('clinics')
                    .select('*')
                    .eq('owner_id', session.user.id)
                    .single();

                setClinic(clinicData);
                setSystemPrompt(clinicData?.system_prompt || '');

                // Fetch WhatsApp Status & Config
                const statusRes = await fetch(`${API_URL}/api/whatsapp/status`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                const statusData = await statusRes.json();
                if (statusRes.ok) {
                    setStatus(statusData.status);
                    setConfig(prev => ({
                        ...prev,
                        phone_number_id: statusData.phone_number_id || '',
                        verify_token: statusData.verify_token || '',
                        webhook_url: API_URL + '/api/whatsapp/webhook',
                        telegram_token: statusData.telegram_token || '',
                        messenger_token: statusData.messenger_token || '',
                        messenger_page_id: statusData.messenger_page_id || '',
                        messenger_verify_token: statusData.messenger_verify_token || '',
                        messenger_webhook_url: API_URL + '/api/messenger/webhook?clinicId=' + (clinic?.id || '')
                    }));
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/whatsapp/connect`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
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
        try {
            const { error } = await supabase
                .from('clinics')
                .update({ system_prompt: systemPrompt })
                .eq('id', clinic.id);
            if (error) throw error;
            toast.success('تم تحديث تعليمات البوت');
        } catch (error) {
            toast.error('فشل حفظ التعليمات');
        }
    };

    const handleSaveTG = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/whatsapp/telegram-token`, {
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
            const res = await fetch(`${API_URL}/api/whatsapp/messenger-config`, {
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

    if (loading) return (
        <div className="flex h-[80vh] items-center justify-center">
            <RefreshCw className="animate-spin text-emerald-500 w-10 h-10" />
        </div>
    );

    return (
        <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-500 p-4 pb-20">
            <header>
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                    <Bot className="text-emerald-500 w-8 h-8" />
                    المساعد الذكي (Official WhatsApp API)
                </h1>
                <p className="text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
                    نظام الربط الرسمي من Meta. يوفر استقراراً تاماً وسرعة في الرد دون الحاجة لبقاء الهاتف متصلاً.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left: Configuration */}
                <div className="glass-panel p-8 rounded-3xl border border-white/5 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Globe className="text-sky-400 w-5 h-5" />
                        <h3 className="text-xl font-bold text-white">إعدادات الربط الرسمي</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block px-1">Webhook URL (ضعه في Meta Dashboard)</label>
                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={config.webhook_url}
                                    className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-300 text-sm font-mono"
                                />
                                <button onClick={() => copyToClipboard(config.webhook_url)} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors">
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block px-1">Phone Number ID</label>
                            <input
                                type="text"
                                value={config.phone_number_id}
                                onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                                placeholder="مثال: 1092837465"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500/50"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block px-1">Access Token (Permanent)</label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    value={config.access_token}
                                    onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
                                    placeholder="EAAB..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-white outline-none focus:border-emerald-500/50"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block px-1">Verify Token (كلمة سر من اختيارك)</label>
                            <input
                                type="text"
                                value={config.verify_token}
                                onChange={(e) => setConfig({ ...config, verify_token: e.target.value })}
                                placeholder="اختر أي كلمة تضعها هنا وفي Meta"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500/50"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSaveConfig}
                        disabled={saving}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                    >
                        {saving ? <RefreshCw className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                        حفظ إعدادات الاتصال الرسمي
                    </button>

                    <div className="p-4 bg-sky-500/5 border border-sky-500/10 rounded-2xl flex gap-3 text-sky-200/70 text-xs leading-relaxed">
                        <AlertCircle className="w-5 h-5 shrink-0 text-sky-400" />
                        <p>تأكد من اختيار (Messages) في قسم Webhook Fields داخل لوحة تحكم Meta Developer لكي يستقبل الـ AI الرسائل.</p>
                    </div>

                    <div className="pt-8 border-t border-white/5 space-y-6">
                        <div className="flex items-center gap-3">
                            <Facebook className="text-blue-500 w-5 h-5" />
                            <h3 className="text-xl font-bold text-white">ربط فيسبوك ماسنجر</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1.5 block px-1">Callback URL (ضعه في Facebook Developer)</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={config.messenger_webhook_url}
                                        className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-300 text-sm font-mono text-left"
                                        dir="ltr"
                                    />
                                    <button onClick={() => copyToClipboard(config.messenger_webhook_url)} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 mb-1.5 block px-1">Page Access Token</label>
                                <input
                                    type="password"
                                    value={config.messenger_token}
                                    onChange={(e) => setConfig({ ...config, messenger_token: e.target.value })}
                                    placeholder="EAAB..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500/50"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1.5 block px-1">Page ID</label>
                                    <input
                                        type="text"
                                        value={config.messenger_page_id}
                                        onChange={(e) => setConfig({ ...config, messenger_page_id: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500/50 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1.5 block px-1">Verify Token</label>
                                    <input
                                        type="text"
                                        value={config.messenger_verify_token}
                                        onChange={(e) => setConfig({ ...config, messenger_verify_token: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500/50 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveMessenger}
                            disabled={saving}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                            {saving ? <RefreshCw className="animate-spin w-5 h-5" /> : <Facebook size={18} />}
                            حفظ إعدادات الماسنجر
                        </button>
                    </div>

                    <div className="pt-8 border-t border-white/5 space-y-6">
                        <div className="flex items-center gap-3">
                            <Smartphone className="text-sky-400 w-5 h-5" />
                            <h3 className="text-xl font-bold text-white">تفعيل تليجرام (بديل سريع)</h3>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block px-1">Telegram Bot Token (من BotFather)</label>
                            <input
                                type="text"
                                value={config.telegram_token}
                                onChange={(e) => setConfig({ ...config, telegram_token: e.target.value })}
                                placeholder="8259958270:AAH_..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-sky-500/50"
                            />
                        </div>

                        <button
                            onClick={handleSaveTG}
                            disabled={saving}
                            className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                            {saving ? <RefreshCw className="animate-spin w-5 h-5" /> : <Smartphone className="w-4 h-4" />}
                            تفعيل بوت التليجرام
                        </button>
                    </div>
                </div>

                {/* Right: AI Logic */}
                <div className="space-y-6">
                    <div className="glass-panel p-8 rounded-3xl border border-white/5">
                        <div className="flex items-center gap-3 mb-4">
                            <Settings className="text-sky-400 w-5 h-5" />
                            <h3 className="text-xl font-bold text-white">تعليمات المساعد الذكي</h3>
                        </div>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="w-full h-48 bg-slate-900/50 border border-slate-700 rounded-2xl p-4 text-white focus:border-emerald-500 outline-none resize-none mb-4 leading-loose shadow-inner"
                            placeholder="اكتب هنا تعليمات الطبيب للبوت..."
                        />
                        <button
                            onClick={handleSavePrompt}
                            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
                        >
                            تحديث تعليمات البوت
                        </button>
                    </div>

                    <div className={`p-8 rounded-3xl border-2 transition-all flex flex-col items-center text-center ${status === 'connected' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900 border-slate-800'}`}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${status === 'connected' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                            {status === 'connected' ? <Smartphone className="w-8 h-8" /> : <Activity className="w-8 h-8" />}
                        </div>
                        <h4 className="text-lg font-bold text-white">حالة الاتصال بالخدمة</h4>
                        <p className={`text-sm mt-1 ${status === 'connected' ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {status === 'connected' ? 'النظام متصل وجاهز لاستقبال الرسائل' : 'بانتظار إدخال الإعدادات الرسمية'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppSettings;
