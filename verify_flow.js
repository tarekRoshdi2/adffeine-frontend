const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dzraizczbionzhwjwfgc.supabase.co';
const supabaseKey = 'sb_publishable_rZdrposPXoha-pSrltapHQ_55__AEc1';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFlow() {
    const email = `testdoc_${Date.now()}@example.com`;
    const password = 'Test@2026Password';

    console.log("1. Creating user via admin backend API...");
    try {
        const createRes = await fetch('http://localhost:5000/api/admin/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const createData = await createRes.json();
        console.log("Create user response:", createRes.status, createData);

        if (!createRes.ok) {
            console.error("Failed to create user. Exiting.");
            return;
        }

        console.log("2. Attempting to log in via Supabase client...");
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error("Login failed:", error.message);
        } else {
            console.log("Login successful! User ID:", data.user.id);
        }

        // Clean up
        console.log("3. Cleaning up user...");
        await fetch(`http://localhost:5000/api/admin/delete-user/${createData.user.id}`, { method: 'DELETE' });
        console.log("Cleanup done.");

    } catch (e) {
        console.error("Test flow exception:", e);
    }
}

testFlow();
