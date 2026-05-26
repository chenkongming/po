/**
 * 将 icons/ 下最新 logo（优先 icon-512.webp）转为 resources/icon.png，
 * 供 @capacitor/assets 生成 Android 启动器图标。
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const iconsDir = path.join(root, "icons");
const outFile = path.join(root, "resources", "icon.png");

const candidates = [
  "icon-512.webp",
  "icon-512.png",
  "icon.png",
  "logo.png",
  "icon-256.webp",
];

async function main() {
  if (!fs.existsSync(iconsDir)) {
    console.error("未找到 icons 目录:", iconsDir);
    process.exit(1);
  }

  const srcName = candidates.find((name) => fs.existsSync(path.join(iconsDir, name)));
  if (!srcName) {
    console.error("icons 目录下未找到 icon-512.webp / icon.png 等源文件");
    process.exit(1);
  }

  const src = path.join(iconsDir, srcName);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  await sharp(src)
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outFile);

  console.log(`已同步: icons/${srcName} -> resources/icon.png (1024x1024)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
