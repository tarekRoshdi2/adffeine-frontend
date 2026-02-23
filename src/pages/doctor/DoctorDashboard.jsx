import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Menu, Activity } from 'lucide-react';
import Sidebar from './components/Sidebar';
import DoctorAssistant from './components/DoctorAssistant';
import Overview from './Overview';
import PatientsList from './PatientsList';
import PatientDetails from './PatientDetails';
import CalendarView from './CalendarView';
import MessagesView from './MessagesView';
import Settings from './Settings';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

const DoctorDashboard = () => {
    const toast = useToast();
    const location = useLocation();
    const [clinicId, setClinicId] = useState(null);

    // Notification Sound
    const playNotificationSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log("Audio play failed:", e));
    };

    useEffect(() => {
        const setupNotifications = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: clinic } = await supabase
                .from('clinics')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (clinic) {
                setClinicId(clinic.id);

                // 1. Listen for New Messages
                const msgSub = supabase
                    .channel('global_messages')
                    .on('postgres_changes', {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `clinic_id=eq.${clinic.id}`
                    }, (payload) => {
                        if (payload.new.sender_type === 'user') {
                            toast.info(`رسالة جديدة: ${payload.new.content.substring(0, 30)}...`);
                            playNotificationSound();
                        }
                    })
                    .subscribe();

                // 2. Listen for New Appointments
                const apptSub = supabase
                    .channel('global_appointments')
                    .on('postgres_changes', {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'appointments',
                        filter: `clinic_id=eq.${clinic.id}`
                    }, (payload) => {
                        toast.success('تم تسجيل حجز جديد في العيادة! 📅');
                        playNotificationSound();
                    })
                    .subscribe();

                return () => {
                    supabase.removeChannel(msgSub);
                    supabase.removeChannel(apptSub);
                };
            }
        };

        setupNotifications();
    }, []);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans" dir="rtl">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                            <Activity className="text-white" size={18} />
                        </div>
                        <h1 className="text-lg font-bold bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                            عيادتي الذكية
                        </h1>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 bg-slate-800 rounded-lg text-slate-300 hover:text-white"
                    >
                        <Menu size={24} />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto w-full">
                    <div className="max-w-7xl mx-auto p-4 md:p-8">
                        <Routes>
                            <Route path="/" element={<Overview />} />
                            <Route path="/patients" element={<PatientsList />} />
                            <Route path="/patients/:id" element={<PatientDetails />} />
                            <Route path="/calendar" element={<CalendarView />} />
                            <Route path="/messages" element={<MessagesView />} />
                            <Route path="/settings" element={<Settings />} />
                        </Routes>
                    </div>
                </main>
            </div>

            <DoctorAssistant />
        </div>
    );
};

export default DoctorDashboard;
