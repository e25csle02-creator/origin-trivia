import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    dotenv.config({ path: path.join(__dirname, '../.env') });
} catch (e) {
    console.warn("Failed to load .env file (might be in production):", e.message);
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
    origin: [
        'http://localhost:8080',
        'http://localhost:8081',
        'http://localhost:8082',
        'http://localhost:5173',
        'http://127.0.0.1:8080',
        'https://origin-trivia.netlify.app',
        'https://origin-trivia.vercel.app'
    ],
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

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});



// OpenAI client is initialized lazily in the route handler to prevent startup crash if key is missing


app.post('/api/evaluate', async (req, res) => {
    const { questionText, studentAnswer, modelAnswer, rubric } = req.body;

    if (!questionText || !studentAnswer) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error('OpenRouter API Key is not configured in environment variables.');
        }

        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
        });

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

    // Transporter is created later if needed

    const results = {
        success: 0,
        failed: 0,
        logs: []
    };

    // Define Default Body Template
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

    // Retry Helper
    const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (err) {
                if (i === maxRetries - 1) throw err;
                console.warn(`[RETRY] Attempt ${i + 1} failed. Retrying in ${delay}ms...`, err.message);
                await new Promise(res => setTimeout(res, delay));
            }
        }
    };

    // --- 1. Google Apps Script (Batch Send) ---
    if (process.env.GOOGLE_APPS_SCRIPT_URL) {
        console.log(`[GAS] Sending batch request for ${recipients.length} recipients...`);

        // Pre-process body for GAS (Batch mode doesn't support per-student customization unless GAS handles it)
        // We replace {{student_name}} with "Student" to avoid broken placeholders.
        let processedBody = (customMessage || defaultBody)
            .replace(/{{Activity_Name}}/gi, quizDetails.title)
            .replace(/{{Subject}}/gi, quizDetails.subject)
            .replace(/{{Branch}}/gi, quizDetails.branch)
            .replace(/{{Year}}/gi, quizDetails.year)
            .replace(/{{Semester}}/gi, quizDetails.semester)
            .replace(/{{Publish_Date}}/gi, quizDetails.publishDate || new Date().toLocaleDateString())
            .replace(/{{Deadline}}/gi, quizDetails.deadline || "No Deadline")
            .replace(/{{Faculty_Name}}/gi, quizDetails.facultyName || "Faculty")
            .replace(/{{student_name}}/gi, "Student")
            .replace(/{Student name}/gi, "Student")
            .replace(/{{Student name}}/gi, "Student");

        const processedSubject = (customSubject || "New Quiz Available: {{quiz_title}}")
            .replace('{{quiz_title}}', quizDetails.title);

        try {
            await retryOperation(async () => {
                const gasResponse = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        recipients: recipients,
                        subject: processedSubject,
                        body: processedBody
                    })
                });

                const responseText = await gasResponse.text();
                // Try parsing JSON, but fallback to text if failed (GAS sometimes sends HTML on error)
                let gasResult;
                try {
                    gasResult = JSON.parse(responseText);
                    console.log(`[GAS] Batch Result: Success=${gasResult.success} Sent=${gasResult.sent} Failed=${gasResult.failed}`);
                } catch (e) {
                    console.error("[GAS] Parsed Error (Non-JSON response):", responseText);
                    throw new Error("GAS returned invalid JSON");
                }

                if (gasResult.logs) {
                    gasResult.logs.forEach(log => {
                        results.logs.push({
                            email: log.email,
                            status: log.status,
                            error: log.error,
                            method: 'GAS',
                            time: new Date().toISOString()
                        });
                        if (log.status === 'sent') results.success++;
                        else results.failed++;
                    });
                }
            });
        } catch (gasErr) {
            console.error("[GAS BATCH FAILED AFTER RETRIES]", gasErr);
            results.logs.push({ error: gasErr.message, method: 'GAS_BATCH_FAIL' });
        }
    }

    // --- 2. SMTP (Concurrent Send) ---
    const isPlaceholderPass = process.env.EMAIL_PASS && process.env.EMAIL_PASS.includes('$6969$');
    const smtpEnabled = process.env.EMAIL_USER && process.env.EMAIL_PASS && !isPlaceholderPass && !process.env.EMAIL_USER.includes('your-email');

    if (smtpEnabled) {
        console.log(`[SMTP] Starting concurrent send for ${recipients.length} recipients...`);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const sendEmailPromise = async (student) => {
            try {
                const subject = (customSubject || "New Quiz Available: {{quiz_title}}")
                    .replace('{{quiz_title}}', quizDetails.title);

                let body = (customMessage || defaultBody)
                    .replace(/{{Activity_Name}}/g, quizDetails.title)
                    .replace(/{{Subject}}/g, quizDetails.subject)
                    .replace(/{{Branch}}/g, quizDetails.branch)
                    .replace(/{{Year}}/g, quizDetails.year)
                    .replace(/{{Semester}}/g, quizDetails.semester)
                    .replace(/{{Publish_Date}}/g, quizDetails.publishDate || new Date().toLocaleDateString())
                    .replace(/{{Deadline}}/g, quizDetails.deadline || "No Deadline")
                    .replace(/{{Faculty_Name}}/g, quizDetails.facultyName || "Faculty")
                    .replace(/{{student_name}}/g, student.name)
                    .replace(/{Student name}/g, student.name);

                // Wrap individual send in retry
                await retryOperation(async () => {
                    await transporter.sendMail({
                        from: `"Origin Trivia" <${process.env.EMAIL_USER}>`,
                        to: student.email,
                        subject: subject,
                        text: body
                    });
                }, 2, 500); // 2 retries per student

                return { email: student.email, status: 'sent', method: 'SMTP' };
            } catch (err) {
                console.error(`[SMTP FAIL] ${student.email}:`, err.message);
                let errorMessage = err.message;
                if (err.responseCode === 535) errorMessage = "Auth Failed";
                else if (err.code === 'ECONNREFUSED') errorMessage = "Conn Refused";

                return { email: student.email, status: 'failed', error: errorMessage, method: 'SMTP' };
            }
        };

        const smtpResults = await Promise.all(recipients.map(sendEmailPromise));

        smtpResults.forEach(res => {
            results.logs.push({ ...res, time: new Date().toISOString() });
            if (res.status === 'sent') results.success++;
            else results.failed++;
        });
    }

    // --- 3. MacroDroid (Webhook) ---
    if (process.env.MACRODROID_WEBHOOK_URL) {
        const webhookUrlBase = process.env.MACRODROID_WEBHOOK_URL;
        recipients.forEach(student => {
            const subject = (customSubject || "Notification").replace('{{quiz_title}}', quizDetails.title);
            const url = new URL(webhookUrlBase);
            url.searchParams.append('to', student.email);
            url.searchParams.append('subject', subject);
            fetch(url.toString()).catch(e => console.error("MacroDroid Fail", e));
        });
        console.log("[MACRODROID] Triggered webhooks.");
    }

    res.json({ success: true, results });
});

// Global error handlers to prevent exit
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;

if (process.env.NODE_ENV !== 'production' && process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        const server = app.listen(port, '0.0.0.0', () => {
            console.log(`Server listening at http://0.0.0.0:${port}`);
        });

        server.on('error', (e) => {
            console.error("Server Error:", e);
        });
    } catch (e) {
        console.error("Failed to start server:", e);
    }
}
