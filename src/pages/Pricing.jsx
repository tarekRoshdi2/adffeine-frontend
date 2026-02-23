import React, { useState } from 'react';
import { Check, Star, Zap, Shield, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

const Pricing = () => {
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

    return (
        <div className="min-h-screen bg-slate-950 text-white selection:bg-sky-500/30 overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16 animate-entry">
                    <span className="inline-block px-4 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold mb-6 animate-pulse-soft">
                        ✨ عرض خاص: تجربة مجانية لمدة 7 أيام
                    </span>
                    <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent mb-6">
                        اختر الخطة المناسبة لعيادتك
                    </h1>
                    <p className="text-xl text-slate-400">
                        استثمر في راحة بالك ورضا مرضاك. جميع الخطط تشمل تحديثات مجانية ودعم فني على مدار الساعة.
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>شهري</span>
                        <button
                            onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
                            className="w-16 h-8 bg-slate-800 rounded-full p-1 relative transition-colors hover:bg-slate-700"
                        >
                            <div className={`w-6 h-6 bg-sky-500 rounded-full shadow-lg transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-sm font-bold ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>
                            سنوي <span className="text-emerald-400 text-xs">(وفر 20%)</span>
                        </span>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Starter Plan */}
                    <PricingCard
                        title="البداية"
                        price={billingCycle === 'monthly' ? '49' : '39'}
                        features={[
                            "إدارة حتى 500 مريض",
                            "نظام الحجوزات الأساسي",
                            "تذكير بالمواعيد (SMS)",
                            "دعم فني عبر البريد"
                        ]}
                        icon={<Zap className="text-sky-400" />}
                        delay="0ms"
                    />

                    {/* Pro Plan (Recommended) */}
                    <PricingCard
                        title="احترافي"
                        price={billingCycle === 'monthly' ? '99' : '79'}
                        features={[
                            "عدد غير محدود من المرضى",
                            "المساعد الذكي (AI) 🤖",
                            "الرد الآلي على واتساب",
                            "تقارير وإحصائيات متقدمة",
                            "أولوية في الدعم الفني"
                        ]}
                        icon={<Crown className="text-amber-400" />}
                        isPopular
                        delay="200ms"
                    />

                    {/* Clinic+ Plan */}
                    <PricingCard
                        title="عيادة +"
                        price={billingCycle === 'monthly' ? '199' : '159'}
                        features={[
                            "كل مميزات الباقة الاحترافية",
                            "تعدد العيادات / الفروع",
                            "API للربط مع أنظمة أخرى",
                            "مدير حساب خاص",
                            "تدريب مجاني للطاقم"
                        ]}
                        icon={<Shield className="text-emerald-400" />}
                        delay="400ms"
                    />
                </div>
            </div>
        </div>
    );
};

const PricingCard = ({ title, price, features, icon, isPopular, delay }) => (
    <div
        className={`glass-card p-8 rounded-3xl relative group hover:-translate-y-2 transition-all duration-500 animate-entry flex flex-col ${isPopular ? 'border-sky-500/50 shadow-sky-900/20' : ''}`}
        style={{ animationDelay: delay }}
    >
        {isPopular && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg shadow-sky-500/30 flex items-center gap-1">
                <Star size={12} fill="currentColor" />
                الأكثر طلباً
            </div>
        )}

        <div className="mb-6">
            <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 ${isPopular ? 'text-sky-400 bg-sky-500/10' : 'text-slate-400'}`}>
                {icon}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
            <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">${price}</span>
                <span className="text-slate-500">/ شهرياً</span>
            </div>
        </div>

        <div className="space-y-4 mb-8 flex-1">
            {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3 text-slate-300 text-sm">
                    <div className="min-w-[20px]">
                        <Check size={16} className={isPopular ? "text-sky-400" : "text-slate-500"} />
                    </div>
                    {feature}
                </div>
            ))}
        </div>

        <Link
            to="/login?plan=pro"
            className={`w-full py-4 rounded-xl font-bold text-center transition-all ${isPopular
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-white border border-white/5'
                }`}
        >
            ابدأ فترة التجربة (7 أيام)
        </Link>
    </div>
);

export default Pricing;
