import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Clock, AlignJustify, Columns } from 'lucide-react';
import AddAppointmentModal from './components/AddAppointmentModal';
import AppointmentDetailsModal from './components/AppointmentDetailsModal';

const CalendarView = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'day' : 'week');
    const [appointments, setAppointments] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [selectedAppointment, setSelectedAppointment] = useState(null); // For details modal

    const [searchParams] = new URL(window.location.href).searchParams;

    const [workingHours, setWorkingHours] = useState(null);

    // Settings
    const [startHour, setStartHour] = useState(8);
    const [endHour, setEndHour] = useState(24);
    const HOUR_HEIGHT = 80;

    // Handle view mode on resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) setViewMode('day');
            else setViewMode('week');
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (workingHours) {
            try {
                let minStart = 24;
                let maxEnd = 0;
                let hasEnabledDays = false;

                Object.values(workingHours).forEach(day => {
                    if (day && day.enabled && day.start && day.end) {
                        hasEnabledDays = true;
                        const startH = parseInt(day.start.split(':')[0], 10);
                        let endH = parseInt(day.end.split(':')[0], 10);

                        if (isNaN(startH) || isNaN(endH)) return; // Skip invalid

                        if (endH === 0) endH = 24; // Handle midnight

                        if (startH < minStart) minStart = startH;
                        if (endH > maxEnd) maxEnd = endH;
                    }
                });

                // If no days enabled or calculation weird, fallback
                if (!hasEnabledDays || minStart > maxEnd) {
                    setStartHour(8);
                    setEndHour(24);
                } else {
                    // Clamp between 0 and 24 and Ensure they are numbers
                    const s = Math.max(0, minStart - 1);
                    const e = Math.min(24, maxEnd + 1);
                    setStartHour(isNaN(s) ? 8 : s);
                    setEndHour(isNaN(e) ? 24 : e);
                }
            } catch (err) {
                console.error("Error calculating calendar hours:", err);
                setStartHour(8);
                setEndHour(24);
            }
        }
    }, [workingHours]);

    // Safety check for array creation
    const calculatedLength = endHour - startHour;
    // Ensure length is valid positive integer
    const safeLength = (Number.isFinite(calculatedLength) && calculatedLength > 0) ? calculatedLength : 16;
    const hours = Array.from({ length: safeLength }).map((_, i) => startHour + i);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'new') {
            setIsAddModalOpen(true);
            window.history.replaceState({}, '', '/dashboard/calendar');
        }
        fetchClinicSettings();
    }, []);

    const fetchClinicSettings = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: clinic } = await supabase
                .from('clinics')
                .select('working_hours')
                .eq('owner_id', user.id)
                .single();

            if (clinic?.working_hours) {
                setWorkingHours(clinic.working_hours);
            }
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [currentDate, viewMode]);

    const fetchAppointments = async () => {
        try {
            let start, end;

            if (viewMode === 'week') {
                start = getStartOfWeek(currentDate);
                end = new Date(start);
                end.setDate(end.getDate() + 7);
            } else {
                start = new Date(currentDate);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(end.getDate() + 1); // Next day
            }

            // SECURITY FIX: Get current user and their clinic_id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: clinic, error: clinicError } = await supabase
                .from('clinics')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (clinicError || !clinic) {
                console.error("Clinic not found for user", clinicError);
                return;
            }

            const { data, error } = await supabase
                .from('appointments')
                .select('*, patients(id, full_name, phone_number)')
                .eq('clinic_id', clinic.id)
                .gte('appointment_date', start.toISOString())
                .lt('appointment_date', end.toISOString());

            if (error) {
                console.error('Error fetching appointments:', error);
                return;
            }

            if (data) setAppointments(data);
        } catch (err) {
            console.error('Unexpected error in fetchAppointments:', err);
        }
    };

    const getStartOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay(); // 0 is Sunday, 6 is Saturday
        // Adjust so Saturday is the start (0 index for us)
        // Sat=6 -> diff=0. Sun=0 -> diff=1. Fri=5 -> diff=6.
        const diff = (day + 1) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const daysToShow = useMemo(() => {
        if (viewMode === 'day') return [currentDate];

        const start = getStartOfWeek(currentDate);
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [currentDate, viewMode]);

    const isSlotAvailable = (date, hour) => {
        if (!workingHours) return true; // Default open if no settings

        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        let daySettings = workingHours[dayName];

        // Fallback: Check for case-insensitive match if direct lookup fails
        if (!daySettings) {
            const key = Object.keys(workingHours).find(k => k.toLowerCase() === dayName);
            if (key) daySettings = workingHours[key];
        }

        if (!daySettings) {
            // console.warn(`No settings found for ${dayName}`, workingHours);
            return false; // Safest default if settings exist but day is missing
        }

        if (!daySettings.enabled) return false;

        try {
            // Helper to parse "HH:mm" or "hh:mm PM"
            const parseHour = (timeStr) => {
                if (!timeStr) return 0;
                const lower = timeStr.toLowerCase().trim();
                const isPM = lower.includes('pm') || lower.includes('م');
                const isAM = lower.includes('am') || lower.includes('ص');

                let [h] = lower.replace(/[^0-9:]/g, '').split(':');
                let hourInt = parseInt(h, 10);

                if (isNaN(hourInt)) return 0;

                if (isPM && hourInt < 12) hourInt += 12;
                if (isAM && hourInt === 12) hourInt = 0;

                return hourInt;
            };

            const startH = parseHour(daySettings.start);
            const endH = parseHour(daySettings.end);

            // Handle midnight wrapping (e.g. 09:00 to 00:00 means until end of day)
            // If endH is 0, assume it means 24 (midnight next day) ONLY if startH < 24
            const effectiveEndH = endH === 0 && startH > 0 ? 24 : endH;

            // Debug log for specific day/hour to reduce noise
            if (hour === 12 || hour === 18) {
                // console.log(`Debug Slot ${dayName} ${hour}:00`, { startH, endH, effectiveEndH, isOpen: hour >= startH && hour < effectiveEndH });
            }

            return hour >= startH && hour < effectiveEndH;
        } catch (err) {
            console.error('Error parsing time in isSlotAvailable', err);
            return false;
        }
    };

    const handleSlotClick = (date, hour) => {
        if (!isSlotAvailable(date, hour)) return; // Block click

        const slotDate = new Date(date);
        slotDate.setHours(hour, 0, 0, 0);

        // Handle timezone offset simply for local input
        // Using strict simple formatting to avoid conversion issues
        const year = slotDate.getFullYear();
        const month = String(slotDate.getMonth() + 1).padStart(2, '0');
        const day = String(slotDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const timeStr = String(hour).padStart(2, '0') + ":00";

        setSelectedSlot({ date: dateStr, time: timeStr });
        setIsAddModalOpen(true);
    };

    const handleEventClick = (e, appt) => {
        e.stopPropagation(); // Prevent slot click
        setSelectedAppointment(appt);
    };

    const getEventStyle = (appt) => {
        const date = new Date(appt.appointment_date);
        const hour = date.getHours();
        const minutes = date.getMinutes();

        // If event is before start hour, hide or cap it? 
        // For now assume it fits or is handled by scroll
        // But we must offset by startHour
        const top = ((hour - startHour) * HOUR_HEIGHT) + ((minutes / 60) * HOUR_HEIGHT);
        // Default duration 30 mins
        const height = (30 / 60) * HOUR_HEIGHT;

        return {
            top: `${top}px`,
            height: `${height}px`,
        };
    };

    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const navigateDate = (direction) => {
        const newDate = new Date(currentDate);
        const days = viewMode === 'week' ? 7 : 1;
        newDate.setDate(newDate.getDate() + (direction === 'next' ? days : -days));
        setCurrentDate(newDate);
    };

    /**
     * For a list of day's appointments, returns column layout info.
     * Overlapping appointments are placed in adjacent columns (Google Calendar style).
     */
    const computeColumns = (appts) => {
        const DURATION_MS = 30 * 60 * 1000; // assume 30-min slots
        const sorted = [...appts].sort((a, b) =>
            new Date(a.appointment_date) - new Date(b.appointment_date)
        );
        const colEnds = []; // colEnds[i] = end time of last appt in column i
        const result = {};

        sorted.forEach(appt => {
            const start = new Date(appt.appointment_date).getTime();
            const end = start + DURATION_MS;
            let col = 0;
            while (col < colEnds.length && colEnds[col] > start) col++;
            colEnds[col] = end;
            result[appt.id] = { col };
        });

        // Determine total columns in each overlap group
        sorted.forEach(appt => {
            const start = new Date(appt.appointment_date).getTime();
            const end = start + DURATION_MS;
            let maxCol = result[appt.id].col;
            sorted.forEach(other => {
                if (other.id === appt.id) return;
                const oStart = new Date(other.appointment_date).getTime();
                const oEnd = oStart + DURATION_MS;
                if (start < oEnd && end > oStart) maxCol = Math.max(maxCol, result[other.id].col);
            });
            result[appt.id].total = maxCol + 1;
        });

        return result;
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col gap-6">
            <AddAppointmentModal
                isOpen={isAddModalOpen}
                initialData={selectedSlot}
                onClose={() => { setIsAddModalOpen(false); setSelectedSlot(null); }}
                onAppointmentAdded={() => fetchAppointments()}
            />

            <AppointmentDetailsModal
                isOpen={!!selectedAppointment}
                onClose={() => setSelectedAppointment(null)}
                appointment={selectedAppointment}
            />

            {/* Clean Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900 border-b border-slate-800 p-4 rounded-t-2xl">
                {/* View Toggles & Title */}
                <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => setViewMode('day')}
                            className={`p-2 rounded-md transition-all duration-200 ${viewMode === 'day'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title="اليوم"
                        >
                            <AlignJustify size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`p-2 rounded-md transition-all duration-200 ${viewMode === 'week'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title="الأسبوع"
                        >
                            <Columns size={20} />
                        </button>
                    </div>

                    <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                        <CalendarIcon className="text-blue-500" size={28} />
                        {daysToShow[0] ? daysToShow[0].toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                    </h2>
                </div>

                {/* Navigation & Action */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => navigateDate('next')} className="p-2 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors">
                            <ChevronRight size={22} />
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-6 py-2 hover:bg-slate-700 rounded-md text-slate-300 font-medium text-sm transition-all hover:text-white"
                        >
                            {viewMode === 'day' ? 'اليوم' : 'الأسبوع الحالي'}
                        </button>
                        <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors">
                            <ChevronLeft size={22} />
                        </button>
                    </div>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all font-bold shadow-md"
                    >
                        <Plus size={20} />
                        <span>حجز جديد</span>
                    </button>
                </div>
            </header>

            {/* Calendar Grid Container */}
            <div className="flex-1 bg-slate-950 border border-slate-800 overflow-hidden flex flex-col relative dir-ltr rounded-b-2xl shadow-sm">

                {/* Days Header */}
                <div className="flex border-b border-slate-800 bg-slate-900 pr-20 sticky top-0 z-30">
                    {daysToShow.map((day, i) => {
                        const today = isToday(day);
                        return (
                            <div key={i} className={`flex-1 py-3 text-center border-l border-slate-800 ${today ? 'bg-slate-800/50' : ''}`}>
                                <div className={`text-xs font-bold mb-1 uppercase tracking-wider ${today ? 'text-blue-400' : 'text-slate-500'}`}>
                                    {day.toLocaleDateString('ar-EG', { weekday: 'long' })}
                                </div>
                                <div className={`text-2xl font-bold font-number ${today ? 'text-white' : 'text-slate-400'}`}>
                                    {day.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Scrollable Time Grid */}
                <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-slate-950">
                    <div className="flex relative" style={{ minHeight: `${hours.length * HOUR_HEIGHT}px` }}> {/* Dynamic Height */}

                        {/* Time Column */}
                        <div className="w-20 flex-shrink-0 bg-slate-900 border-r border-slate-800 sticky left-0 z-20">
                            {hours.map(hour => (
                                <div key={hour} className="border-b border-slate-800 text-xs font-bold text-slate-500 relative flex justify-center items-start pt-2" style={{ height: HOUR_HEIGHT }}>
                                    <span className="">
                                        {hour > 12 ? hour - 12 : hour} <span className="text-[10px] text-slate-600 ml-0.5">{hour >= 12 ? 'م' : 'ص'}</span>
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Grid Body */}
                        <div className="flex-1 flex relative">
                            {/* Grid Lines */}
                            {hours.map(hour => (
                                <div key={hour} className="absolute w-full border-b border-slate-800/60" style={{ top: (hour - startHour) * HOUR_HEIGHT }}>
                                </div>
                            ))}

                            {/* Day Columns */}
                            {daysToShow.map((date, colIndex) => {
                                const dayAppts = appointments.filter(a => {
                                    const aDate = new Date(a.appointment_date);
                                    return aDate.getDate() === date.getDate() && aDate.getMonth() === date.getMonth();
                                });

                                return (
                                    <div key={colIndex} className={`flex-1 border-l border-slate-800 relative ${isToday(date) ? 'bg-slate-900/20' : ''}`}>
                                        {/* Time Slots (Click Targets) */}
                                        {hours.map(hour => {
                                            const available = isSlotAvailable(date, hour);
                                            return (
                                                <div
                                                    key={hour}
                                                    onClick={() => handleSlotClick(date, hour)}
                                                    className={`absolute w-full z-10 transition-colors duration-200 border-b border-slate-800/60 ${available
                                                        ? 'cursor-pointer hover:bg-blue-500/10'
                                                        : 'cursor-not-allowed'
                                                        }`}
                                                    style={{ top: (hour - startHour) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                                                >
                                                    {!available && (
                                                        // Red diagonal stripes for closed slots
                                                        <div className="w-full h-full" style={{
                                                            backgroundImage: 'repeating-linear-gradient(45deg, rgba(220, 38, 38, 0.05), rgba(220, 38, 38, 0.05) 10px, rgba(220, 38, 38, 0.15) 10px, rgba(220, 38, 38, 0.15) 20px)'
                                                        }}></div>
                                                    )}
                                                    {available && (
                                                        <div className="hidden hover:flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-all duration-200">
                                                            <div className="bg-blue-600 text-white p-1.5 rounded-full shadow-lg">
                                                                <Plus size={16} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Events */}
                                        {(() => {
                                            const layout = computeColumns(dayAppts);
                                            return dayAppts.map(appt => {
                                                const { col = 0, total = 1 } = layout[appt.id] || {};
                                                const widthPct = 100 / total;
                                                const leftPct = (col / total) * 100;
                                                return (
                                                    <div
                                                        key={appt.id}
                                                        onClick={(e) => handleEventClick(e, appt)}
                                                        className={`absolute rounded px-2 py-1 text-sm cursor-pointer border-l-[3px] shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 z-20 overflow-hidden flex items-center justify-between gap-1
                                                            ${appt.status === 'confirmed' ? 'bg-emerald-900 border-emerald-500 text-emerald-50' :
                                                                appt.status === 'cancelled' ? 'bg-red-900/80 border-red-500 text-red-100 opacity-80' :
                                                                    'bg-amber-900 border-amber-500 text-amber-50'
                                                            }`}
                                                        style={{
                                                            ...getEventStyle(appt),
                                                            width: `calc(${widthPct}% - 4px)`,
                                                            left: `calc(${leftPct}% + 2px)`,
                                                            right: 'auto',
                                                        }}
                                                    >
                                                        <span className="font-bold truncate flex-1 leading-tight text-xs">{appt.patients?.full_name}</span>
                                                        <div className={`text-[10px] font-mono px-1 py-0.5 rounded shrink-0
                                                            ${appt.status === 'confirmed' ? 'bg-emerald-800 text-emerald-200' :
                                                                appt.status === 'cancelled' ? 'bg-red-950 text-red-300' :
                                                                    'bg-amber-950 text-amber-200'
                                                            }`}>
                                                            {appt.status === 'pending' ? 'AI' : new Date(appt.appointment_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
