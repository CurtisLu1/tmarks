import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool, PoolClient } from 'pg';

interface ImportOptions {
  inputPath: string;
  conflict: ConflictStrategy;
  chunkSize: number;
}

type ConflictStrategy = 'skip' | 'overwrite';

interface TablePlan {
  name: string;
  conflictColumns: string[];
  booleanColumns?: string[];
  sequenceColumn?: string;
}

interface ExportPayload {
  tables: Record<string, unknown[]>;
}

interface TableReport {
  table: string;
  attempted: number;
  before: number;
  after: number;
  inserted: number;
}

const TABLES: TablePlan[] = [
  { name: 'users', conflictColumns: ['id'], booleanColumns: ['public_share_enabled'] },
  {
    name: 'user_preferences',
    conflictColumns: ['user_id'],
    booleanColumns: [
      'enable_search_auto_clear',
      'enable_tag_selection_auto_clear',
      'snapshot_auto_create',
      'snapshot_auto_dedupe',
    ],
  },
  {
    name: 'bookmarks',
    conflictColumns: ['id'],
    booleanColumns: ['is_pinned', 'is_archived', 'is_public', 'has_snapshot'],
  },
  { name: 'tags', conflictColumns: ['id'] },
  { name: 'bookmark_tags', conflictColumns: ['bookmark_id', 'tag_id'] },
  { name: 'bookmark_snapshots', conflictColumns: ['id'], booleanColumns: ['is_latest'] },
  { name: 'bookmark_images', conflictColumns: ['id'] },
  { name: 'bookmark_click_events', conflictColumns: ['id'], sequenceColumn: 'id' },
  {
    name: 'tab_groups',
    conflictColumns: ['id'],
    booleanColumns: ['is_folder', 'is_deleted'],
  },
  {
    name: 'tab_group_items',
    conflictColumns: ['id'],
    booleanColumns: ['is_pinned', 'is_todo', 'is_archived'],
  },
  { name: 'shares', conflictColumns: ['id'], booleanColumns: ['is_public'] },
  { name: 'statistics', conflictColumns: ['id'] },
  { name: 'auth_tokens', conflictColumns: ['id'], sequenceColumn: 'id' },
  { name: 'api_keys', conflictColumns: ['id'] },
  { name: 'api_key_logs', conflictColumns: ['id'], sequenceColumn: 'id' },
  { name: 'registration_limits', conflictColumns: ['date'] },
];

function parseArgs(argv: string[]): ImportOptions {
  const options: ImportOptions = {
    inputPath: path.resolve(process.cwd(), 'd1-export.json'),
    conflict: 'skip',
    chunkSize: 500,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input' || arg === '-i') {
      options.inputPath = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
    } else if (arg === '--conflict' || arg === '-c') {
      const strategy = argv[index + 1] as ConflictStrategy;
      if (strategy !== 'skip' && strategy !== 'overwrite') {
        throw new Error('冲突策略仅支持 skip 或 overwrite');
      }
      options.conflict = strategy;
      index += 1;
    } else if (arg === '--chunk-size') {
      options.chunkSize = Number.parseInt(argv[index + 1], 10);
      index += 1;
    }
  }

  if (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0) {
    throw new Error('chunk-size 必须是大于 0 的整数');
  }

  return options;
}

function toSafeIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`非法标识符: ${identifier}`);
  }
  return `"${identifier}"`;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
    const asNumber = Number.parseInt(value, 10);
    if (!Number.isNaN(asNumber)) return asNumber !== 0;
  }
  return Boolean(value);
}

function normalizeRow(plan: TablePlan, row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const booleanColumns = plan.booleanColumns || [];

  for (const [key, value] of Object.entries(row)) {
    if (booleanColumns.includes(key)) {
      normalized[key] = normalizeBoolean(value);
    } else {
      normalized[key] = value ?? null;
    }
  }

  return normalized;
}

async function loadExport(inputPath: string): Promise<ExportPayload> {
  const content = await fs.readFile(inputPath, 'utf8');
  return JSON.parse(content) as ExportPayload;
}

async function countRows(client: PoolClient, tableName: string): Promise<number> {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${toSafeIdentifier(tableName)}`);
  return Number.parseInt(String(result.rows[0].count), 10);
}

function buildInsertQuery(
  plan: TablePlan,
  columns: string[],
  rows: Record<string, unknown>[],
  conflict: ConflictStrategy,
): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const valueClauses: string[] = [];

  rows.forEach((row, rowIndex) => {
    const placeholders = columns.map((_, columnIndex) => {
      const parameterIndex = rowIndex * columns.length + columnIndex + 1;
      const key = columns[columnIndex];
      values.push(row[key] ?? null);
      return `$${parameterIndex}`;
    });
    valueClauses.push(`(${placeholders.join(', ')})`);
  });

  const columnList = columns.map(toSafeIdentifier).join(', ');
  const conflictTarget = plan.conflictColumns.map(toSafeIdentifier).join(', ');
  const conflictAction =
    conflict === 'overwrite'
      ? `DO UPDATE SET ${columns.map((column) => `${toSafeIdentifier(column)} = EXCLUDED.${toSafeIdentifier(column)}`).join(', ')}`
      : 'DO NOTHING';

  const text = `INSERT INTO ${toSafeIdentifier(plan.name)} (${columnList}) VALUES ${valueClauses.join(', ')} ON CONFLICT (${conflictTarget}) ${conflictAction}`;

  return { text, values };
}

async function insertChunk(
  client: PoolClient,
  plan: TablePlan,
  rows: Record<string, unknown>[],
  conflict: ConflictStrategy,
): Promise<void> {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const { text, values } = buildInsertQuery(plan, columns, rows, conflict);
  await client.query(text, values);
}

async function resetSequence(client: PoolClient, table: string, column: string): Promise<void> {
  await client.query(
    `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${toSafeIdentifier(column)}) FROM ${toSafeIdentifier(
      table,
    )}), 0) + 1, false);`,
    [table, column],
  );
}

function printReport(report: TableReport[]): void {
  console.log('\n迁移统计:');
  report.forEach((item) => {
    console.log(
      `${item.table.padEnd(24)} inserted: ${item.inserted.toString().padStart(6)} | before: ${item.before
        .toString()
        .padStart(6)} | after: ${item.after.toString().padStart(6)} | attempted: ${item.attempted}`,
    );
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const payload = await loadExport(options.inputPath);
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('缺少 DATABASE_URL 环境变量');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const report: TableReport[] = [];

  try {
    await client.query('BEGIN');

    for (const plan of TABLES) {
      const rawRows = (payload.tables?.[plan.name] || []) as Record<string, unknown>[];
      if (rawRows.length === 0) {
        continue;
      }

      const before = await countRows(client, plan.name);

      for (let index = 0; index < rawRows.length; index += options.chunkSize) {
        const chunk = rawRows.slice(index, index + options.chunkSize).map((row) => normalizeRow(plan, row));
        await insertChunk(client, plan, chunk, options.conflict);
      }

      if (plan.sequenceColumn) {
        await resetSequence(client, plan.name, plan.sequenceColumn);
      }

      const after = await countRows(client, plan.name);
      report.push({
        table: plan.name,
        attempted: rawRows.length,
        before,
        after,
        inserted: after - before,
      });
    }

    await client.query('COMMIT');
    printReport(report);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('导入失败，已回滚:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('导入过程中发生错误:', error);
  process.exit(1);
});

