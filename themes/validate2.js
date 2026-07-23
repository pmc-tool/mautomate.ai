// Parameterized validate: THEME_ZIP=/home/ratul/theme-dev/<x>-liquid.zip node validate2.js
const AdmZip = require("/home/ratul/foreverfinds/node_modules/adm-zip")
const { validateTheme } = require("/home/ratul/brandtodoor/apps/backend/.medusa/server/src/modules/theme/lib/validator.js")
const zipPath = process.env.THEME_ZIP
if (!zipPath) { console.error("THEME_ZIP missing"); process.exit(1) }
const zip = new AdmZip(zipPath)
const files = zip.getEntries().filter(e => !e.isDirectory).map(e => ({
  path: e.entryName, size: e.header.size, content: e.getData()
}))
const res = validateTheme(files)
console.log("OK:", res.ok)
console.log("manifest id/name/version:", res.manifest && res.manifest.id, "/", res.manifest && res.manifest.name, "/", res.manifest && res.manifest.version)
const errs = res.violations.filter(v => v.level === "error")
const warns = res.violations.filter(v => v.level === "warning")
console.log("ERRORS (" + errs.length + "):")
errs.forEach(v => console.log("  [" + (v.path||"-") + (v.line?":"+v.line:"") + "] " + v.message))
console.log("WARNINGS (" + warns.length + "):")
warns.forEach(v => console.log("  [" + (v.path||"-") + "] " + v.message))
process.exit(errs.length ? 2 : 0)
