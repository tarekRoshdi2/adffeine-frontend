const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dzraizczbionzhwjwfgc.supabase.co';
const supabaseKey = 'sb_publishable_rZdrposPXoha-pSrltapHQ_55__AEc1';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    console.log("Testing login with tarkroshdi@gmail.com");
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'tarkroshdi@gmail.com',
        // In AddClinicModal the password field used in create-user is formData.doctorPassword
        password: 'Password123' // trying some default, we don't know the exact one the user typed
    });

    if (error) {
        console.error("Login failed:", error.message);
    } else {
        console.log("Login successful:", data.user.id);
    }
}

testLogin();
