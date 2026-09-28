// 검수용 표(CSV) 만들기 — 구글 시트로 올려 검수자에게 준다.
// 사용법 (저장소 루트): node tools/wiki/make-review-csv.js washerwoman chef ... > 검수.csv
//
// 칸: 캐릭터 | 구역 | 번호 | 영어 원문 | 번역 | 검수 의견
// 영어 원문(tools/wiki/src)과 번역(public/guide/data/chars)을 같은 순서로 한 줄씩 짝지어 넣는다.
// {c:id}는 사람이 읽기 쉽게 영어 쪽은 영어 이름, 번역 쪽은 정발 이름으로 바꿔 넣는다.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const roles = JSON.parse(fs.readFileSync(path.join(root, "public", "guide", "data", "roles.json"), "utf8"));

// 영어 이름: 여러 단어로 된 이름만 따로 적고, 나머지는 id 첫 글자를 대문자로.
const EN_NAMES = {
    fortuneteller: "Fortune Teller",
    scarletwoman: "Scarlet Woman",
    towncrier: "Town Crier",
    snakecharmer: "Snake Charmer",
    eviltwin: "Evil Twin",
    pithag: "Pit-Hag",
    tealady: "Tea Lady",
    villageidiot: "Village Idiot",
    bountyhunter: "Bounty Hunter",
    cultleader: "Cult Leader",
    plaguedoctor: "Plague Doctor",
    devilsadvocate: "Devil's Advocate",
    organgrinder: "Organ Grinder",
    poppygrower: "Poppy Grower",
    nightwatchman: "Nightwatchman",
    lordoftyphon: "Lord of Typhon",
    fanggu: "Fang Gu",
    nodashii: "No Dashii",
    lilmonsta: "Lil' Monsta",
    alhadikhia: "Al-Hadikhia",
    highpriestess: "High Priestess",
    hellslibrarian: "Hell's Librarian",
    boomdandy: "Boomdandy",
    flowergirl: "Flowergirl"
};

function enName(id) {
    return EN_NAMES[id] || (id.charAt(0).toUpperCase() + id.slice(1));
}

function plain(text, lang, self) {
    return text
        .replace(/\{ability\}/g, lang === "ko" && roles[self] ? roles[self].ability : "{ability}")
        .replace(/\{c:([a-z_]+)\}/g, (all, id) => (
            lang === "en" ? enName(id) : (roles[id] ? roles[id].name : id)
        ));
}

function lines(guide) {
    const out = [];
    guide.sections.forEach((section) => {
        out.push({ area: section.key, text: section.title });
        section.blocks.forEach((block) => {
            const kind = Object.keys(block)[0];
            const value = block[kind];
            (Array.isArray(value) ? value : [value]).forEach((text) => {
                out.push({ area: section.key, text });
            });
        });
    });
    return out;
}

function csvCell(text) {
    return "\"" + String(text).replace(/"/g, "\"\"") + "\"";
}

const ids = process.argv.slice(2);
if (!ids.length) {
    console.error("캐릭터 id를 하나 이상 적어 주세요. 예: node tools/wiki/make-review-csv.js washerwoman");
    process.exit(1);
}

const rows = [["캐릭터", "구역", "번호", "영어 원문", "번역", "검수 의견"]];

ids.forEach((id) => {
    const en = lines(JSON.parse(fs.readFileSync(path.join(root, "tools", "wiki", "src", id + ".json"), "utf8")));
    const ko = lines(JSON.parse(fs.readFileSync(path.join(root, "public", "guide", "data", "chars", id + ".json"), "utf8")));
    if (en.length !== ko.length) {
        console.error(`FAIL ${id}: 원문 ${en.length}줄 / 번역 ${ko.length}줄 — 칸 구조를 먼저 맞추세요`);
        process.exit(1);
    }
    const name = roles[id] ? roles[id].name : id;
    en.forEach((line, index) => {
        rows.push([name, line.area, index + 1, plain(line.text, "en", id), plain(ko[index].text, "ko", id), ""]);
    });
});

process.stdout.write(rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
