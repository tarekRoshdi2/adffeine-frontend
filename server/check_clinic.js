const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('clinics')
        .select('*, clinic_services(name)')
        .eq('id', '5f1dbeac-a85e-4f9d-a5e5-17e6574364c3')
        .single();

    console.log("Error:", error);
    console.log("Data:", data ? "Found info" : "null");
}
check();
