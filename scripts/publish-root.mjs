#!/usr/bin/env node
/**
 * Copy the Vite build onto the repository root so GitHub Pages
 * (which serves / from main) picks up real HTML files per page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html is missing. Run vite build first.');
  process.exit(1);
}

copyFile(path.join(dist, 'index.html'), path.join(root, 'index.html'));

const skipDirs = new Set(['assets', 'icons', 'presentations', 'src', 'public']);
for (const ent of fs.readdirSync(dist, { withFileTypes: true })) {
  if (!ent.isDirectory() || skipDirs.has(ent.name)) continue;
  const index = path.join(dist, ent.name, 'index.html');
  if (fs.existsSync(index)) copyFile(index, path.join(root, ent.name, 'index.html'));
}

const presentationsIndex = path.join(dist, 'presentations', 'index.html');
if (fs.existsSync(presentationsIndex)) {
  copyFile(presentationsIndex, path.join(root, 'presentations', 'index.html'));
}

const assetsDest = path.join(root, 'assets');
fs.mkdirSync(assetsDest, { recursive: true });
for (const name of fs.readdirSync(assetsDest)) {
  if (/^index-.*\.(js|css)$/.test(name)) fs.unlinkSync(path.join(assetsDest, name));
}
const distAssets = path.join(dist, 'assets');
if (fs.existsSync(distAssets)) {
  for (const name of fs.readdirSync(distAssets)) {
    copyFile(path.join(distAssets, name), path.join(assetsDest, name));
  }
}

for (const name of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png']) {
  const from = path.join(dist, name);
  if (fs.existsSync(from)) copyFile(from, path.join(root, name));
}

const iconsFrom = path.join(dist, 'icons');
const iconsDest = path.join(root, 'icons');
if (fs.existsSync(iconsFrom)) {
  fs.mkdirSync(iconsDest, { recursive: true });
  for (const name of fs.readdirSync(iconsFrom)) {
    copyFile(path.join(iconsFrom, name), path.join(iconsDest, name));
  }
}

console.log('published dist onto the repository root');
