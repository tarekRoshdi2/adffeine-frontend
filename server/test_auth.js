require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testAuth() {
    const email = `doc_${Date.now()}@test.com`;
    const password = "TestPassword@2026!";
    console.log(`Creating user ${email}...`);

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (createError) {
        console.error("Create user error:", createError.message);
        process.exit(1);
    }

    console.log("User created! ID:", createData.user.id);

    // Now try to log in
    // Note: using anon key to simulate client login
    const supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || 'sb_publishable_rZdrposPXoha-pSrltapHQ_55__AEc1');
    console.log("Attempting login...");
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (loginError) {
        console.error("Login Error:", loginError.message);
    } else {
        console.log("Login Success! User:", loginData.user.id);
    }

    // Clean up
    await supabase.auth.admin.deleteUser(createData.user.id);
    console.log("Done.");
    process.exit(0);
}

testAuth();
