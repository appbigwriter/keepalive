import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

/**
 * Automates the Postgres and Auth restore process.
 * Make sure to run this against a NEW Supabase project to avoid irreversible conflicts.
 */
export async function restoreDatabase(
    newConnectionString: string,
    postgresDumpPath: string,
    authSqlPath: string
) {
    console.log('[Restore] Starting automated database restore...');
    
    try {
        // 1. Restore Postgres Schema (-1 single transaction, -c clean, -x no privileges, -O no owner)
        console.log('[Restore] Restoring public schema from dump...');
        const pgRestoreCmd = `pg_restore -d "${newConnectionString}" -1 -c -x -O --role=postgres "${postgresDumpPath}"`;
        await execAsync(pgRestoreCmd);
        console.log('[Restore] Postgres schema restored successfully.');

        // 2. Restore Auth data
        // For auth, it is a plain SQL file
        console.log('[Restore] Restoring auth data from SQL file...');
        const authRestoreCmd = `psql -d "${newConnectionString}" -f "${authSqlPath}"`;
        await execAsync(authRestoreCmd);
        console.log('[Restore] Auth data restored successfully.');

    } catch (e: any) {
        console.error('[Restore] Error during database restore:', e.message);
        throw e;
    }
}

// Ensure it's not accidentally run
if (require.main === module) {
    console.error('Do not run restore.ts directly without proper parameters. Use as a module or modify the script for CLI usage.');
    process.exit(1);
}
