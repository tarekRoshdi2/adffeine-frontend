
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log("Checking 'patients' table columns...");
    const { data: pData, error: pError } = await supabase.from('patients').select('*').limit(1);
    if (pError) console.error("Patients Error:", pError);
    else console.log("Patients Columns:", Object.keys(pData[0] || {}));

    console.log("\nChecking 'appointments' table columns...");
    const { data: aData, error: aError } = await supabase.from('appointments').select('*').limit(1);
    if (aError) console.error("Appointments Error:", aError);
    else console.log("Appointments Columns:", Object.keys(aData[0] || {}));
}

checkSchema();
