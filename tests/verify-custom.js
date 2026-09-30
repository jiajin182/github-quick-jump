// 自定义地址逻辑的断言测试：node tests/verify-custom.js
// 取出 content.js 中 'use strict' 到 buildWidget 之间的纯逻辑段求值，避免依赖 DOM。
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const slice = src.slice(src.indexOf("'use strict';"), src.indexOf('function buildWidget'));
const ctx = new Function(
  slice +
    '; return { SERVICES, sanitizeCustom, activeServices, currentServiceId, setCustom: (v) => { customServices = v; } };'
)();

let failed = 0;
const check = (ok, msg) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
};

// 模板 URL 能否被 new URL 接受（占位符含花括号）
check(ctx.sanitizeCustom([{ label: 'A', template: 'https://example.com/{owner}/{repo}' }]).length === 1,
  'new URL 接受含 {owner}/{repo} 的模板');

// 基本过滤
const dirty = [
  { label: '  Trim Me  ', desc: '  看依赖  ', template: '  https://example.com/{owner}/{repo}  ' },
  { label: '', template: 'https://a.com/{repo}' },
  { label: 'NoTemplate', template: '' },
  { label: 'BadScheme', template: 'ftp://a.com/{repo}' },
  { label: 'Relative', template: '/{owner}/{repo}' },
  { label: 'JsUrl', template: 'javascript:alert(1)' },
  null,
  'not-an-object',
  { label: 'NoPlaceholder', template: 'https://dash.example.com' }
];
const cleaned = ctx.sanitizeCustom(dirty);
check(cleaned.length === 2, `脏数据过滤后剩 2 条（实际 ${cleaned.length}）`);
check(cleaned[0].label === 'Trim Me', 'label 已 trim');
check(cleaned[0].desc === '看依赖', 'desc 已 trim');
check(cleaned[1].label === 'NoPlaceholder', '无占位符的静态地址保留');
check(ctx.sanitizeCustom(null).length === 0, 'null -> []');
check(ctx.sanitizeCustom('x').length === 0, '非数组 -> []');

// id 唯一
const ids = cleaned.map((s) => s.id);
check(new Set(ids).size === ids.length, '自定义项 id 唯一');

// 模板替换
const custom = ctx.sanitizeCustom([
  { label: 'MyTool', desc: '看依赖图', template: 'https://example.com/{owner}/{repo}' },
  { label: 'Static', template: 'https://dash.example.com' }
]);
check(custom[0].url('vuejs', 'core') === 'https://example.com/vuejs/core', '模板替换 owner/repo');
check(custom[0].url('my org', 'my/repo') === 'https://example.com/my%20org/my%2Frepo', '占位符做了 URL 编码');
check(custom[1].url('vuejs', 'core') === 'https://dash.example.com', '静态地址不受占位符影响');

// activeServices 合并顺序：内置在前，自定义在后
ctx.setCustom([]);
check(ctx.activeServices().length === 7, `无自定义时 7 项（实际 ${ctx.activeServices().length}）`);
ctx.setCustom(custom);
const merged = ctx.activeServices();
check(merged.length === 9, `有 2 条自定义时 9 项（实际 ${merged.length}）`);
check(merged[7].label === 'MyTool' && merged[8].label === 'Static', '自定义项追加在内置项之后');
check(merged[0].id === 'gitdiagram' && merged[6].id === 'github', '内置 7 项顺序不变');
check(merged[7].custom === true && merged[0].custom === undefined, '仅自定义项带 custom 标记');

// 自定义项不参与「当前」判定
for (const host of ['github.com', 'deepwiki.com', 'stackblitz.com']) {
  const current = ctx.currentServiceId(host);
  check(!custom.some((s) => s.id === current), `${host} 的「当前」项不是自定义项`);
}

console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);