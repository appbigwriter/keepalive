import { Pool } from 'pg';

let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/keepalive';

const schema = process.env.SUPABASE_SCHEMA;
if (schema) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString += `${separator}options=-csearch_path%3D${schema}`;
}

const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function query(text: string, params?: unknown[]) {
  const schema = process.env.SUPABASE_SCHEMA;
  let sql = text;
  if (schema && schema !== 'public') {
    const tables = [
      'organizations', 'projects', 'project_credentials', 
      'edge_function_secrets', 'keepalive_runs', 'backups', 
      'backup_artifacts', 'alerts', 'users', 'audit_log'
    ];
    for (const table of tables) {
      // Substitui apenas quando a tabela não estiver prefixada e for uma palavra isolada
      const regex = new RegExp(`(?<!\\.)\\b${table}\\b`, 'g');
      sql = sql.replace(regex, `${schema}.${table}`);
    }
  }
  try {
    return await pool.query(sql, params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[db] query failed:', message);
    console.error('[db] sql:', sql);
    throw err;
  }
}
