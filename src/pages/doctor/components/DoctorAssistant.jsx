import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Bell, Zap, MessageSquare, ChevronDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';

const DoctorAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { type: 'bot', text: 'أهلاً يا دكتور 👋 أنا مساعدك الذكي. جاهز لمساعدتك في إدارة العيادة اليوم.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState(null);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const [clinicId, setClinicId] = useState(null);

    // Real-time Listener & Fetch Clinic ID
    useEffect(() => {
        const fetchClinicId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: clinic } = await supabase
                    .from('clinics')
                    .select('id')
                    .eq('owner_id', user.id)
                    .single();

                if (clinic) {
                    setClinicId(clinic.id);
                }
            }
        };
        fetchClinicId();

        const channel = supabase
            .channel('doctor-assistant')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments' },
                (payload) => {
                    handleRealtimeEvent(payload);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleRealtimeEvent = (payload) => {
        let text = '';
        if (payload.eventType === 'INSERT') {
            text = `🆕 حجز جديد: ${payload.new.patient_name} (${payload.new.appointment_time})`;
        } else if (payload.eventType === 'UPDATE' && payload.new.status === 'arrived') {
            text = `🔔 المريض ${payload.new.patient_name} وصل العيادة الآن!`;
        }

        if (text) {
            // Show toast notification
            setNotification(text);
            // Add to chat history as system info
            setMessages(prev => [...prev, { type: 'system', text }]);

            // Auto-hide notification
            setTimeout(() => setNotification(null), 5000);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { type: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/ai/doctor-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMsg, clinicId: clinicId || 1 })
            });
            const data = await res.json();

            setMessages(prev => [...prev, { type: 'bot', text: data.response }]);
        } catch (err) {
            setMessages(prev => [...prev, { type: 'bot', text: 'عذراً، حدث خطأ في الاتصال.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Notification Toast */}
            {notification && (
                <div className="fixed bottom-24 left-6 z-50 bg-slate-800/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl border border-sky-500/30 animate-slide-up flex items-center gap-4">
                    <div className="bg-sky-500/20 p-2 rounded-full text-sky-400">
                        <Bell size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-sky-400">تنبيه جديد</h4>
                        <p className="text-sm">{notification}</p>
                    </div>
                    <button onClick={() => setNotification(null)} className="hover:bg-white/10 p-1 rounded-full">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Floating Trigger */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 left-6 z-40 bg-gradient-to-r from-sky-600 to-indigo-600 text-white p-4 rounded-2xl shadow-2xl shadow-sky-500/30 hover:scale-105 transition-all group border border-white/10"
                >
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-slate-900" />
                    <Bot size={28} className="group-hover:rotate-12 transition-transform" />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 left-6 z-50 w-[380px] h-[600px] bg-slate-900/95 backdrop-blur-xl border border-sky-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-sky-900/50 to-indigo-900/50 border-b border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/20">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">المساعد الذكي</h3>
                                <p className="text-xs text-emerald-400 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    متصل بالعيادة
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors text-slate-400 hover:text-white">
                            <ChevronDown size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.type === 'user'
                                        ? 'bg-sky-600 text-white rounded-br-none'
                                        : msg.type === 'system'
                                            ? 'bg-slate-800/80 border border-amber-500/20 text-slate-300 w-full text-center text-xs py-2'
                                            : 'bg-white/10 text-slate-200 border border-white/5 rounded-bl-none'
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white/5 p-3 rounded-2xl rounded-bl-none flex gap-1">
                                    <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/5 bg-black/20">
                        {/* Quick Actions (Optional - can be added later) */}
                        <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-hide">
                            <QuickAction icon={<Zap size={14} />} text="ملخص اليوم" onClick={() => { setInput("لخص لي وضع العيادة اليوم"); handleSend(); }} />
                            <QuickAction icon={<MessageSquare size={14} />} text="مين الدور؟" onClick={() => { setInput("من المريض التالي؟"); handleSend(); }} />
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="اكتب استفسارك هنا..."
                                className="w-full bg-slate-800 text-white placeholder:text-slate-500 rounded-xl py-3 pr-4 pl-12 border border-white/10 focus:border-sky-500 focus:outline-none transition-all"
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const QuickAction = ({ icon, text, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-sky-500/20 hover:text-sky-400 border border-white/5 rounded-lg text-xs transition-colors whitespace-nowrap"
    >
        {icon}
        {text}
    </button>
);

export default DoctorAssistant;
