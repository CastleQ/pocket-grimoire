#!/usr/bin/env bash
#
# setup.sh — 포그플러스(PG Plus) 개발환경 자동 구축
#
# 사용법:
#   bash setup.sh              평소: 있는 건 건너뛰고, 없는 것만 구축
#   bash setup.sh --reset-db   DB만 싹 지우고 새로 구축 (DB 꼬였을 때)
#
# 전제: PHP 8.2 / Node 20 / Composer / Yarn 이 이미 설치돼 있을 것 (Codespace 기본 제공)
#
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
echo "▶ 프로젝트 위치: $PROJECT_DIR"

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true

RESET_DB=0
if [ "$1" = "--reset-db" ]; then
  RESET_DB=1
  echo "▶ [옵션] --reset-db: DB를 지우고 새로 구축합니다."
fi

DB_PATH="$PROJECT_DIR/var/data.db"
echo "▶ [1/6] .env.local 생성 (DB: $DB_PATH)"
echo "DATABASE_URL=\"sqlite:///$DB_PATH\"" > .env.local

if [ -d vendor ] && [ -f vendor/autoload_runtime.php ]; then
  echo "▶ [2/6] vendor 이미 있음 → 건너뜀"
else
  echo "▶ [2/6] composer install (1~3분)..."
  composer install
fi

if [ -d node_modules ] && [ -x node_modules/.bin/encore ]; then
  echo "▶ [3/6] node_modules 이미 있음 → 건너뜀"
else
  echo "▶ [3/6] yarn install (1~3분)..."
  yarn install
fi

mkdir -p var
echo "▶ [4/6] var 폴더 준비됨"

db_is_healthy() {
  [ -f "$DB_PATH" ] || return 1
  local cnt orphan
  cnt=$(php bin/console doctrine:query:sql "SELECT COUNT(*) FROM roles" 2>/dev/null | grep -oE '[0-9]+' | head -1)
  orphan=$(php bin/console doctrine:query:sql "SELECT COUNT(*) FROM roles WHERE team_id IS NULL" 2>/dev/null | grep -oE '[0-9]+' | head -1)
  [ -n "$cnt" ] && [ "$cnt" -ge 240 ] && [ "$orphan" = "0" ]
}

if [ "$RESET_DB" = "1" ]; then
  echo "▶ [5/6] --reset-db: 기존 DB 삭제"
  rm -f "$DB_PATH"
fi

if [ "$RESET_DB" = "0" ] && db_is_healthy; then
  echo "▶ [5/6] DB 이미 정상(캐릭터 충분 + 팀 연결 정상) → 건너뜀"
else
  echo "▶ [5/6] DB 구축 시작..."
  rm -f "$DB_PATH"
  php bin/console doctrine:database:create
  php bin/console doctrine:schema:create
  echo "   - 에디션 5종 삽입"
  php bin/console doctrine:query:sql "INSERT INTO editions (identifier, name) VALUES ('tb','Trouble Brewing'),('snv','Sects and Violets'),('bmr','Bad Moon Rising'),('hdcs','华灯初上'),('syyl','山雨欲来')"
  echo "   - 팀 먼저 import (한국어)"
  php bin/console pocket-grimoire:import --type teams --locale ko_KR --new no
  echo "   - 영문 뼈대 + 한국어 번역 import (메모리 넉넉히, 1~2분)"
  php -d memory_limit=-1 bin/console pocket-grimoire:import --locale ko_KR
fi

echo "▶ [6/6] 검증"
CNT=$(php bin/console doctrine:query:sql "SELECT COUNT(*) FROM roles" 2>/dev/null | grep -oE '[0-9]+' | head -1)
ORPHAN=$(php bin/console doctrine:query:sql "SELECT COUNT(*) FROM roles WHERE team_id IS NULL" 2>/dev/null | grep -oE '[0-9]+' | head -1)
echo "   - 캐릭터 수: ${CNT:-?} (240 이상이면 정상)"
echo "   - 팀 없는 캐릭터: ${ORPHAN:-?} (0이면 정상)"

if [ -n "$CNT" ] && [ "$CNT" -ge 240 ] && [ "$ORPHAN" = "0" ]; then
  echo ""
  echo "✅ 환경 준비 완료! 이제 개발/배포를 시작할 수 있습니다."
else
  echo ""
  echo "⚠️  검증 실패. 위 숫자를 확인하세요. 'bash setup.sh --reset-db'로 재구축을 시도할 수 있습니다."
  exit 1
fi
