import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import AdminDashboard from './AdminDashboard';

const AdminAuthWrapper = () => {
    const toast = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // On mount: check if already logged in as admin
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                if (profile?.role === 'admin') {
                    setIsAdmin(true);
                }
            }
            setChecking(false);
        };
        checkSession();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
            if (authError) throw authError;

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', authData.user.id)
                .single();

            if (profile?.role !== 'admin') {
                await supabase.auth.signOut();
                throw new Error('هذا الحساب ليس لديه صلاحيات المدير.');
            }

            setIsAdmin(true);
        } catch (error) {
            toast.error('فشل تسجيل الدخول: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Spinner while checking session
    if (checking) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // If already authenticated as admin, show the dashboard
    if (isAdmin) {
        return <AdminDashboard />;
    }

    // Otherwise, show silent admin login form
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-slate-800/20 rounded-full blur-3xl -ml-20 -mb-20"></div>

            <div className="glass-panel p-8 rounded-2xl border border-white/10 w-full max-w-md relative z-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center mx-auto mb-5">
                    <ShieldCheck className="text-purple-400" size={32} />
                </div>

                <h1 className="text-2xl font-bold mb-2 text-white">
                    لوحة التحكم
                </h1>
                <p className="text-slate-400 mb-8 text-sm">
                    أدخل بياناتك للمتابعة
                </p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute right-3 top-3.5 text-slate-500" size={20} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="البريد الإلكتروني"
                            className="w-full pr-10 pl-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-purple-500 transition-colors text-right"
                            required
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute right-3 top-3.5 text-slate-500" size={20} />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="كلمة المرور"
                            className="w-full pr-10 pl-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-purple-500 transition-colors text-right"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-lg shadow-purple-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? 'جاري الدخول...' : 'دخول'}
                    </button>
                </form>

                <p className="mt-6 text-xs text-slate-600">
                    Smart Shield &copy; 2026
                </p>
            </div>
        </div>
    );
};

export default AdminAuthWrapper;
