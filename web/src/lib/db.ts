import { Pool } from 'pg';

let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/keepalive';

const schema = process.env.SUPABASE_SCHEMA;
if (schema) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString += `${separator}options=-csearch_path%3D${schema}`;
}

const pool = new Pool({
  connectionString,
});

export async function query(text: string, params?: any[]) {
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
  return pool.query(sql, params);
}
