import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const AdminAuthWrapper = ({ children }) => {
    const toast = useToast();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profile?.role === 'admin') {
                setIsAdmin(true);
            } else {
                await supabase.auth.signOut();
            }
        }
        setLoading(false);
    };

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

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />

                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 mb-4 border border-purple-500/20">
                            <Lock size={32} />
                        </div>
                        <h1 className="text-3xl font-black text-white">لوحة التحكم</h1>
                        <p className="text-slate-400 mt-2">أدخل بياناتك للمتابعة</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400 block px-1">البريد الإلكتروني</label>
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-purple-500 outline-none transition-colors"
                                placeholder="tarekroshdi@gmail.com"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400 block px-1">كلمة المرور</label>
                            <input
                                required
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-purple-500 outline-none transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-purple-900/20 mt-4 active:scale-95"
                        >
                            دخول
                        </button>
                    </form>

                    <p className="text-center text-slate-600 text-[10px] mt-8 uppercase tracking-widest">Smart Shield © 2026</p>
                </div>
            </div>
        );
    }

    return children;
};

export default AdminAuthWrapper;
