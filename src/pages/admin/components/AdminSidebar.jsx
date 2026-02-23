import React from 'react';
import { NavLink } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Stethoscope, Settings, LogOut, ShieldAlert } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const AdminSidebar = () => {
    const navigate = useNavigate();
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error logging out:', error.message);
        navigate('/login');
    };

    return (
        <aside className="w-64 glass-panel h-screen sticky top-0 flex flex-col border-r border-white/10 bg-slate-900/50 backdrop-blur-xl">
            <div className="p-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center neon-shadow">
                    <ShieldAlert className="text-white" size={20} />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Admin Panel
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                <NavItem to="/admin" end icon={<LayoutDashboard size={20} />} label="Overview" />
                <NavItem to="/admin/clinics" icon={<Stethoscope size={20} />} label="Clinics Management" />
                <NavItem to="/admin/settings" icon={<Settings size={20} />} label="Global Settings" />
            </nav>

            <div className="p-4 border-t border-white/10">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 w-full transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
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
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
        `}
    >
        {icon}
        <span className="font-medium">{label}</span>
    </NavLink>
);

export default AdminSidebar;
