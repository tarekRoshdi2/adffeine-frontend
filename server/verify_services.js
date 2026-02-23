require('dotenv').config();
const aiRouter = require('./AIAgentRouter');

async function verify() {
    // Current clinic ID from user screenshots (Adffeine AI)
    const clinicId = '10bcfce7-1995-4ee9-be76-a973426d7571';

    console.log("--- Verification Start ---");
    console.log("Simulating 'ما هي الخدمات المتاحة؟' for clinic:", clinicId);

    // We prefix sender with test_ to avoid database clutter if possible
    const response = await aiRouter.handleIncomingMessage({
        clinicId,
        sender: 'test_verifier_999',
        text: 'ما هي الخدمات المتاحة؟',
        platform: 'whatsapp'
    });

    console.log("\nAI Response:");
    console.log(response);
    console.log("\n--- Verification End ---");
}

verify().catch(console.error);
