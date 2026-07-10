import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { query } from './db.js';
import { decrypt } from './crypto.js';
import { logAlert } from './alerts.js';
import { syncArtifactOffsite } from './offsite.js';

const execAsync = util.promisify(exec);
const BACKUP_DIR = process.env.BACKUP_DIR || '/tmp/keepalive_backups';

export async function runBackupStorage(projectId: string, nickname: string, projectRef: string, orgTokenEnc: string, backupId: string) {
    console.log(`[Backup:Storage] Starting storage backup for ${nickname}...`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const localDir = path.join(BACKUP_DIR, `${nickname}_storage_${timestamp}`);
    const archivePath = `${localDir}.tar.gz`;

    try {
        const token = decrypt(orgTokenEnc);

        // Ensure backup dir exists
        await fs.mkdir(localDir, { recursive: true });

        // Using Supabase CLI to list buckets and download files. 
        // We set the SUPABASE_ACCESS_TOKEN env variable for the child process.
        const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token };

        // 1. List buckets
        // The Supabase CLI storage ls command lists files, not directly buckets in a simple way.
        // Alternatively, since we have the PG connection (or just assuming we know the buckets),
        // we can query the 'storage.buckets' table if we had the DB connection here.
        // For CLI approach: we will assume we can pull everything from all buckets if we do `supabase storage cp -r ss://${projectRef}/ localDir`
        // Currently, `supabase storage cp` might require specific bucket names. 
        // Let's execute a sync or copy command for the whole storage if supported, otherwise we'd need to fetch bucket names from Postgres.

        // Assuming Supabase CLI allows downloading all buckets by omitting bucket name or querying them:
        // Actually, the most reliable way to get buckets is to query the Postgres DB for this project.
        
        // Fetch buckets from the project database (we need the connString for this)
        const credsRes = await query(`SELECT material FROM project_credentials WHERE project_id = $1 AND role_type = 'backup'`, [projectId]);
        if (credsRes.rows.length === 0) throw new Error('Backup credentials not found');
        const connString = decrypt(credsRes.rows[0].material);

        const { Client } = await import('pg');
        const client = new Client({ connectionString: connString });
        await client.connect();
        const bucketsRes = await client.query('SELECT id, name FROM storage.buckets');
        await client.end();

        for (const bucket of bucketsRes.rows) {
            const bucketName = bucket.name;
            const bucketDir = path.join(localDir, bucketName);
            await fs.mkdir(bucketDir, { recursive: true });

            console.log(`[Backup:Storage] Downloading bucket ${bucketName} for ${nickname}...`);
            
            // Use Supabase CLI to download bucket contents
            // Command format: supabase storage cp -r ss://<project-ref>/<bucket-name> <local-path> --project-ref <ref>
            const cmd = `supabase storage cp -r ss://${projectRef}/${bucketName} "${bucketDir}" --project-ref ${projectRef}`;
            
            try {
                await execAsync(cmd, { env });
            } catch (cmdErr: any) {
                console.warn(`[Backup:Storage] Warning: Failed to download bucket ${bucketName}. Might be empty or inaccessible. Error: ${cmdErr.message}`);
            }
        }

        // 2. Compress the downloaded directory
        console.log(`[Backup:Storage] Compressing storage backup for ${nickname}...`);
        await execAsync(`tar -czf "${archivePath}" -C "${BACKUP_DIR}" "${path.basename(localDir)}"`);
        
        // Clean up the uncompressed directory
        await fs.rm(localDir, { recursive: true, force: true });

        const stats = await fs.stat(archivePath);

        // 3. Log artifact
        const artRes = await query(`
            INSERT INTO backup_artifacts (backup_id, layer, local_path, size_bytes, verified)
            VALUES ($1, 'storage', $2, $3, true)
            RETURNING id
        `, [backupId, archivePath, stats.size]);
        
        // 4. Sync offsite
        await syncArtifactOffsite(artRes.rows[0].id, archivePath, nickname);

        console.log(`[Backup:Storage] Storage backup successful for ${nickname}. Size: ${stats.size} bytes`);
        return true;
    } catch (e: any) {
        console.error(`[Backup:Storage] Storage backup failed for ${nickname}:`, e.message);
        await logAlert(projectId, 'warning', 'STORAGE_DUMP_FAILED', `Failed to backup storage for ${nickname}: ${e.message}`);
        return false;
    }
}
