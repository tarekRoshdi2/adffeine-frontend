const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    console.log("--- Starting Debug ---");

    // 1. Check if we can select from Clinics
    const { data: clinics, error: cErr } = await supabase.from('clinics').select('id').limit(1);
    if (cErr) {
        console.error("Clinics table error:", cErr);
    } else {
        console.log("Clinics table accessible, first clinic ID:", clinics[0]?.id);
    }

    if (!clinics || clinics.length === 0) {
        console.error("No clinics found in DB.");
        return;
    }
    const testClinicId = clinics[0].id;

    // 2. Try to select from whatsapp_sessions
    const { data: session, error: sErr } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('clinic_id', testClinicId)
        .limit(1);

    if (sErr) {
        if (sErr.code === 'PGRST116' || sErr.code === 'PGRST204') {
            console.log("Session not found (as expected if new)");
        } else {
            console.error("WhatsApp Sessions select error:", sErr);
        }
    } else {
        console.log("WhatsApp Sessions accessible, columns:", session[0] ? Object.keys(session[0]) : "Table empty");
    }

    // 3. Try the actual Upsert that is failing
    console.log("Attempting test upsert...");
    const { error: uErr } = await supabase
        .from('whatsapp_sessions')
        .upsert({
            clinic_id: testClinicId,
            phone_number_id: '123456789',
            access_token: 'test_token',
            verify_token: 'test_verify',
            status: 'connected'
        }, { onConflict: 'clinic_id' });

    if (uErr) {
        console.error("UPSERT FAILED! Error details:", uErr);
    } else {
        console.log("UPSERT SUCCESSFUL!");
    }

    process.exit();
}

debug();
