import { query } from './db.js';
import { decrypt } from './crypto.js';

// Supabase Management API base URL
const SUPABASE_API_URL = 'https://api.supabase.com/v1';

interface SupabaseProject {
    id: string;
    organization_id: string;
    name: string;
    region: string;
    created_at: string;
    status: string; // usually ACTIVE, INACTIVE (paused), etc.
}

export async function fetchProjectsForOrg(managementToken: string): Promise<SupabaseProject[]> {
    const response = await fetch(`${SUPABASE_API_URL}/projects`, {
        headers: {
            'Authorization': `Bearer ${managementToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
    }

    const projects: SupabaseProject[] = await response.json();
    return projects;
}

export async function runAudit() {
    console.log('[Audit] Starting organization audit...');
    
    // Fetch all organizations from our Config DB
    const res = await query('SELECT id, name, management_token FROM organizations');
    const orgs = res.rows;
    
    for (const org of orgs) {
        console.log(`[Audit] Auditing organization: ${org.name}`);
        
        let token: string;
        try {
            token = decrypt(org.management_token);
        } catch (e) {
            console.error(`[Audit] Failed to decrypt token for org ${org.name}. Skipping...`);
            continue;
        }

        try {
            const projects = await fetchProjectsForOrg(token);
            console.log(`[Audit] Found ${projects.length} projects in org ${org.name}.`);
            
            for (const p of projects) {
                // Here we would identify the status and update our local database.
                // Status parsing logic: active, paused (inactive), at_risk
                let computedStatus = 'unknown';
                
                // Supabase API usually returns status as 'ACTIVE_HEALTHY', 'INACTIVE' (paused), 'RESTORING', etc.
                const rawStatus = (p.status || '').toUpperCase();
                
                if (rawStatus.includes('ACTIVE')) {
                    computedStatus = 'active';
                } else if (rawStatus.includes('INACTIVE') || rawStatus === 'PAUSED') {
                    // Check if it's near the 90-day mark
                    // We need to know when it was paused to calculate the 90 days.
                    // This might require a different endpoint or assuming worst case.
                    computedStatus = 'paused'; 
                    // TODO: Implement 'at_risk' logic when near 90 days
                }

                console.log(`  - Project: ${p.name} (${p.id}) | Raw Status: ${rawStatus} | Computed: ${computedStatus}`);
                
                // Insert or update project in our local database
                // For the sake of the initial triage, we just list them.
            }
        } catch (e: any) {
            console.error(`[Audit] Error auditing org ${org.name}:`, e.message);
        }
    }
    
    console.log('[Audit] Audit completed.');
}

// If run directly
if (require.main === module) {
    runAudit()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
