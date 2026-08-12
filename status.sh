#!/usr/bin/env bash
# status.sh — 세션 시작 현황 요약 (읽기 전용, 아무것도 바꾸지 않음)
# 사용법: bash status.sh
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "══════ 포그플러스 현황 ($(date '+%Y-%m-%d %H:%M')) ══════"

git fetch --quiet 2>/dev/null
echo "HEAD    : $(git log --oneline -1)"
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null)
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null)
DIRTY=$(git status --porcelain | wc -l)
echo "원격대비: 앞선 커밋 ${AHEAD:-?} / 뒤진 커밋 ${BEHIND:-?} / 미커밋 파일 ${DIRTY}"
[ "$DIRTY" != "0" ] && git status --short | head -10

echo "── 최근 커밋 3개 ──"
git log --oneline -3 | tail -2

echo "── 창고 ──"
printf "vendor %s / node_modules %s / .env.local %s / DB %s\n" \
  "$([ -d vendor ] && echo ✓ || echo ✗)" \
  "$([ -d node_modules ] && echo ✓ || echo ✗)" \
  "$([ -f .env.local ] && echo ✓ || echo ✗)" \
  "$([ -f var/data.db ] && echo ✓ || echo ✗)"

echo "── 배포본 (docs/) ──"
for f in index.html sheet.html data/characters.json; do
  [ -f "docs/$f" ] && printf "%-22s %s bytes\n" "$f" "$(stat -c%s "docs/$f")" \
                   || printf "%-22s ✗ 없음\n" "$f"
done

echo "── 주요 파일 줄 수 ──"
for f in assets/js/sheet.js assets/scss/sheet.scss \
         assets/js/processes/setup/sheet-share.js \
         assets/js/processes/setup/character-sheet.js; do
  [ -f "$f" ] && printf "%-46s %s줄\n" "$f" "$(wc -l < "$f")"
done

echo "── 규약 자가점검 ──"
AW=$(grep -rn "async \|await " assets/js --include=*.js 2>/dev/null | grep -v "^\S*: *[/*]" | wc -l)
echo "async/await 실코드 의심(C-8): ${AW}건  ※0이 정상, 주석은 제외됨"
echo "VERSION: $(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' assets/js/constants/version.js 2>/dev/null | head -1)"

echo "══════════════════════════════════════════"