// 위키 원문 수집 도구 — 공식 위키 캐릭터 문서를 받아 tools/wiki/src/<id>.json 으로 정리한다.
// 위키는 일반 문서 주소를 자동 요청에 418로 막으므로, MediaWiki API(api.php)로 본문과 판 정보를 받는다.
// 사용법 (저장소 루트): node tools/wiki/fetch-src.js librarian chef ...
//   이미 있는 원문은 건너뛴다(SKIP). 다시 받으려면 --force 를 붙인다.
//
// 정리 규칙 (번역 파일과 같은 칸 구조)
//  - 섹션: 위키 본문의 h2 제목 단위 (Summary / How to Run / Examples / Tips & Tricks / Bluffing as ...)
//  - 블록: <p> → { p }, 연속된 <ul> 항목들 → { ul: [...] }, <div class="example"> → { example }
//  - 캐릭터 링크 → {c:id} (위키 문서 이름에서 영문자만 남겨 소문자로: Scarlet_Woman → scarletwoman)
//  - <b> → **굵게**
//  - 판번호(oldid)·최종 수정일·아티스트·팟캐스트를 함께 저장

const fs = require("fs");
const path = require("path");
const https = require("https");

const root = path.resolve(__dirname, "..", "..");
const srcDir = path.join(root, "tools", "wiki", "src");
const WIKI = "https://wiki.bloodontheclocktower.com/";

// 앱 id → 위키 문서 이름 (여러 단어·특수 표기만 적는다. 나머지는 첫 글자만 대문자)
const PAGE_NAMES = {
    fortuneteller: "Fortune_Teller",
    scarletwoman: "Scarlet_Woman",
    towncrier: "Town_Crier",
    snakecharmer: "Snake_Charmer",
    eviltwin: "Evil_Twin",
    pithag: "Pit-Hag",
    tealady: "Tea_Lady",
    villageidiot: "Village_Idiot",
    bountyhunter: "Bounty_Hunter",
    cultleader: "Cult_Leader",
    plaguedoctor: "Plague_Doctor",
    devilsadvocate: "Devil%27s_Advocate",
    organgrinder: "Organ_Grinder",
    poppygrower: "Poppy_Grower",
    lordoftyphon: "Lord_of_Typhon",
    fanggu: "Fang_Gu",
    nodashii: "No_Dashii",
    lilmonsta: "Lil%27_Monsta",
    alhadikhia: "Al-Hadikhia",
    highpriestess: "High_Priestess",
    bonecollector: "Bone_Collector",
    hellslibrarian: "Hell%27s_Librarian",
    spiritofivory: "Spirit_of_Ivory",
    deusexfiasco: "Deus_ex_Fiasco"
};

function pageName(id) {
    return PAGE_NAMES[id] || (id.charAt(0).toUpperCase() + id.slice(1));
}

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "PocketGrimoirePlus-translation/1.0" } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                resolve(get(new URL(res.headers.location, url).href));
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error("HTTP " + res.statusCode + " " + url));
                return;
            }
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => resolve(body));
        }).on("error", reject);
    });
}

function decode(text) {
    return text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#0?39;/g, "'")
        .replace(/&#(\d+);/g, (all, n) => String.fromCharCode(Number(n)));
}

// 인라인 HTML → 번역 파일 표기
function inline(html) {
    return decode(html
        // 캐릭터 링크 (다른 문서로 가는 링크 + 자기 자신 링크)
        .replace(/<a[^>]*href="[^"]*\/([^"\/#?]+)"[^>]*>\s*<span[^>]*data-role[^>]*>[\s\S]*?<\/span>\s*<\/a>/g, (all, page) => (
            "{c:" + decodeURIComponent(page).toLowerCase().replace(/[^a-z]/g, "") + "}"
        ))
        .replace(/<a[^>]*class="[^"]*selflink[^"]*"[^>]*>[\s\S]*?<\/a>/g, "{c:__SELF__}")
        .replace(/<\/?b>/g, "**")
        .replace(/<br\s*\/?>/g, " ")
        .replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim();
}

function parse(id, html, oldid, lastEdited) {
    const artist = inline((html.match(/<td>Artist<\/td>\s*<td>([\s\S]*?)<\/td>/) || [])[1] || "");
    const audio = (html.match(/data-file="([^"]+)"/) || [])[1] || "";
    const podcastBy = inline((html.match(/Cult of the Clocktower Episode<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "").replace(/^by\s+/, "");

    // API 본문에는 제목마다 [edit] 버튼이 들어 있으므로 먼저 걷어낸다.
    const body = html.split(/<!--\s*\nNewPP/)[0]
        .replace(/<span class="mw-editsection">[\s\S]*?\]<\/span><\/span>/g, "");
    // 오른쪽 정보 상자(#character-details)는 따로 뽑았으므로 본문에서 뺀다.
    const main = body.replace(/<div id="character-details">[\s\S]*?<\/div>\s*<\/div>/, "");

    const sections = [];
    const parts = main.split(/<h2>/).slice(1);
    parts.forEach((part) => {
        const titleHtml = (part.match(/<span class="mw-headline"[^>]*>([\s\S]*?)<\/span>\s*<\/h2>/) || [])[1] || "";
        const title = inline(titleHtml);
        const key = /^summary/i.test(title) ? "summary"
            : /^how to run/i.test(title) ? "how-to-run"
            : /^examples?/i.test(title) ? "examples"
            : /^tips.*if you are good/i.test(title) ? "tips-good"
            : /^tips.*if you are evil/i.test(title) ? "tips-evil"
            : /^tips/i.test(title) ? "tips"
            : /^bluffing/i.test(title) ? "bluffing"
            : title.toLowerCase().replace(/[^a-z]+/g, "-");
        const content = part.slice(part.indexOf("</h2>") + 5);

        const blocks = [];
        const re = /<div class="example">([\s\S]*?)<\/div>|<ul>([\s\S]*?)<\/ul>|<p>([\s\S]*?)<\/p>/g;
        let m;
        while ((m = re.exec(content))) {
            if (m[1] !== undefined) {
                const text = inline(m[1]);
                if (text) {
                    blocks.push({ example: text });
                }
            } else if (m[2] !== undefined) {
                const items = (m[2].match(/<li>([\s\S]*?)<\/li>/g) || []).map((li) => inline(li.replace(/^<li>|<\/li>$/g, ""))).filter(Boolean);
                const last = blocks[blocks.length - 1];
                if (last && last.ul) {
                    last.ul.push(...items);
                } else if (items.length) {
                    blocks.push({ ul: items });
                }
            } else {
                const text = inline(m[3]);
                if (text) {
                    blocks.push({ p: text });
                }
            }
        }
        sections.push({ key, title, blocks });
    });

    const json = JSON.stringify({
        id,
        source: {
            page: decodeURIComponent(pageName(id)),
            oldid,
            lastEdited: lastEdited ? lastEdited.slice(0, 10) : ""
        },
        artist,
        podcast: audio ? { by: podcastBy, audio } : null,
        sections
    }, null, 4).replace(/\{c:__SELF__\}/g, "{c:" + id + "}");

    return JSON.parse(json);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const ids = args.filter((arg) => !arg.startsWith("--"));

if (!ids.length) {
    console.error("캐릭터 id를 하나 이상 적어 주세요. 예: node tools/wiki/fetch-src.js librarian chef");
    process.exit(1);
}

let failed = 0;

ids.reduce((chain, id) => chain.then(() => {
    const out = path.join(srcDir, id + ".json");
    if (fs.existsSync(out) && !force) {
        console.log("SKIP " + id + " (이미 있음)");
        return null;
    }
    const page = pageName(id);
    return Promise.all([
        get(WIKI + "api.php?action=parse&format=json&prop=text%7Crevid&page=" + page),
        get(WIKI + "api.php?action=query&format=json&prop=revisions&rvprop=ids%7Ctimestamp&titles=" + page)
    ])
        .then(([parsed, info]) => {
            const parseJson = JSON.parse(parsed);
            if (parseJson.error) {
                throw new Error(parseJson.error.info || "문서 없음");
            }
            const pages = JSON.parse(info).query.pages;
            const rev = (pages[Object.keys(pages)[0]].revisions || [])[0] || {};
            const data = parse(id, parseJson.parse.text["*"], parseJson.parse.revid, rev.timestamp || "");
            const counts = data.sections.map((s) => s.key + ":" + s.blocks.length).join(" ");
            if (!data.source.oldid || !data.sections.length) {
                throw new Error("본문을 찾지 못함");
            }
            fs.writeFileSync(out, JSON.stringify(data, null, 4) + "\n");
            console.log("OK   " + id + " (판 " + data.source.oldid + ", " + counts + ")");
        })
        .catch((error) => {
            failed += 1;
            console.log("FAIL " + id + ": " + error.message);
        });
}), Promise.resolve()).then(() => {
    process.exitCode = failed ? 1 : 0;
});
