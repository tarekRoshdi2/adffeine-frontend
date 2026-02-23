import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminSidebar from './components/AdminSidebar';
import ClinicsManagement from './ClinicsManagement';
import AdminOverview from './AdminOverview';
import AdminSettings from './AdminSettings';

const AdminDashboard = () => {
    return (
        <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans" dir="rtl">
            <AdminSidebar />

            <main className="flex-1 overflow-y-auto h-screen">
                <div className="max-w-7xl mx-auto p-8">
                    <Routes>
                        <Route path="/" element={<AdminOverview />} />
                        <Route path="/clinics" element={<ClinicsManagement />} />
                        <Route path="/settings" element={<AdminSettings />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
