import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const viewsDir = path.join(rootDir, 'apps/admin/src/views');

const allowedWithoutPageRefresh = new Map([
  [
    'apps/admin/src/views/apple/AppleFinanceView.vue',
    'wrapper view; AppleProfitReportPage registers the refresh handler'
  ],
  [
    'apps/admin/src/views/apple/AppleReportsView.vue',
    'wrapper view; AppleProfitReportPage registers the refresh handler'
  ],
  ['apps/admin/src/views/auth/LoginView.vue', 'public login page outside the admin refresh host'],
  ['apps/admin/src/views/system/SystemStateView.vue', 'static 403/404/maintenance state page']
]);

function walkVueFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkVueFiles(filePath);
    }

    return filePath.endsWith('.vue') ? [filePath] : [];
  });
}

function toProjectPath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

const viewFiles = walkVueFiles(viewsDir).sort((a, b) =>
  toProjectPath(a).localeCompare(toProjectPath(b))
);
const missing = [];
const exempt = [];
let registeredCount = 0;

for (const filePath of viewFiles) {
  const projectPath = toProjectPath(filePath);
  const source = fs.readFileSync(filePath, 'utf8');

  if (source.includes('usePageRefresh(')) {
    registeredCount += 1;
    continue;
  }

  const reason = allowedWithoutPageRefresh.get(projectPath);
  if (reason) {
    exempt.push({ file: projectPath, reason });
    continue;
  }

  missing.push(projectPath);
}

if (missing.length) {
  console.error('Admin page refresh check failed. These views must register usePageRefresh:');

  for (const file of missing) {
    console.error(`- ${file}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        ok: true,
        totalViews: viewFiles.length,
        registeredViews: registeredCount,
        exemptViews: exempt.length,
        exemptions: exempt
      },
      null,
      2
    )
  );
}
