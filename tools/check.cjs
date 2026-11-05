const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const errors = []
const ignored = new Set(['node_modules', '.git', 'runtime', '.runtime'])
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return []
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) errors.push(result.error?.message || result.stderr || result.stdout || args.join(' '))
  return result
}
function registered(base) {
  for (const ext of ['.js', '.json', '.wxml']) {
    if (!fs.existsSync(base + ext)) errors.push('Missing registered file: ' + path.relative(root, base + ext))
  }
}
const files = walk(root)
if (!process.argv.includes('--tests-only')) {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  for (const page of app.pages || []) registered(path.resolve(root, page))
  for (const pack of app.subPackages || app.subpackages || []) {
    for (const page of pack.pages || []) registered(path.resolve(root, pack.root, page))
  }
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const config = JSON.parse(fs.readFileSync(file, 'utf8'))
        for (const component of Object.values(config.usingComponents || {})) {
          if (component.startsWith('plugin://')) continue
          registered(component.startsWith('/') ? path.join(root, component) : path.resolve(path.dirname(file), component))
        }
      } catch (error) { errors.push(path.relative(root, file) + ': ' + error.message) }
    }
    if (!/\.(?:js|cjs|mjs)$/.test(file)) continue
    run(['--check', file])
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) {
      if (!match[2].startsWith('.')) continue
      const base = path.resolve(path.dirname(file), match[2])
      if (![base, base + '.js', base + '.json', base + '.cjs', path.join(base, 'index.js'), path.join(base, 'index.json')].some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())) {
        errors.push(path.relative(root, file) + ': missing local dependency ' + match[2])
      }
    }
  }
}
for (const file of files.filter(file => path.dirname(file) === path.join(root, 'tests') && file.endsWith('.test.js')).sort()) {
  const result = run([file])
  if (result.status === 0) process.stdout.write(result.stdout)
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else console.log('Frontend checks passed')
