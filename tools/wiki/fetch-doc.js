// 위키 일반 문서 원문 수집 도구 — 캐릭터가 아닌 문서(용어집·이야기꾼 조언 등)를 받아
// tools/wiki/src-pages/<키>.json 으로 정리한다. 번역은 public/guide/data/pages/<키>.json 에 같은 칸 구조로 쓴다.
// 위키는 일반 문서 주소를 자동 요청에 418로 막으므로 MediaWiki API(api.php)로 위키텍스트와 판번호를 받는다.
// 사용법 (저장소 루트): node tools/wiki/fetch-doc.js glossary changelog ...
//   이미 있는 원문은 건너뛴다(SKIP). 다시 받으려면 --force 를 붙인다.
//
// 정리 규칙
//  - 섹션: 위키 제목(= … =) 단위. level은 문서 안에서 가장 큰 제목을 1로 맞춘 단계. 첫 제목 앞 글은 제목 없는 섹션.
//  - 블록: 빈 줄로 나뉜 문단 → { p }, 연속된 * 항목 → { ul: [...] }. ** 하위 항목이 있으면 그 항목은 { t, ul: [...] }
//  - {{Good|Butler}} 같은 캐릭터 틀 → {c:butler} (영문자만 남겨 소문자)
//  - '''굵게''' → **굵게**, ''기울임'' → __기울임__ (능력 문구의 * 표시와 헷갈리지 않게)
//  - [[문서|글자]] → [글자](wiki:문서), [https://주소 글자] → [글자](https://주소)

const fs = require("fs");
const path = require("path");
const https = require("https");

const root = path.resolve(__dirname, "..", "..");
const outDir = path.join(root, "tools", "wiki", "src-pages");
const API = "https://wiki.bloodontheclocktower.com/api.php";

// 키 → 위키 문서 이름
const PAGES = {
    "glossary": "Glossary",
    "storyteller-advice": "Storyteller_Advice",
    "player-strategy": "Player_Strategy",
    "changelog": "Changelog"
};

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "pocket-grimoire-ko wiki translation tool" } }, (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => { body += chunk; });
            response.on("end", () => {
                if (response.statusCode !== 200) {
                    reject(new Error(url + " " + response.statusCode));
                    return;
                }
                resolve(body);
            });
        }).on("error", reject);
    });
}

function inline(text) {
    return text
        .replace(/<br\s*\/?>/g, " ")
        .replace(/\{\{\s*(?:Good|Evil|Traveler|Traveller|Fabled|Loric)\s*\|([^|}]+)\|?\s*\}\}/g, (all, name) => (
            "{c:" + name.toLowerCase().replace(/[^a-z]/g, "") + "}"
        ))
        .replace(/'''(.+?)'''/g, "**$1**")
        .replace(/''(.+?)''/g, "__$1__")
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (all, page, label) => "[" + label + "](wiki:" + page.trim().replace(/ /g, "_") + ")")
        .replace(/\[\[([^\]|]+)\]\]/g, (all, page) => "[" + page + "](wiki:" + page.trim().replace(/ /g, "_") + ")")
        .replace(/\[(https?:\/\/\S+)\s+([^\]]+)\]/g, "[$2]($1)")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parse(key, wikitext, oldid) {
    const lines = wikitext
        .replace(/\{\{TOClimit\|\d+\}\}/g, "")
        .replace(/__[A-Z]+__/g, "")
        .split("\n");
    const headings = lines.map((line) => line.match(/^(=+)\s*(.+?)\s*=+\s*$/)).filter(Boolean);
    const top = headings.length ? Math.min.apply(null, headings.map((m) => m[1].length)) : 1;
    const sections = [];
    const used = {};
    let section = { key: "intro", level: 0, title: "", blocks: [] };
    let paragraph = [];

    function flush() {
        const text = inline(paragraph.join(" "));
        if (text) {
            section.blocks.push({ p: text });
        }
        paragraph = [];
    }

    lines.forEach((line) => {
        const heading = line.match(/^(=+)\s*(.+?)\s*=+\s*$/);
        if (heading) {
            flush();
            if (section.blocks.length || section.title) {
                sections.push(section);
            }
            const title = inline(heading[2]);
            let slug = title.toLowerCase().replace(/\{c:([a-z]+)\}/g, "$1").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
            used[slug] = (used[slug] || 0) + 1;
            if (used[slug] > 1) {
                slug += "-" + used[slug];
            }
            section = { key: slug, level: heading[1].length - top + 1, title: title, blocks: [] };
            return;
        }
        const item = line.match(/^(\*+)\s*(.*)$/);
        if (item) {
            flush();
            let list = section.blocks[section.blocks.length - 1];
            if (!list || !list.ul) {
                list = { ul: [] };
                section.blocks.push(list);
            }
            if (item[1].length === 1) {
                list.ul.push(inline(item[2]));
            } else {
                const last = list.ul.length - 1;
                if (typeof list.ul[last] === "string") {
                    list.ul[last] = { t: list.ul[last], ul: [] };
                }
                list.ul[last].ul.push(inline(item[2]));
            }
            return;
        }
        if (!line.trim() || /^<\/?div/.test(line.trim())) {
            flush();
            return;
        }
        paragraph.push(line);
    });
    flush();
    if (section.blocks.length || section.title) {
        sections.push(section);
    }
    return { id: key, source: { page: PAGES[key], oldid: oldid }, sections: sections };
}

const force = process.argv.includes("--force");
const keys = process.argv.slice(2).filter((arg) => arg !== "--force");
if (!keys.length) {
    console.log("사용법: node tools/wiki/fetch-doc.js <키> ...  (키: " + Object.keys(PAGES).join(", ") + ")");
    process.exit(1);
}

keys.reduce((chain, key) => chain.then(() => {
    if (!PAGES[key]) {
        console.log("FAIL " + key + ": 모르는 키");
        return null;
    }
    const file = path.join(outDir, key + ".json");
    if (fs.existsSync(file) && !force) {
        console.log("SKIP " + key + " (이미 있음)");
        return null;
    }
    return get(API + "?action=parse&page=" + encodeURIComponent(PAGES[key]) + "&prop=wikitext%7Crevid&format=json")
        .then((body) => {
            const data = JSON.parse(body).parse;
            const doc = parse(key, data.wikitext["*"], data.revid);
            fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
            const blocks = doc.sections.reduce((sum, s) => sum + s.blocks.length, 0);
            console.log("OK   " + key + ": 판 " + data.revid + " / 섹션 " + doc.sections.length + " / 블록 " + blocks);
        })
        .catch((error) => {
            console.log("FAIL " + key + ": " + error.message);
        });
}), Promise.resolve());
