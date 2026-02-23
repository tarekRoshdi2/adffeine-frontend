require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
let out = "";
function log(msg) {
    out += msg + "\n";
    fs.writeFileSync('auth_log3.txt', out);
}

async function testAuth() {
    try {
        const email = "tarkroshdi@gmail.com";
        const password = "Tarek@2016";

        log(`Looking up user ${email}...`);

        // Find user by querying auth.users is not directly possible with just js client without listing all,
        // Let's just create a new one to test if createUser sets password.
        const testEmail = `testdoc_${Date.now()}@test.com`;
        log("Creating " + testEmail);
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: password,
            email_confirm: true
        });

        if (createError) {
            log("Create error: " + createError.message);
            process.exit(1);
        }

        log("Created ID: " + createData.user.id);

        // Update password just to be 100% sure it's set
        log("Updating password explicitly...");
        await supabase.auth.admin.updateUserById(createData.user.id, { password: password });

        const supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        log("Logging in...");
        const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
            email: testEmail,
            password: password
        });

        if (loginError) {
            log("Login Error: " + loginError.message);
        } else {
            log("Login Success! User: " + loginData.user.id);
        }

        await supabase.auth.admin.deleteUser(createData.user.id);
        log("Done cleaning up.");
        process.exit(0);
    } catch (err) {
        log("Exception: " + err.message);
        process.exit(1);
    }
}

testAuth();
