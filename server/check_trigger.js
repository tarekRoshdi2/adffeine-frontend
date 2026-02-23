require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTrigger() {
    let out = "";
    try {
        const email = `testtrig_${Date.now()}@test.com`;

        // 1. Create auth user
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password: "TestPassword123!",
            email_confirm: true
        });

        if (createError) {
            out += "Error creating user: " + createError.message + "\n";
            fs.writeFileSync('trigger_test.txt', out);
            return;
        }

        out += "User created: " + createData.user.id + "\n";

        // 2. IMMEDIATELY check if profile exists
        const { data: profileExists, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', createData.user.id)
            .single();

        if (profileExists) {
            out += "PROFILE AUTO-CREATED BY TRIGGER!\n" + JSON.stringify(profileExists) + "\n";
        } else {
            out += "No profile found automatically.\n";
            if (profileErr) out += "Select profile error: " + profileErr.message + "\n";
        }

        // 3. Try to insert manually to see what error we get
        const { error: insertErr } = await supabase
            .from('profiles')
            .insert([{ id: createData.user.id, email: email, role: 'doctor' }]);

        if (insertErr) {
            out += "Insert profile error: " + insertErr.message + " | details: " + JSON.stringify(insertErr) + "\n";
        } else {
            out += "Insert profile success!\n";
        }

        // Cleanup
        await supabase.auth.admin.deleteUser(createData.user.id);
        out += "Cleanup done.\n";
    } catch (e) {
        out += "Exception: " + e.message + "\n";
    }
    fs.writeFileSync('trigger_test.txt', out);
    console.log("Done");
}

checkTrigger();
