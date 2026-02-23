import React, { useState, useEffect } from 'react';
import { Calendar, MessageSquare, Users, BarChart, Settings, Activity, LogOut, Facebook, Smartphone } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';

const Sidebar = () => {
    const navigate = useNavigate();
    const [wsConnected, setWsConnected] = useState(false);
    const [tgConnected, setTgConnected] = useState(false);
    const [msgConnected, setMsgConnected] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchStatus = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            try {
                const res = await fetch(`${API_URL}/api/whatsapp/status`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });

                if (res.ok && isMounted) {
                    const data = await res.json();
                    setWsConnected(data.status === 'connected');
                    setTgConnected(!!data.telegram_token);
                    setMsgConnected(!!data.messenger_token);
                }
            } catch (error) {
                console.error("Error fetching status indicators:", error);
            }
        };

        fetchStatus();

        // Real-time listener for WA status
        const waChannel = supabase
            .channel('whatsapp_status')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_sessions' }, payload => {
                if (isMounted) setWsConnected(payload.new.status === 'connected');
            })
            .subscribe();

        // Real-time listener for TG/FB (trigger refetch instead of reading payload due to RLS)
        const clinicChannel = supabase
            .channel('clinic_status')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clinics' }, () => {
                fetchStatus();
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(waChannel);
            supabase.removeChannel(clinicChannel);
        };
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error logging out:', error.message);
        navigate('/login');
    };

    return (
        <aside className="w-64 glass-panel h-screen sticky top-0 flex flex-col border-r border-white/10 bg-slate-900/50 backdrop-blur-xl">
            <div className="p-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center neon-shadow">
                    <Activity className="text-white" size={20} />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                    عيادتي الذكية
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                <NavItem to="/dashboard" end icon={<BarChart size={20} />} label="نظرة عامة" />
                <NavItem to="/dashboard/calendar" icon={<Calendar size={20} />} label="المواعيد" />
                <NavItem to="/dashboard/patients" icon={<Users size={20} />} label="سجل المرضى" />
                <NavItem to="/dashboard/messages" icon={<MessageSquare size={20} />} label="المحادثات" />

                <div className="pt-4 border-t border-white/10 mt-4">
                    <NavItem to="/dashboard/settings" icon={<Settings size={20} />} label="الإعدادات" />
                </div>
            </nav>

            <div className="p-4 space-y-3">
                <div className="glass-panel p-3 rounded-2xl border border-white/5 space-y-3 bg-slate-900/40">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">حالة المنصات</span>
                        <div className="flex gap-1.5">
                            <StatusDot active={wsConnected} color="emerald" label="WA" />
                            <StatusDot active={tgConnected} color="sky" label="TG" />
                            <StatusDot active={msgConnected} color="blue" label="FB" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <StatusItem connected={wsConnected} label="واتساب" platform="whatsapp" />
                        <StatusItem connected={tgConnected} label="تليجرام" platform="telegram" />
                        <StatusItem connected={msgConnected} label="ماسنجر" platform="messenger" />
                    </div>
                </div>

                {/* Logout Button (Arrow 1) */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-300 border border-transparent hover:border-red-500/20"
                >
                    <LogOut size={20} />
                    <span className="font-medium">تسجيل الخروج</span>
                </button>
            </div>
        </aside>
    );
};

const NavItem = ({ to, icon, label, end }) => (
    <NavLink
        to={to}
        end={end}
        className={({ isActive }) => `
            flex items-center gap-3 p-3 rounded-xl transition-all duration-300
            ${isActive
                ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
        `}
    >
        {icon}
        <span className="font-medium">{label}</span>
    </NavLink>
);

const StatusDot = ({ active, color, label }) => (
    <div className="group relative">
        <div className={`w-2 h-2 rounded-full transition-all duration-500 ${active ? `bg-${color}-500 animate-pulse shadow-[0_0_8px_rgba(var(--${color}-500-rgb),0.5)]` : 'bg-slate-700'}`}
            style={active ? { boxShadow: `0 0 10px ${color === 'emerald' ? '#10b981' : color === 'sky' ? '#0ea5e9' : '#3b82f6'}` } : {}}
        />
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-[8px] text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-bold">
            {label}
        </span>
    </div>
);

const StatusItem = ({ connected, label, platform }) => {
    const getIcon = () => {
        if (platform === 'whatsapp') return <Activity size={12} className={connected ? 'text-emerald-400' : 'text-slate-600'} />;
        if (platform === 'telegram') return <Smartphone size={12} className={connected ? 'text-sky-400' : 'text-slate-600'} />;
        if (platform === 'messenger') return <Facebook size={12} className={connected ? 'text-blue-500' : 'text-slate-600'} />;
    };

    return (
        <div className="flex items-center gap-2 px-1">
            {getIcon()}
            <span className={`text-[10px] font-medium ${connected ? 'text-slate-200' : 'text-slate-500'}`}>
                {label}
            </span>
            <div className={`ml-auto w-1 h-1 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-700'}`} />
        </div>
    );
};

export default Sidebar;
