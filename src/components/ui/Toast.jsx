import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const Toast = ({ id, type, message, onClose }) => {
    const [progress, setProgress] = useState(100);

    const styles = {
        success: {
            icon: <CheckCircle className="text-emerald-400" size={20} />,
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            progress: "bg-emerald-500"
        },
        error: {
            icon: <AlertCircle className="text-red-400" size={20} />,
            bg: "bg-red-500/10",
            border: "border-red-500/20",
            progress: "bg-red-500"
        },
        info: {
            icon: <Info className="text-sky-400" size={20} />,
            bg: "bg-sky-500/10",
            border: "border-sky-500/20",
            progress: "bg-sky-500"
        }
    };

    const style = styles[type] || styles.info;

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev <= 0) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1.5; // Faster decay for better UX
            });
        }, 30); // ~2 seconds

        const closeTimer = setTimeout(() => {
            onClose(id);
        }, 2500); // Auto close after 2.5s

        return () => {
            clearInterval(timer);
            clearTimeout(closeTimer);
        };
    }, [id, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            layout
            className={`relative w-96 p-4 rounded-2xl backdrop-blur-2xl shadow-2xl flex items-start gap-4 overflow-hidden border ${style.bg} ${style.border}`}
        >
            <div className="shrink-0 mt-0.5 p-1 bg-white/5 rounded-full">{style.icon}</div>

            <div className="flex-1 z-10">
                <p className="text-sm font-bold text-white leading-relaxed tracking-wide">{message}</p>
            </div>

            <button
                onClick={() => onClose(id)}
                className="text-white/30 hover:text-white/80 transition-colors bg-white/5 hover:bg-white/10 p-1 rounded-full"
            >
                <X size={14} />
            </button>

            {/* Glowing Progress Bar */}
            <div className="absolute bottom-0 left-0 h-[2px] bg-white/5 w-full">
                <motion.div
                    className={`h-full shadow-[0_0_10px_rgba(255,255,255,0.5)] ${style.progress}`}
                    initial={{ width: "100%" }}
                    animate={{ width: `${progress}%` }}
                />
            </div>
        </motion.div>
    );
};

export default Toast;
