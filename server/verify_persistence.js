require('dotenv').config();
const aiRouter = require('./AIAgentRouter');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
    const testClinicId = '5f1dbeac-a85e-4f9d-a5e5-17e6574364c3'; // عيادة د نيدو التخصصية
    const testSender = 'simulate_user_123';
    const testText = 'Hello, I want to book an appointment.';

    console.log("--- Starting Persistence Verification ---");

    try {
        // 1. Fetch current message count
        const { count: beforeCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true });

        console.log(`Messages before: ${beforeCount}`);

        // 2. Simulate message
        console.log("Simulating incoming message...");
        const response = await aiRouter.handleIncomingMessage({
            clinicId: testClinicId,
            sender: testSender,
            text: testText,
            platform: 'whatsapp'
        });

        console.log(`AI Response: ${response}`);

        // 3. Check message count after
        const { count: afterCount, data: newMessages } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(2);

        console.log(`Messages after: ${afterCount}`);

        if (afterCount >= beforeCount + 2) {
            console.log("✅ SUCCESS: Messages saved to database!");
            console.log("Latest messages:");
            newMessages.forEach(m => {
                console.log(`- [${m.sender_type}] ${m.content}`);
            });
        } else {
            console.log("❌ FAILURE: Messages were not saved.");
        }

    } catch (err) {
        console.error("Verification Error:", err);
    }
}

verify();
