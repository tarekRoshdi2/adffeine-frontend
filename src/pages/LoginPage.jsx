import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Stethoscope, MessageCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const LoginPage = () => {
    const toast = useToast();
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data: authData, error: authError } = await signIn({ email, password });
            if (authError) throw authError;

            // Check role from DB — Admin goes to /admin, Doctor goes to /dashboard
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', authData.user.id)
                .single();

            if (profile?.role === 'admin') {
                navigate('/admin');
                return;
            }

            // Security Check: Block if clinic is suspended
            const { data: clinic } = await supabase
                .from('clinics')
                .select('status')
                .eq('owner_id', authData.user.id)
                .single();

            if (clinic && clinic.status === 'suspended') {
                await supabase.auth.signOut();
                throw new Error('تم إيقاف حساب العيادة من قبل الإدارة. يرجى التواصل معنا على 01115822923.');
            }

            navigate('/dashboard');

        } catch (error) {
            toast.error('فشل تسجيل الدخول: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -ml-20 -mt-20"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -mr-20 -mb-20"></div>

            <div className="glass-panel p-8 rounded-2xl border border-white/10 w-full max-w-md relative z-10 text-center">

                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center mx-auto mb-5">
                    <Stethoscope className="text-sky-400" size={32} />
                </div>

                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    تسجيل دخول العيادة
                </h1>
                <p className="text-slate-400 mb-8">
                    أدخل بيانات حسابك للمتابعة
                </p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute right-3 top-3.5 text-slate-500" size={20} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="البريد الإلكتروني"
                            className="w-full pr-10 pl-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 transition-colors text-right"
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
                            className="w-full pr-10 pl-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 transition-colors text-right"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all shadow-lg shadow-sky-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-white/5 space-y-2">
                    <p className="text-sm text-slate-500">
                        محمي بواسطة نظام Smart Shield &copy; 2026
                    </p>
                    <a
                        href="https://wa.me/201115822923"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                        <MessageCircle size={15} />
                        للتسجيل توصل معنا: 01115822923
                    </a>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
