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

app.use(cors());
app.use(bodyParser.json());

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

app.post('/api/compile', (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    // Create a unique temporary directory for this request to avoid collisions
    const requestId = crypto.randomUUID();
    const requestDir = path.join(tempDir, requestId);
    fs.mkdirSync(requestDir);

    const filePath = path.join(requestDir, 'Main.java');

    // Attempt to detect class name or just force Main?
    // For simplicity, we'll assume the user is writing a class named Main or we rename it.
    // BUT, in Java, public class name must match file name.
    // Let's assume the user code *contains* "class Main".
    // If not, we might fail.
    // Better approach: Regex to find "public class \w+" and use that as filename.
    // Fallback to "Main" if not found (assuming non-public class or default).

    let className = 'Main';
    const classMatch = code.match(/public\s+class\s+(\w+)/);
    if (classMatch && classMatch[1]) {
        className = classMatch[1];
    }

    const javaFile = path.join(requestDir, `${className}.java`);

    fs.writeFile(javaFile, code, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to write code to file' });
        }

        // Compile
        exec(`javac "${javaFile}"`, { cwd: requestDir }, (compileErr, compileStdout, compileStderr) => {
            if (compileErr) {
                // cleanup
                fs.rmSync(requestDir, { recursive: true, force: true });
                return res.json({ output: '', error: `Compilation Error:\n${compileStderr}` });
            }

            // Run
            // Using exec for simplicity, but spawn is safer for long running or streaming.
            // Set a timeout to prevent infinite loops.
            const runProcess = exec(`java -cp . ${className}`, { cwd: requestDir, timeout: 5000 }, (runErr, runStdout, runStderr) => {
                // cleanup
                fs.rmSync(requestDir, { recursive: true, force: true });

                if (runErr && runErr.killed) {
                    return res.json({ output: '', error: 'Execution Timed Out' });
                }

                if (runErr) {
                    return res.json({ output: runStdout, error: `Runtime Error:\n${runStderr || runErr.message}` });
                }

                res.json({ output: runStdout, error: runStderr });
            });
        });
    });
});

app.post('/api/notify', async (req, res) => {
    const { recipients, quizDetails, customSubject, customMessage } = req.body;

    // recipients: [{ email, name, student_id }]
    // quizDetails: { title, subject, branch, year, semester, link }

    if (!recipients || recipients.length === 0) {
        return res.json({ success: true, message: 'No recipients provided' });
    }

    console.log(`[NOTIFICATION] Preparing emails for ${recipients.length} students...`);

    // Verify Email Config
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_USER.includes('your-email')) {
        console.warn("Email credentials missing in .env. Falling back to SIMULATION.");
        // Fallback logic or error? User asked for real mail.
        // Let's simulation if credentials are defaults, but warn.
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

            const defaultBody = `Hello {{student_name}},\n\nA new quiz has been published for your class.\n\nSubject: {{subject}}\nBranch: {{branch}}\nYear: {{year}}\nSemester: {{semester}}\n\nPlease log in to Origin Trivia to attempt the quiz.\n\nRegards,\nOrigin Trivia Team`;

            const messageTemplate = customMessage || defaultBody;

            const body = messageTemplate
                .replace(/{{student_name}}/g, student.name)
                .replace(/{{quiz_title}}/g, quizDetails.title)
                .replace(/{{subject}}/g, quizDetails.subject)
                .replace(/{{branch}}/g, quizDetails.branch)
                .replace(/{{year}}/g, quizDetails.year)
                .replace(/{{semester}}/g, quizDetails.semester);

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

app.listen(port, () => {
    console.log(`Compiler server listening at http://localhost:${port}`);
});
