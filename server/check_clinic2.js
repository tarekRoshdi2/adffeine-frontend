const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', '5f1dbeac-a85e-4f9d-a5e5-17e6574364c3')
        .maybeSingle();

    if (error) {
        console.log("DB Error:", error.message);
    } else if (!data) {
        console.log("Clinic NOT FOUND in db");
    } else {
        console.log("Clinic found:", data.clinic_name);
    }
}
check();
