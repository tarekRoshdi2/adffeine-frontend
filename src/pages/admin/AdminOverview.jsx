import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Activity, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AdminOverview = () => {
    const [stats, setStats] = useState({
        clinicsCount: 0,
        activeClinics: 0,
        totalPatients: 0,
        mrr: 0
    });
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        const fetchStats = async () => {
            // Count Clinics
            const { count: clinicsCount } = await supabase.from('clinics').select('*', { count: 'exact', head: true });
            const { count: activeClinics } = await supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('status', 'active');

            // Count Patients
            const { count: patientsCount } = await supabase.from('patients').select('*', { count: 'exact', head: true });

            // Load base price from admin_settings (fallback to 1500)
            let basePrice = 1500;
            try {
                const { data: priceRow } = await supabase
                    .from('admin_settings')
                    .select('value')
                    .eq('key', 'base_price')
                    .maybeSingle();
                if (priceRow) basePrice = parseFloat(priceRow.value) || 1500;
            } catch (_) { }

            const mrr = (activeClinics || 0) * basePrice;

            setStats({
                clinicsCount: clinicsCount || 0,
                activeClinics: activeClinics || 0,
                totalPatients: patientsCount || 0,
                mrr
            });

            // Real appointments data for last 7 days
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const { data: appointments } = await supabase
                .from('appointments')
                .select('appointment_date')
                .gte('appointment_date', sevenDaysAgo.toISOString());

            // Build a day-by-day count map
            const dayCountMap = {};
            const days = Array.from({ length: 7 }).map((_, i) => {
                const d = new Date(today);
                d.setDate(today.getDate() - (6 - i));
                const key = d.toISOString().split('T')[0];
                dayCountMap[key] = 0;
                return { date: d, key };
            });

            (appointments || []).forEach(appt => {
                const key = appt.appointment_date?.split('T')[0];
                if (key && dayCountMap[key] !== undefined) dayCountMap[key]++;
            });

            const data = days.map(({ date, key }) => ({
                name: date.toLocaleDateString('ar-EG', { weekday: 'short' }),
                appointments: dayCountMap[key]
            }));

            setChartData(data);
        };
        fetchStats();
    }, []);

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    لوحة التحكم الرئيسية
                </h1>
                <p className="text-slate-400 mt-2">نظرة عامة على أداء النظام بالكامل</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={<Activity />} label="العيادات النشطة" value={`${stats.activeClinics} / ${stats.clinicsCount}`} color="purple" />
                <StatCard icon={<Users />} label="إجمالي المرضى في النظام" value={stats.totalPatients} color="pink" />
                <StatCard icon={<DollarSign />} label="الأرباح الشهرية المتوقعة (MRR)" value={`${stats.mrr.toLocaleString()} ج.م`} color="emerald" />
            </div>

            <div className="glass-panel p-6 border border-white/5 rounded-2xl">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white text-right">نمو الحجوزات (آخر 7 أيام)</h2>
                </div>
                <div className="h-[300px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorAppts" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8' }} />
                            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8' }} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="appointments" name="الحجوزات" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorAppts)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, color }) => (
    <div className={`glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden`}>
        <div className={`w-12 h-12 rounded-xl bg-${color}-500/20 flex items-center justify-center text-${color}-400 mb-4`}>
            {icon}
        </div>
        <div className="text-3xl font-bold mb-1">{value}</div>
        <div className="text-slate-400">{label}</div>
    </div>
);

export default AdminOverview;
