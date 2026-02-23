import React from 'react';
import { Play, Calendar, MessageSquare, PieChart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Demo = () => {
    return (
        <div className="min-h-screen bg-slate-950 text-white selection:bg-sky-500/30 overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">

                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16 animate-entry">
                    <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent mb-6 leading-tight">
                        شاهد كيف يعمل <br /> <span className="text-indigo-400">مستقبل إدارة العيادات</span>
                    </h1>
                    <p className="text-xl text-slate-400">
                        جولة سريعة في 3 دقائق توضح لك كيف يوفر Smart Secretary AI وقتك ويضاعف كفاءة عيادتك.
                    </p>
                </div>

                {/* Video Player Container */}
                <div className="max-w-5xl mx-auto mb-24 animate-entry" style={{ animationDelay: '200ms' }}>
                    <div className="aspect-video bg-slate-900 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group cursor-pointer">
                        {/* Placeholder Content */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 opacity-90" />

                        {/* Play Button */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                                <Play size={40} className="text-white fill-white ml-2" />
                            </div>
                        </div>

                        {/* UI Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
                            <h3 className="text-2xl font-bold text-white mb-2">جولة في النظام</h3>
                            <p className="text-slate-300">تعرف على واجهة الطبيب، المساعد الذكي، ونظام الحجوزات.</p>
                        </div>
                    </div>
                </div>

                {/* Features Highlight */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <FeatureHighlight
                        icon={<Calendar />}
                        title="إدارة المواعيد"
                        desc="جدول مواعيد ذي يتفادى التعارضات تلقائياً."
                        colors="text-sky-400 bg-sky-500/10"
                    />
                    <FeatureHighlight
                        icon={<MessageSquare />}
                        title="محادثات واتساب"
                        desc="بوت يرد على المرضى 24/7 دون تدخل منك."
                        colors="text-emerald-400 bg-emerald-500/10"
                    />
                    <FeatureHighlight
                        icon={<PieChart />}
                        title="تقارير ذكية"
                        desc="إحصائيات دقيقة عن أداء العيادة ونموها."
                        colors="text-violet-400 bg-violet-500/10"
                    />
                </div>

                {/* CTA */}
                <div className="text-center animate-entry" style={{ animationDelay: '400ms' }}>
                    <div className="glass-panel p-12 max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
                        <h2 className="text-3xl font-bold mb-6">هل تفضل شرح حي ومباشر؟</h2>
                        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                            فريقنا جاهز لعمل عرض توضيحي (Demo) خاص لعيادتك عبر Zoom للإجابة على كل استفساراتك.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                                احجز موعد للعرض (Live)
                            </button>
                            <Link to="/pricing" className="px-8 py-4 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-bold text-white flex items-center gap-2">
                                تخطى العرض وابدأ التجربة
                                <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const FeatureHighlight = ({ icon, title, desc, colors }) => (
    <div className="flex items-start gap-4 p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors">
        <div className={`p-3 rounded-xl ${colors}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-lg font-bold mb-1">{title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
        </div>
    </div>
);

export default Demo;
