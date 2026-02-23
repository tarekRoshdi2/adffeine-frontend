import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Shield, Zap, CheckCircle, ArrowRight, Star } from 'lucide-react';

const LandingPage = () => {
    return (
        <div className="min-h-screen bg-slate-950 text-white selection:bg-sky-500/30 overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Navbar */}
            <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto relative z-10 animate-fade-in">
                <div className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-2">
                    <Bot size={32} className="text-sky-500" />
                    Smart Secretary AI
                </div>
                <div className="flex gap-6 items-center">
                    <Link to="/login" className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-sm font-bold flex items-center gap-2 group">
                        دخول الأطباء
                        <ArrowRight size={16} className="group-hover:-translate-x-1 transition-transform" />
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="py-24 px-6 text-center relative z-10">
                <div className="max-w-4xl mx-auto space-y-8 animate-entry">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-bold mb-4 animate-pulse-soft">
                        <Star size={14} fill="currentColor" />
                        النظام رقم #1 لإدارة العيادات الذكية
                    </div>

                    <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight tracking-tight">
                        حوّل عيادتك لكيان ذكي <br />
                        <span className="text-sky-500">يعمل 24/7</span> دون توقف
                    </h1>

                    <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        نظام متكامل يجمع بين إدارة الحجوزات، الرد الآلي على واتساب، وتنظيم ملفات المرضى باستخدام أحدث تقنيات الذكاء الاصطناعي.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                        <Link to="/pricing" className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-sky-500/20 hover:scale-105 hover:shadow-sky-500/40 flex items-center justify-center gap-2">
                            <Zap size={20} fill="currentColor" />
                            ابدأ فترة التجربة (7 أيام)
                        </Link>
                        <Link to="/demo" className="glass-panel px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2 group">
                            شاهد العرض التجريبي
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 px-6 max-w-7xl mx-auto relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard
                        icon={<Bot className="text-sky-400" size={40} />}
                        title="حجز آلي ذكي"
                        desc="البوت يقرأ مواعيدك، يفهم لغة المريض، ويحجز الموعد المناسب بدقة متناهية دون تدخل بشري."
                        delay="0ms"
                    />
                    <FeatureCard
                        icon={<Shield className="text-emerald-400" size={40} />}
                        title="عزل وحماية كاملة"
                        desc="بيانات مرضاك مشفرة ومحفوظة في بيئة معزولة تماماً. خصوصية العيادة هي أولويتنا القصوى."
                        delay="200ms"
                    />
                    <FeatureCard
                        icon={<Zap className="text-amber-400" size={40} />}
                        title="مساعد طبيب ذكي"
                        desc="يقوم البوت بجمع شكوى المريض، التاريخ المرضي، وتلخيص الحالة لك قبل دخول المريض للعيادة."
                        delay="400ms"
                    />
                </div>
            </section>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc, delay }) => (
    <div
        className="glass-card p-10 relative group hover:-translate-y-2 transition-all duration-500 animate-entry rounded-3xl"
        style={{ animationDelay: delay }}
    >
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all" />

        <div className="relative z-10">
            <div className="mb-6 p-4 bg-white/5 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-500 border border-white/5 shadow-lg">
                {icon}
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-sky-400 transition-colors">{title}</h3>
            <p className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{desc}</p>
        </div>
    </div>
);

export default LandingPage;
