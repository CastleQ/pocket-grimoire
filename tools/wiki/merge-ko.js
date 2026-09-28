// 번역 본문 합치기 — 번역 본문(sections)만 적은 파일에 원문의 판 정보·아티스트·팟캐스트를 붙여
// public/guide/data/chars/<id>.json 을 만든다. 메타데이터를 손으로 옮겨 적다 틀리는 일을 막는다.
// 사용법 (저장소 루트): node tools/wiki/merge-ko.js <판> <번역본문.json> ...
//   번역본문.json 형식: { "id": "chef", "sections": [ ...원문과 같은 칸 구조... ] }
//   <판>: tb / bmr / snv 등 (guide.html 의 EDITIONS 키)

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const [edition, ...files] = process.argv.slice(2);

if (!edition || !files.length) {
    console.error("사용법: node tools/wiki/merge-ko.js <판> <번역본문.json> ...");
    process.exit(1);
}

files.forEach((file) => {
    const ko = JSON.parse(fs.readFileSync(file, "utf8"));
    const src = JSON.parse(fs.readFileSync(path.join(root, "tools", "wiki", "src", ko.id + ".json"), "utf8"));
    const out = {
        id: ko.id,
        source: src.source,
        artist: src.artist,
        edition,
        podcast: src.podcast || null,
        sections: ko.sections
    };
    if (!out.podcast) {
        delete out.podcast;
    }
    fs.writeFileSync(path.join(root, "public", "guide", "data", "chars", ko.id + ".json"), JSON.stringify(out, null, 4) + "\n");
    console.log("OK   " + ko.id);
});
