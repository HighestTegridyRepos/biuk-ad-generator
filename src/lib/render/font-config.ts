import path from "path"
import fs from "fs"

let fontConfigured = false
export function ensureFontConfig() {
  if (fontConfigured) return
  fontConfigured = true

  const candidates = [
    path.join(process.cwd(), "src", "fonts"),
    path.join(process.cwd(), "fonts"),
    path.join(process.cwd(), "public"),
    path.join(__dirname, "..", "..", "..", "..", "src", "fonts"),
    path.join(__dirname, "..", "..", "..", "..", "fonts"),
    path.join(__dirname, "fonts"),
    "/tmp/fonts",
  ]

  const tmpFonts = "/tmp/fonts"
  fs.mkdirSync(tmpFonts, { recursive: true })

  for (const dir of candidates) {
    const fontFile = path.join(dir, "Inter-Bold.ttf")
    if (fs.existsSync(fontFile)) {
      const dest = path.join(tmpFonts, "Inter-Bold.ttf")
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(fontFile, dest)
      }
      break
    }
  }

  const fcConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${tmpFonts}</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
  <match target="pattern">
    <test qual="any" name="family"><string>sans-serif</string></test>
    <edit name="family" mode="assign" binding="same"><string>Inter</string></edit>
  </match>
  <match target="pattern">
    <test qual="any" name="family"><string>Inter</string></test>
    <edit name="family" mode="assign" binding="same"><string>Inter</string></edit>
  </match>
</fontconfig>`

  const confPath = "/tmp/fonts.conf"
  fs.writeFileSync(confPath, fcConf)
  fs.mkdirSync("/tmp/fontconfig-cache", { recursive: true })

  process.env.FONTCONFIG_FILE = confPath
  process.env.FONTCONFIG_PATH = "/tmp"
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
