require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
let out = "";
function log(msg) {
    out += msg + "\n";
    fs.writeFileSync('auth_log.txt', out);
}

async function testAuth() {
    try {
        const email = `doc_${Date.now()}@test.com`;
        const password = "TestPassword@2026!";
        log(`Creating user ${email}...`);

        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (createError) {
            log("Create user error: " + createError.message);
            process.exit(1);
        }

        log("User created! ID: " + createData.user.id);

        // Now try to log in
        const supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || 'sb_publishable_rZdrposPXoha-pSrltapHQ_55__AEc1');
        log("Attempting login...");
        const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (loginError) {
            log("Login Error: " + loginError.message);
        } else {
            log("Login Success! User: " + loginData.user.id);
        }

        // Clean up
        await supabase.auth.admin.deleteUser(createData.user.id);
        log("Done cleaning up.");
        process.exit(0);
    } catch (err) {
        log("Exception: " + err.message);
        process.exit(1);
    }
}

testAuth();
