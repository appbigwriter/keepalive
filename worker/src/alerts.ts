import nodemailer from 'nodemailer';
import { query } from './db.js';

// SMTP Configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || '"KeepAlive System" <alerts@keepalive.local>';
const ALERTS_TO = process.env.ALERTS_TO; // Comma separated list of emails

// Dead-man's switch URL (e.g. healthchecks.io)
const HEARTBEAT_URL = process.env.HEARTBEAT_URL;

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
}

export async function sendEmailAlert(subject: string, text: string, html?: string) {
    if (!transporter || !ALERTS_TO) {
        console.warn('[Alerts] SMTP not configured or ALERTS_TO not set. Cannot send email.');
        return;
    }

    try {
        const info = await transporter.sendMail({
            from: SMTP_FROM,
            to: ALERTS_TO,
            subject,
            text,
            html,
        });
        console.log(`[Alerts] Email sent: ${info.messageId}`);
    } catch (e: any) {
        console.error('[Alerts] Error sending email:', e.message);
    }
}

export async function logAlert(projectId: string | null, severity: string, alertType: string, message: string) {
    try {
        await query(`
            INSERT INTO alerts (project_id, severity, alert_type, message)
            VALUES ($1, $2, $3, $4)
        `, [projectId, severity, alertType, message]);
        
        console.log(`[Alerts] Logged alert: [${severity}] ${alertType} - ${message}`);
        
        // Also send email
        await sendEmailAlert(
            `[KeepAlive Alert] ${severity.toUpperCase()}: ${alertType}`,
            message
        );
    } catch (e: any) {
        console.error('[Alerts] Error logging alert to database:', e.message);
    }
}

export async function sendHeartbeat() {
    if (!HEARTBEAT_URL) {
        console.log('[Alerts] HEARTBEAT_URL not set. Skipping dead-man\'s switch ping.');
        return;
    }

    try {
        const res = await fetch(HEARTBEAT_URL);
        if (!res.ok) {
            console.error(`[Alerts] Heartbeat failed with status ${res.status}`);
        } else {
            console.log('[Alerts] Heartbeat sent successfully.');
        }
    } catch (e: any) {
        console.error('[Alerts] Error sending heartbeat:', e.message);
    }
}
