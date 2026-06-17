/**
 * Copy 8th Wall engine + XRExtras binaries into client/public/xr for same-origin
 * loading (reliable SLAM chunk paths on iOS Safari).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const arEngineRoot = path.resolve(clientRoot, '..', 'ar-engine');
const repoRoot = path.resolve(clientRoot, '..');

const engineDist = path.join(repoRoot, 'node_modules', '@8thwall', 'engine-binary', 'dist');
const extrasDist = path.join(repoRoot, 'node_modules', '@8thwall', 'xrextras', 'dist');

const copyBundle = (dest) => {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  for (const file of ['xr.js', 'xr-slam.js']) {
    cpSync(path.join(engineDist, file), path.join(dest, file));
  }
  cpSync(path.join(engineDist, 'resources'), path.join(dest, 'resources'), { recursive: true });
  cpSync(path.join(extrasDist, 'xrextras.js'), path.join(dest, 'xrextras.js'));

  const extrasResources = path.join(extrasDist, 'resources');
  if (existsSync(extrasResources)) {
    cpSync(extrasResources, path.join(dest, 'resources'), { recursive: true });
  }
};

if (!existsSync(engineDist) || !existsSync(extrasDist)) {
  console.warn('[sync-xr-assets] @8thwall packages missing — run npm install at repo root.');
  process.exit(0);
}

copyBundle(path.join(clientRoot, 'public', 'xr'));
copyBundle(path.join(arEngineRoot, 'public', 'xr'));

console.log('[sync-xr-assets] Copied 8th Wall assets to client/public/xr and ar-engine/public/xr');
