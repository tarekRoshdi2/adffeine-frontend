const fs = require('fs');

async function checkLogin() {
    try {
        const response = await fetch("https://dzraizczbionzhwjwfgc.supabase.co/auth/v1/token?grant_type=password", {
            method: 'POST',
            headers: {
                'apikey': 'sb_publishable_rZdrposPXoha-pSrltapHQ_55__AEc1',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: "tarkroshdi@gmail.com",
                password: "Tarek@2016"
            })
        });

        const data = await response.json();
        const output = "Status: " + response.status + "\\nBody: " + JSON.stringify(data, null, 2);
        fs.writeFileSync('login_check.txt', output);
        console.log("Check login_check.txt");
    } catch (e) {
        fs.writeFileSync('login_check.txt', 'Error: ' + e.message);
    }
}

checkLogin();
