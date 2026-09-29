// 공식 징크스 적용 도구 — 위키 원문(tools/wiki/jinx-src.json)과 한국어 원고(tools/wiki/jinx-ko/<묶음>.json)를
// 앱 데이터 assets/data/jinx.json(영어 뼈대)·assets/data/jinxes/ko_KR.json(한국어)에 묶음 단위로 반영한다.
// 사용법 (저장소 루트): node tools/wiki/apply-jinx.js tb
//
// 묶음: tb / bmr / snv / exp — 징크스 쌍의 두 캐릭터 중 "앞선" 에디션으로 나눈다 (tb < bmr < snv < 실험).
//   캐릭터 에디션은 assets/data/characters.json 의 edition 값 (빈칸 = 실험 캐릭터).
//
// 반영 규칙 (해당 묶음의 쌍만 건드린다)
//  - 위키에 있는 쌍: 영어 문구를 위키 원문으로 교체(없으면 추가), 한국어는 원고로 교체(없으면 추가)
//  - 위키에 없는 쌍(공식에서 삭제됨): 영어·한국어 모두 삭제 → DB에서도 지우려면 bash setup.sh --reset-db (함정 ⑨)
//  - 두 캐릭터의 앞뒤(target/trick)는 영어 뼈대 기준으로 한국어를 맞춘다.
//    뼈대에 없는 새 쌍은 옛 한국어 파일의 방향 → 없으면 위키에 적힌 순서를 쓴다.
//    (방향이 어긋나면 import 때 번역이 연결되지 않아 영어로 나온다 — 2026-09-29 확인)
//
// 한국어 원고 형식: [ { "pair": "baron-heretic", "ko": "..." } ]  (pair = 두 id를 알파벳순으로 "-" 연결)
// 여러 번 실행해도 안전하다 (이미 같으면 SKIP).

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const group = process.argv[2];
const RANK = { tb: 0, bmr: 1, snv: 2, exp: 3 };

if (!(group in RANK)) {
    console.error("사용법: node tools/wiki/apply-jinx.js <tb|bmr|snv|exp>");
    process.exit(1);
}

const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const write = (file, data, indent) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, indent) + "\n");
const pairKey = (a, b) => [a, b].sort().join("-");

const editions = {};
read("assets/data/characters.json").forEach((role) => editions[role.id] = role.edition);
const rankOf = (id) => (editions[id] in RANK) ? RANK[editions[id]] : RANK.exp;
const inGroup = (a, b) => Math.min(rankOf(a), rankOf(b)) === RANK[group];

const source = read("tools/wiki/jinx-src.json");
const draftFile = "tools/wiki/jinx-ko/" + group + ".json";
const drafts = new Map(read(draftFile).map(({ pair, ko }) => [pair, ko]));
const english = read("assets/data/jinx.json");
const korean = read("assets/data/jinxes/ko_KR.json");

// 영어 뼈대의 현재 방향: "a-b" → [target, trick]
const direction = new Map();
english.forEach((target) => target.jinx.forEach((trick) => direction.set(pairKey(target.id, trick.id), [target.id, trick.id])));
korean.forEach(({ target, trick }) => {
    if (!direction.has(pairKey(target, trick))) {
        direction.set(pairKey(target, trick), [target, trick]);
    }
});

const wiki = new Map(source.jinxes.filter(({ a, b }) => inGroup(a, b)).map((jinx) => [pairKey(jinx.a, jinx.b), jinx]));
let fail = 0;
const report = [];

// 1. 원고 점검 — 묶음의 모든 쌍에 한국어가 있어야 하고, 묶음 밖 쌍이 섞이면 안 된다.
wiki.forEach((jinx, key) => {
    if (!drafts.has(key)) {
        report.push("FAIL 원고 없음 " + key);
        fail++;
    }
});
drafts.forEach((ko, key) => {
    if (!wiki.has(key)) {
        report.push("FAIL 묶음에 없는 원고 " + key);
        fail++;
    }
});
if (fail) {
    report.forEach((line) => console.log(line));
    process.exit(1);
}

// 2. 영어 뼈대
const findTrick = (targetId, trickId) => {
    const target = english.find((entry) => entry.id === targetId);
    return target && target.jinx.find((entry) => entry.id === trickId);
};
wiki.forEach((jinx, key) => {
    const [targetId, trickId] = direction.get(key) || [jinx.a, jinx.b];
    direction.set(key, [targetId, trickId]);
    const trick = findTrick(targetId, trickId);
    if (trick && trick.reason === jinx.reason) {
        report.push("SKIP 영어 " + key);
    } else if (trick) {
        trick.reason = jinx.reason;
        report.push("OK   영어 교체 " + key);
    } else {
        let target = english.find((entry) => entry.id === targetId);
        if (!target) {
            target = { id: targetId, jinx: [] };
            english.push(target);
        }
        target.jinx.push({ id: trickId, reason: jinx.reason });
        report.push("OK   영어 추가 " + key);
    }
});
english.forEach((target) => {
    target.jinx = target.jinx.filter((trick) => {
        const key = pairKey(target.id, trick.id);
        if (inGroup(target.id, trick.id) && !wiki.has(key)) {
            report.push("OK   영어 삭제(공식에서 삭제됨) " + key);
            return false;
        }
        return true;
    });
});
const englishOut = english.filter((target) => target.jinx.length);

// 3. 한국어
const koreanOut = korean.filter(({ target, trick }) => {
    const key = pairKey(target, trick);
    if (!inGroup(target, trick)) {
        return true;
    }
    if (!wiki.has(key)) {
        report.push("OK   한국어 삭제(공식에서 삭제됨) " + key);
    }
    return false;
});
wiki.forEach((jinx, key) => {
    const [target, trick] = direction.get(key);
    const before = korean.find((entry) => pairKey(entry.target, entry.trick) === key);
    const after = { target, trick, reason: drafts.get(key) };
    koreanOut.push(after);
    if (before && before.target === target && before.trick === trick && before.reason === after.reason) {
        report.push("SKIP 한국어 " + key);
    } else {
        report.push("OK   한국어 " + (before ? "교체" : "추가") + " " + key);
    }
});
koreanOut.sort((x, y) => x.target.localeCompare(y.target) || x.trick.localeCompare(y.trick));

write("assets/data/jinx.json", englishOut, 2);
write("assets/data/jinxes/ko_KR.json", koreanOut, 4);
report.forEach((line) => console.log(line));
console.log(`\n${group}: 위키 ${wiki.size}쌍 반영 / 앱 전체 영어 ${englishOut.reduce((n, t) => n + t.jinx.length, 0)}쌍 · 한국어 ${koreanOut.length}쌍`);
