const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://dzraizczbionzhwjwfgc.supabase.co';
const supabaseKey = 'sb_publishable_rZdrposPXoha-pSrltapHQ_55__AEc1';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    let output = "Starting login test for tarkroshdi@gmail.com\\n";
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'tarkroshdi@gmail.com',
        password: 'Tarek@2016'
    });

    if (error) {
        output += "Login failed: " + error.message + "\\n";
        output += "Error code: " + error.code + "\\n";
        output += "Error status: " + error.status + "\\n";
    } else {
        output += "Login successful! User ID: " + data.user.id + "\\n";
    }

    fs.writeFileSync('out.log', output);
    console.log("Done. Check out.log");
}

testLogin();
