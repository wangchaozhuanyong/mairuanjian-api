import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

export const developmentDataTables = [
  'active_sessions',
  'login_logs',
  'audit_logs',
  'sensitive_access_logs',
  'sensitive_access_approvals',
  'notification_logs',
  'platform_sync_logs',
  'error_logs',
  'system_health_snapshots',
  'queue_status_logs',
  'cron_job_logs',
  'backup_jobs',
  'restore_jobs',
  'data_import_jobs',
  'data_export_jobs',
  'recycle_bin_records',
  'data_cleanup_jobs',
  'duplicate_merge_jobs',
  'attachments',
  'automation_task_logs',
  'automation_tasks',
  'apple_account_action_plan_items',
  'apple_account_action_plans',
  'renewal_tasks',
  'apple_account_locks',
  'service_activations',
  'apple_orders',
  'apple_balance_adjustments',
  'apple_balance_consumptions',
  'apple_balance_topups',
  'apple_account_status_checks',
  'apple_service_platform_mappings',
  'apple_services',
  'apple_accounts',
  'code_after_sales',
  'code_refund_records',
  'code_delivery_logs',
  'redeem_codes',
  'redeem_code_batches',
  'code_platform_orders',
  'code_platform_mappings',
  'code_services',
  'message_templates',
  'customers',
  'source_platforms',
  'telegram_configs',
  'ip_whitelists',
  'app_announcements',
  'maintenance_windows',
  'user_table_views'
];

const launchChecklistItemsToReset = new Map([
  [
    'apple_e2e',
    {
      status: 'pending',
      owner: '业务',
      evidence: '',
      remark: '需用真实样例数据验收订单、成本、续费和报表'
    }
  ],
  [
    'code_e2e',
    {
      status: 'pending',
      owner: '业务',
      evidence: '',
      remark: '需验收导入、去重、锁码、发货、防重复和售后'
    }
  ],
  [
    'sensitive_audit',
    {
      status: 'pending',
      owner: '技术',
      evidence: '',
      remark: '覆盖 Apple ID、礼品卡代码、兑换码、客户手机号'
    }
  ],
  [
    'backup_restore',
    {
      status: 'pending',
      owner: '技术',
      evidence: '',
      remark: '至少在非生产环境完成恢复演练'
    }
  ]
]);

const devUserWhereSql = [
  "username LIKE 'acceptance%'",
  "username LIKE 'browser_smoke%'",
  "display_name LIKE '%验收%'",
  "display_name LIKE '%烟测%'"
].join(' OR ');

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function countRows(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`
  );
  return Number(rows[0]?.count ?? 0);
}

async function countDevUsers(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM users WHERE ${devUserWhereSql}`
  );
  return Number(rows[0]?.count ?? 0);
}

async function getLaunchChecklist(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT value FROM system_parameters WHERE key = 'maintenance_launch_checklist' LIMIT 1"
  );
  return Array.isArray(rows[0]?.value) ? rows[0].value : [];
}

function resetLaunchChecklistItems(items) {
  return items.map((item) => {
    const reset = launchChecklistItemsToReset.get(item?.id);
    if (!reset) return item;

    return {
      ...item,
      ...reset,
      updatedAt: new Date().toISOString()
    };
  });
}

async function saveLaunchChecklist(prisma, items) {
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO system_parameters (id, key, "group", value, remark, created_at, updated_at)
      VALUES ($1::uuid, 'maintenance_launch_checklist', 'maintenance', $2::jsonb, '上线检查清单', now(), now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `,
    randomUUID(),
    JSON.stringify(items)
  );
}

async function listLocalBackupFiles(backupDir) {
  if (!existsSync(backupDir)) {
    return [];
  }

  const files = await readdir(backupDir, { withFileTypes: true });
  return files
    .filter((file) => file.isFile() && file.name.endsWith('.dump'))
    .map((file) => resolve(backupDir, file.name));
}

async function removeLocalBackupFiles(files) {
  for (const file of files) {
    await rm(file, { force: true });
  }
}

export function isLocalApiBaseUrl(apiBaseUrl) {
  try {
    const url = new URL(apiBaseUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function isLocalDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function assertLocalAcceptanceDatabase(apiBaseUrl, databaseUrl) {
  if (!isLocalApiBaseUrl(apiBaseUrl) || !databaseUrl || isLocalDatabaseUrl(databaseUrl)) {
    return;
  }

  if (process.env.ACCEPTANCE_ALLOW_REMOTE_DATABASE === '1') {
    return;
  }

  const url = new URL(databaseUrl);
  throw new Error(
    `Refusing to run local acceptance against remote database ${url.hostname}. Set ACCEPTANCE_ALLOW_REMOTE_DATABASE=1 only after confirming this remote database may receive acceptance records.`
  );
}

export async function collectDevelopmentDataCounts(prisma) {
  const tableCounts = {};
  for (const table of developmentDataTables) {
    tableCounts[table] = await countRows(prisma, table);
  }

  return {
    tables: tableCounts,
    devUsers: await countDevUsers(prisma)
  };
}

export function summarizeDevelopmentDataCounts(counts) {
  const nonEmptyTables = Object.entries(counts.tables)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const totalRows = nonEmptyTables.reduce((sum, [, count]) => sum + count, 0) + counts.devUsers;

  return {
    totalRows,
    nonEmptyTables,
    devUsers: counts.devUsers
  };
}

export async function cleanupDevelopmentData(
  prisma,
  {
    dryRun = false,
    resetLaunchChecklist = true,
    deleteLocalBackups = false,
    backupDir = resolve('backups/postgres/local')
  } = {}
) {
  const before = await collectDevelopmentDataCounts(prisma);
  const backupFiles = deleteLocalBackups ? await listLocalBackupFiles(backupDir) : [];

  if (dryRun) {
    return {
      dryRun: true,
      before,
      after: before,
      deletedBackupFiles: []
    };
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `TRUNCATE ${developmentDataTables.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE ${devUserWhereSql})`
      );
      await tx.$executeRawUnsafe(`DELETE FROM users WHERE ${devUserWhereSql}`);

      if (resetLaunchChecklist) {
        const checklist = await getLaunchChecklist(tx);
        if (checklist.length) {
          await saveLaunchChecklist(tx, resetLaunchChecklistItems(checklist));
        }
      }
    },
    { timeout: 60_000 }
  );

  if (deleteLocalBackups) {
    await removeLocalBackupFiles(backupFiles);
  }

  return {
    dryRun: false,
    before,
    after: await collectDevelopmentDataCounts(prisma),
    deletedBackupFiles: backupFiles
  };
}

export async function cleanupLocalAcceptanceData(prisma, apiBaseUrl) {
  if (process.env.ACCEPTANCE_KEEP_DATA === '1' || process.env.ACCEPTANCE_AUTO_CLEANUP === '0') {
    return {
      skipped: true,
      reason: 'acceptance cleanup disabled by env'
    };
  }

  if (!isLocalApiBaseUrl(apiBaseUrl)) {
    return {
      skipped: true,
      reason: 'API base URL is not local'
    };
  }

  if (!isLocalDatabaseUrl(process.env.DATABASE_URL ?? '')) {
    return {
      skipped: true,
      reason: 'database URL is not local'
    };
  }

  const result = await cleanupDevelopmentData(prisma, {
    resetLaunchChecklist: false,
    deleteLocalBackups: false
  });

  return {
    skipped: false,
    result
  };
}
