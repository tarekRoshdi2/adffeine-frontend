import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    ArrowRight, Calendar, User, FileText, Phone, Clock,
    CheckCircle2, PlayCircle, StopCircle, History, Activity, X, Droplet, Pill, AlertCircle, Edit3, Settings
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const PatientDetails = ({ patientIdProp, isModal, closeModal }) => {
    const toast = useToast();
    const { id: paramId } = useParams();
    const id = patientIdProp || paramId;
    const navigate = useNavigate();

    // Core Data State
    const [patient, setPatient] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [activeAppointment, setActiveAppointment] = useState(null);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'visits', 'edit'
    const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
    const [viewHistoryItem, setViewHistoryItem] = useState(null);
    const [editConsultationItem, setEditConsultationItem] = useState(null);
    const [clinicInfo, setClinicInfo] = useState(null);

    // Edit Profile State
    const [editForm, setEditForm] = useState({
        phone_number: '',
        age: '',
        address: '',
        blood_type: '',
        allergies: '',
        chronic_conditions: '',
        weight: ''
    });
    const [savingProfile, setSavingProfile] = useState(false);

    useEffect(() => {
        if (!id) return;

        const fetchPatientDetails = async () => {
            try {
                // SECURITY FIX: get user & clinic
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/login');
                    return;
                }

                const { data: clinic, error: clinicError } = await supabase
                    .from('clinics')
                    .select('id, clinic_name, specialty')
                    .eq('owner_id', user.id)
                    .single();

                if (clinicError || !clinic) {
                    toast.error("حدث خطأ في جلب بيانات العيادة");
                    navigate('/dashboard');
                    return;
                }

                setClinicInfo(clinic);

                // 1. Fetch Patient Info (Ensuring it belongs to this clinic)
                const { data: patientData, error: patientError } = await supabase
                    .from('patients')
                    .select('*')
                    .eq('id', id)
                    .eq('clinic_id', clinic.id)
                    .single();

                if (patientError) throw patientError;
                setPatient(patientData);
                setEditForm({
                    phone_number: patientData.phone_number || '',
                    age: patientData.age || '',
                    address: patientData.address || '',
                    blood_type: patientData.blood_type || '',
                    allergies: patientData.allergies || '',
                    chronic_conditions: patientData.chronic_conditions || '',
                    weight: patientData.weight || ''
                });

                // 2. Fetch Appointments (Ensuring it belongs to this clinic)
                const { data: apptData, error: apptError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('patient_id', id)
                    .eq('clinic_id', clinic.id)
                    .order('appointment_date', { ascending: false });

                if (apptError) throw apptError;
                setAppointments(apptData || []);

                // 3. Find Active Appointment (Today's appointment that is arrived or in-progress)
                const todayIndices = (apptData || []).filter(a => {
                    const d = new Date(a.appointment_date);
                    const now = new Date();
                    return d.getDate() === now.getDate() &&
                        d.getMonth() === now.getMonth() &&
                        d.getFullYear() === now.getFullYear();
                });

                // Prioritize in-progress, then arrived, then confirmed
                const active = todayIndices.find(a => a.status === 'in-progress') ||
                    todayIndices.find(a => a.status === 'arrived') ||
                    todayIndices.find(a => a.status === 'confirmed');

                setActiveAppointment(active);

            } catch (error) {
                console.error('Error fetching details:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPatientDetails();
    }, [id]);

    const handleStatusChange = async (newStatus, consultationDetails = null) => {
        if (!activeAppointment) return;

        // If trying to complete, open modal first (unless details are provided)
        if (newStatus === 'completed' && !consultationDetails) {
            setIsFinishModalOpen(true);
            return;
        }

        try {
            const updateData = { status: newStatus };
            if (consultationDetails) {
                updateData.consultation_details = consultationDetails;
            }

            const { error } = await supabase
                .from('appointments')
                .update(updateData)
                .eq('id', activeAppointment.id);

            if (error) throw error;

            setActiveAppointment(prev => ({ ...prev, status: newStatus }));
            setAppointments(prev => prev.map(a => a.id === activeAppointment.id ? { ...a, status: newStatus, consultation_details: consultationDetails } : a));

            if (newStatus === 'completed') {
                setIsFinishModalOpen(false);

                // Auto-append to global medical history for AI Bot (WhatsApp Data Pool)
                if (consultationDetails && consultationDetails.diagnosis) {
                    const dateStr = new Date().toLocaleDateString('ar-EG');
                    const newHistoryEntry = `\n[زيارة ${dateStr}]: ${consultationDetails.diagnosis}`;
                    const updatedHistory = (patient.medical_history || '') + newHistoryEntry;

                    await supabase
                        .from('patients')
                        .update({ medical_history: updatedHistory.trim() })
                        .eq('id', patient.id);

                    setPatient(prev => ({ ...prev, medical_history: updatedHistory.trim() }));
                }

                toast.success('تم إنهاء الكشف وحفظ الروشتة بنجاح');
                setActiveTab('visits'); // Switch to visits tab to show what was saved
            }

        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('حدث خطأ أثناء تحديث الحالة');
        }
    };

    const handleEditConsultation = async (consultationDetails, appointmentId) => {
        try {
            const oldAppt = appointments.find(a => a.id === appointmentId);
            const oldDiagnosis = oldAppt?.consultation_details?.diagnosis;
            const newDiagnosis = consultationDetails?.diagnosis;

            const { error } = await supabase
                .from('appointments')
                .update({ consultation_details: consultationDetails })
                .eq('id', appointmentId);

            if (error) throw error;

            // Sync the updated diagnosis to the global Medical History string if it was changed
            if (oldDiagnosis && newDiagnosis && oldDiagnosis !== newDiagnosis && patient?.medical_history) {
                // simple exact string replace of the old diagnosis in the history block
                const updatedHistory = patient.medical_history.replace(oldDiagnosis, newDiagnosis);

                if (updatedHistory !== patient.medical_history) {
                    await supabase
                        .from('patients')
                        .update({ medical_history: updatedHistory })
                        .eq('id', patient.id);
                    setPatient(prev => ({ ...prev, medical_history: updatedHistory }));
                }
            }

            setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, consultation_details: consultationDetails } : a));
            setEditConsultationItem(null);
            toast.success('تم تعديل الروشتة والكشف بنجاح');
        } catch (error) {
            console.error('Error updating consultation:', error);
            toast.error('حدث خطأ أثناء تعديل البيانات');
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const { error } = await supabase
                .from('patients')
                .update(editForm)
                .eq('id', id);

            if (error) throw error;
            toast.success('تم تحديث بيانات المريض بنجاح');
            setPatient(prev => ({ ...prev, ...editForm }));
            setActiveTab('overview');
        } catch (error) {
            console.error('Error saving profile:', error);
            toast.error('حدث خطأ أثناء حفظ البيانات');
        } finally {
            setSavingProfile(false);
        }
    };


    if (loading) return (
        <div className="flex items-center justify-center h-full min-h-screen text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mr-2"></div>
            جاري تحميل بيانات المريض...
        </div>
    );

    if (!patient) return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <User size={48} className="mb-4 opacity-50" />
            <p className="text-xl font-bold">المريض غير موجود</p>
            <button onClick={() => navigate(-1)} className="mt-4 text-sky-400 hover:text-sky-300">
                العودة للقائمة
            </button>
        </div>
    );

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">

            {/* Modals */}
            {isFinishModalOpen && (
                <FinishConsultationModal
                    onClose={() => setIsFinishModalOpen(false)}
                    onConfirm={(details) => handleStatusChange('completed', details)}
                />
            )}

            {viewHistoryItem && (
                <HistoryDetailsModal
                    appointment={viewHistoryItem}
                    patient={patient}
                    clinic={clinicInfo}
                    onClose={() => setViewHistoryItem(null)}
                />
            )}

            {editConsultationItem && (
                <FinishConsultationModal
                    initialData={editConsultationItem.consultation_details}
                    onClose={() => setEditConsultationItem(null)}
                    onConfirm={(details) => handleEditConsultation(details, editConsultationItem.id)}
                    isEditMode={true}
                />
            )}

            {/* Top Navigation */}
            {!isModal && (
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate('/dashboard/patients')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-sky-600 transition-colors">
                            <ArrowRight size={16} />
                        </div>
                        <span>عودة لسجل المرضى</span>
                    </button>
                    <div className="px-4 py-1 rounded-full bg-slate-800 text-slate-400 text-sm border border-slate-700 font-mono">
                        #{patient.id.slice(0, 8)}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-140px)]">

                {/* Left Column: Fixed Profile Sidebar (1 col) */}
                <div className="xl:col-span-1 space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar pr-2">

                    {/* Main Profile Card */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/5 text-center relative overflow-hidden group shrink-0">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-emerald-500"></div>
                        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-slate-300 text-4xl mb-4 border-4 border-slate-900 shadow-xl relative">
                            <User />
                            {patient.gender && (
                                <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-slate-900
                                ${patient.gender === 'male' ? 'bg-sky-500' : 'bg-pink-500'}`}>
                                    <span className="text-xs">{patient.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
                                </div>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1">{patient.full_name || 'بلا اسم'}</h1>
                        <p className="text-slate-400 text-sm font-mono mb-4">{patient.phone_number}</p>

                        <div className="flex justify-center gap-2 mb-6">
                            <div className="px-3 py-1 bg-slate-800/50 rounded-lg text-xs font-bold text-slate-300 border border-slate-700/50">
                                {patient.age ? `${patient.age} عام` : '--'}
                            </div>
                            <div className="px-3 py-1 bg-slate-800/50 rounded-lg text-xs font-bold text-slate-300 border border-slate-700/50">
                                {appointments.length} زيارات
                            </div>
                            <div className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1
                                ${patient.source === 'telegram' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                    patient.source === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        patient.source === 'manual' ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
                                <span>{
                                    patient.source === 'telegram' ? 'تليجرام' :
                                        patient.source === 'whatsapp' ? 'واتساب' :
                                            patient.source === 'manual' ? 'العيادة' : 'غير معروف'
                                }</span>
                            </div>
                        </div>

                        {/* Status Action Area (Sticky in Sidebar) */}
                        {activeAppointment && (
                            <div className="p-4 bg-slate-900/80 rounded-xl border border-sky-500/20 shadow-inner">
                                <p className="text-xs text-sky-400 font-bold mb-3 flex items-center gap-2 justify-center">
                                    <Activity size={14} /> حالة موعد اليوم
                                </p>
                                <div className="space-y-3">
                                    <select
                                        value={activeAppointment.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        className={`w-full text-center appearance-none bg-slate-950 border-2 rounded-xl py-2 px-3 text-sm font-bold outline-none cursor-pointer transition-colors
                                        ${activeAppointment.status === 'in-progress' ? 'border-emerald-500/50 text-emerald-400' :
                                                activeAppointment.status === 'arrived' ? 'border-sky-500/50 text-sky-400' : 'border-slate-700 hover:border-slate-600 text-slate-300'}`}
                                    >
                                        <option value="pending">⏳ قيد الانتظار</option>
                                        <option value="confirmed">📅 مؤكد</option>
                                        <option value="arrived">🏥 وصل العيادة</option>
                                        <option value="in-progress">🩺 جاري الكشف</option>
                                        <option value="completed">✅ تم الكشف</option>
                                        <option value="cancelled">🚫 ملغي</option>
                                        <option value="no-show">👻 لم يحضر</option>
                                    </select>

                                    {activeAppointment.status === 'arrived' && (
                                        <button
                                            onClick={() => handleStatusChange('in-progress')}
                                            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20 transition-all hover:scale-[1.02]"
                                        >
                                            <PlayCircle size={18} /> بدء الكشف
                                        </button>
                                    )}

                                    {activeAppointment.status === 'in-progress' && (
                                        <button
                                            onClick={() => handleStatusChange('completed')}
                                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02] animate-pulse-slow"
                                        >
                                            <CheckCircle2 size={18} /> إنهاء الكشف واستخراج الروشتة
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Basic Info Quick Cards */}
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                        <div className="glass-panel p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <Droplet size={18} className="text-red-400 mb-1" />
                            <span className="text-[10px] text-slate-500">فصيلة الدم</span>
                            <span className="font-bold text-white text-sm mt-1">{patient.blood_type || '--'}</span>
                        </div>
                        <div className="glass-panel p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <Activity size={18} className="text-sky-400 mb-1" />
                            <span className="text-[10px] text-slate-500">الوزن</span>
                            <span className="font-bold text-white text-sm mt-1">{patient.weight ? `${patient.weight} kg` : '--'}</span>
                        </div>
                    </div>

                    <div className="glass-panel p-4 rounded-xl border border-white/5 shrink-0">
                        <div className="flex items-center gap-2 mb-2 text-rose-400">
                            <AlertCircle size={16} />
                            <h4 className="text-xs font-bold">الحساسية</h4>
                        </div>
                        <p className="text-sm font-medium text-white">{patient.allergies || 'لا يوجد معلومات'}</p>
                    </div>

                    <div className="glass-panel p-4 rounded-xl border border-white/5 shrink-0">
                        <div className="flex items-center gap-2 mb-2 text-orange-400">
                            <Activity size={16} />
                            <h4 className="text-xs font-bold">الأمراض المزمنة</h4>
                        </div>
                        <p className="text-sm font-medium text-white">{patient.chronic_conditions || 'لا يوجد معلومات'}</p>
                    </div>

                </div>

                {/* Right Column: Main Content Area (3 cols) */}
                <div className="xl:col-span-3 flex flex-col h-full bg-slate-900/40 rounded-3xl border border-white/5 overflow-hidden shadow-2xl backdrop-blur-xl">

                    {/* Tabs Header */}
                    <div className="flex border-b border-white/5 bg-slate-950/50 p-2">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all
                            ${activeTab === 'overview' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                        >
                            <User size={18} /> نظرة عامة
                        </button>
                        <button
                            onClick={() => setActiveTab('visits')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all
                            ${activeTab === 'visits' ? 'bg-slate-800 text-sky-400 shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                        >
                            <History size={18} /> الزيارات والروشتات
                        </button>
                        <button
                            onClick={() => setActiveTab('edit')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all
                            ${activeTab === 'edit' ? 'bg-slate-800 text-emerald-400 shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                        >
                            <Settings size={18} /> تعديل الملف الطبي
                        </button>
                    </div>

                    {/* Tab Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                        {/* TAB 1: Overview */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-in fade-in duration-300">

                                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                                    <h3 className="text-indigo-400 text-sm font-bold mb-3 flex items-center gap-2">
                                        <Droplet size={16} /> الملخص الطبي المبدئي (طول المريض)
                                    </h3>
                                    <p className="text-slate-300 leading-relaxed text-sm lg:text-base relative z-10">
                                        {patient.medical_history || "لا يمتلك المريض تاريخاً مرضياً مسجلاً مسبقاً في النظام العام. استخدم قائمة (الزيارات) لإضافة روشتات."}
                                    </p>
                                </div>

                                <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2 mt-8">
                                    <Clock size={18} className="text-sky-400" />
                                    آخر 3 مواعيد
                                </h3>

                                {appointments.length === 0 ? (
                                    <div className="text-center p-8 bg-slate-900/30 rounded-2xl border border-white/5 border-dashed">
                                        <Calendar className="mx-auto text-slate-600 mb-3 opacity-50" size={32} />
                                        <p className="text-slate-500">لا يوجد سجل مواعيد سابق.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {appointments.slice(0, 3).map(appt => (
                                            <div key={appt.id} className="p-4 rounded-xl bg-slate-800/30 border border-white/5 hover:bg-slate-800/60 transition-colors shadow-sm">
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="font-bold text-slate-200 text-sm">
                                                        {new Date(appt.appointment_date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    <span className={`px-2 py-0.5 text-[10px] rounded-full border ${appt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                                        {appt.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-emerald-400 font-medium truncate">
                                                    {appt.consultation_details?.diagnosis ? `التشخيص: ${appt.consultation_details.diagnosis}` : 'لا يوجد تشخيص مسجل'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: Visits (SOAP Timeline) */}
                        {activeTab === 'visits' && (
                            <div className="animate-in fade-in duration-300 space-y-6">
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white mb-1">الروشتات وسجل الكشوفات</h2>
                                        <p className="text-slate-400 text-sm">تاريخ الزيارات والعلاجات الموصوفة</p>
                                    </div>
                                    <span className="px-3 py-1 bg-sky-500/10 text-sky-400 rounded-lg text-xs font-bold border border-sky-500/20">
                                        إجمالي {appointments.filter(a => a.status === 'completed').length} كشوفات
                                    </span>
                                </div>

                                {appointments.length === 0 ? (
                                    <div className="text-center p-12 bg-slate-900/30 rounded-2xl border border-white/5 border-dashed flex flex-col items-center">
                                        <History className="text-slate-600 mb-4" size={48} opacity={0.5} />
                                        <p className="text-slate-400 text-lg">لا توجد زيارات سابقة</p>
                                    </div>
                                ) : (
                                    <div className="relative border-r-2 border-slate-800 pr-4 space-y-12">
                                        {appointments.map(appt => (
                                            <div key={appt.id} className="relative pr-6">
                                                <div className="absolute -right-[27px] top-1 w-4 h-4 rounded-full border-4 bg-slate-900 border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]" />

                                                <div className="mb-3 flex items-center justify-between">
                                                    <h3 className="font-bold text-lg text-white">
                                                        {new Date(appt.appointment_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </h3>
                                                    <span className={`px-3 py-1 text-xs rounded-full border ${appt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-600'}`}>
                                                        {appt.status}
                                                    </span>
                                                </div>

                                                <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-lg">

                                                    {/* AI Summary of Complaint */}
                                                    <div className="p-4 bg-slate-950/50 border-b border-white/5 flex gap-3">
                                                        <Activity className="text-rose-400 shrink-0 mt-0.5" size={18} />
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-bold mb-1">شكوى المريض (AI / مسجلة)</div>
                                                            <div className="text-sm text-slate-300">{appt.chief_complaint || 'لم يسجل شكوى محددة.'}</div>
                                                        </div>
                                                    </div>

                                                    {/* Consultation Result / Prescription */}
                                                    {appt.consultation_details ? (
                                                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                                            <div className="hidden md:block absolute top-4 bottom-4 left-1/2 w-px bg-slate-800/50 -translate-x-1/2"></div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                                                                    <Droplet size={14} /> التشخيص (Diagnosis)
                                                                </h4>
                                                                <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                                                                    {appt.consultation_details.diagnosis || '-'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-sky-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                                                                    <Pill size={14} /> خطة العلاج (Prescription)
                                                                </h4>
                                                                <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                                                                    {appt.consultation_details.prescription || '-'}
                                                                </p>
                                                            </div>

                                                            {appt.consultation_details.notes && (
                                                                <div className="col-span-full pt-4 border-t border-white/5">
                                                                    <h4 className="text-xs font-bold text-slate-500 mb-2">ملاحظات إضافية</h4>
                                                                    <p className="text-slate-400 text-xs italic">{appt.consultation_details.notes}</p>
                                                                </div>
                                                            )}

                                                            <div className="col-span-full mt-2 pt-4 flex justify-between items-center border-t border-white/5">
                                                                <div className="text-xs font-bold text-slate-500">
                                                                    القرار: <span className="text-emerald-400">{appt.consultation_details.outcome === 'checkup' ? 'علاج عادي' : appt.consultation_details.outcome}</span>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => setEditConsultationItem(appt)}
                                                                        className="text-xs font-bold text-slate-400 hover:text-white transition-colors bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1">
                                                                        <Edit3 size={14} /> تعديل
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setViewHistoryItem(appt)}
                                                                        className="text-xs font-bold text-sky-400 hover:text-white transition-colors bg-sky-400/10 px-3 py-1.5 rounded-lg">
                                                                        عرض وتصدير الروشتة &larr;
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-8 text-center bg-slate-900/30">
                                                            <p className="text-slate-500 text-sm">
                                                                {appt.status === 'completed'
                                                                    ? 'تم الكشف ولكن لم يتم تدوين وصفة طبية أو تشخيص مفصل.'
                                                                    : 'لم يتم استكمال أو تدوين هذا الكشف بعد.'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: Edit Profile */}
                        {activeTab === 'edit' && (
                            <form onSubmit={handleSaveProfile} className="max-w-3xl animate-in fade-in duration-300">
                                <div className="mb-6">
                                    <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                        <Edit3 className="text-emerald-400" /> تحديث بيانات المريض
                                    </h2>
                                    <p className="text-slate-400 text-sm">تعديل المعلومات الأساسية والتاريخ المرضي الشامل.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">رقم الهاتف</label>
                                        <input
                                            type="text"
                                            value={editForm.phone_number}
                                            onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">العمر</label>
                                            <input
                                                type="number"
                                                value={editForm.age}
                                                onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">الوزن (kg)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={editForm.weight}
                                                onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm text-slate-400 mb-1">العنوان</label>
                                        <input
                                            type="text"
                                            value={editForm.address}
                                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>

                                    <div className="md:col-span-2 pt-4 border-t border-white/5">
                                        <h3 className="text-emerald-400 font-bold mb-4 text-sm uppercase tracking-wide">البيانات الحيوية</h3>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">فصيلة الدم</label>
                                        <select
                                            value={editForm.blood_type}
                                            onChange={(e) => setEditForm({ ...editForm, blood_type: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                                        >
                                            <option value="">غير محدد</option>
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm text-rose-400 mb-1">الحساسية للأدوية / الأطعمة (إن وجدت)</label>
                                        <textarea
                                            value={editForm.allergies}
                                            onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-rose-500 outline-none resize-none h-24"
                                            placeholder="مثال: حساسية بنيسيلين..."
                                        ></textarea>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm text-orange-400 mb-1">أمراض مزمنة أو عمليات سابقة</label>
                                        <textarea
                                            value={editForm.chronic_conditions}
                                            onChange={(e) => setEditForm({ ...editForm, chronic_conditions: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-orange-500 outline-none resize-none h-24"
                                            placeholder="مثال: سكري، ضغط دم، عملية زائدة دودية عام 2015..."
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {savingProfile ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <CheckCircle2 size={20} />
                                        )}
                                        حفظ البيانات الطبية
                                    </button>
                                </div>
                            </form>
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
};

// -------------------------------------------------------------------------------------------------
// MODALS
// -------------------------------------------------------------------------------------------------

const FinishConsultationModal = ({ onClose, onConfirm, initialData, isEditMode = false }) => {
    const [outcome, setOutcome] = useState(initialData?.outcome || 'checkup');
    const [diagnosis, setDiagnosis] = useState(initialData?.diagnosis || '');
    const [prescription, setPrescription] = useState(initialData?.prescription || '');
    const [notes, setNotes] = useState(initialData?.notes || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm({ outcome, diagnosis, prescription, notes });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl relative animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]" dir="rtl">

                <div className="p-6 border-b border-white/5 bg-slate-950/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {isEditMode ? <Edit3 className="text-amber-500" /> : <CheckCircle2 className="text-emerald-500" />}
                        {isEditMode ? 'تعديل بيانات الكشف (الروشتة)' : 'إنهاء الكشف (تأكيد الروشتة)'}
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">قم بتدوين التشخيص والعلاج لإضافتهما لسجل المريض التاريخي.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar">

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-sky-400 flex items-center gap-2"><Droplet size={16} /> التشخيص (Diagnosis)</label>
                        <textarea
                            required
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            placeholder="ما هو تشخيص الحالة الطبي..."
                            className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-3 text-emerald-100 focus:border-sky-500 outline-none resize-none text-base"
                        ></textarea>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-emerald-400 flex items-center gap-2"><Pill size={16} /> خطة العلاج / الروشتة الموصوفة</label>
                        <textarea
                            value={prescription}
                            onChange={(e) => setPrescription(e.target.value)}
                            placeholder="- دواء كذا (الجرعة)&#10;- دواء كذا (الجرعة)&#10;الراحة التامة لمدة 3 أيام."
                            className="w-full h-32 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none resize-none text-base leading-relaxed"
                        ></textarea>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-400">الإجراء المتخذ (القرار)</label>
                            <select
                                value={outcome}
                                onChange={(e) => setOutcome(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 outline-none"
                            >
                                <option value="checkup">✅ كشف وعلاج (عادي)</option>
                                <option value="procedure">💉 إجراء جراحي / صغرى بالمقعد</option>
                                <option value="referral">➡️ تحويل لطبيب آخر / تخصص آخر</option>
                                <option value="followup">📅 طلب استشارة لاحقة / مراجعة</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-400">ملاحظات سرية للعيادة (لا تُطبع)</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="ملاحظات..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-300 focus:border-sky-500 outline-none"
                            />
                        </div>
                    </div>

                </form>

                <div className="p-6 border-t border-white/5 bg-slate-950/50 flex gap-3 mt-auto">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors font-bold"
                    >
                        تراجع واستكمال الكشف
                    </button>
                    <button
                        type="submit"
                        disabled={!diagnosis.trim()}
                        className={`flex-1 py-3 rounded-xl text-white shadow-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${isEditMode ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
                    >
                        {isEditMode ? <Edit3 size={20} /> : <CheckCircle2 size={20} />}
                        {isEditMode ? 'حفظ التعديلات' : 'حفظ وإنهاء موعد المريض'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Simplified Print View Modal
const HistoryDetailsModal = ({ appointment, patient, clinic, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl relative animate-in fade-in zoom-in duration-200 text-slate-900 overflow-hidden" dir="rtl">

                {/* Print Header */}
                <div className="border-b-4 border-slate-900 p-8 flex justify-between items-center bg-slate-50">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">{clinic?.clinic_name || 'العيادة الذكية'}</h1>
                        <p className="text-sm font-bold text-slate-500 mt-1">{clinic?.specialty || 'روشتة طبية'}</p>
                    </div>
                    <div className="text-left font-mono text-sm border-l-2 border-slate-300 pl-4 text-slate-600 font-medium">
                        <div>Date: {new Date(appointment.appointment_date).toLocaleDateString()}</div>
                        <div>ID: #{appointment.id.slice(0, 8)}</div>
                    </div>
                </div>

                {/* Patient Info */}
                <div className="p-8 pb-4">
                    <div className="flex gap-8 mb-8 border-b border-slate-200 pb-6">
                        <div className="flex-1">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">اسم المريض</div>
                            <div className="text-lg font-bold">{patient?.full_name || 'غير محدد'}</div>
                        </div>
                        <div className="w-1/4">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">العمر</div>
                            <div className="font-bold">{patient?.age || '--'} عام</div>
                        </div>
                    </div>

                    {/* Rx Body */}
                    {appointment.consultation_details ? (
                        <div className="space-y-8 min-h-[300px]">
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    التشخيص الطبي
                                </h3>
                                <div className="text-lg font-bold text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    {appointment.consultation_details.diagnosis || 'غير مسجل'}
                                </div>
                            </div>

                            <div>
                                <h3 className="flex items-center gap-2 text-2xl font-black text-slate-900 mb-4 font-serif italic text-blue-900">
                                    Rx.
                                </h3>
                                <div className="text-lg leading-loose whitespace-pre-wrap pl-6 font-medium text-slate-700">
                                    {appointment.consultation_details.prescription || 'لم يوصف دواء لهذه الزيارة.'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-slate-400 font-bold">لا توجد بيانات للروشتة.</div>
                    )}
                </div>

                <div className="p-4 bg-slate-100 flex justify-between items-center mt-4">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-200 font-bold transition-colors">
                        إغلاق
                    </button>
                    <button
                        onClick={() => {
                            toast.success('تم إرسال أمر الطباعة!');
                            window.print();
                        }}
                        className="px-6 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-bold transition-colors flex items-center gap-2 shadow-lg">
                        🖨️ طباعة الروشتة
                    </button>
                </div>
            </div>
            {/* CSS specifically to hide other things when printing */}
            <style>{`
                @media print {
                    body > *:not(.fixed) { display: none !important; }
                    .fixed { position: absolute; inset: 0; background: white; }
                    .bg-slate-950\\/80 { background: white !important; }
                    button { display: none !important; }
                    .shadow-2xl { border: none !important; shadow: none !important; }
                }
            `}</style>
        </div>
    );
};

export default PatientDetails;
