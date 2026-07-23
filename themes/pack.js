const AdmZip = require("/home/ratul/foreverfinds/node_modules/adm-zip")
const fs = require("fs")
const path = require("path")
const root = "/tmp/learts-liquid"
const zip = new AdmZip()
function walk(dir, base) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue
    const full = path.join(dir, name)
    const rel = base ? base + "/" + name : name
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, rel)
    else zip.addFile(rel, fs.readFileSync(full))
  }
}
walk(root, "")
zip.writeZip("/tmp/learts-liquid.zip")
const entries = zip.getEntries().map(e => e.entryName).sort()
console.log("packed", entries.length, "entries")
console.log(entries.join("\n"))
