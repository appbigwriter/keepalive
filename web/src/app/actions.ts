'use server';

import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getDashboardStats() {
  const statsRes = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE status = 'paused') as paused,
      COUNT(*) FILTER (WHERE status = 'at_risk') as at_risk
    FROM projects
  `);
  
  return {
    total: parseInt(statsRes.rows[0].total) || 0,
    active: parseInt(statsRes.rows[0].active) || 0,
    paused: parseInt(statsRes.rows[0].paused) || 0,
    atRisk: parseInt(statsRes.rows[0].at_risk) || 0,
  };
}

export async function getProjects() {
  // Query projects and join with the latest keepalive ping and latest backup
  const projectsRes = await query(`
    SELECT 
      p.id, 
      p.nickname as name, 
      p.phase, 
      p.status,
      (SELECT executed_at FROM keepalive_runs WHERE project_id = p.id ORDER BY executed_at DESC LIMIT 1) as last_ping,
      (SELECT completed_at FROM backups WHERE project_id = p.id AND status = 'completed' ORDER BY completed_at DESC LIMIT 1) as last_backup,
      (SELECT total_size_bytes FROM backups WHERE project_id = p.id AND status = 'completed' ORDER BY completed_at DESC LIMIT 1) as latest_backup_size
    FROM projects p
    ORDER BY p.created_at DESC
  `);
  
  return projectsRes.rows.map(row => ({
    id: row.id,
    name: row.name,
    phase: row.phase,
    status: row.status,
    lastPing: row.last_ping ? new Date(row.last_ping).toLocaleString() : 'Never',
    lastBackup: row.last_backup ? new Date(row.last_backup).toLocaleString() : 'Never',
    size: row.latest_backup_size ? formatBytes(row.latest_backup_size) : '0 B',
  }));
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export async function triggerPing(projectId: string) {
  // In a real scenario, this would enqueue a job or call the worker API
  console.log('Triggering manual ping for', projectId);
  // simulate
  await new Promise(r => setTimeout(r, 500));
}

export async function triggerBackup(projectId: string) {
  // In a real scenario, this would enqueue a job
  console.log('Triggering manual backup for', projectId);
  await new Promise(r => setTimeout(r, 500));
}

export async function getOrganizations() {
  const res = await query('SELECT id, name FROM organizations ORDER BY name ASC');
  return res.rows.map(row => ({
    id: row.id,
    name: row.name
  }));
}

export async function createProject(data: {
  orgId: string | null;
  newOrgName?: string;
  newOrgToken?: string;
  nickname: string;
  projectRef: string;
  phase: string;
  criticality: string;
  connString: string;
  scopeBuckets: boolean;
  scopeEdge: boolean;
}) {
  let orgId = data.orgId;

  // Se for uma nova organização, cria primeiro
  if (!orgId && data.newOrgName) {
    const orgRes = await query(
      'INSERT INTO organizations (name, management_token) VALUES ($1, $2) RETURNING id',
      [data.newOrgName, data.newOrgToken || '']
    );
    orgId = orgRes.rows[0].id;
  }

  if (!orgId) {
    throw new Error('Organização não informada.');
  }

  // Cria o projeto
  await query(
    `INSERT INTO projects (
      org_id, nickname, phase, criticality, project_ref, conn_string, scope_buckets, scope_edge, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      orgId,
      data.nickname,
      data.phase,
      data.criticality,
      data.projectRef,
      data.connString,
      data.scopeBuckets,
      data.scopeEdge,
      'unknown'
    ]
  );

  revalidatePath('/');
}
