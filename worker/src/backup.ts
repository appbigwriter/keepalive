import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { query } from './db.js';
import { decrypt } from './crypto.js';
import { logAlert } from './alerts.js';
import { syncArtifactOffsite } from './offsite.js';
import { runBackupStorage } from './storage.js';
import { runBackupEdgeFunctions } from './functions.js';

const execAsync = util.promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || '/tmp/keepalive_backups';

async function ensureBackupDir() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (e: any) {
        console.error('[Backup] Failed to create backup directory:', e.message);
    }
}

export async function runBackupPostgres(projectId: string, nickname: string, connStringEnc: string, backupId: string) {
    const connString = decrypt(connStringEnc);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${nickname}_postgres_${timestamp}.dump`;
    const localPath = path.join(BACKUP_DIR, filename);

    console.log(`[Backup] Starting Postgres dump for ${nickname}...`);
    
    try {
        // We use custom format (-Fc) which is compressed and suitable for pg_restore
        // We exclude auth and storage schemas from the full dump, as they need special handling
        const command = `pg_dump "${connString}" -Fc -N auth -N storage -f "${localPath}"`;
        
        await execAsync(command);
        
        const stats = await fs.stat(localPath);
        
        // Log artifact
        const artRes = await query(`
            INSERT INTO backup_artifacts (backup_id, layer, local_path, size_bytes, verified)
            VALUES ($1, 'postgres', $2, $3, true)
            RETURNING id
        `, [backupId, localPath, stats.size]);
        
        await syncArtifactOffsite(artRes.rows[0].id, localPath, nickname);
        
        console.log(`[Backup] Postgres dump successful for ${nickname}. Size: ${stats.size} bytes`);
        return true;
    } catch (e: any) {
        console.error(`[Backup] Postgres dump failed for ${nickname}:`, e.message);
        await logAlert(projectId, 'warning', 'POSTGRES_DUMP_FAILED', `Failed to dump postgres schema for ${nickname}: ${e.message}`);
        return false;
    }
}

export async function runBackupAuth(projectId: string, nickname: string, connStringEnc: string, backupId: string) {
    const connString = decrypt(connStringEnc);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${nickname}_auth_${timestamp}.sql`;
    const localPath = path.join(BACKUP_DIR, filename);

    console.log(`[Backup] Starting Auth data dump for ${nickname}...`);
    
    try {
        // Data-only dump for auth schema (--data-only), plain text SQL
        const command = `pg_dump "${connString}" -n auth -a -f "${localPath}"`;
        
        await execAsync(command);
        
        const stats = await fs.stat(localPath);
        
        // Log artifact
        const artRes = await query(`
            INSERT INTO backup_artifacts (backup_id, layer, local_path, size_bytes, verified)
            VALUES ($1, 'auth', $2, $3, true)
            RETURNING id
        `, [backupId, localPath, stats.size]);
        
        await syncArtifactOffsite(artRes.rows[0].id, localPath, nickname);
        
        console.log(`[Backup] Auth data dump successful for ${nickname}. Size: ${stats.size} bytes`);
        return true;
    } catch (e: any) {
        console.error(`[Backup] Auth dump failed for ${nickname}:`, e.message);
        await logAlert(projectId, 'warning', 'AUTH_DUMP_FAILED', `Failed to dump auth data for ${nickname}: ${e.message}`);
        return false;
    }
}

export async function runBackups() {
    console.log('[Backup] Starting backup engine...');
    await ensureBackupDir();

    // Fetch active projects that need backups
    const res = await query(`
        SELECT p.id, p.nickname, p.project_ref, p.scope_buckets, p.scope_edge, 
               pc.material as conn_string_enc,
               o.management_token as org_token_enc
        FROM projects p
        JOIN project_credentials pc ON p.id = pc.project_id
        JOIN organizations o ON p.org_id = o.id
        WHERE p.status = 'active' AND pc.role_type = 'backup'
    `);

    const projects = res.rows;
    console.log(`[Backup] Found ${projects.length} active projects for backup.`);

    for (const project of projects) {
        // Create backup record
        const backupRes = await query(`
            INSERT INTO backups (project_id, status)
            VALUES ($1, 'in_progress')
            RETURNING id
        `, [project.id]);
        
        const backupId = backupRes.rows[0].id;
        
        const pgSuccess = await runBackupPostgres(project.id, project.nickname, project.conn_string_enc, backupId);
        const authSuccess = await runBackupAuth(project.id, project.nickname, project.conn_string_enc, backupId);
        
        let storageSuccess = true;
        if (project.scope_buckets) {
            storageSuccess = await runBackupStorage(project.id, project.nickname, project.project_ref, project.org_token_enc, backupId);
        }

        let edgeSuccess = true;
        if (project.scope_edge) {
            edgeSuccess = await runBackupEdgeFunctions(project.id, project.nickname, project.project_ref, project.org_token_enc, backupId);
        }
        
        const overallStatus = (pgSuccess && authSuccess && storageSuccess && edgeSuccess) ? 'completed' : 'failed';
        
        await query(`
            UPDATE backups 
            SET status = $1, completed_at = NOW()
            WHERE id = $2
        `, [overallStatus, backupId]);
    }
    
    console.log('[Backup] Backup engine completed.');
}

if (require.main === module) {
    runBackups()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
