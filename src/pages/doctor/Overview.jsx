import React, { useEffect, useState } from 'react';
import { Users, Calendar, Activity, Clock, ChevronRight, Stethoscope, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import PatientDetailsModal from './components/PatientDetailsModal';

const Overview = () => {
    const [stats, setStats] = useState({ appointments: 0, patients: 0, chats: 0 });
    const [todaysAppointments, setTodaysAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [clinicName, setClinicName] = useState('');
    const [weeklyData, setWeeklyData] = useState([]);
    const [statusData, setStatusData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Live Clock
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        fetchDashboardData();

        const subscription = supabase
            .channel('public:appointments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        return () => {
            clearInterval(timer);
            supabase.removeChannel(subscription);
        };
    }, []);

    const fetchDashboardData = async () => {
        try {
            // SECURITY FIX: Get current user and their clinic_id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: clinic, error: clinicError } = await supabase
                .from('clinics')
                .select('id, clinic_name')
                .eq('owner_id', user.id)
                .single();

            if (clinic) {
                setClinicName(clinic.clinic_name);
            }

            if (clinicError || !clinic) {
                console.error("Clinic not found for user", clinicError);
                return;
            }

            const { count: apptCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinic.id);

            const { count: patCount } = await supabase
                .from('patients')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinic.id);

            setStats({
                appointments: apptCount || 0,
                patients: patCount || 0,
                chats: 0
            });

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const { data: todayAppts, error } = await supabase
                .from('appointments')
                .select(`
                    id,
                    appointment_date,
                    status,
                    chief_complaint,
                    patients (id, full_name, medical_history)
                `)
                .eq('clinic_id', clinic.id)
                .gte('appointment_date', todayStart.toISOString())
                .lte('appointment_date', todayEnd.toISOString())
                .order('appointment_date', { ascending: true });

            if (error) {
                toast.error('خطأ في تحميل البيانات');
                throw error;
            }

            const sortedAppts = (todayAppts || []).sort((a, b) => {
                const statusOrder = { 'in-progress': 1, 'arrived': 2, 'confirmed': 3, 'pending': 4, 'completed': 5, 'cancelled': 6 };
                return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
            });

            setTodaysAppointments(sortedAppts);

            // 6. Fetch Analytics Data (Last 7 Days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data: recentAppts } = await supabase
                .from('appointments')
                .select('appointment_date, status')
                .eq('clinic_id', clinic.id)
                .gte('appointment_date', sevenDaysAgo.toISOString())
                .order('appointment_date', { ascending: true });

            // Process Weekly Data
            const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const last7Days = [...Array(7)].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                return {
                    name: days[date.getDay()],
                    date: date.toISOString().split('T')[0],
                    count: 0
                };
            });

            const statusCounts = {
                'completed': { name: 'تم الكشف', value: 0, color: '#10b981' },
                'confirmed': { name: 'مؤكد', value: 0, color: '#0ea5e9' },
                'cancelled': { name: 'ملغي', value: 0, color: '#ef4444' },
                'pending': { name: 'انتظار', value: 0, color: '#f59e0b' }
            };

            recentAppts?.forEach(appt => {
                const apptDate = appt.appointment_date.split('T')[0];
                const dayData = last7Days.find(d => d.date === apptDate);
                if (dayData) dayData.count++;

                if (statusCounts[appt.status]) {
                    statusCounts[appt.status].value++;
                }
            });

            setWeeklyData(last7Days);
            setStatusData(Object.values(statusCounts).filter(s => s.value > 0));

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error('حدث خطأ أثناء تسجيل الخروج');
            console.error('Error logging out:', error.message);
        } else {
            toast.success('تم تسجيل الخروج بنجاح');
            window.location.href = '/login';
        }
    };

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="space-y-8 animate-fade-in p-2 pb-20">
            <PatientDetailsModal
                isOpen={!!selectedPatientId}
                patientId={selectedPatientId}
                onClose={() => setSelectedPatientId(null)}
            />

            {/* Premium Header */}
            <header className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 animate-entry" style={{ animationDelay: '0ms' }}>
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                        <span className="bg-gradient-to-r from-sky-400 via-purple-400 to-sky-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]">
                            {clinicName || 'جاري التحميل...'}
                        </span>
                    </h1>
                    <p className="text-slate-400 font-medium">إليك ملخص سريع لأداء العيادة اليوم.</p>
                </div>

                {/* Live Clock Widget (Arrow 3) */}
                <div className="glass-card px-6 py-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 flex items-center gap-4 shadow-[0_0_20px_rgba(14,165,233,0.1)]">
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white font-mono tracking-wider">
                            {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-sky-400 font-bold uppercase tracking-widest">
                            {currentTime.toLocaleDateString('ar-EG', { weekday: 'long' })}
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 animate-pulse-soft">
                        <Clock size={20} />
                    </div>
                </div>
            </header>

            {/* 3D Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard
                    icon={<Calendar />}
                    label="حجوزات اليوم"
                    value={todaysAppointments.length}
                    color="sky"
                    delay="100ms"
                />
                <StatCard
                    icon={<Users />}
                    label="إجمالي المرضى"
                    value={stats.patients}
                    color="emerald"
                    delay="200ms"
                />
            </div>

            {/* Main Command Center - Moved Up */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Waiting Room (High Priority) - Span 7 */}
                <div className="lg:col-span-7 glass-panel p-1 rounded-3xl border border-white/5 animate-entry" style={{ animationDelay: '300ms' }}>
                    <div className="bg-slate-900/40 rounded-[20px] p-6 h-full flex flex-col">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-900/20">
                                    <Users size={20} className="text-white" />
                                </div>
                                <span className="text-white">غرفة الانتظار</span>
                            </h2>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <input
                                        type="text"
                                        placeholder="بحث عن مريض..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50 transition-colors"
                                    />
                                </div>
                                <span className="text-[10px] font-bold bg-white/5 text-slate-400 px-3 py-2 rounded-xl border border-white/5 whitespace-nowrap">
                                    {todaysAppointments.length} مواعيد
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar max-h-[500px] pr-2">
                            {(() => {
                                const filtered = todaysAppointments.filter(appt =>
                                    appt.patients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    appt.chief_complaint?.toLowerCase().includes(searchTerm.toLowerCase())
                                );

                                if (filtered.length === 0) {
                                    return (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                                                <Calendar size={32} />
                                            </div>
                                            <p className="text-slate-500">
                                                {searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد مواعيد مجدولة لهذا اليوم.'}
                                            </p>
                                        </div>
                                    );
                                }

                                return filtered.map((appt, idx) => (
                                    <AppointmentItem
                                        key={appt.id}
                                        index={idx}
                                        appt={appt}
                                        onSelect={() => setSelectedPatientId(appt.patients?.id)}
                                    />
                                ));
                            })()}
                        </div>
                    </div>
                </div>

                {/* Right Column: AI Insight - Span 5 */}
                <div className="lg:col-span-5 flex flex-col gap-6 animate-entry" style={{ animationDelay: '400ms' }}>
                    {/* AI Insight Card */}
                    <div className="glass-card p-1 rounded-3xl border border-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                        <div className="bg-slate-900/60 backdrop-blur-xl rounded-[20px] p-6 relative z-10 h-full">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-400">
                                <Stethoscope size={18} />
                                المساعد الذكي
                            </h2>
                            {(() => {
                                const nextPatient = todaysAppointments.find(a => a.status === 'in-progress')
                                    || todaysAppointments.find(a => a.status === 'arrived')
                                    || todaysAppointments.find(a => a.status === 'confirmed');

                                if (!nextPatient) {
                                    return (
                                        <div className="text-slate-400 text-sm leading-relaxed">
                                            لا يوجد مرضى يحتاجون للانتباه حالياً. <br />
                                            وقت رائع لمراجعة التقارير أو أخذ استراحة قصيرة! ☕
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-lg font-bold text-slate-300">
                                                {nextPatient.patients?.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-400 mb-0.5">
                                                    {nextPatient.status === 'in-progress' ? 'يتم الكشف عليه الآن' : 'المريض التالي'}
                                                </div>
                                                <div className="font-bold text-white text-lg leading-none">
                                                    {nextPatient.patients?.full_name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                                            <p className="text-emerald-100/90 text-sm leading-relaxed">
                                                <span className="font-bold text-emerald-400 block mb-1 text-xs">الشكوى / السبب:</span>
                                                {nextPatient.chief_complaint || 'غير محدد'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="text-3xl font-bold text-white">
                                {todaysAppointments.filter(a => a.status === 'completed').length}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">تم الكشف اليوم</div>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="text-3xl font-bold text-white">
                                {todaysAppointments.filter(a => a.status === 'cancelled').length}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">إلغاء المواعيد</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analytics Section - Phase 2 (Moved Down) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-entry" style={{ animationDelay: '500ms' }}>
                {/* Weekly Activity Line Chart */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <TrendingUp size={18} className="text-sky-400" />
                            نشاط الحجوزات (أسبوعي)
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyData}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    itemStyle={{ color: '#0ea5e9' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#0ea5e9"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution Donut Chart */}
                <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <PieChartIcon size={18} className="text-purple-400" />
                        توزيع الحالات
                    </h3>
                    <div className="h-[250px] w-full flex flex-col items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData.length > 0 ? statusData : [{ name: 'N/A', value: 1, color: '#1e293b' }]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(statusData.length > 0 ? statusData : [{ color: '#1e293b' }]).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
                            {statusData.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-[10px] text-slate-400 font-bold">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Sub Components ---

const StatCard = ({ icon, label, value, color, delay }) => (
    <div
        className="glass-card p-6 rounded-3xl relative overflow-hidden group hover:-translate-y-2 animate-entry"
        style={{ animationDelay: delay }}
    >
        <div className={`absolute -right-6 -top-6 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl group-hover:bg-${color}-500/20 transition-all duration-500`} />

        <div className="relative z-10 flex items-start justify-between">
            <div>
                <p className="text-slate-400 font-medium mb-1 text-sm">{label}</p>
                <h3 className="text-4xl font-bold text-white tracking-tight">{value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 flex items-center justify-center text-${color}-400 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.2)]`}>
                {icon}
            </div>
        </div>

        {/* Decorative Line */}
        <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-${color}-500/0 via-${color}-500/50 to-${color}-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
    </div>
);

const AppointmentItem = ({ appt, index, onSelect }) => {
    const isArrived = appt.status === 'arrived';
    const isInProgress = appt.status === 'in-progress';
    const isConfirmed = appt.status === 'confirmed';

    return (
        <div
            onClick={onSelect}
            className={`
                group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer animate-entry
                ${isInProgress
                    ? 'bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/30'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 hover:translate-x-1'
                }
            `}
            style={{ animationDelay: `${500 + (index * 100)}ms` }}
        >
            {/* Status Line Indicator */}
            <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-l-full transition-all duration-300
                ${isInProgress ? 'bg-emerald-500 h-10 shadow-[0_0_10px_#10b981]'
                    : isArrived ? 'bg-sky-500 h-6'
                        : 'bg-slate-700 h-4 group-hover:h-6'}
            `} />

            {/* Time */}
            <div className={`
                flex flex-col items-center justify-center min-w-[60px] h-[60px] rounded-xl border font-mono text-sm transition-colors
                ${isInProgress ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-900/50 border-white/5 text-slate-400 group-hover:text-white group-hover:border-white/10'}
            `}>
                <span className="font-bold text-lg">
                    {new Date(appt.appointment_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }).replace('ص', '').replace('م', '')}
                </span>
                <span className="text-[10px] opacity-60">
                    {new Date(appt.appointment_date).getHours() >= 12 ? 'مساءً' : 'صباحاً'}
                </span>
            </div>

            {/* Info */}
            <div className="flex-1 pr-2">
                <div className="flex justify-between items-center mb-1">
                    <h3 className={`font-bold text-lg transition-colors ${isInProgress ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                        {appt.patients?.full_name}
                    </h3>
                    {/* Badge */}
                    <div>
                        {isInProgress ? (
                            <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 animate-pulse">
                                جاري الكشف
                            </span>
                        ) : isArrived ? (
                            <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/20">
                                وصل للعيادة
                            </span>
                        ) : appt.status === 'pending' ? (
                            <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                                <Activity size={10} />
                                يحتاج مراجعة (AI)
                            </span>
                        ) : (
                            <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                                {appt.status}
                            </span>
                        )}
                    </div>
                </div>

                <p className="text-sm text-slate-500 flex items-center gap-2 overflow-hidden">
                    <span className="truncate max-w-[200px]">{appt.chief_complaint || 'كشف روتيني'}</span>
                    {/* Hover Reveal Action */}
                    <ChevronRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-sky-400" />
                </p>
            </div>
        </div>
    );
};

const Skeleton = ({ className }) => (
    <div className={`shimmer-bg bg-slate-800/50 rounded-lg ${className}`} />
);

const DashboardSkeleton = () => (
    <div className="space-y-8 animate-pulse p-2 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
            <div>
                <Skeleton className="h-10 w-64 mb-2" />
                <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-16 w-48 rounded-2xl" />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-[300px] rounded-3xl" />
            <Skeleton className="h-[300px] rounded-3xl" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 h-[600px] glass-panel rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-6 w-20" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                </div>
            </div>
            <div className="lg:col-span-5 space-y-6">
                <Skeleton className="h-[300px] rounded-3xl" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                </div>
            </div>
        </div>
    </div>
);

export default Overview;
