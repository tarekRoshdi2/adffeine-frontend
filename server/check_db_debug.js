console.log("Process started");
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log("Supabase URL:", process.env.SUPABASE_URL ? "Exists" : "MISSING");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log("Checking data for Nido clinic...");
    const { data: clinic } = await supabase.from('clinics').select('*').ilike('clinic_name', '%نيدو%').single();
    if (!clinic) {
        console.log("Clinic not found");
        return;
    }
    console.log("Clinic ID:", clinic.id);
    console.log("System Prompt:", clinic.system_prompt ? "Populated" : "Empty");
    console.log("Telegram Token:", clinic.telegram_token ? "Populated" : "Empty");

    const { data: session } = await supabase.from('whatsapp_sessions').select('*').eq('clinic_id', clinic.id).single();
    if (session) {
        console.log("WA Session Status:", session.status);
        console.log("WA Phone ID:", session.phone_number_id);
    } else {
        console.log("No WA session found");
    }
}

check();
