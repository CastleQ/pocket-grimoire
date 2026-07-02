#!/usr/bin/env bash
# Pocket Grimoire 개발환경 자동 준비 스크립트
# 사용법: bash .devcontainer/start.sh
cd /workspaces/pocket-grimoire || exit 1

echo "▶ 1/4 프론트엔드 빌드 확인..."
if [ ! -d public/build ]; then
  echo "   빌드가 없어 새로 만듭니다 (잠시만요)..."
  yarn dev
else
  echo "   OK (이미 빌드됨)"
fi

echo "▶ 2/4 데이터베이스 확인..."
if [ ! -f var/data.db ]; then
  echo "   ⚠ DB가 없습니다. 먼저 아래를 실행하세요:"
  echo "     bash .devcontainer/setup-db.sh"
else
  echo "   OK (DB 있음)"
fi

echo "▶ 3/4 웹서버 시작..."
symfony server:start -d --no-tls --port=8000 >/dev/null 2>&1 \
  && echo "   OK (서버 시작됨)" \
  || echo "   OK (이미 실행 중)"

echo "▶ 4/4 포트 8000 공개 설정..."
if [ -n "$CODESPACE_NAME" ]; then
  gh codespace ports visibility 8000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 \
    && echo "   ✅ 포트 공개됨" \
    || echo "   ⚠ 자동 공개 실패 — 포트 탭에서 8000 우클릭 → 포트 가시성 → 공개"
else
  echo "   (Codespace 환경이 아니라 건너뜀)"
fi

echo ""
echo "✅ 준비 완료! 포트 탭에서 8000의 지구본 아이콘 클릭 → 주소 끝에 /ko_KR/ 붙이기"
