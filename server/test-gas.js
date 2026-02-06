import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log("--- Notification Test Script ---");
const testEmail = process.env.EMAIL_USER || "test@example.com";

async function testGAS() {
    if (!process.env.GOOGLE_APPS_SCRIPT_URL) {
        console.log("Skipping GAS Test (URL missing)");
        return;
    }
    console.log("\nTesting Google Apps Script...");
    try {
        const res = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                recipients: [{ email: testEmail, name: "Test User" }],
                subject: "Activity Hub: GAS Test",
                body: "If you received this, Google Apps Script integration is working!"
            })
        });

        const text = await res.text();
        console.log("GAS Response:", text);

        try {
            const json = JSON.parse(text);
            if (json.success) {
                console.log("✅ GAS Success: Email sent to " + testEmail);
            } else {
                console.error("❌ GAS Failed:", json.error);
            }
        } catch (e) {
            console.log("Response might not be JSON (check deployment settings):", text);
        }

    } catch (e) {
        console.error("❌ GAS Network Error:", e.message);
    }
}

async function run() {
    await testGAS();
}

run();
