# CLAUDE.md — 포켓 그리모어 플러스+ 작업 규약

이 파일은 Claude Code가 매 세션 자동으로 읽는다. 여기 적힌 규칙은 모두 지킨다.

---

## 0. 세션을 시작하면 가장 먼저

**항상 한국어로 답한다.** 설명, 주석, 커밋 메시지 모두 한국어.

다른 조회보다 먼저 이것을 실행한다.

```bash
bash status.sh
```

HEAD·원격 차이·창고·배포본 크기·파일 줄 수·규약 자가점검이 한 번에 나온다.
**이 문서에 적힌 수치나 커밋 해시를 믿지 말고 이 출력을 믿어라.** 문서는 저장소보다 뒤처질 수 있다.

---

## 1. 이 프로젝트가 무엇인가

GPL-3.0 `Skateside/pocket-grimoire`(BOTC 이야기꾼용 가상 마도서)를 포크한 한국 커뮤니티판 **포켓 그리모어 플러스+**. 전국에서 실사용 중이다.

**Symfony/PHP + SQLite로 로컬 렌더 → `bake.sh`가 정적으로 구움 → `docs/` → GitHub Pages 배포.**
온라인 캐릭터 배포·커스텀 시트 아카이브·시트 링크 공유는 Supabase가 담당한다.

| 항목 | 값 |
|---|---|
| 라이브 | `https://castleq.github.io/pocket-grimoire/` |
| 저장소 | `https://github.com/CastleQ/pocket-grimoire` (**공개** — 함정 ⑤) |
| 작업 경로 | `/workspaces/pocket-grimoire` (GitHub Codespaces) |
| 배포 경로 기준 | `bake.sh`의 `BASE="/pocket-grimoire"` — 저장소 이름과 같아야 함 |
| 로컬 개발 서버 | `php -S 0.0.0.0:8000 -t public` → `/ko_KR/` |
| 도구 버전 | PHP 8.2 / Node 20 / Composer 2.x / Yarn 1.22 |

> **이 저장소는 공개다.** 비밀로 둬야 할 운영 정보(데이터베이스 접속 상세, 운영 조회문, 방어 설계)는 이 파일에도, 저장소 어디에도 쓰지 않는다. 그런 내용이 필요한 작업에서는 CastleQ에게 직접 물어본다.

---

## 2. 소통 규칙 (CastleQ 요청, 영구)

- **클릭 단위로 설명한다.** PC에 익숙하지 않은 사람에게 말하듯이, 동작을 최소 단위로 쪼갠다.
- **전문용어를 피하되, 오해가 생길 상황이면 과감히 쓰고 바로 아래에 `note.`를 붙여 설명한다.**
- **요리 / 영상제작 / 건물건설 비유**로 과정을 설명한다.
- **한 대화에 한 작업.** 완료를 확인한 뒤 다음으로 넘어간다.
- **명령을 줄 때 "어디에 붙여넣는지" 매번 명시한다.** Codespace 터미널 / VS Code 편집기 / 브라우저 콘솔 / 브라우저 주소창.
- **로드맵 진행 시 각 단계마다 전체 공정 대비 현재 위치를 고지한다.**
- **선 제안 금지.** CastleQ가 별도로 언급했거나 **로직 충돌·버그**가 있는 경우를 빼고는, 관련 작업을 먼저 제안하지 않는다. 작업 끝에 "다음 과제" 목록을 나열하지 않는다.
- **기술 스택이 부적합하거나 환경적 한계에 부딪히면 과감히 대안을 제안한다.**

---

## 3. 코드 작성 규칙

- **실제로 동작하는 코드만.** 테스트 목적 외에 mock 데이터나 가짜 구현을 만들지 않는다.
- **타입 `any` / `unknown` 금지.**
- 성능 최적화와 장기 유지보수를 동시에 고려한다.
- 가능하면 재사용 가능한 컴포넌트로 설계한다.

### 문제 해결 우선순위

1. 잠정적 시뮬레이션을 거쳐 실제로 동작하는 해결책을 찾는다.
2. **원인을 추측하기 전에 실제 데이터를 확인하는 진단 코드를 먼저 쓴다.**
3. 기존 코드 패턴을 분석해 일관성을 유지한다.
4. 오류가 나면 원인을 기록해 재발을 막는다.
5. 테스트 가능한 구조로 설계한다.

---

## 4. 치명적 함정 (모르면 반드시 사고 난다)

**① `async` / `await` 금지 (브라우저 코드)**
webpack 폴리필이 꺼져 있어 `regeneratorRuntime is not defined`로 즉사한다. 증상이 **"눌러도 아무 반응 없음"** 이라 원인 파악이 어렵다. **Promise `.then()` / `.catch()` 체인만 쓴다.**

**② 공식 캐릭터 이미지 주소는 두 곳에서 관리된다**
`docs/data/characters.json`(bake.sh가 교체) **그리고** `assets/data/role-images.json`(JS 번들 포함). **후자가 앱 시작 시 전자를 덮어쓴다**(`general.js`의 `applyRoleImages()`). 한쪽만 고치면 캐시를 지워도 해결되지 않는다.

**③ 데이터를 바꾸면 VERSION을 올려라**
`assets/js/constants/version.js`. 안 올리면 기존 사용자는 `Store.lookup`의 옛 데이터를 계속 쓴다.
단, `public/scripts/`의 시트 JSON은 매번 새로 받아오므로 VERSION 인상 대상이 아니다.

**④ html2canvas는 외부 사이트 이미지를 촬영하지 못한다**
`script.bloodontheclocktower.com`, `botc.app`은 CORS 헤더가 없어 저장 시 아이콘이 사라진다. `bloodstar.xyz`·`imgur`·`picui.cn`은 허용. 저장소 내장 아이콘은 항상 안전.

**⑤ 저장소를 비공개로 돌리면 사이트가 죽는다**
무료 플랜에서 비공개로 전환하면 **GitHub Pages가 자동으로 내려간다. 절대 이 저장소를 비공개로 바꾸지 마라.**

**⑥ Codespace 재구축은 gitignore 대상을 조용히 지운다**
`node_modules` / `vendor` / `.env.local` / `var`(SQLite DB)가 전부 증발한다. 과거 이 때문에 **빈 배포가 두 번** 나갔다. 복귀 후 첫 배포 전에 `bash setup.sh`.

**⑦ JSON import 경로는 층수를 세라 (빌드 즉사)**
`assets/data/`를 참조하는 상대 경로는 파일 위치마다 다르다. 틀리면 빌드가 통째로 실패한다.

| 참조하는 파일 | 올바른 경로 |
|---|---|
| `assets/js/sheet.js` | `../data/...` |
| `assets/js/processes/*.js` | `../../data/...` |
| `assets/js/processes/setup/*.js` | `../../../data/...` |

**⑧ `main.js`에서 `update-notice.js`는 `store.js`보다 먼저**
`store.js`는 처음 방문자에게도 `setVersion()`으로 판번호를 기록한다. 순서가 뒤바뀌면 **첫 방문자에게도 업데이트 모달이 뜬다.**

**⑨ `import`에는 삭제 기능이 없다 → 데이터를 빼면 `--reset-db` 필수**
`ImportCommand`는 추가·갱신만 한다. 원고에서 항목을 빼도 DB에는 그대로 남는다. 반드시 `bash setup.sh --reset-db`.

**⑩ 새 DB의 첫 import는 진크스가 0건이 된다 → import 2회**
빈 DB에서는 캐릭터가 저장되기 전에 진크스 대상을 찾아 전부 실패한다. `Jinx: unable to find target role '...'` 경고가 진크스 항목 수만큼 뜨면 **진크스 0건**이라는 뜻이다. `setup.sh`가 import를 2회 실행하도록 이미 수정돼 있다.
DB 재구축 후 캐릭터 / 진크스 / 시나리오 수를 반드시 확인한다. (기대값은 기억으로 말하지 말고 실제 조회 결과를 CastleQ에게 확인받는다 — C-3)

**⑪ 공식 `firstNight` 숫자와 정발 마스터는 눈금이 다르다**
`characters.json`의 숫자는 **황혼·정보 단계를 빼고** 매겨져 있다. 정발 마스터(`tools/official-master.json`)는 **포함**해서 1부터 센다. 둘 다 맞는 값이며 섞어 쓰면 순서가 어긋난다.
관계식: **정발 값 = `assets/data/night-order.json` 배열 위치 + 1**.
정보 단계 위치는 `night-info.js`의 이웃 보간으로 구한다.

**⑫ `docs/` 아래는 전부 자동 생성물이다**
`docs/data/` · `docs/scripts/` · `docs/img/` 모두 `bake.sh`가 매번 지우고 다시 만든다. 고칠 곳은 **`public/scripts/`** 와 `assets/data/`다.
`docs/`는 GitHub Pages가 서비스하는 공개 폴더이므로, 작업 메모나 문서를 여기에 두지 않는다.

---

## 5. 시트 데이터 규칙

- 내장 시트는 `public/scripts/*.json`, 목록은 `public/scripts/manifest.json`.
- **manifest의 `name`과 시트 파일 안 `_meta.name`은 글자 하나까지 같아야 한다.** 이모지도 포함해서 동일하게 적는다. 이 이름이 플레이 기록 집계의 키라, 한쪽만 바꾸면 기록이 둘로 쪼개진다.
- manifest 그룹 분류
  - `custom` — 공식 캐릭터만 조합한 스크립트
  - `homebrew` — 유저 창작 캐릭터가 포함되거나 그 캐릭터 위주인 스크립트
  - `teensyville` — 7인 미만용, 전체 캐릭터 수가 일반 스크립트의 절반 이하
- manifest에 넣을 이름과 제작자는 **각 JSON 파일의 `_meta`에 이미 들어 있으므로 그대로 가져다 쓴다.**
- **캐릭터는 이름이 아니라 id로 처리한다.** 이름이 서로 엇갈리는 함정이 있다. 예: `acrobat1` = 기예꾼, `juggler1` = 곡예사.
- 시트 안에 공식 캐릭터가 들어 있어도 앱은 id로 자기 DB의 정발 데이터를 먼저 쓴다(`select-edition.js`의 `getOfficialCharacter()`). **번역 방침: 공식 캐릭터는 정발 용어로 통일, 홈브류 고유 캐릭터는 원문 유지.**
- `_meta`의 `firstNight` / `otherNight` 배열은 **이름이 아니라 id로** 적는다. `dusk`·`minioninfo`·`demoninfo`·`dawn` 같은 특수 키가 섞인다.

---

## 6. 명령 3개면 다 된다

| 명령 | 용도 |
|---|---|
| `bash status.sh` | 현황 요약 (읽기 전용) |
| `bash setup.sh` (`--reset-db`) | 창고 4종 + DB 자동 복구·검증 |
| `bash deploy.sh "커밋 메시지"` | setup → bake → **검문 4항목** → 커밋·푸시 |

**배포는 반드시 `deploy.sh`로 한다.** bake만 실행하고 수동 커밋하는 것은 검문 우회다.

검문 4항목: `index.html` ≥ 10만 bytes / `characters.json` ≥ 10만 bytes / 캐릭터 ≥ 175 / 에러 문자열 없음.
하나라도 실패하면 커밋 전에 중단되므로 빈 배포가 물리적으로 불가능하다.

> `deploy.sh`는 `git add -A`로 커밋한다. **저장소 폴더에 남아 있는 임시 파일은 전부 공개 저장소에 올라간다.** 스크린샷·메모 등 임시 파일은 `.gitignore`에 들어 있는 `ideas/` 폴더에 둔다.

> bake 출력의 `아이콘 N개`는 **0이 정상**이다. 이 값은 남아 있는 외부 주소 개수라 적을수록 좋다. 실제 성공 지표는 다음 줄의 `공식 아이콘 교체 / 외부주소 잔존 0개`다.

---

## 7. 작업 규약 (위반 금지)

| # | 규약 |
|---|---|
| **C-1** | 터미널로 되는 일은 터미널 명령으로. 50줄 넘는 코드는 편집기에서 다룬다 |
| **C-3** | **기대값을 기억으로 말하지 않는다.** "이 명령을 실행하고 나온 값을 알려주세요, 제가 판단하겠습니다" |
| **C-4** | 대화가 길어지면 새 대화로. 압축보다 인수인계서가 낫다 |
| **C-5** | 프론트 수정 후 **라이브에서 직접 눌러 확인.** deploy.sh 검문은 JS 런타임 오류를 못 잡는다 |
| **C-6** | **파일을 만들었으면 열어서 읽고 나서 말한다.** "내가 방금 만든 파일"도 예외 아님 |
| **C-7** | 수정 스크립트는 **여러 번 실행해도 안전하게.** 적용됨=`SKIP`, 못 찾음=`FAIL`, 항목별 개별 보고. `FAIL`이 떠도 파일을 열어 실제 상태를 확인한 뒤 판단. 치환 앵커는 유일해야 하며 등장 횟수를 먼저 센다 |
| **C-8** | `async`/`await` 금지 (함정 ①) |
| **C-9** | 이미지 주소는 두 곳 함께 + VERSION 인상 (함정 ②③) |
| **C-10** | "화면은 되는데 저장이 안 된다" 류는 **단계별 값을 콘솔에 찍어** 어디서 어긋나는지 특정한다 |
| **C-11** | **가설을 세웠다 암산으로 철회하기를 반복하지 말고 즉시 실측한다.** 과거에 원인을 맞게 짚어놓고 근거 없이 철회해 2턴을 버린 적이 있다 |
| **C-12** | **진단 명령은 최소 출력으로.** `cat 파일` 금지 → `grep -n -A 5 "앵커"`. 있나 없나만 알면 `grep -c`로 숫자만. 여러 파일은 `head -20` 상한. **한 번에 몰아서** 묻는다 |
| **C-13** | **문서를 압축·재구성했으면 원본과 키워드 대조로 누락을 검증한다.** "검증했다"가 아니라 "대조 출력을 봤다"여야 한다. 미검출 항목은 원본에 실제로 있었는지 역으로 확인한다 |

**긴 파일 수정의 정석:** 수백 줄짜리 파일을 대화로 옮겨 적지 말고 `tools/patch-XXX.js` 작업 지시서를 만들어 `node`로 실행한 뒤 지시서를 지운다.

---

## 8. 파일 지도

| 용도 | 경로 |
|---|---|
| 시트 페이지 | `assets/js/sheet.js` / `assets/scss/sheet.scss` |
| **밤 정보 단계 공용** ⚠️ | `assets/js/utils/night-info.js` — 하수인·악마 정보 문구와 **순번 이웃 보간**. `night-order.js`·`sheet.js`가 함께 쓴다 |
| **지시문 서식 공용** ⚠️ | `assets/js/utils/rich-text.js` — `*강조*`·`[대괄호]`·`"따옴표"`·`:reminder:`→● |
| 그리모어 밤 순서 | `assets/js/processes/night-order.js` |
| 업데이트 안내 | `assets/js/constants/notice.js` / `assets/js/processes/update-notice.js` / `templates/partials/setup/update-notice.html.twig` |
| 정발 번역 기준 | `tools/official-master.json` (공식 캐릭터의 단일 기준. 눈금 주의 — 함정 ⑪) |
| 내장 시트 | `public/scripts/*.json` / `public/scripts/manifest.json` |
| 시트 선택·`_meta` 처리 | `assets/js/processes/setup/select-edition.js` |
| 시트 공유 | `assets/js/processes/setup/sheet-share.js` |
| 시트 열기/공유 연결 | `assets/js/processes/setup/character-sheet.js` |
| 커스텀 시트 아카이브 | `assets/js/processes/setup/script-archive.js` |
| 온라인 배포 | `assets/js/processes/setup/distribute.js` |
| 공식 3종 순번표 | `assets/js/data/official-order.js` |
| 공식 아이콘 매핑 ⚠️ | `assets/data/role-images.json` |
| 아이콘 | `public/img/official/` / `assets/img/download.png` |
| 시트 모달 | `templates/partials/setup/character-sheet.html.twig` |
| 번역 | `translations/messages.ko_KR.yaml` (하위 들여쓰기 **8칸**) |
| 미사용 자료 | `assets/data/_unused/` (되살리는 법은 그 안 `README.md`) |
| 빌드 | `bake.sh` |
| 자동화 | `status.sh` / `setup.sh` / `deploy.sh` (저장소 루트) |

---

## 9. 알려진 제약 — 버그로 착각하지 마라

- **대형 시트**는 A4 하한까지 줄여도 초과해 확인창이 뜬다. **의도된 동작.**
- **일부 시트의 밤 지시문 누락** — 시트 JSON에 `firstNightReminder`가 없는 **데이터 문제**다. 코드 문제가 아니다.
- `edition`이 빈칸인 실험 캐릭터는 **기본 3종에 원래 안 나온다.**
- **무해한 노이즈:** Xdebug 연결 실패 / `site.webmanifest`·`favicon.svg` 404 / `_wdt/` 연결 거부 / Git LFS 훅 경고 / Node 20 deprecated. **전부 무시.**
- ⚠️ **`Jinx: unable to find target role`은 무해하지 않다.** 함정 ⑩ 참조.
- **Codespace 파이썬이 손상돼 있다**(`shutil` 없음). 네트워크·파일 작업은 Node나 curl로 한다.
- **내장 시트 상당수가 YAML `entry_order`와 어긋난 순서** — 현행 방침상 문제 없음.
- **`git push`가 설명 없이 실패하면 Git LFS 훅을 의심한다.** 이 프로젝트는 LFS를 전혀 쓰지 않는데 훅만 잔재로 남아 푸시를 막은 적이 있다. 증상은 `error: failed to push some refs`뿐이고 전송 기록이 아예 없다.
  - 즉시 우회: `git push --no-verify`
  - 근본 해결: `.git/hooks/`의 lfs 관련 훅 4개 제거. 이 폴더는 커밋되지 않으므로 **Codespace 재구축 시 되살아날 수 있다.**

---

## 10. 업데이트 안내 모달 다루는 법

`assets/js/constants/notice.js`의 **`NOTICE_ID`를 바꿀 때만** 모달이 뜬다. 배포할 때마다 자동으로 뜨지는 않는다.

- 같은 사용자 2회차 접속부터는 뜨지 않는다
- **완전 첫 방문자에게는 띄우지 않는다** (함정 ⑧)
- 다음 공지는 이 파일의 날짜 번호와 항목만 고친다. 다른 파일은 손대지 않는다

---

## 11. 이 문서에 없는 것

다음은 공개 저장소에 두지 않는다.

- 데이터베이스 접속 상세와 운영 조회문
- 시트 공유 기능의 방어 설계 상세
- 과거 종결된 버그의 상세 이력, 채택하지 않은 설계안

**이 내용들은 `/workspaces/pgplus-notes/pgplus_REF_v5.md`(별도 비공개 저장소)에 있다.** 위 항목이 필요한 작업이면 그 파일을 검색해서 읽어라. 내용을 이 문서(CLAUDE.md)나 공개 저장소 어디에도 옮겨 적지 마라.

---

## 12. 현재 상태

> 이 항목은 빨리 낡는다. **반드시 `bash status.sh`로 실제 값을 확인하고, 이 줄과 다르면 실제 값을 따른다.**

- 2026-09-16 기준 VERSION 0.15.0, 내장 시트 19종
- 진행 중: 시트 데이터 작업 — 내장 홈브류 스크립트 추가 및 기존 내장 시트 점검
- 보류: `ballad-of-seat-7` 시트의 정보 단계 중복 (시트 데이터가 아니라 `sheet.js` 코드 문제로 판단, 새 시트 입고 후 별도 처리) / 그리모어 타원 배치