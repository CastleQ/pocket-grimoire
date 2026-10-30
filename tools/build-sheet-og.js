// 내장 시트마다 링크 미리보기(오픈그래프) 제목만 바꾼 시트 페이지 사본을 굽는다.
// 미리보기 봇은 스크립트를 돌리지 않으므로 시트마다 고정 파일이 필요하다.
//   docs/sheet.html → docs/sheet-<키>.html   (키: 공식 tb/bmr/snv, 그 밖은 manifest 파일 이름)
// 앱의 [시트 공유하기]가 같은 키로 링크를 만든다(sheet-share.js).
// 사용: node tools/build-sheet-og.js   (bake.sh 가 docs/sheet.html 을 만든 뒤 부른다)

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "docs/sheet.html");
const MANIFEST = path.join(ROOT, "public/scripts/manifest.json");
const SUFFIX = " - 캐릭터 시트";

// 공식 3종은 manifest 에 없다. 키는 select-edition.js 의 OFFICIAL_SHEETS value 와 같아야 한다.
const OFFICIAL = [
    { key: "tb", title: "점철되는 혼란" },
    { key: "bmr", title: "피로 물든 달" },
    { key: "snv", title: "화단에 꽃피운 이단" }
];

function escapeAttr(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const html = fs.readFileSync(SOURCE, "utf8");
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const pages = OFFICIAL.slice();
Object.keys(manifest).forEach((group) => {
    manifest[group].forEach((sheet) => {
        if (!/^[a-z0-9-]+\.json$/.test(sheet.file)) {
            throw new Error("파일 이름에 쓸 수 없는 글자: " + sheet.file);
        }
        pages.push({ key: sheet.file.replace(/\.json$/, ""), title: sheet.name });
    });
});

// 치환 앵커가 정확히 한 번씩 있어야 한다(C-7).
const ANCHORS = [
    /<title>[^<]*<\/title>/,
    /<meta property="og:title" content="[^"]*">/,
    /<meta name="twitter:title" content="[^"]*">/
];
ANCHORS.forEach((anchor) => {
    const count = html.split(new RegExp(anchor.source, "g")).length - 1;
    if (count !== 1) {
        throw new Error("docs/sheet.html 앵커 " + anchor + " 개수 " + count + " (1이어야 함)");
    }
});

fs.readdirSync(path.join(ROOT, "docs"))
    .filter((name) => /^sheet-.+\.html$/.test(name))
    .forEach((name) => fs.unlinkSync(path.join(ROOT, "docs", name)));

pages.forEach(({ key, title }) => {
    const full = escapeAttr(title + SUFFIX);
    const out = html
        .replace(ANCHORS[0], "<title>" + full + "</title>")
        .replace(ANCHORS[1], '<meta property="og:title" content="' + full + '">')
        .replace(ANCHORS[2], '<meta name="twitter:title" content="' + full + '">');
    fs.writeFileSync(path.join(ROOT, "docs", "sheet-" + key + ".html"), out);
});

console.log("   시트 미리보기 페이지 " + pages.length + "개 (docs/sheet-<키>.html)");
