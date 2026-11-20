// 시트 그림을 PG+ 저장소에 내장: 외부 그림 받아 webp로 → 시트 주소 교체. 여러 번 실행해도 안전.
// 사용: node tools/patch-selfhost-images.js <시트파일.json> <로고키> [원본 script.json]
// 원본 script.json을 주면 시트에 없는 image를 그 파일에서 가져온다(id로 대조).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = 'https://castleq.github.io/pocket-grimoire';
const [sheetPath, logoKey, srcPath] = process.argv.slice(2);
const root = path.join(__dirname, '..');
const sheet = JSON.parse(fs.readFileSync(sheetPath, 'utf8'));
const src = srcPath ? JSON.parse(fs.readFileSync(srcPath, 'utf8')) : [];
const srcById = new Map(src.filter((c) => c && c.id).map((c) => [c.id, c]));
const tmp = fs.mkdtempSync('/tmp/selfhost-');
let fail = 0;

function save(url, out, resize) {
    if (url.startsWith(BASE)) return url;
    const file = path.join(root, 'public', out);
    const live = `${BASE}/${out}`;
    if (fs.existsSync(file)) { console.log('SKIP', out); return live; }
    const raw = path.join(tmp, path.basename(out) + '.src');
    try {
        execFileSync('curl', ['-sSfL', '-m', '30', '-o', raw, url]);
        execFileSync('convert', [raw, '-resize', resize, '-quality', '85', file]);
        console.log('OK  ', out);
        return live;
    } catch (e) {
        console.log('FAIL', out, url);
        fail += 1;
        return url;
    }
}

for (const c of sheet) {
    if (!c || typeof c !== 'object') continue;
    if (c.id === '_meta') {
        if (c.logo) c.logo = save(c.logo, `guide/img/logo_${logoKey}.webp`, '540x540>');
        continue;
    }
    let imgs = [].concat(c.image || []);
    if (!imgs.length && srcById.has(c.id)) imgs = [].concat(srcById.get(c.id).image || []);
    if (!imgs.length) continue;
    const done = imgs.map((u, i) => save(u, `img/official/${c.id}_${i}.webp`, '400x400'));
    c.image = typeof c.image === 'string' ? done[0] : done;
}

// 원본 들여쓰기 유지
const indent = (fs.readFileSync(sheetPath, 'utf8').match(/\n( +|\t)\S/) || [, '  '])[1];
fs.writeFileSync(sheetPath, JSON.stringify(sheet, null, indent) + '\n');
fs.rmSync(tmp, { recursive: true });
console.log(fail ? `FAIL ${fail}건` : '전부 완료');
process.exit(fail ? 1 : 0);
