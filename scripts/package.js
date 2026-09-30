// 生成 Chrome 网上应用店(zip)的打包脚本。
// 纯 node 实现，无第三方依赖：手写 ZIP（deflate + CRC32），只打包商店运行所需的文件。
//
// 用法：
//   node scripts/package.js
// 产物：
//   dist/github-quick-jump.zip
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'github-quick-jump.zip');

// 商店 zip 只需要扩展运行所需的文件；README/LICENSE/隐私/文档/测试都排除。
const FILES = [
  'manifest.json',
  'content.js',
  'options.html',
  'options.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

// ---- CRC32（标准查表法，npm/zlib 不内置就要自己算）----
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- 最小 ZIP 写入 ----
const chunks = [];
const central = [];
let offset = 0;
let centralSize = 0;

function pushLocal(name, data) {
  const compressed = zlib.deflateRawSync(data);
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(8, 6); // method = deflate
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28); // extra length

  chunks.push(local, nameBuf, compressed);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); // central dir signature
  entry.writeUInt16LE(20, 4); // version made by
  entry.writeUInt16LE(20, 6); // version needed
  entry.writeUInt16LE(8, 10); // method
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(compressed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(nameBuf.length, 28);
  entry.writeUInt16LE(0, 30); // extra length
  entry.writeUInt16LE(0, 32); // comment length
  entry.writeUInt32LE(0, 34); // disk number start
  entry.writeUInt32LE(offset, 42); // local header offset
  central.push(entry, nameBuf);
  centralSize += 46 + nameBuf.length;

  offset += 30 + nameBuf.length + compressed.length;
}

function finishZip() {
  const cdStart = offset;
  for (const c of central) chunks.push(c);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(FILES.length, 8);
  eocd.writeUInt16LE(FILES.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, eocd]);
}

// ---- 收集并校验文件，生成 zip ----
const missing = FILES.filter((f) => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) {
  console.error('缺少文件：\n  ' + missing.join('\n  '));
  process.exit(1);
}

for (const f of FILES) pushLocal(f, fs.readFileSync(path.join(ROOT, f)));

fs.mkdirSync(OUT_DIR, { recursive: true });
const zip = finishZip();
fs.writeFileSync(OUT_FILE, zip);

console.log('写入 ' + OUT_FILE);
console.log('大小：' + (zip.length / 1024).toFixed(1) + ' KB');
console.log('包含：');
for (const f of FILES) {
  const bytes = fs.statSync(path.join(ROOT, f)).size;
  console.log('  - ' + f + ' (' + bytes + ' B)');
}
console.log('\n上传到 Chrome 网上应用店时选择该 zip 即可；隐私政策填写 PRIVACY.md 的公开地址。');