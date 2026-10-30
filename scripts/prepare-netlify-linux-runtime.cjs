/* eslint-disable @typescript-eslint/no-require-imports -- Deployment utility runs directly in Node. */
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

// Local macOS builds trace macOS native modules. Netlify functions run on
// Linux x64, so include Sharp's matching, integrity-verified optional packages.
async function main() {
  const root = process.cwd();
  const target = path.join(root, '.netlify/functions-internal/___netlify-server-handler/node_modules');
  const sharp = JSON.parse(await fs.readFile(path.join(target, 'sharp/package.json'), 'utf8'));
  const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'everymoment-netlify-runtime-'));
  try {
    for (const name of ['@img/sharp-linux-x64', '@img/sharp-libvips-linux-x64']) {
      const entry = lock.packages[`node_modules/${name}`];
      const version = sharp.optionalDependencies[name];
      if (!entry || entry.version !== version || !entry.resolved?.startsWith('https://registry.npmjs.org/') || !entry.integrity?.startsWith('sha512-')) {
        throw new Error(`Missing matching locked runtime dependency for ${name}@${version}`);
      }
      const response = await fetch(entry.resolved);
      if (!response.ok) throw new Error(`Could not download ${name}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const actual = `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
      if (actual !== entry.integrity) throw new Error(`Integrity check failed for ${name}`);
      const archive = path.join(temporary, name.split('/').pop() + '.tgz');
      const destination = path.join(target, name);
      await fs.writeFile(archive, bytes);
      await fs.mkdir(destination, { recursive: true });
      execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', destination]);
      const installed = JSON.parse(await fs.readFile(path.join(destination, 'package.json'), 'utf8'));
      if (installed.version !== version) throw new Error(`Unexpected runtime version for ${name}`);
      console.log(`Prepared ${name}@${version} for the Netlify function.`);
    }
    await fs.access(path.join(target, '@img/sharp-linux-x64/lib', `sharp-linux-x64-${sharp.version}.node`));
    // --no-build deploys use the existing ZIP from Netlify's manifest.
    // Update that artifact as well as its source directory.
    const functionRoot = path.dirname(target);
    const functionArchive = path.join(root, '.netlify/functions/___netlify-server-handler.zip');
    await fs.access(functionArchive);
    execFileSync('zip', ['-q', '-r', functionArchive, 'node_modules/@img/sharp-linux-x64', 'node_modules/@img/sharp-libvips-linux-x64'], { cwd: functionRoot });
    console.log('Linux Sharp runtime verified and included in the deployable function ZIP.');
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
