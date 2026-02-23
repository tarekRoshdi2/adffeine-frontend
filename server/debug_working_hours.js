
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugClinics() {
    console.log('Fetching clinics...');
    const { data: clinics, error } = await supabase
        .from('clinics')
        .select('id, clinic_name, working_hours');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!clinics || clinics.length === 0) {
        console.log('No clinics found.');
        return;
    }

    clinics.forEach(clinic => {
        console.log(`\n--- Clinic: ${clinic.clinic_name} (${clinic.id}) ---`);
        console.log('Type of working_hours:', typeof clinic.working_hours);
        console.log(JSON.stringify(clinic.working_hours, null, 2));
    });
}

debugClinics();
