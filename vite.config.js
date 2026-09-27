import { defineConfig } from 'vite'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const project = resolve(import.meta.dirname)
const site = resolve(project, 'build-src')

function htmlInputs() {
  const pages = {}
  const home = resolve(site, 'index.html')
  if (existsSync(home)) pages.main = home
  if (!existsSync(site)) return pages
  for (const ent of readdirSync(site, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    if (ent.name === 'src' || ent.name === 'public') continue
    const index = resolve(site, ent.name, 'index.html')
    if (existsSync(index)) pages[ent.name] = index
  }
  return pages
}

export default defineConfig({
  root: site,
  base: '/',
  build: {
    outDir: resolve(project, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: htmlInputs(),
    },
  },
})
