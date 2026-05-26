const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "quotes.js");
const out = path.join(__dirname, "..", "android", "app", "src", "main", "assets", "quotes.json");

const content = fs.readFileSync(src, "utf8");
const match = content.match(/const QUOTES = (\[[\s\S]*\]);/);
if (!match) {
  console.error("无法解析 quotes.js");
  process.exit(1);
}

const quotes = eval(match[1]);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(quotes));
console.log(`已导出 ${quotes.length} 条语录 -> ${out}`);
