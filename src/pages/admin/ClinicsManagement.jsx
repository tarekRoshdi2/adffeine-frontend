import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Trash2, Edit, PowerOff, Settings as SettingsIcon } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { API_URL } from '../../lib/api';
import AddClinicModal from './components/AddClinicModal';
import EditClinicModal from './components/EditClinicModal';
import ClinicSettingsModal from './components/ClinicSettingsModal';

const ClinicsManagement = () => {
    const toast = useToast();
    const [clinics, setClinics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingClinic, setEditingClinic] = useState(null);
    const [settingsClinic, setSettingsClinic] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchClinics();
    }, []);

    const fetchClinics = async () => {
        try {
            const { data, error } = await supabase
                .from('clinics')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setClinics(data || []);
        } catch (error) {
            console.error('Error fetching clinics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClinicAdded = (newClinic) => {
        setClinics([newClinic, ...clinics]);
    };

    const handleEditClick = (clinic) => {
        setEditingClinic(clinic);
        setIsEditModalOpen(true);
    };

    const handleSettingsClick = (clinic) => {
        setSettingsClinic(clinic);
        setIsSettingsModalOpen(true);
    };

    const handleClinicUpdated = (updatedClinic) => {
        setClinics(clinics.map(c => c.id === updatedClinic.id ? updatedClinic : c));
    };

    const handleSuspendClick = async (clinic) => {
        if (window.confirm(`هل أنت متأكد من إيقاف عيادة ${clinic.clinic_name}؟`)) {
            try {
                const { error } = await supabase.from('clinics').update({ status: 'suspended' }).eq('id', clinic.id);
                if (error) throw error;
                handleClinicUpdated({ ...clinic, status: 'suspended' });
                toast.success('تم إيقاف العيادة بنجاح');
            } catch (err) {
                console.error('Suspend error:', err);
                toast.error('حدث خطأ أثناء الإيقاف');
            }
        }
    };

    const handlePermanentDelete = async (clinic) => {
        if (window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف عيادة "${clinic.clinic_name}" نهائياً؟ هذا سيؤدي لحذف العيادة وجميع بيانات المرضى وحساب الطبيب المرتبط بها.`)) {
            try {
                const response = await fetch(`${API_URL}/api/admin/delete-clinic/${clinic.id}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'فشل الحذف');
                }
                setClinics(clinics.filter(c => c.id !== clinic.id));
                toast.success('تم حذف العيادة والحساب المرتبط بها بنجاح');
            } catch (err) {
                console.error('Delete error:', err);
                toast.error('حدث خطأ أثناء الحذف: ' + err.message);
            }
        }
    };

    const filteredClinics = clinics.filter(c => {
        const matchesSearch = c.clinic_name.includes(searchTerm) || (c.specialty && c.specialty.includes(searchTerm));
        const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-6">
            <AddClinicModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onClinicAdded={handleClinicAdded}
            />

            <EditClinicModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingClinic(null);
                }}
                clinic={editingClinic}
                onClinicUpdated={handleClinicUpdated}
            />

            <ClinicSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => {
                    setIsSettingsModalOpen(false);
                    setSettingsClinic(null);
                }}
                clinic={settingsClinic}
            />

            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">إدارة العيادات</h1>
                    <p className="text-slate-400">إضافة وتعديل اشتراكات العيادات</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                >
                    <Plus size={20} />
                    <span>إضافة عيادة</span>
                </button>
            </header>

            {/* Filters and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2 bg-slate-900 p-1 rounded-xl w-full sm:w-auto border border-white/5">
                    {['all', 'active', 'suspended', 'inactive'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === status ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {status === 'all' ? 'الكل' : status === 'active' ? 'نشط' : status === 'suspended' ? 'موقوف' : 'غير نشط'}
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute right-3 top-2.5 text-slate-500" size={20} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="بحث بالاسم أو التخصص..."
                        className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
                    />
                </div>
            </div>

            {/* Clinics Table */}
            <div className="glass-panel overflow-hidden rounded-2xl border border-white/5">
                <table className="w-full text-right">
                    <thead className="bg-white/5 text-slate-400">
                        <tr>
                            <th className="p-4 font-medium">اسم العيادة</th>
                            <th className="p-4 font-medium">التخصص</th>
                            <th className="p-4 font-medium">الحالة</th>
                            <th className="p-4 font-medium">تاريخ الاشتراك</th>
                            <th className="p-4 font-medium">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
                        ) : filteredClinics.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-500">لا توجد عيادات مسجلة مطابقة للبحث</td></tr>
                        ) : (
                            filteredClinics.map((clinic) => (
                                <tr key={clinic.id} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                                    <td className="p-4 font-bold">{clinic.clinic_name}</td>
                                    <td className="p-4 text-slate-300">{clinic.specialty}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${clinic.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : clinic.status === 'suspended' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                                            {clinic.status === 'active' ? 'نشط' : clinic.status === 'suspended' ? 'موقوف' : 'غير نشط'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-400">
                                        {new Date(clinic.created_at).toLocaleDateString('ar-EG')}
                                    </td>
                                    <td className="p-4 flex gap-2">
                                        <button
                                            onClick={() => handleSettingsClick(clinic)}
                                            className="p-2 hover:bg-slate-700 rounded-lg text-emerald-400"
                                            title="إعدادات الذكاء الاصطناعي والربط"
                                        >
                                            <SettingsIcon size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(clinic)}
                                            className="p-2 hover:bg-slate-700 rounded-lg text-sky-400"
                                            title="تعديل البيانات والدخول"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleSuspendClick(clinic)}
                                            className="p-2 hover:bg-slate-700 rounded-lg text-yellow-400 transition-colors"
                                            title="إيقاف العيادة"
                                        >
                                            <PowerOff size={18} />
                                        </button>
                                        <button
                                            onClick={() => handlePermanentDelete(clinic)}
                                            className="p-2 hover:bg-slate-700 rounded-lg text-red-500 transition-colors"
                                            title="حذف نهائي"
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
        </div>
    );
};

export default ClinicsManagement;

