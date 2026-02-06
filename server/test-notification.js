import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log("--- Notification Test Script ---");
console.log("Loaded Environment Variables:");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Missing");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Set" : "Missing");
console.log("MACRODROID_URL:", process.env.MACRODROID_WEBHOOK_URL ? process.env.MACRODROID_WEBHOOK_URL : "Missing");
console.log("GAS_URL:", process.env.GOOGLE_APPS_SCRIPT_URL ? "Set" : "Missing");

const testEmail = process.env.EMAIL_USER || "test@example.com"; // Self-test

async function testSMTP() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log("Skipping SMTP Test (Credentials missing)");
        return;
    }
    console.log("\nTesting SMTP...");
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    try {
        await transporter.sendMail({
            from: `"Test Script" <${process.env.EMAIL_USER}>`,
            to: testEmail,
            subject: "Activity Hub: SMTP Test",
            text: "If you received this, SMTP is working!"
        });
        console.log("✅ SMTP Success: Email sent to " + testEmail);
    } catch (e) {
        console.error("❌ SMTP Code Error:", e.message);
    }
}

async function testWebhook() {
    if (!process.env.MACRODROID_WEBHOOK_URL) {
        console.log("Skipping Webhook Test (URL missing)");
        return;
    }
    console.log("\nTesting MacroDroid Webhook...");
    try {
        const url = new URL(process.env.MACRODROID_WEBHOOK_URL);
        url.searchParams.append('to', testEmail);
        url.searchParams.append('subject', "Activity Hub: Webhook Test");
        url.searchParams.append('body', "If you received this, Webhook is working!");

        console.log("Triggering URL:", url.toString());
        const res = await fetch(url.toString());

        if (res.ok) {
            console.log("✅ Webhook Success: Server returned " + res.status);
            console.log("Check your phone logs now!");
        } else {
            console.error("❌ Webhook Failed: Server returned " + res.status + " " + res.statusText);
        }
    } catch (e) {
        console.error("❌ Webhook Error:", e.message);
    }
}

async function run() {
    await testSMTP();
    await testWebhook();
    await testGAS();
}

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
        // console.log("GAS Response:", text); // Optional debug

        try {
            const json = JSON.parse(text);
            if (json.success) {
                console.log("✅ GAS Success: Email sent to " + testEmail);
            } else {
                console.error("❌ GAS Failed:", json.error);
            }
        } catch (e) {
            console.log("Response might not be JSON:", text);
        }

    } catch (e) {
        console.error("❌ GAS Network Error:", e.message);
    }
}

run();
