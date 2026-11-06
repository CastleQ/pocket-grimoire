// 내장 시트(public/scripts/*.json)에 들어 있는 캐릭터 플레이버 문구를 모아
// public/scripts/flavors.json { 정규화한 id: 문구 } 로 만든다. 캐릭터 뽑기 화면(claim.html)이 읽는다.
// bake.sh 가 배포 때마다 실행하므로 시트를 추가·수정하면 저절로 따라온다.
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "public", "scripts");
const normaliseId = id => String(id || "").replace(/[-_]/g, "").toLowerCase(); // claim.html 과 같은 규칙
const out = {};
fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "flavors.json").sort().forEach(f => {
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { return; }
    if (!Array.isArray(data)) { return; }
    data.forEach(c => {
        if (!c || typeof c !== "object" || c.id === "_meta" || typeof c.flavor !== "string" || !c.flavor.trim()) { return; }
        const key = normaliseId(c.id);
        if (!out[key]) { out[key] = c.flavor.trim(); }
    });
});
fs.writeFileSync(path.join(dir, "flavors.json"), JSON.stringify(out));
console.log("   플레이버 문구 " + Object.keys(out).length + "개 → public/scripts/flavors.json");
