import { exec } from 'child_process';
import util from 'util';
import { query } from './db.js';
import { logAlert } from './alerts.js';

const execAsync = util.promisify(exec);

// Offsite Config
// We can use rclone or aws-cli for offsite sync. Let's assume aws-cli is installed in the container
// and configured to point to Cloudflare R2 or AWS S3.
const OFFSITE_BUCKET = process.env.OFFSITE_BUCKET || 's3://keepalive-backups';

export async function syncArtifactOffsite(artifactId: string, localPath: string, nickname: string) {
    console.log(`[Offsite] Syncing ${localPath} to offsite storage...`);
    
    try {
        const filename = localPath.split('/').pop() || localPath.split('\\').pop();
        const offsitePath = `${OFFSITE_BUCKET}/${nickname}/${filename}`;
        
        // Use AWS CLI to copy the file
        // Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_ENDPOINT_URL_S3 to be set
        await execAsync(`aws s3 cp "${localPath}" "${offsitePath}"`);
        
        // Update database
        await query(`
            UPDATE backup_artifacts 
            SET offsite_path = $1 
            WHERE id = $2
        `, [offsitePath, artifactId]);
        
        console.log(`[Offsite] Successfully synced to ${offsitePath}`);
        return true;
    } catch (e: any) {
        console.error(`[Offsite] Failed to sync ${localPath}:`, e.message);
        // Note: For a single artifact we might not want to spam alerts, but for the sake of completion:
        // await logAlert(null, 'warning', 'OFFSITE_SYNC_FAILED', `Failed to sync artifact ${localPath}: ${e.message}`);
        return false;
    }
}
