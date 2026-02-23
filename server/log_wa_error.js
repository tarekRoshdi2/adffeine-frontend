const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const log = (msg) => { console.log(msg); fs.appendFileSync('wa_debug.log', msg + '\n'); };
    fs.writeFileSync('wa_debug.log', '--- WA DEBUG START ---\n');

    try {
        const { data: clinic } = await supabase.from('clinics').select('id').limit(1).single();
        if (!clinic) throw new Error("No clinic found");
        log("Testing with Clinic ID: " + clinic.id);

        log("Attempting upsert...");
        const res = await supabase.from('whatsapp_sessions').upsert({
            clinic_id: clinic.id,
            phone_number_id: 'test_id',
            access_token: 'test_token',
            verify_token: 'test_verify',
            status: 'connected'
        }, { onConflict: 'clinic_id' });

        log("Result: " + JSON.stringify(res, null, 2));

    } catch (e) {
        log("Exception: " + e.message);
    }
    process.exit();
}

run();
