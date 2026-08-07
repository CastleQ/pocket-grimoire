#!/usr/bin/env bash
# Pocket Grimoire 정적 빌드 스크립트 (GitHub Pages 배포용 docs/ 생성)
# 사용법: export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 && bash bake.sh
set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="/pocket-grimoire"   # ← GitHub Pages 프로젝트 경로 (저장소 이름과 동일해야 함)

echo "▶ 1/7 서버 기동 (HTML/데이터 렌더용)..."
pkill -f "php -S" 2>/dev/null || true; sleep 1
if [ -f router.php ]; then
  (php -S 127.0.0.1:8000 -t public router.php >/tmp/pg.log 2>&1 &)
else
  (php -S 127.0.0.1:8000 -t public public/index.php >/tmp/pg.log 2>&1 &)
fi
sleep 2
curl -s -o /dev/null -w "   index HTTP %{http_code}\n" "http://localhost:8000/ko_KR/"

echo "▶ 2/7 배포용 프론트엔드 빌드 (publicPath=$BASE/build)..."
if DEPLOY_BASE="$BASE" yarn build >/tmp/bake_build.log 2>&1; then
  echo "   빌드 완료"
else
  echo "   ✗ 빌드 실패 — 아래 로그 확인:"; tail -8 /tmp/bake_build.log; exit 1
fi

echo "▶ 3/7 그리모어 HTML 굽기..."
mkdir -p docs
curl -s "http://localhost:8000/ko_KR/" -o docs/index.html
echo "   docs/index.html = $(wc -c < docs/index.html) bytes"

echo "▶ 4/7 데이터 3종 저장..."
mkdir -p docs/data
curl -s "http://localhost:8000/ko_KR/data/characters" -o docs/data/characters.json
curl -s "http://localhost:8000/ko_KR/data/jinx" -o docs/data/jinx.json
curl -s "http://localhost:8000/ko_KR/data/game" -o docs/data/game.json
echo "   아이콘 $(grep -o script.bloodontheclocktower.com docs/data/characters.json | wc -l)개"

echo "▶ 5/7 URLS를 정적 JSON 경로로 교체..."
node -e '
const fs=require("fs"), base=process.argv[1], p="docs/index.html";
let h=fs.readFileSync(p,"utf8");
h=h.replace(/characters:\s*"[^"]*"/, "characters: \"" + base + "/data/characters.json\"");
h=h.replace(/jinxes:\s*"[^"]*"/,     "jinxes: \"" + base + "/data/jinx.json\"");
h=h.replace(/game:\s*"[^"]*"/,       "game: \"" + base + "/data/game.json\"");
h=h.replace(/src="\/build\//g,       "src=\"" + base + "/build/");
h=h.replace(/scriptsBase:\s*"[^"]*"/, "scriptsBase: \"" + base + "/scripts/\"");
fs.writeFileSync(p,h);
console.log("   URLS characters/jinxes/game + /build 이미지 경로 교체 완료");
' "$BASE"
node tools/rewrite-images.js "$BASE"

echo "▶ 6/7 빌드 자원 + claim.html 복사 + Jekyll 비활성화..."
rm -rf docs/build && cp -r public/build docs/build
cp public/claim.html docs/claim.html
rm -rf docs/scripts && cp -r public/scripts docs/scripts
rm -rf docs/img && cp -r public/img docs/img
touch docs/.nojekyll
echo "   docs/build + docs/claim.html 복사 완료"

echo "▶ 7/7 개발용 빌드 복구 (publicPath=/build)..."
if yarn dev >/tmp/bake_devrestore.log 2>&1; then echo "   개발 빌드 복구됨"; else echo "   (복구 실패 — 나중에 'yarn dev' 수동 실행)"; fi

echo ""
echo "✅ 정적 빌드 완료! docs/ 내용:"
ls docs
echo "   (배포 경로 가정: $BASE — 저장소 이름이 'pocket-grimoire'이면 정확)"
