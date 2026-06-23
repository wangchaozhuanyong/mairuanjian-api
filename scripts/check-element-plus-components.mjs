import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const adminSrcDir = join(repoRoot, 'apps/admin/src');
const pluginPath = join(adminSrcDir, 'plugins/element-plus.ts');

const componentTagPattern = /<\s*(el-[a-z0-9-]+)/gi;
const registeredNamePattern = /['"`](El[A-Za-z0-9]+)['"`]/g;

const usedComponents = new Map();
const registeredComponents = new Set();

for (const filePath of walkVueFiles(adminSrcDir)) {
  const content = readFileSync(filePath, 'utf8');

  for (const match of content.matchAll(componentTagPattern)) {
    const tag = match[1];
    const componentName = kebabToPascalComponentName(tag);
    const files = usedComponents.get(componentName) ?? new Set();
    files.add(relative(repoRoot, filePath));
    usedComponents.set(componentName, files);
  }
}

const pluginContent = readFileSync(pluginPath, 'utf8');
for (const match of pluginContent.matchAll(registeredNamePattern)) {
  registeredComponents.add(match[1]);
}

const missing = [...usedComponents.keys()]
  .filter((componentName) => !registeredComponents.has(componentName))
  .sort();

if (missing.length) {
  console.error('Element Plus components used in Vue files but not registered:');

  for (const componentName of missing) {
    const files = [...(usedComponents.get(componentName) ?? [])].sort();
    console.error(`- ${componentName}: ${files.join(', ')}`);
  }

  process.exit(1);
}

console.log(`Element Plus registration check passed (${usedComponents.size} components).`);

function* walkVueFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      yield* walkVueFiles(path);
      continue;
    }

    if (path.endsWith('.vue')) {
      yield path;
    }
  }
}

function kebabToPascalComponentName(tag) {
  return tag
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
