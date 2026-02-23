const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://dzraizczbionzhwjwfgc.supabase.co';
const serviceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cmFpemN6Ymlvbnpod2p3ZmdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQyNDcxNCwiZXhwIjoyMDg3MDAwNzE0fQ.q8QsDkKivvSllQRtJ9_7vxxdkKDYNIet5tmt1kIBXc4';
const anonKey = 'sb_publishable_rZdrposPXoha-pSrltapHQ_55__AEc1';

async function audit() {
    let log = "--- Database Audit ---\n";
    const admin = createClient(supabaseUrl, serviceRole);
    const anon = createClient(supabaseUrl, anonKey);

    // 1. Check Clinics with Service Role (Bypass RLS)
    const { data: cAdmin, error: eAdmin } = await admin.from('clinics').select('*');
    log += `Total Clinics (Admin): ${cAdmin ? cAdmin.length : 0}\n`;
    if (eAdmin) log += `Clinic Admin Error: ${eAdmin.message}\n`;

    // 2. Check Clinics with Anon (Respect RLS)
    const { data: cAnon, error: eAnon } = await anon.from('clinics').select('*');
    log += `Total Clinics (Anon): ${cAnon ? cAnon.length : 0}\n`;
    if (eAnon) log += `Clinic Anon Error: ${eAnon.message}\n`;

    // 3. Profiles
    const { data: pAdmin } = await admin.from('profiles').select('*');
    log += `Total Profiles: ${pAdmin ? pAdmin.length : 0}\n`;
    if (pAdmin) {
        log += `Roles: ${JSON.stringify(pAdmin.map(p => ({ email: p.email, role: p.role })))}\n`;
    }

    fs.writeFileSync('audit_results.txt', log);
    process.exit(0);
}

audit();
