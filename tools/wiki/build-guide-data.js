// 캐릭터 가이드(공식 위키 번역) 데이터 생성·점검 도구
// 사용법 (Codespace 터미널, 저장소 루트): node tools/wiki/build-guide-data.js
//
// 하는 일
//  1. public/guide/data/roles.json 생성
//     - tools/official-master.json(정발 기준)에서 이름·유형·능력·대사를 가져온다.
//     - id는 앱 id로 맞춘다 (마스터 "washerwoman1" → 앱 "washerwoman").
//     - 앱 DB(docs/data/characters.json)에 없는 id는 넣지 않는다.
//  1-2. public/guide/data/jinxes.json 생성 — 앱의 정발 징크스(docs/data/jinx.json)를 캐릭터별로
//     양쪽 모두에 모아 둔다. 가이드의 "관련 징크스" 칸에 쓴다 (위키 징크스 표 대신).
//  2. public/guide/data/index.json 생성 — 번역이 있는 캐릭터 id 목록.
//     뽑기 화면(claim.html)이 이 목록을 보고 가이드 버튼을 보여줄지 정한다.
//  3. 점검 (하나라도 FAIL이면 종료 코드 1)
//     - 번역 파일의 {c:id}가 roles.json에 모두 있는가
//     - 번역 파일과 영어 원문(tools/wiki/src)의 칸 구조가 같은가
//
// 여러 번 실행해도 결과가 같다 (C-7).

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const masterPath = path.join(root, "tools", "official-master.json");
const appDataPath = path.join(root, "docs", "data", "characters.json");
const srcDir = path.join(root, "tools", "wiki", "src");
const dataDir = path.join(root, "public", "guide", "data");
const charsDir = path.join(dataDir, "chars");

const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
const appIds = new Set(JSON.parse(fs.readFileSync(appDataPath, "utf8")).map((c) => c.id));

// 1. roles.json
const roles = {};
master.forEach((entry) => {
    if (entry.id === "_meta") {
        return;
    }
    const id = entry.id.replace(/1$/, "");
    if (!appIds.has(id)) {
        return;
    }
    roles[id] = {
        name: entry.name,
        team: entry.team,
        ability: entry.ability || "",
        flavor: entry.flavor || ""
    };
});
fs.writeFileSync(path.join(dataDir, "roles.json"), JSON.stringify(roles) + "\n");
console.log(`roles.json: 캐릭터 ${Object.keys(roles).length}개`);

// 1-2. jinxes.json
const jinxSource = JSON.parse(fs.readFileSync(path.join(root, "docs", "data", "jinx.json"), "utf8"));
const jinxes = {};
function addJinx(a, b, reason) {
    if (!roles[a] || !roles[b]) {
        return;
    }
    (jinxes[a] = jinxes[a] || []).push({ with: b, reason });
}
jinxSource.forEach((entry) => {
    (entry.jinx || []).forEach((pair) => {
        addJinx(entry.id, pair.id, pair.reason);
        addJinx(pair.id, entry.id, pair.reason);
    });
});
Object.keys(jinxes).forEach((id) => jinxes[id].sort((x, y) => x.with.localeCompare(y.with)));
fs.writeFileSync(path.join(dataDir, "jinxes.json"), JSON.stringify(jinxes) + "\n");
console.log(`jinxes.json: 징크스가 있는 캐릭터 ${Object.keys(jinxes).length}개`);

// 2. index.json
const guides = fs.readdirSync(charsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort();
fs.writeFileSync(path.join(dataDir, "index.json"), JSON.stringify(guides) + "\n");
console.log(`index.json: 번역 ${guides.length}개 (${guides.join(", ")})`);

// 3. 점검
function shape(guide) {
    return guide.sections.map((section) => section.key + ":" + section.blocks.map((block) => {
        const kind = Object.keys(block)[0];
        return kind + (Array.isArray(block[kind]) ? block[kind].length : "");
    }).join(","));
}

let failed = 0;

guides.forEach((id) => {
    const ko = JSON.parse(fs.readFileSync(path.join(charsDir, id + ".json"), "utf8"));
    const problems = [];

    if (!roles[id]) {
        problems.push("roles.json에 이 캐릭터가 없음");
    }

    const unknown = (JSON.stringify(ko).match(/\{c:([a-z_]+)\}/g) || [])
        .map((mark) => mark.slice(3, -1))
        .filter((roleId) => !roles[roleId]);
    if (unknown.length) {
        problems.push("모르는 캐릭터 표시: " + Array.from(new Set(unknown)).join(", "));
    }

    const srcPath = path.join(srcDir, id + ".json");
    if (!fs.existsSync(srcPath)) {
        problems.push("영어 원문 없음 (tools/wiki/src/" + id + ".json)");
    } else {
        const en = JSON.parse(fs.readFileSync(srcPath, "utf8"));
        if (JSON.stringify(shape(en)) !== JSON.stringify(shape(ko))) {
            problems.push("원문과 칸 구조가 다름");
        }
        if (en.source.oldid !== ko.source.oldid) {
            problems.push(`판번호 다름 (원문 ${en.source.oldid} / 번역 ${ko.source.oldid})`);
        }
    }

    if (problems.length) {
        failed += 1;
        console.log(`FAIL ${id}: ${problems.join(" / ")}`);
    } else {
        console.log(`OK   ${id}`);
    }
});

process.exitCode = failed ? 1 : 0;
