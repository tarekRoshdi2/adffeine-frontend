const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const clinicId = '10bcfce7-1995-4ee9-be76-a973426d7571';

    console.log("Checking clinic_services for clinic:", clinicId);
    const { data: services, error: sErr } = await supabase
        .from('clinic_services')
        .select('*')
        .eq('clinic_id', clinicId);

    if (sErr) console.error("Error fetching services:", sErr);
    else console.log("Found Services:", services);

    const { data: clinic, error: cErr } = await supabase
        .from('clinics')
        .select('*, clinic_services(name)')
        .eq('id', clinicId)
        .single();

    if (cErr) console.error("Error fetching clinic context:", cErr);
    else console.log("Clinic Context services:", clinic.clinic_services);
}
check();
