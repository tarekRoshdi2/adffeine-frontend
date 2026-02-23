require('dotenv').config();
const messengerManager = require('./MessengerManager');

async function testSend() {
    await messengerManager.init();

    const clinicId = '5f1dbeac-a85e-4f9d-a5e5-17e6574364c3';
    const recipientId = '24483441711239948';

    console.log("Sending test message to", recipientId, "for clinic", clinicId);

    const res = await messengerManager.sendMessage(clinicId, recipientId, "Test reply from local script");
    console.log("Result:", res);
}

testSend().catch(console.error);
