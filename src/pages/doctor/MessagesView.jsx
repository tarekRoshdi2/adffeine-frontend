import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Send, Phone, MoreVertical, User, Trash2, MessageCircle, Send as TelegramIcon, FileText, Facebook } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { API_URL } from '../../lib/api';

const MessagesView = () => {
    const toast = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [chats, setChats] = useState([]); // List of patients
    const [selectedChat, setSelectedChat] = useState(null); // Selected patient
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastActivePlatform, setLastActivePlatform] = useState('whatsapp'); // Tracks last incoming message platform
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null });
    const messagesEndRef = useRef(null);

    // ── Platform Helpers ──────────────────────────────────────────────────────
    const PLATFORM_CONFIG = {
        whatsapp: { label: 'واتساب', color: 'bg-emerald-500', textColor: 'text-emerald-400', Icon: MessageCircle },
        telegram: { label: 'تليجرام', color: 'bg-sky-500', textColor: 'text-sky-400', Icon: TelegramIcon },
        messenger: { label: 'ماسنجر', color: 'bg-blue-600', textColor: 'text-blue-400', Icon: Facebook },
    };

    // Get which platforms a patient has registered IDs for
    const getPatientPlatforms = (patient) => {
        const platforms = [];
        if (patient.phone_number || patient.whatsapp_id) platforms.push('whatsapp');
        if (patient.telegram_id) platforms.push('telegram');
        if (patient.messenger_id) platforms.push('messenger');
        return platforms.length > 0 ? platforms : [patient.source || 'whatsapp'];
    };

    const getPlatformInfo = (platform) => PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.whatsapp;

    // Derived: Filtered chat list based on search term
    const filteredChats = chats.filter(chat =>
        (chat.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (chat.phone_number || '').includes(searchTerm)
    );

    // 0. Handle navigation from appointments (auto-select patient)
    useEffect(() => {
        if (location.state && location.state.patientId && chats.length > 0) {
            const target = chats.find(c => c.id === location.state.patientId);
            if (target) {
                setSelectedChat(target);
            }
        }
    }, [location.state, chats]);

    // 1. Fetch Patients & Real-time List Updates
    useEffect(() => {
        fetchChats();

        // Subscribe to patient updates (new leads or message interactions)
        const subscription = supabase
            .channel('public:patients_list')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'patients'
            }, (payload) => {
                console.log("[Realtime] Patient update received:", payload);

                // Merge/Redirection Logic: If our selected chat was deleted,
                // it likely merged. We need to fetch and auto-select the new top entry.
                if (payload.eventType === 'DELETE' && selectedChat && payload.old.id === selectedChat.id) {
                    console.log("[Realtime] Selected chat deleted (likely merged). Redirecting...");
                    fetchChats(true); // Force re-select top patient
                } else {
                    fetchChats();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [selectedChat]); // Respond to selection state to handle deletes

    // 2. Fetch Messages for Selected Chat & Real-time Updates
    useEffect(() => {
        if (!selectedChat) return;

        fetchMessages(selectedChat.id);

        const subscription = supabase
            .channel(`chat_room:${selectedChat.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `patient_id=eq.${selectedChat.id}`
            }, (payload) => {
                console.log("[Realtime] New message received:", payload);
                setMessages(prev => {
                    // Check if message already exists (to avoid duplicates from local optimistic updates)
                    if (prev.some(m => m.id === payload.new.id)) return prev;
                    return [...prev, payload.new];
                });
                scrollToBottom();
            })
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [selectedChat]);

    const fetchChats = async (autoSelectNew = false) => {
        try {
            // Get patients sorted by last interaction
            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .order('last_interaction', { ascending: false });

            if (error) throw error;
            setChats(data || []);

            // Auto-selection: If requested (on merge), or if nothing is selected yet
            if (autoSelectNew && data.length > 0) {
                setSelectedChat(data[0]);
            } else if (!selectedChat && data.length > 0) {
                setSelectedChat(data[0]);
            }
        } catch (error) {
            console.error('Error fetching chats:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (patientId) => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: true });

        const msgs = data || [];
        setMessages(msgs);

        // Determine last active platform from message history
        const lastUserMsg = [...msgs].reverse().find(m => m.sender_type === 'user');
        if (lastUserMsg?.platform) {
            setLastActivePlatform(lastUserMsg.platform);
        } else if (selectedChat) {
            // Fallback: derive from patient fields
            if (selectedChat.telegram_id && !selectedChat.phone_number) setLastActivePlatform('telegram');
            else if (selectedChat.messenger_id && !selectedChat.phone_number) setLastActivePlatform('messenger');
            else setLastActivePlatform('whatsapp');
        }

        scrollToBottom();
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleClearChat = async () => {
        if (!selectedChat) return;
        setConfirmModal({ isOpen: true, type: 'clear' });
    };

    const handleDeleteConversation = async () => {
        if (!selectedChat) return;
        setConfirmModal({ isOpen: true, type: 'delete' });
    };

    const confirmAction = async () => {
        if (!selectedChat) return;
        const type = confirmModal.type;
        setConfirmModal({ isOpen: false, type: null });

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            if (type === 'clear') {
                const response = await fetch(`${API_URL}/api/chat/messages/${selectedChat.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });

                if (response.ok) {
                    setMessages([]);
                    toast.success('تم مسح الرسائل بنجاح');
                } else {
                    throw new Error('Failed to clear chat');
                }
            } else if (type === 'delete') {
                const response = await fetch(`${API_URL}/api/chat/patient/${selectedChat.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });

                if (response.ok) {
                    toast.success('تم حذف المحادثة نهائياً');
                    const deletedId = selectedChat.id;
                    setSelectedChat(null);
                    setChats(prev => prev.filter(c => c.id !== deletedId));
                } else {
                    throw new Error('Failed to delete patient');
                }
            }
        } catch (error) {
            console.error('Error during deletion:', error);
            toast.error(type === 'clear' ? 'فشل مسح الرسائل' : 'فشل حذف المحادثة');
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedChat) return;

        // Optimistic UI Update
        const tempMsg = {
            id: Date.now(),
            sender_type: 'doctor',
            content: messageInput,
            created_at: new Date().toISOString()
        };
        setMessages([...messages, tempMsg]);
        setMessageInput('');

        try {
            // Get current session for auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('يجب تسجيل الدخول أولاً');
                return;
            }

            // Call Backend API to send via WhatsApp or Telegram
            const response = await fetch(`${API_URL}/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patientId: selectedChat.id,
                    text: tempMsg.content
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send');
            }

            // Success: clear the doctor attention flag since we intervened manually
            if (selectedChat?.needs_doctor_attention) {
                await supabase.from('patients')
                    .update({ needs_doctor_attention: false })
                    .eq('id', selectedChat.id);
                setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, needs_doctor_attention: false } : c));
                setSelectedChat(prev => ({ ...prev, needs_doctor_attention: false }));
            }

            // fetch messages again to ensure state is in sync
            fetchMessages(selectedChat.id);

        } catch (error) {
            console.error('Error sending message:', error);
            toast.error(error.message || 'فشل الإرسال');
            // Optional: Remove the optimistic message on failure
            setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6">
            {/* Chat List */}
            <div className="w-1/3 glass-panel flex flex-col rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5">
                    <div className="relative">
                        <Search className="absolute right-3 top-2.5 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="بحث في المحادثات..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:outline-none focus:border-sky-500 text-sm transition-colors"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? <p className="p-4 text-center text-slate-500">جاري التحميل...</p> : filteredChats.map(chat => {
                        const platforms = getPatientPlatforms(chat);
                        return (
                            <div
                                key={chat.id}
                                onClick={() => {
                                    setSelectedChat(chat);
                                }}
                                className={`p-4 flex gap-3 cursor-pointer hover:bg-white/5 transition-colors relative ${selectedChat?.id === chat.id ? 'bg-white/5 border-r-2 border-sky-500' : ''}`}
                            >
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 relative">
                                    <User size={20} />
                                    {/* Show ALL platform badges this patient has */}
                                    <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                                        {platforms.map((p, i) => {
                                            const { color, Icon } = getPlatformInfo(p);
                                            return (
                                                <div key={p} className={`w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 ${color}`}
                                                    style={{ marginRight: i > 0 ? '-6px' : '0', zIndex: platforms.length - i }}>
                                                    <Icon size={9} className="text-white" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className={`font-bold truncate flex items-center gap-2 ${selectedChat?.id === chat.id ? 'text-white' : 'text-slate-300'}`}>
                                            {chat.full_name || chat.phone_number}
                                            {chat.is_lead === true && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 tracking-wider">محتمل</span>}
                                        </h3>
                                        <div className="flex items-center gap-1 shrink-0 mr-2">
                                            {/* Doctor attention flag badge */}
                                            {chat.needs_doctor_attention && (
                                                <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center animate-pulse" title="المريض يطلب التواصل مع الدكتور">
                                                    <span className="text-white text-[9px] font-bold">!</span>
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-500">
                                                {new Date(chat.last_interaction).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-400 truncate dir-rtl text-right">
                                        {chat.phone_number || chat.telegram_id || chat.messenger_id}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chat Window */}
            {selectedChat ? (
                <div className="flex-1 glass-panel flex flex-col rounded-2xl border border-white/5 overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/30">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                <User size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white flex items-center gap-2 mb-0.5">
                                    {selectedChat.full_name || selectedChat.phone_number}
                                    {selectedChat.is_lead === true && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 tracking-wider">محتمل</span>}
                                </h3>
                                {/* Show ALL registered platforms + highlight the ACTIVE one (last message) */}
                                <div className="flex items-center gap-2">
                                    {getPatientPlatforms(selectedChat).map(p => {
                                        const { label, textColor, color, Icon } = getPlatformInfo(p);
                                        const isActive = p === lastActivePlatform;
                                        return (
                                            <span key={p} className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${isActive
                                                ? `${textColor} bg-white/5 border-current`
                                                : 'text-slate-600 border-white/5'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? color : 'bg-slate-600'}`}></span>
                                                {label}
                                                {isActive && <span className="text-[9px] opacity-70">← آخر رسالة</span>}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleClearChat}
                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                                title="مسح الرسائل فقط"
                            >
                                <MessageCircle size={20} />
                            </button>
                            <button
                                onClick={() => navigate(`/dashboard/patients/${selectedChat.id}`)}
                                className="p-2 hover:bg-sky-500/10 rounded-lg text-sky-400 transition-colors"
                                title="عرض السجل المرضي"
                            >
                                <FileText size={20} />
                            </button>
                            <button
                                onClick={handleDeleteConversation}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors"
                                title="حذف المحادثة نهائياً من القائمة"
                            >
                                <Trash2 size={20} />
                            </button>
                            <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                                <Phone size={20} />
                            </button>
                            <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                                <MoreVertical size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Attention Alert Banner */}
                    {selectedChat.needs_doctor_attention && (
                        <div className="mx-4 mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between gap-4 animate-pulse shadow-lg shadow-red-900/10" dir="rtl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                                    <span className="text-white font-bold text-lg">!</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-red-400 font-bold">المريض يطلب التواصل مع الدكتور</p>
                                    <p className="text-red-500/60 text-xs">سيتم إخفاء التنبيه تلقائياً عند إرسال رد، أو يمكنك مسحه يدوياً.</p>
                                </div>
                            </div>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    await supabase.from('patients').update({ needs_doctor_attention: false }).eq('id', selectedChat.id);
                                    setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, needs_doctor_attention: false } : c));
                                    setSelectedChat(prev => ({ ...prev, needs_doctor_attention: false }));
                                    toast.success('تم وضع علامة "تم التواصل"');
                                }}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors shrink-0 shadow-lg shadow-red-500/20"
                            >
                                تم التواصل
                            </button>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-950/30">
                        {messages.length === 0 ? (
                            <p className="text-center text-slate-500 mt-10">لا توجد رسائل سابقة. ابدأ المحادثة الآن.</p>
                        ) : (
                            messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[70%] p-3 rounded-2xl ${msg.sender_type === 'user'
                                        ? 'bg-slate-800 text-slate-200 rounded-tr-none'
                                        : 'bg-sky-600 text-white rounded-tl-none'
                                        }`}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        <div className={`flex items-center gap-1 mt-1 ${msg.sender_type === 'user' ? 'justify-start' : 'justify-end'}`}>
                                            {/* Per-message platform indicator (only for incoming) */}
                                            {msg.sender_type === 'user' && msg.platform && (() => {
                                                const { color, Icon } = getPlatformInfo(msg.platform);
                                                return <span className={`inline-flex items-center gap-0.5 text-[9px] px-1 rounded ${color}/20 text-slate-400`}><Icon size={8} />{msg.platform}</span>;
                                            })()}
                                            <span className={`text-[10px] ${msg.sender_type === 'user' ? 'text-slate-500' : 'text-sky-200'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/5 bg-slate-900/30">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="اكتب رسالة..."
                                className="flex-1 bg-slate-950 border border-slate-700/50 rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500 transition-colors text-right"
                                dir="auto"
                            />
                            <button
                                onClick={handleSendMessage}
                                className="bg-sky-600 hover:bg-sky-500 text-white p-3 rounded-xl transition-colors"
                            >
                                <TelegramIcon size={20} className="rotate-180" />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-xs text-slate-500 flex items-center justify-center gap-1">
                                🤖 الرد الآلي مفعل
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 glass-panel flex flex-col items-center justify-center rounded-2xl border border-white/5 text-slate-500">
                    <User size={48} className="mb-4 opacity-50" />
                    <p>اختر محادثة للبدء</p>
                </div>
            )}

            {/* Premium Confirm Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${confirmModal.type === 'clear' ? 'bg-sky-500/20 text-sky-400' : 'bg-red-500/20 text-red-400'}`}>
                                {confirmModal.type === 'clear' ? <MessageCircle size={32} /> : <Trash2 size={32} />}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">
                                {confirmModal.type === 'clear' ? 'مسح الرسائل' : 'حذف المحادثة'}
                            </h3>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                {confirmModal.type === 'clear'
                                    ? 'هل أنت متأكد من مسح كافة الرسائل؟ سيتم الاحتفاظ بحساب المريض في القائمة.'
                                    : 'هل أنت متأكد من حذف هذه المحادثة نهائياً؟ سيتم مسح المريض وكافة رسائله ولا يمكن التراجع عن هذا الإجراء.'}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal({ isOpen: false, type: null })}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors font-medium"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={confirmAction}
                                    className={`flex-1 py-3 rounded-xl transition-colors font-medium text-white ${confirmModal.type === 'clear' ? 'bg-sky-600 hover:bg-sky-500' : 'bg-red-600 hover:bg-red-500'}`}
                                >
                                    {confirmModal.type === 'clear' ? 'مسح الرسائل' : 'حذف نهائي'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessagesView;
