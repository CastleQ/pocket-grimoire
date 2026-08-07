// docs/data/characters.json 의 이미지 주소를 저장소 내부 경로로 교체한다.
//
// - 공식 캐릭터: tools/official-master.json 의 image 배열 순서 그대로
//   $BASE/img/official/{id}_{순번}.{확장자} 배열로 교체한다.
//   (배열을 유지해야 선/악 토큰 이미지 전환 기능이 동작한다)
// - 그 밖에 남아 있는 "/build/..." 절대경로는 $BASE 를 붙여 교정한다.

const fs = require("fs");
const base = process.argv[2];
const charPath = "docs/data/characters.json";
const masterPath = "tools/official-master.json";

const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
const chars = JSON.parse(fs.readFileSync(charPath, "utf8"));

const localById = new Map();

for (const entry of master) {
    if (!entry.id || entry.id === "_meta") {
        continue;
    }

    const id = entry.id.replace(/\d+$/, "");
    const images = Array.isArray(entry.image) ? entry.image : [entry.image];
    const paths = [];

    images.filter(Boolean).forEach((url, index) => {
        const ext = url.split("?")[0].split(".").pop().toLowerCase();
        const file = `public/img/official/${id}_${index}.${ext}`;

        if (fs.existsSync(file)) {
            paths.push(`${base}/img/official/${id}_${index}.${ext}`);
        }
    });

    if (paths.length) {
        localById.set(id, paths);
    }
}

let replaced = 0;
let buildFixed = 0;
let untouched = [];

for (const character of chars) {
    const local = localById.get(character.id);

    if (local) {
        character.image = (local.length === 1) ? local[0] : local;
        replaced += 1;
        continue;
    }

    const images = Array.isArray(character.image) ? character.image : [character.image];
    const fixed = images.filter(Boolean).map((url) => {
        if (typeof url === "string" && url.startsWith("/build/")) {
            buildFixed += 1;
            return base + url;
        }
        return url;
    });

    if (fixed.some((url) => typeof url === "string" && url.startsWith("http"))) {
        untouched.push(character.id);
    }

    character.image = (fixed.length === 1) ? fixed[0] : fixed;
}

fs.writeFileSync(charPath, JSON.stringify(chars));

console.log(`   공식 아이콘 교체 ${replaced}개 / /build 경로 교정 ${buildFixed}개 / 외부주소 잔존 ${untouched.length}개`);

if (untouched.length) {
    console.log("   잔존: " + untouched.slice(0, 8).join(", "));
}
