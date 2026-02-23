const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
    const res = await supabase.from('clinics').select('id, telegram_token, messenger_token');
    console.log(JSON.stringify(res.data, null, 2));
}
check();
