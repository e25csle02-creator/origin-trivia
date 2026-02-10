import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors({
    origin: ['http://localhost:8080', 'http://localhost:5173', 'http://127.0.0.1:8080', 'https://origin-trivia.netlify.app'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Ensure temp directory exists
// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: path.join(__dirname, '../.env') });

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

app.post('/api/evaluate', async (req, res) => {
    const { questionText, studentAnswer, modelAnswer, rubric } = req.body;

    if (!questionText || !studentAnswer) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "google/gemini-2.0-flash-lite-preview-02-05:free", // Using a free/cheap model on OpenRouter
            messages: [
                {
                    role: "system",
                    content: `You are an expert teacher grading a student's answer.
Please evaluate the STUDENT ANSWER based on the provided QUESTION and MODEL ANSWER/RUBRIC.
You must return a JSON object with two fields:
1. "score": a number between 0 and 100 representing the percentage score.
2. "feedback": a concise explanation of the score and how to improve.

Be fair and constructive.`
                },
                {
                    role: "user",
                    content: `Question: ${questionText}
          
Model Answer / Rubric: ${modelAnswer || 'No specific model answer provided, use general knowledge.'}
Rubric Notes: ${rubric || 'None'}
Expected Keywords: ${req.body.expectedKeywords ? (Array.isArray(req.body.expectedKeywords) ? req.body.expectedKeywords.join(', ') : req.body.expectedKeywords) : 'None'}

CRITICAL INSTRUCTION:
If "Expected Keywords" are provided above, you MUST check if the Student Answer contains or is semantically highly related to ANY ONE of the keywords.
If the Student Answer matches or covers the meaning of AT LEAST ONE keyword, you MUST give a score of 100.
Ignore the Model Answer if a keyword match is found; the keyword match takes precedence for full marks.
If no keywords are matched, evaluate normally based on the Model Answer.

Student Answer: ${studentAnswer}

Evaluate now and return ONLY the JSON.`
                }
            ],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        const result = JSON.parse(content);
        res.json(result);
    } catch (error) {
        console.error("AI Evaluation Error:", error);
        res.status(500).json({ error: 'Failed to evaluate answer', details: error.message });
    }
});

app.post('/api/compile', async (req, res) => {
    const { code, language = 'java' } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    // Piston Language Mapping
    // Client sends 'java', Piston expects 'java'
    // If strict match needed:
    const pistonLang = language === 'java' ? 'java' : language;
    const pistonVersion = language === 'java' ? '15.0.2' : '*';

    try {
        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                language: pistonLang,
                version: pistonVersion,
                files: [
                    {
                        name: "Main.java", // Helps Piston identify the entry point
                        content: code
                    }
                ]
            })
        });

        const data = await response.json();

        // Piston Error (API level)
        if (data.message) {
            console.error("Piston API Error:", data.message);
            return res.json({
                output: '',
                error: `Piston API Error: ${data.message}`
            });
        }

        // Execution Result
        // { run: { stdout, stderr, code, signal, output } }
        // We map to { output, error }

        const { stdout, stderr } = data.run || {};

        res.json({
            output: stdout || '',
            error: stderr || ''
        });

    } catch (error) {
        console.error("Compiler API Error (Piston):", error);
        res.status(500).json({ error: 'Failed to execute code via Piston API' });
    }
});

app.post('/api/notify', async (req, res) => {
    const { recipients, quizDetails, customSubject, customMessage } = req.body;

    // recipients: [{ email, name, student_id }]
    // quizDetails: { title, subject, branch, year, semester, link }

    console.log(`[NOTIFICATION] Received request. Recipients: ${recipients?.length}, Subject: ${quizDetails.subject}`);

    if (!recipients || recipients.length === 0) {
        console.warn("[NOTIFICATION] No recipients provided.");
        return res.json({ success: true, message: 'No recipients provided' });
    }

    console.log(`[NOTIFICATION] Preparing emails for ${recipients.length} students...`);

    // Verify Email Config
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error("[NOTIFICATION] Missing EMAIL_USER or EMAIL_PASS in environment variables.");
        // Continue but warn
    } else {
        console.log(`[NOTIFICATION] Email Config Found. User: ${process.env.EMAIL_USER}`);
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const results = {
        success: 0,
        failed: 0,
        logs: []
    };

    // Send emails
    for (const student of recipients) {
        try {
            // Template Replacement
            const subject = (customSubject || "New Quiz Available: {{quiz_title}}")
                .replace('{{quiz_title}}', quizDetails.title);

            const defaultBody = `Hello {{student_name}},

A new activity has been published for your class.

Activity Name : {{Activity_Name}}
Subject       : {{Subject}}
Branch        : {{Branch}}
Year          : {{Year}}
Semester      : {{Semester}}
Published On  : {{Publish_Date}}
Deadline      : {{Deadline}}

Please log in to the Origin Trivia platform and complete the activity within the given time.
https://origin-trivia.netlify.app/

Login Details:
Email    : Your college mail ID
Password : Your SIN number (in capital)

If you have any questions, contact your faculty.

Best regards,
{{Faculty_Name}}
Origin Trivia Team`;

            const messageTemplate = customMessage || defaultBody;

            const body = messageTemplate
                .replace(/{{student_name}}/g, student.name)
                .replace(/{Student name}/g, student.name)
                .replace(/{{Activity_Name}}/g, quizDetails.title)
                .replace(/{{Subject}}/g, quizDetails.subject)
                .replace(/{{Branch}}/g, quizDetails.branch)
                .replace(/{{Year}}/g, quizDetails.year)
                .replace(/{{Semester}}/g, quizDetails.semester)
                .replace(/{{Publish_Date}}/g, quizDetails.publishDate || new Date().toLocaleDateString())
                .replace(/{{Deadline}}/g, quizDetails.deadline || "No Deadline")
                .replace(/{{Faculty_Name}}/g, quizDetails.facultyName || "Faculty");

            // Send Real Mail via SMTP (if configured)
            const isPlaceholderPass = process.env.EMAIL_PASS && process.env.EMAIL_PASS.includes('$6969$');

            if (process.env.EMAIL_USER && process.env.EMAIL_PASS && !isPlaceholderPass && !process.env.EMAIL_USER.includes('your-email')) {
                await transporter.sendMail({
                    from: `"Origin Trivia" <${process.env.EMAIL_USER}>`,
                    to: student.email,
                    subject: subject,
                    text: body
                });
                console.log(`[SMTP SENT] To: ${student.email}`);
            } else if (isPlaceholderPass) {
                console.log(`[SMTP SKIPPED] Placeholder password detected. Using Webhook only.`);
            }

            // Send via Google Apps Script (if configured)
            if (process.env.GOOGLE_APPS_SCRIPT_URL) {
                // We send one by one to personalizing, or we could batch.
                // To keep 'logs' consistent with existing structure, let's send one by one for now
                // OR optimize: The GAS script I wrote handles a list.
                // Let's use the BATCH capability of the GAS script for efficiency, 
                // BUT we are currently inside a loop `for (const student of recipients)`.
                // Refactoring to batch would be efficient but changes the structure significantly.

                // For "Free Limits ~500/day", sending 1 HTTP request per student is bad.
                // Better: Collect all intended emails and send 1 POST to GAS.

                // However, preserving existing logic:
                // Let's collect them first? 
                // The current loop processes recipients one by one.

                // Let's just do an HTTP call per student for now (simplest integration).
                // It might be slow for 60 students.

                try {
                    const gasResponse = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            recipients: [student], // Wrap in array as GAS expects list
                            subject: subject,
                            body: body
                        })
                    });
                    const gasResult = await gasResponse.json();
                    if (gasResult.success) {
                        console.log(`[GAS SENT] To: ${student.email}`);
                    } else {
                        throw new Error(gasResult.error || "GAS Unknown Error");
                    }
                } catch (gasErr) {
                    console.error("[GAS FAIL]", gasErr);
                    throw gasErr; // Allow catch block below to handle it
                }
            }

            // Send via MacroDroid Webhook (if configured)
            if (process.env.MACRODROID_WEBHOOK_URL) {
                // Ensure URL ends with 'send_email' or uses query params? 
                // We'll just POST the data and let MacroDroid handle it.
                // MacroDroid Webhook Trigger accepts parameters as query params (?param1=value) usually OR JSON body?
                // Standard MacroDroid webhook trigger usually takes query params for variables. 
                // e.g. https://trigger.macrodroid.com/UUID/send_email?to=...&subject=...
                // But let's try JSON body if supported, or constructing URL.
                // Documentation says query parameters are mapped to variables [webhook_param].

                const webhookUrl = new URL(process.env.MACRODROID_WEBHOOK_URL);
                webhookUrl.searchParams.append('to', student.email);
                webhookUrl.searchParams.append('subject', subject);
                webhookUrl.searchParams.append('body', body);

                // Using fetch (Node 18+)
                await fetch(webhookUrl.toString());
                console.log(`[MACRODROID TRIGGERED] To: ${student.email}`);
            }

            results.success++;
            results.logs.push({
                email: student.email,
                status: 'sent',
                time: new Date().toISOString()
            });

        } catch (err) {
            console.error(`[NOTIFICATION FAILED] To: ${student.email}`, err);
            results.failed++;

            // Extract meaningful error message
            let errorMessage = err.message;
            if (err.responseCode === 535) {
                errorMessage = "Authentication Failed: Check email/password in .env";
            } else if (err.code === 'ECONNREFUSED') {
                errorMessage = "Connection Refused: Check internet or firewall";
            }

            results.logs.push({
                email: student.email,
                status: 'failed',
                error: errorMessage, // Send error back to client
                time: new Date().toISOString()
            });
        }
    }

    res.json({ success: true, results });
});

try {
    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`Compiler server listening at http://0.0.0.0:${port}`);
    });

    server.on('error', (e) => {
        console.error("Server Error:", e);
    });
} catch (e) {
    console.error("Failed to start server:", e);
}

// Global error handlers to prevent exit
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
