require('dotenv').config();

async function check() {
    try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/clinics?id=eq.5f1dbeac-a85e-4f9d-a5e5-17e6574364c3&select=*,clinic_services(name)`;
        const res = await fetch(url, {
            headers: {
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Body:", text);
    } catch (e) {
        console.log("Fetch Error:", e);
    }
}
check();
