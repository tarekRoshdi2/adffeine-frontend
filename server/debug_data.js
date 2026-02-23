require('dotenv').config({ override: true });
const supabase = require('./lib/supabase');

async function debugData() {
    console.log("--- Debugging Doctor Data ---");
    const todayStart = new Date();
    todayStart.setDate(todayStart.getDate() - 2); // Look back 2 days
    const todayEnd = new Date();
    todayEnd.setDate(todayEnd.getDate() + 2); // Look forward 2 days

    console.log("Querying WIDE Range from:", todayStart.toISOString());
    console.log("Querying WIDE Range to:", todayEnd.toISOString());

    const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*, patients(*)') // Try to join to see structure
        .gte('appointment_date', todayStart.toISOString())
        .lte('appointment_date', todayEnd.toISOString())
        .order('appointment_date', { ascending: true });

    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log(`Found ${appointments.length} appointments.`);
        if (appointments.length > 0) {
            console.log("Sample Appointment 0:", JSON.stringify(appointments[0], null, 2));

            // Simulation of what Service does
            const a = appointments[0];
            console.log("Service tries to access:");
            console.log("a.patient_name:", a.patient_name);
            console.log("a.appointment_time:", a.appointment_time);
        }
    }
}

debugData();
