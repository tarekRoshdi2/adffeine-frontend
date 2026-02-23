const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase credentials missing in server environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).');
}

// Service Role Key allows bypassing RLS. Fallback to Anon Key if missing (will be restricted but runs)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || process.env.SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = supabaseAdmin;
