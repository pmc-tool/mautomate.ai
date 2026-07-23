// Parameterized pack: THEME_DIR=/home/ratul/theme-dev/<x>-liquid node pack2.js
const AdmZip = require("/home/ratul/foreverfinds/node_modules/adm-zip")
const fs = require("fs")
const path = require("path")
const root = process.env.THEME_DIR
if (!root || !fs.existsSync(root)) { console.error("THEME_DIR missing/not found:", root); process.exit(1) }
const out = process.env.THEME_ZIP || (root.replace(/\/+$/, "") + ".zip")
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
zip.writeZip(out)
console.log("packed", zip.getEntries().length, "entries ->", out)
