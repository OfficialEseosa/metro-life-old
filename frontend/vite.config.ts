import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))
const sharedSource = resolve(root, '../shared')
const sharedCopy = resolve(root, 'src/shared-data')

/** Keeps src/shared-data in step with ../shared while the dev server runs (npm scripts do the initial copy). */
function sharedData(): Plugin {
  return {
    name: 'metro-shared-data',
    apply: 'serve',
    configureServer(server) {
      if (!existsSync(sharedSource)) return
      server.watcher.add(sharedSource)
      const copy = (file: string) => {
        if (dirname(file) !== sharedSource || !file.endsWith('.json')) return
        mkdirSync(sharedCopy, { recursive: true })
        copyFileSync(file, join(sharedCopy, basename(file)))
      }
      server.watcher.on('change', copy)
      server.watcher.on('add', copy)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '')
  const target = (env.METRO_API_PROXY || 'http://localhost:8080').replace(/\/+$/, '')
  return {
    plugins: [react(), sharedData()],
    server: {
      port: 5173,
      proxy: {
        '/api': target,
        '/ws': { target: target.replace(/^http/, 'ws'), ws: true },
      },
    },
  }
})
