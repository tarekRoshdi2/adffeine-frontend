import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import PatientDetails from '../PatientDetails';

const PatientDetailsModal = ({ isOpen, onClose, patientId }) => {
    if (!isOpen || !patientId) return null;

    // Prevent background scrolling when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full h-full max-w-[1600px] bg-slate-900 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col" dir="rtl">

                {/* Close Button Layer */}
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 z-[60] bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 p-2 rounded-full backdrop-blur transition-all border border-white/5"
                >
                    <X size={24} />
                </button>

                {/* Content Container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-12">
                    {/* Reuse the existing PatientDetails page component logic by passing ID via prop context or modifying it to accept props. 
                       However, PatientDetails currently uses useParams(). We need to refactor PatientDetails slightly to accept an optional prop 'id'.
                    */}
                    <PatientDetails patientIdProp={patientId} isModal={true} closeModal={onClose} />
                </div>
            </div>
        </div>
    );
};

export default PatientDetailsModal;
