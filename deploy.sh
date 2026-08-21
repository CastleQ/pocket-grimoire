#!/usr/bin/env bash
#
# deploy.sh — 포그플러스(PG Plus) 안전 배포 스크립트
#
# 사용법:
#   bash deploy.sh "커밋 메시지"
#   bash deploy.sh                  (메시지 생략 시 자동 생성)
#
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

MSG="${1:-deploy: 정적 빌드 재배포 ($(date '+%Y-%m-%d %H:%M'))}"

echo "═══════════════════════════════════════"
echo " 포그플러스 배포 시작"
echo " 커밋 메시지: $MSG"
echo "═══════════════════════════════════════"

echo ""
echo "▶▶ 1단계: 환경 확인 (창고·DB)"
bash setup.sh

echo ""
echo "▶▶ 2단계: 정적 빌드"
bash bake.sh

echo ""
echo "▶▶ 3단계: 배포 전 검문"

FAIL=0

HTML_SIZE=$(wc -c < docs/index.html 2>/dev/null || echo 0)
echo "   - 웹페이지 크기: ${HTML_SIZE} bytes (10만 이상이어야 정상)"
if [ "$HTML_SIZE" -lt 100000 ]; then
  echo "     ❌ 실패: 웹페이지가 비어 있습니다."
  FAIL=1
else
  echo "     ✅ 통과"
fi

DATA_SIZE=$(wc -c < docs/data/characters.json 2>/dev/null || echo 0)
echo "   - 캐릭터 데이터 크기: ${DATA_SIZE} bytes (10만 이상이어야 정상)"
if [ "$DATA_SIZE" -lt 100000 ]; then
  echo "     ❌ 실패: 캐릭터 데이터가 비어 있습니다."
  FAIL=1
else
  echo "     ✅ 통과"
fi

CHAR_COUNT=$(grep -o '"id"' docs/data/characters.json 2>/dev/null | wc -l)
echo "   - 캐릭터 개수: ${CHAR_COUNT}개 (175 이상이어야 정상)"
if [ "$CHAR_COUNT" -lt 175 ]; then
  echo "     ❌ 실패: 캐릭터 수가 부족합니다."
  FAIL=1
else
  echo "     ✅ 통과"
fi

if grep -q "Internal Server Error\|Uncaught Error\|Fatal error" docs/data/characters.json 2>/dev/null; then
  echo "   - 에러 페이지 혼입: ❌ 발견됨"
  FAIL=1
else
  echo "   - 에러 페이지 혼입: ✅ 없음"
fi

if [ "$FAIL" = "1" ]; then
  echo ""
  echo "═══════════════════════════════════════"
  echo " 🛑 배포 중단 — 검문 실패"
  echo "═══════════════════════════════════════"
  echo " 커밋·푸시하지 않았습니다. 라이브는 안전합니다."
  echo ""
  echo " 해결 방법:"
  echo "   bash setup.sh --reset-db   (DB 재구축 후 다시 시도)"
  exit 1
fi

echo ""
echo "   🎉 검문 전체 통과"

echo ""
echo "▶▶ 4단계: 커밋 + 푸시"

if [ -z "$(git status --porcelain)" ]; then
  echo "   변경 사항이 없습니다. 배포할 것이 없어 종료합니다."
  exit 0
fi

git add -A
git commit -m "$MSG" --no-verify
git push --no-verify

echo ""
echo "═══════════════════════════════════════"
echo " ✅ 배포 완료!"
echo "═══════════════════════════════════════"
echo " GitHub Actions가 1~2분 내 자동 배포합니다."
echo " 확인: https://castleq.github.io/pocket-grimoire/"