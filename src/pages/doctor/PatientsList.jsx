import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, User, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

const PatientsList = () => {
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const toast = useToast();

    useEffect(() => {
        fetchPatients();
    }, []);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`هل أنت متأكد من حذف المريض ${name || ''}؟ سيتم حذف جميع بياناته ومواعيده نهائياً.`)) return;

        try {
            const { error } = await supabase
                .from('patients')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('تم حذف المريض بنجاح');
            fetchPatients();
        } catch (error) {
            console.error('Error deleting patient:', error);
            toast.error('فشل في حذف المريض');
        }
    };

    useEffect(() => {
        if (!searchQuery) {
            setFilteredPatients(patients);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = patients.filter(p =>
                (p.full_name && p.full_name.toLowerCase().includes(query)) ||
                (p.phone_number && p.phone_number.includes(query)) ||
                (p.id && p.id.includes(query))
            );
            setFilteredPatients(filtered);
        }
    }, [searchQuery, patients]);

    const fetchPatients = async () => {
        try {
            // SECURITY FIX: Get current user and their clinic_id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: clinic, error: clinicError } = await supabase
                .from('clinics')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (clinicError || !clinic) {
                console.error("Clinic not found for user", clinicError);
                return;
            }

            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .eq('clinic_id', clinic.id)
                .not('full_name', 'is', null)
                .neq('full_name', '')
                .neq('full_name', '\u0645\u0631\u064a\u0636 \u062c\u062f\u064a\u062f')
                .order('last_interaction', { ascending: false });

            if (error) throw error;
            setPatients(data || []);
            setFilteredPatients(data || []);
        } catch (error) {
            console.error('Error fetching patients:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/20 p-2 rounded-lg text-blue-400">
                        <User size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">سجل المرضى</h1>
                        <p className="text-slate-400 text-xs">عرض والبحث في ملفات المرضى</p>
                    </div>
                </div>

                <div className="relative w-full md:w-96 group">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="بحث بالاسم، الرقم، أو الكود..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all text-slate-200 placeholder:text-slate-600 shadow-inner"
                    />
                </div>
            </header>

            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="w-full text-right relative">
                        <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-5 font-semibold text-sm tracking-wide">المريض</th>
                                <th className="p-5 font-semibold text-sm tracking-wide">رقم الهاتف</th>
                                <th className="p-5 font-semibold text-sm tracking-wide">آخر زيارة</th>
                                <th className="p-5 font-semibold text-sm tracking-wide w-1/4">ملخص الحالة (AI)</th>
                                <th className="p-5 font-semibold text-sm tracking-wide"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-5"><div className="h-10 w-10 bg-slate-800 rounded-full"></div></td>
                                        <td className="p-5"><div className="h-4 w-32 bg-slate-800 rounded"></div></td>
                                        <td className="p-5"><div className="h-4 w-24 bg-slate-800 rounded"></div></td>
                                        <td className="p-5"><div className="h-4 w-48 bg-slate-800 rounded"></div></td>
                                        <td className="p-5"></td>
                                    </tr>
                                ))
                            ) : filteredPatients.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 text-slate-500">
                                            <div className="bg-slate-800/50 p-4 rounded-full">
                                                <Search size={32} className="opacity-50" />
                                            </div>
                                            <p className="text-lg font-medium">لا يوجد نتائج مطابقة</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredPatients.map((patient) => (
                                    <tr
                                        key={patient.id}
                                        className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                        onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
                                    >
                                        <td className="p-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shadow-md group-hover:scale-110 transition-transform duration-300">
                                                    <span className="font-bold text-lg">{patient.full_name ? patient.full_name.charAt(0) : '?'}</span>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-base mb-0.5">{patient.full_name || 'غير مسجل'}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono bg-slate-950 px-1.5 py-0.5 rounded w-fit">#{patient.id.slice(0, 8)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 font-mono text-emerald-400 font-medium tracking-wide" dir="ltr">
                                            <div className="flex flex-col">
                                                <span>{patient.phone_number}</span>
                                                <span className={`text-[9px] font-sans px-1.5 py-0.5 rounded w-fit mt-1 border ${patient.source === 'telegram' || patient.source?.startsWith('ai_telegram') ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                                    patient.source === 'whatsapp' || patient.source?.startsWith('ai_whatsapp') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        patient.source === 'messenger' || patient.source?.startsWith('ai_messenger') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                            patient.source?.startsWith('ai_') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                                'bg-slate-800 text-slate-500 border-slate-700'
                                                    }`}>
                                                    {patient.source === 'telegram' ? 'تليجرام' :
                                                        patient.source === 'whatsapp' ? 'واتساب' :
                                                            patient.source === 'messenger' ? 'ماسنجر' :
                                                                patient.source?.startsWith('ai_telegram') ? 'بوت تليجرام 🤖' :
                                                                    patient.source?.startsWith('ai_whatsapp') ? 'بوت واتساب 🤖' :
                                                                        patient.source?.startsWith('ai_messenger') ? 'بوت ماسنجر 🤖' :
                                                                            patient.source?.startsWith('ai_') ? 'بوت ذكي 🤖' :
                                                                                'من العيادة (يدوي)'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-slate-400 text-sm">
                                            {new Date(patient.last_interaction).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="p-5 text-slate-400 text-sm leading-relaxed">
                                            <div className="truncate max-w-xs opacity-80 group-hover:opacity-100 transition-opacity">
                                                {patient.medical_history || '-'}
                                            </div>
                                        </td>
                                        <td className="p-5 text-left flex items-center justify-end gap-2">
                                            <button
                                                className="px-4 py-2 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all duration-300 text-sm font-medium border border-blue-600/20 hover:border-blue-600 shadow-sm hover:shadow-blue-500/20"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/dashboard/patients/${patient.id}`);
                                                }}
                                            >
                                                عرض الملف
                                            </button>
                                            <button
                                                className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all duration-300 border border-transparent hover:border-red-500/20"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(patient.id, patient.full_name);
                                                }}
                                                title="حذف المريض"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-slate-800 bg-slate-950 text-slate-500 text-xs flex justify-between items-center">
                    <span>إجمالي المرضى: {filteredPatients.length}</span>
                    <span>تم التحديث للتو</span>
                </div>
            </div>
        </div >
    );
};

export default PatientsList;
