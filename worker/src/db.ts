import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// The Config DB connection string should be provided via environment variables.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Add additional config here if necessary
});

export async function query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[DB] executed query:`, { text, duration, rows: res.rowCount });
    return res;
}

export async function getClient() {
    return await pool.connect();
}
