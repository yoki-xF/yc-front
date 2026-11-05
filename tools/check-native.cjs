// Uses the compilers bundled with the official WeChat developer tools. No upload.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const compilerDir = process.env.YC_WECHAT_COMPILER_DIR || '/Applications/wechatwebdevtools.app/Contents/Resources/app.asar.unpacked/node_modules/wcc-exec'
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'yc-native-check-'))
function files(dir, extension) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? files(full, extension) : full.endsWith(extension) ? [path.relative(root, full)] : []
  })
}
try {
  for (const [name, extension] of [['wcc', '.wxml'], ['wcsc', '.wxss']]) {
    const compiler = path.join(compilerDir, process.platform === 'win32' ? name + '.exe' : name)
    if (!fs.existsSync(compiler)) throw Error('未找到微信编译器，请安装开发者工具或设置 YC_WECHAT_COMPILER_DIR：' + name)
    const sources = ['pages', 'components', 'styles'].flatMap(dir => files(path.join(root, dir), extension)).sort()
    if (name === 'wcsc') sources.unshift('app.wxss')
    const result = spawnSync(compiler, ['-o', path.join(output, name + '.js'), ...sources], { cwd: root, encoding: 'utf8' })
    if (result.status !== 0) throw Error(result.error?.message || result.stderr || result.stdout || name + ' failed')
    console.log(name + ': ' + sources.length + ' files compiled')
  }
  console.log('WXML/WXSS compilation passed; no upload, runtime or device verification')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  fs.rmSync(output, { recursive: true, force: true })
}
