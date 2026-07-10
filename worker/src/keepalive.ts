import { query } from './db.js';
import { decrypt } from './crypto.js';
import { Client } from 'pg';

export async function runKeepAlive() {
    console.log('[KeepAlive] Starting keep-alive engine...');

    // Fetch active projects that need keep-alive
    // Assuming status 'active' is what we want. Might also want to ping 'paused' if we manually restored it but the DB isn't updated yet.
    const res = await query(`
        SELECT p.id, p.nickname, pc.material as conn_string_enc
        FROM projects p
        JOIN project_credentials pc ON p.id = pc.project_id
        WHERE p.status = 'active' AND pc.role_type = 'keepalive'
    `);

    const projects = res.rows;
    console.log(`[KeepAlive] Found ${projects.length} active projects to ping.`);

    const concurrencyLimit = 5; // Configurable pool size
    let i = 0;

    const executePing = async (project: any) => {
        const start = Date.now();
        let success = false;
        let errorMessage = null;

        console.log(`[KeepAlive] Pinging project: ${project.nickname}`);

        try {
            const connString = decrypt(project.conn_string_enc);
            
            // Connect directly to the project's postgres instance
            const client = new Client({
                connectionString: connString,
                statement_timeout: 10000, // 10 seconds timeout
            });

            await client.connect();

            // The ping table must exist on the project's public schema.
            // Typically created via the bootstrap snippet.
            // Example: CREATE TABLE IF NOT EXISTS keepalive_ping (id SERIAL PRIMARY KEY, pinged_at TIMESTAMP DEFAULT NOW());
            
            await client.query('INSERT INTO keepalive_ping DEFAULT VALUES');
            await client.query("DELETE FROM keepalive_ping WHERE pinged_at < NOW() - INTERVAL '1 day'"); // Auto cleanup

            await client.end();
            success = true;
        } catch (e: any) {
            console.error(`[KeepAlive] Error pinging project ${project.nickname}:`, e.message);
            errorMessage = e.message;
        }

        const latencyMs = Date.now() - start;

        // Log the run in our config DB
        await query(`
            INSERT INTO keepalive_runs (project_id, success, latency_ms, error_message)
            VALUES ($1, $2, $3, $4)
        `, [project.id, success, latencyMs, errorMessage]);
    };

    // Execute with basic concurrency limit
    while (i < projects.length) {
        const batch = projects.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map(executePing));
        i += concurrencyLimit;
    }

    console.log('[KeepAlive] Engine completed.');
}

if (require.main === module) {
    runKeepAlive()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
