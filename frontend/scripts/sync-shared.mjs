// Copies the repository's shared/*.json game data into src/shared-data so the frontend builds
// from its own folder (for example on a static host whose root directory is frontend/).
// The copy is generated and ignored by git; shared/ stays the single source of truth.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(root, '..', 'shared')
const target = join(root, 'src', 'shared-data')

if (!existsSync(source)) {
  if (existsSync(target) && readdirSync(target).some(name => name.endsWith('.json'))) {
    console.warn('[shared-data] ../shared not found; using the existing copy in src/shared-data.')
    process.exit(0)
  }
  console.error('[shared-data] ../shared not found. Build from a full checkout of the repository; on Vercel keep "Include files outside the root directory in the Build Step" enabled.')
  process.exit(1)
}
mkdirSync(target, { recursive: true })
const names = readdirSync(source).filter(name => name.endsWith('.json'))
for (const name of names) copyFileSync(join(source, name), join(target, name))
console.log(`[shared-data] copied ${names.length} file(s) from ../shared`)
