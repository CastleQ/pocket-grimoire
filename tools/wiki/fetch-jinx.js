// 공식 징크스 원문 수집 도구 — 위키 "Djinn" 문서(전체 징크스 목록)를 받아 tools/wiki/jinx-src.json 으로 정리한다.
// 사용법 (저장소 루트): node tools/wiki/fetch-jinx.js
//
// 위키는 일반 문서 주소를 자동 요청에 418로 막으므로, fetch-src.js 와 같이 MediaWiki API(api.php)를 쓴다.
// 캐릭터별 문서의 "Related Jinxes" 칸과 Djinn 문서의 목록은 같은 내용이다(2026-09-29 대조 확인).
//
// 결과 형식: { page, oldid, lastEdited, jinxes: [ { a, b, reason } ] }
//   a / b : 캐릭터 id (위키 문서에 적힌 순서 그대로)
//   reason: 영어 원문

const fs = require("fs");
const path = require("path");
const https = require("https");

const WIKI = "https://wiki.bloodontheclocktower.com/";
const OUT = path.join(__dirname, "jinx-src.json");

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "pocket-grimoire-plus guide builder" } }, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => res.statusCode === 200
                ? resolve(JSON.parse(body))
                : reject(new Error("HTTP " + res.statusCode + " " + url)));
        }).on("error", reject);
    });
}

const toId = (name) => name.toLowerCase().replace(/[^a-z]/g, "");
const decode = (text) => text
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"");

Promise.all([
    get(WIKI + "api.php?action=parse&format=json&prop=text&page=Djinn"),
    get(WIKI + "api.php?action=query&format=json&prop=revisions&rvprop=ids%7Ctimestamp&titles=Djinn")
]).then(([parsed, query]) => {
    const html = parsed.parse.text["*"];
    const revision = Object.values(query.query.pages)[0].revisions[0];
    const jinxes = [];

    [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].forEach(([, item]) => {
        const roles = [...item.matchAll(/data-role="([^"]+)"/g)].map(([, name]) => toId(name));
        if (roles.length < 2) {
            return;
        }
        const text = decode(item.replace(/<[^>]+>/g, ""));
        jinxes.push({ a: roles[0], b: roles[1], reason: text.slice(text.indexOf(":") + 1).trim() });
    });

    const result = {
        page: "Djinn",
        oldid: revision.revid,
        lastEdited: revision.timestamp.slice(0, 10),
        jinxes
    };
    fs.writeFileSync(OUT, JSON.stringify(result, null, 4) + "\n");
    console.log(`OK   징크스 ${jinxes.length}쌍 (판 ${result.oldid}, ${result.lastEdited}) → tools/wiki/jinx-src.json`);
}).catch((error) => {
    console.error("FAIL " + error.message);
    process.exit(1);
});
