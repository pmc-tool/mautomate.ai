// Parameterized upload (medusa exec): THEME_ZIP env selects the zip.
const AdmZip = require("/home/ratul/foreverfinds/node_modules/adm-zip")
const { validateTheme } = require("/home/ratul/brandtodoor/apps/backend/.medusa/server/src/modules/theme/lib/validator.js")

const TEXT_EXT = /\.(liquid|css|js|json|txt|map|svg)$/i
const CT = { ".css":"text/css",".js":"application/javascript",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".gif":"image/gif",".webp":"image/webp",".avif":"image/avif",".ico":"image/x-icon",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".otf":"font/otf" }
const THEME_MODULE = "theme"

module.exports.default = async function ({ container }) {
  const zipPath = process.env.THEME_ZIP
  if (!zipPath) { console.log("THEME_ZIP env missing"); return }
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries().filter(e=>!e.isDirectory).map(e=>({ path:e.entryName, size:e.header.size, content:e.getData() }))
  const { ok, manifest, violations } = validateTheme(entries)
  if (!ok || !manifest) { console.log("VALIDATION FAILED", JSON.stringify(violations.filter(v=>v.level==="error"))); return }

  const svc = container.resolve(THEME_MODULE)
  const existing = await svc.listThemes({ handle: manifest.id })
  let theme = existing && existing[0]
  if (!theme) {
    theme = (await svc.createThemes([{ handle:manifest.id, name:manifest.name, author:manifest.author??null, description:manifest.description??null, status:"draft", visibility:"public", uploaded_by:null }]))[0]
    console.log("created theme row", theme.id)
  } else { console.log("theme row exists", theme.id) }

  const dupe = await svc.listThemeVersions({ theme_id:theme.id, version:manifest.version })
  if (dupe && dupe.length) { console.log("VERSION EXISTS — skipping version create:", manifest.version); }
  else {
    const previewFile = entries.find(f=>f.path==="preview.png")
    const version = (await svc.createThemeVersions([{ theme_id:theme.id, version:manifest.version, manifest, warnings:violations.filter(v=>v.level==="warning"), preview: previewFile?("data:image/png;base64,"+previewFile.content.toString("base64")):null, size_bytes:entries.reduce((n,f)=>n+f.size,0), file_count:entries.length, uploaded_by:null }]))[0]
    await svc.createThemeFiles(entries.map(f=>{ const ext=f.path.slice(f.path.lastIndexOf(".")); const isText=TEXT_EXT.test(f.path); return { theme_version_id:version.id, path:f.path, kind:isText?"text":"binary", content:isText?f.content.toString("utf8"):f.content.toString("base64"), content_type:CT[ext]??"application/octet-stream", size_bytes:f.size } }))
    console.log("created version", version.id, "with", entries.length, "files")
  }

  await svc.updateThemes([{ id:theme.id, current_version:manifest.version, name:manifest.name, status:"published" }])
  console.log("DONE — theme", manifest.id, "published at version", manifest.version)
}
