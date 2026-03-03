const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, '../../Downloads/receptionist-488320-9819a4711810.json');
    if (!fs.existsSync(keyPath)) {
      console.error('Key file not found at', keyPath);
      process.exit(2);
    }

    const key = require(keyPath);
    const subject = process.env.GCP_SUBJECT_EMAIL || key.client_email;

    console.log('Using key.client_email =', key.client_email);
    console.log('Testing as subject =', subject);

    const jwt = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject
    });

    // Try get access token
    const tokenResp = await jwt.authorize();
    console.log('Got token. Expires at:', tokenResp.expiry_date || 'unknown');

    // Attempt freebusy query for the subject calendar (short window)
    const calendar = google.calendar({ version: 'v3', auth: jwt });
    const now = new Date();
    const later = new Date(Date.now() + 60 * 60 * 1000);
    try {
      const fb = await calendar.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: later.toISOString(),
          items: [{ id: subject }]
        }
      });
      console.log('Freebusy response:', JSON.stringify(fb.data, null, 2));
    } catch (fbErr) {
      console.error('Freebusy query failed:', fbErr.message || fbErr);
    }
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

main();
