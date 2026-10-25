// Refuses a release whose docs lag the code. Run before publishing
// (prepublishOnly) and by the smoke test. It checks that:
//   - every public method of the client is named in README.md and in the
//     website's page, frontend/src/pages/docs/javascript.tsx;
//   - CHANGELOG.md has a heading for the version in package.json;
//   - the website's page names this minor version (1.4, …).
// Outside the hive repo (the public hive-js repo) the website is not there,
// and only the first two are checked.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(path.join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))

// Public methods: two-space indented members of the exported classes, not
// private, not the constructor.
const internal = new Set(['constructor'])
const methods = new Set()
for (const file of ['src/database.ts', 'src/auth.ts', 'src/index.ts']) {
  for (const m of read(file).matchAll(/^ {2}(private |async )*([a-z][A-Za-z]*)\s*(<[^>]*>)?\(/gm)) {
    if (!m[1]?.includes('private') && !internal.has(m[2])) methods.add(m[2])
  }
}

const problems = []
const mentions = (text, name) => new RegExp(`\\b${name}\\b`).test(text)

const readme = read('README.md')
for (const m of methods) if (!mentions(readme, m)) problems.push(`README.md does not mention ${m}()`)

const changelog = read('CHANGELOG.md')
if (!changelog.includes(`## ${pkg.version} (`)) problems.push(`CHANGELOG.md has no "## ${pkg.version} (date)" entry`)

const web = path.join(root, '..', 'frontend', 'src', 'pages', 'docs', 'javascript.tsx')
if (existsSync(web)) {
  const page = readFileSync(web, 'utf8')
  for (const m of methods) if (!mentions(page, m)) problems.push(`the website's /docs/javascript does not mention ${m}()`)
  const minor = pkg.version.split('.').slice(0, 2).join('.')
  if (!page.includes(minor)) problems.push(`the website's /docs/javascript does not mention version ${minor}`)
} else {
  console.log('check-docs: no website here (public repo); README and CHANGELOG checked only')
}

if (problems.length) {
  console.error('check-docs: the docs lag the code:\n  - ' + problems.join('\n  - '))
  process.exit(1)
}
console.log(`check-docs: ${methods.size} methods documented, CHANGELOG has ${pkg.version}`)
