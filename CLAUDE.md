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
관계식: **정발 값 = `assets/data/night-order.json` 배열 위치 + 1**. 단 정발 마스터의 `otherNight`는 위치 그대로(1 작음)라 외부 자료(위치+1)와 비교할 때 주의.
정보 단계 위치는 `night-info.js`의 이웃 보간으로 구한다. 마도서(`night-order.js`)도 보간에 여행자·전설·로릭을 넣는다(관문이 첫날 밤 정보 단계 앞에 깨기 때문, 2026-11-20).

**⑫ `docs/` 아래는 전부 자동 생성물이다**
`docs/data/` · `docs/scripts/` · `docs/img/` 모두 `bake.sh`가 매번 지우고 다시 만든다. 고칠 곳은 **`public/scripts/`** 와 `assets/data/`다.
`docs/`는 GitHub Pages가 서비스하는 공개 폴더이므로, 작업 메모나 문서를 여기에 두지 않는다.
단, `docs/` 맨 위의 단독 html(`claim.html`·`whale.html` 등, `bake.sh`의 `cp public/x.html` 줄)은 지우지 않는다 → 단독 페이지를 없앨 때는 `cp` 줄 삭제와 함께 `git rm docs/x.html`도 한다(2026-11-23 `coffee.html` 잔존).

**⑬ `guide/data/`·`img/official/` 위치를 바꾸면 캐릭터 도감 사이트가 깨진다**
별도 사이트 `CastleQ/botc-wiki-ko`(캐릭터 도감)가 PG+ 배포본의 `/pocket-grimoire/guide/data/…`(roles·index·jinxes·chars)와 `/pocket-grimoire/img/official/<id>_0.webp`, `/pocket-grimoire/guide/img/…`를 **절대 경로로 직접 읽는다.** (`guide/img/logo_<판>.webp`는 PG+ 뽑기 화면 로고도 씀) 이 폴더·파일 이름·데이터 형식을 바꾸려면 도감 쪽도 함께 고친다.

**⑭ Supabase 공개 키 권한을 좁히는 변경은 순서와 점검 범위를 지켜라 (실사용 중단 2회)**
공개 키(anon) 권한을 줄이면 **이미 배포된 옛 앱**과 **그 표를 쓰는 DB 함수**가 함께 깨진다. 증상은 `permission denied for table …`(401, 42501) — 나눠주기 저장 실패, 플레이어 뽑기(claim) 실패로 나타났다.
- 순서는 **앱 배포 → 캐시(최대 10분) 경과 → DB 권한 변경**. 반대로 하면 옛 앱이 즉시 멈춘다.
- 바꾸기 전에 **그 표를 쓰는 DB 함수 목록을 뽑아 함수마다 실제로 불러 점검**한다. 앱 요청만 점검하면 안 된다. (조회문·복구 절차는 비공개 문서 — §11)
- 앱에서 `slots`는 **필요한 칸만 지정해 읽는다.** `select=*`, 저장 시 `Prefer: return=representation` 금지 — 공개 키로 읽을 수 없는 칸이 있다.
- DB 변경 SQL은 CastleQ가 대시보드에서 실행한다. 변경 전후로 공개 키 점검(읽기·저장·함수 호출)을 하고, 데이터를 쓰지 않는 방식(없는 id 대상)으로 확인한다.

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
- **수정본 시트를 받으면 JSON을 통째로 덮어쓰고 `_meta.name`만 기존 PG+ 이름으로 되돌린다**(CastleQ 방침). 새 시트는 먼저 기존 manifest에 같은 이름이 있는지 확인한다(갱신일 수 있음).
  - **덮어쓰기 전에 옛 JSON과 새 JSON을 캐릭터 id·항목(키)별로 대조한다.** 값이 바뀐 것(수정)은 그대로 덮어쓴다. 옛 쪽에만 있고 새 쪽에서 **사라지는** 캐릭터·항목(예: PG+가 따로 넣은 `flavor`)이 있으면 덮어쓰기 전에 목록을 보여 주고 CastleQ에게 되묻는다. 예: `fall-of-rome.json`의 `flavor` 27개는 PG+가 제작자 연감에서 넣은 것이다(2026-11-17).
- **manifest의 `file` 이름은 `[a-z0-9-]+.json`만, 한 번 정하면 바꾸지 않는다.** 이 이름이 공유 링크 주소 `sheet-<파일이름>.html`이 되어(§8 시트 링크 미리보기), 바꾸거나 시트를 빼면 이미 퍼진 그 시트의 공유 링크가 404가 된다. 시트를 뺄 때는 CastleQ에게 이 점을 알린다.
- **용어:** PG+ 데이터(앱·가이드·징크스·징크스 원고 `tools/wiki/jinx-ko`)는 `참가자·지명`(2026-10 통일), AAB 규칙 위키·외부 번역 자료는 `플레이어·지목`. 외부 자료와 대조할 때는 용어를 먼저 맞춰 바꾼 뒤 비교한다. 공식 영어 최신 데이터: `https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-release/main/resources/data/{roles,nightsheet}.json`.
- **`bloodstar.xyz`는 주소가 사라졌다(2026-11 확인, DNS 없음·보관소 사본 없음).** 시트 그림·로고에 이 주소가 있으면 앱에서 깨진다. 공식 캐릭터는 이름·유형·능력을 대조해 `https://castleq.github.io/pocket-grimoire/img/official/<공식id>_0.webp`(선악 두 장이면 `_1`도)로, 구할 곳 없는 그림은 `image`를 지운다(앱이 유형 기본 그림을 넣음). 홈브류 원본은 botchomebrew.wiki의 `assets/media/full/art/<slug>-<스크립트>.png.webp`(591px)에 있을 수 있다 → `img/official/<id>_0.webp`(400px)로 넣고 시트 주소를 바꾼다.
- **시트 그림은 외부 주소에 두지 않고 저장소에 넣는다.** 외부 사이트는 사라질 수 있고(bloodstar), 살아 있어도 CORS가 없으면 시트 저장 때 아이콘이 빠진다(klutzbanana — 함정 ④). `node tools/patch-selfhost-images.js <시트.json> <로고키> [원본 script.json]`이 그림을 `img/official/<id>_<n>.webp`·로고를 `guide/img/logo_<로고키>.webp`로 받아 주소를 바꾼다(여러 번 실행 안전). klutzbanana 원본 데이터는 `https://klutzbanana.com/api/public/scripts/<시트id>/script.json`(페이지 주소의 `/scripts/<시트id>/`). 캐릭터별 연감 해설(`almanacDetails`)·플레이버는 `…/<시트id>/characters`, 판 소개글은 `…/<시트id>`의 `almanacIntroduction` — 홈브류 위키 문서 원고로 쓴다(점소이 2026-11-20).

---

## 6. 명령 3개면 다 된다

| 명령 | 용도 |
|---|---|
| `bash status.sh` | 현황 요약 (읽기 전용) |
| `bash setup.sh` (`--reset-db`) | 창고 4종 + DB 자동 복구·검증 |
| `bash deploy.sh "커밋 메시지"` | setup → bake → **검문 4항목** → 커밋·푸시 |

**배포는 반드시 `deploy.sh`로 한다.** bake만 실행하고 수동 커밋하는 것은 검문 우회다.
**배포 전 CastleQ의 허가 필수 (C-14).**

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
| **C-14** | **배포는 반드시 CastleQ의 허가를 먼저 받는다.** 작업 결과는 로컬서버에서 확인하는 것이 기본이고, CastleQ가 요청할 때만 배포한 뒤 라이브에서 확인한다. 클라우드 세션에서는 Claude가 자동 브라우저로 로컬서버를 눌러 보고 결과·스크린샷을 보고하는 것이 로컬 확인이다. 작업 가지(`claude/...`)에 올리는 것은 보관이라 허가 없이 하고, **main 반영(`deploy.sh` 포함)이 배포다**. 예외: 세션 기록(`BOTC-project-note`)과 `tools/last-session-record.txt`만 바꾸는 커밋은 사이트와 무관해 배포가 아니므로 허가 없이 main에 올린다 |
| **C-15** | **작업 세션은 끝날 때 CastleQ의 확인을 받고 기록한다.** 대화 중에는 기록하지 않는다. 작업→배포→라이브 확인까지 끝났다고 판단되면(배포 없는 작업은 "끝" 같은 마무리 신호에) 개인 지침의 마무리 질문과 합쳐 한 번 묻고, 확인하면 그때 세션 기록 파일(환경·새로 알게 된 함정·커밋별 작업 내역·확인 못 한 경로·결정 사항)을 만들어 CastleQ에게 파일로 전달하고(공개 저장소에는 두지 않음), `tools/last-session-record.txt`를 "날짜 기록에 포함된 마지막 커밋번호" 한 줄로 갱신한다. 세션 시작 때 `status.sh`의 "세션 기록" 칸에 ⚠️가 뜨면 **다른 작업보다 먼저 CastleQ에게 알린다** |

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
| 홍보 모달 (내림) | 2026-10-01 제거. 다시 쓸 때는 보관본 `/workspaces/BOTC-project-note/archive/2026-09-promo-pokemon/README.md` 참고 — **앱·뽑기 화면(`public/claim.html`) 두 곳을 함께** 고친다 |
| 정발 번역 기준 | `tools/official-master.json` (공식 캐릭터의 단일 기준. 눈금 주의 — 함정 ⑪) |
| 내장 시트 | `public/scripts/*.json` / `public/scripts/manifest.json` |
| 시트 선택·`_meta` 처리 | `assets/js/processes/setup/select-edition.js` |
| 시트 공유 | `assets/js/processes/setup/sheet-share.js` — 내장 시트면 `sheet-<키>.html?s=번호`, 아니면 `sheet.html?s=번호` |
| 시트 링크 미리보기 | `tools/build-sheet-og.js` — bake가 `docs/sheet-<키>.html`(오픈그래프 제목 `{시트 이름} - 캐릭터 시트`)을 굽는다. 키: 공식 `tb`·`bmr`·`snv`(`select-edition.js`의 `OFFICIAL_SHEETS`와 **두 곳 함께**), 그 밖은 manifest 파일 이름 |
| 시트 열기/공유 연결 | `assets/js/processes/setup/character-sheet.js` |
| 커스텀 시트 아카이브 | `assets/js/processes/setup/script-archive.js` |
| 온라인 배포 | `assets/js/processes/setup/distribute.js` |
| **참가자용 마도서** (게임 내보내기) | 만들기 `assets/js/processes/grimoire/export.js` → 링크 `?play=<시트 공유 번호>&g=<이름·접시 위치 비율>`. 받기: `assets/js/utils/play-mode.js`(판별·**따로 쓰는 저장 칸 `pocket-grimoire-play`** — `Store.create`는 반드시 `STORE_KEY`로) + `assets/js/processes/play-mode.js`(시트 받아 빈 접시 깔기). 숨길 메뉴는 `play-hide` 클래스·`_play-mode.scss`. [캐릭터 시트]는 진짜 `<a target=_blank>` 링크(`storeSheetPayload()`). 참가자용 인원 현황은 `tally-set` 이벤트로 접시 수를 넣는다. 이야기꾼 마도서 가운데 [게임 시작하기](`#start-game`, 현황 `#grimoire-tally` 안)는 같은 창을 열고 링크를 만들면 숨김(`pg_game_link_made`, `sheet-change`·`clear`에서 다시 보임) |
| 뽑기 화면 시트 로고 | `select-edition.js`가 `pg_current_logo`(시트 `_meta.logo`, 공식 3종은 `tb`·`bmr`·`snv`) 저장 → `distribute.js`가 링크에 `&logo=` → `public/claim.html`이 표시(공식은 `guide/img/logo_<판>.webp`). 투명 빈 로고 `yIFrcQd`는 제외 |
| 캐릭터 고르기 목록 숨김 규칙 | `_character-list.scss` — 항목에 `data-team`·`is-in-play`가 있고 목록에 `is-show-*`가 없으면 가림. 악마의 속임수와 "이 캐릭터들은 게임에 없습니다" 접시(`info-tokens.js`, 열 때만 붙임)가 함께 씀 |
| **캐릭터 가이드**(공식 위키 번역) | `public/guide.html` / `public/guide/data/` / `tools/wiki/` — 작업 방법은 `tools/wiki/README.md` · 도감 사이트가 이 데이터를 읽음(함정 ⑬). 가이드 징크스(`jinxes.json`)는 `build-guide-data.js`가 bake 결과 `docs/data/jinx.json`에서 만든다 → 징크스 번역을 바꾸면 bake 뒤에 돌린다(안 그러면 옛 문장으로 되돌아감) |
| 공식 3종 순번표 | `assets/js/data/official-order.js` |
| 공식 아이콘 매핑 ⚠️ | `assets/data/role-images.json` |
| 아이콘 | `public/img/official/` / `assets/img/download.png` |
| 시트별 위키 버튼 주소 | `public/scripts/sheet-wikis.json` + `assets/js/utils/sheet-wiki.js` — 항목이 있으면 그 시트의 보라색 위키 버튼이 그 주소로. `"menuOnly": true`면 마도서 메뉴 [공식 Wiki 사이트 바로가기]만 그 주소(예: 점소이 → 도감 `edition-jeomsoi.html`), 캐릭터 토큰은 PG+ 위키(`guide.html`) |
| 캐릭터 그림 깨짐 대비 | `assets/js/utils/image-fallback.js` `setCharacterImage()` — 그림이 안 열리면 유형 아이콘(`img/icons/<유형>.webp`)으로 바꿔 끼움. 캐릭터 그림을 넣는 곳은 `.src =` 대신 이것을 쓴다(토큰·알림 토큰·징크스·시트 화면) |
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
- **무해한 노이즈:** Xdebug 연결 실패 / 개발 서버(`/ko_KR/`)의 `img/favicon-*.png` 404(파비콘은 상대 경로라 배포본에서만 맞음) / `_wdt/` 연결 거부 / Git LFS 훅 경고 / Node 20 deprecated. **전부 무시.**
- ⚠️ **`Jinx: unable to find target role`은 무해하지 않다.** 함정 ⑩ 참조.
- **Codespace 파이썬이 손상돼 있다**(`shutil` 없음). 네트워크·파일 작업은 Node나 curl로 한다.
- **Claude 클라우드 세션(관리자 계정 root)에서는 `deploy.sh`가 준비 단계에서 멈춘다.** composer가 root에서 플러그인을 꺼 버려 `symfony-cmd: not found`가 나고, 그 뒤로 배포가 진행되지 않는다. 앞에 설정을 붙여 실행한다: `COMPOSER_ALLOW_SUPERUSER=1 bash deploy.sh "커밋 메시지"`
- **클라우드 세션의 배포 순서:** `deploy.sh`는 **지금 가지**에 커밋·푸시한다. `git fetch origin && git checkout -B main origin/main && git merge --ff-only <작업가지>` → deploy → `git push origin main:<작업가지>`. 다른 대화가 main에 먼저 배포했을 수 있으니 fetch부터 한다. `merge --ff-only`가 실패하면(main이 갈라짐) 작업 가지에 `git merge origin/main`을 한 뒤 다시 한다. 검문만 시험할 때 `deploy.sh` 사본은 저장소 안에서 돌린다(맨 위에서 자기 폴더로 `cd`함).
  - ⚠️ **오래 이어 쓴 세션은 DB가 옛 것이다.** `setup.sh`는 DB가 있으면 다시 넣지 않아, 다른 대화가 고친 캐릭터·징크스 원고가 빠진 채 구워져 **배포가 최신 번역을 옛 문장으로 되돌린다**(2026-11-23 사고). → 이제 자동으로 막는다: `setup.sh`는 재료(`assets/data/*.json`)가 DB 파일보다 새것이면 DB를 다시 만들고, `deploy.sh` 검문은 재료가 그대로인데 `docs/data`·`public/guide/data/jinxes.json`이 바뀌면 중단한다(의도한 변경이면 `DATA_CHANGE_OK=1 bash deploy.sh …`).
- **클라우드 로컬 확인:** `docs/`를 `<폴더>/pocket-grimoire`로 링크해 `python3 -m http.server`로 띄우고 Playwright로 누른다. 공유 기능은 `route`로 `rpc/save_shared_sheet`·`rpc/get_shared_sheet`를 가짜 응답으로 바꿔 **실데이터를 쓰지 않는다.**
  - 나눠주기를 누르는 확인은 **판을 먼저 골라야** 캐릭터 체크박스가 생긴다: `#select-edition-form`의 `edition` 라디오(`tb`)를 고르고 `requestSubmit()` → `#player-select input[name="character"]` 체크 → `#player-select-distribute`. `rest/v1/games`·`slots`는 `route`로 가짜 응답.
  - 로컬 확인용으로 `bake.sh`를 돌렸으면 커밋 전에 `git checkout -- docs && git clean -fd docs`로 되돌린다(배포는 deploy.sh가 다시 굽는다).
- **DB 변경 SQL은 CastleQ에게 주기 전에 컨테이너의 PostgreSQL 16(`/usr/lib/postgresql/16/bin`)으로 미리 시험한다.** 클러스터는 `/var/tmp/` 아래에(스크래치 폴더는 postgres 사용자가 못 씀) `su postgres -c "initdb …; pg_ctl …"`. anon·authenticated 역할과 칸 단위 권한을 실제처럼 재현해 공개 키 동작까지 본다.
- **함수 인자 수를 바꿀 때는 `create or replace`로 안 된다** → 한 트랜잭션에서 옛 함수 `drop` + 새 함수 생성(새 인자는 `default null`로 옛 앱 호출 호환), 끝에 `notify pgrst, 'reload schema';`.
- **내장 시트 상당수가 YAML `entry_order`와 어긋난 순서** — 현행 방침상 문제 없음.
- **클라우드 마도서 토큰 확인:** 판을 고른 뒤 `#character-list__list li`(숨어 있어 `innerText`가 빔 → `textContent`로 찾기) 클릭 → `#character-list-confirm` → 패드의 `.js--token--wrapper`를 **페이지 안에서 `element.click()`**(Playwright `click()`으로는 토큰 창이 안 열림) → `#character-show-token`의 `dataset.wikiId`가 위키 버튼 주소. 메뉴 위키 버튼은 `#reset-height`(이름과 달리 위키 버튼) → `#character-wiki-confirm`의 `dataset.url`. 그리모어 그림은 `loading="lazy"`라 그림 수를 셀 때는 `eager`로 바꾼다.
- **Bash 안전 검사 오탐:** 명령 안 heredoc에 `$$`(Playwright `page.$$`)가 있으면 삭제 명령으로 오인해 막힌다 → 스크립트는 Write 도구로 파일을 만들고 `node 파일`로 실행.
- **클라우드 시트 그림 확인(실제 앱 흐름):** Playwright로 앱을 열고 `input[name=edition][value="sheet:<파일>.json"]` 체크 → `#select-edition-form`의 `requestSubmit()` → `window.open`을 막고 `#open-sheet` 클릭 → `localStorage.pg-sheet-data`가 생기면 `sheet.html`을 열어 `naturalWidth`가 0인 `img`를 센다. 고친 시트는 `route`로 `scripts/<파일>.json`을 작업 파일로 바꿔 배포 전에 본다.
- **클라우드 저장소는 얕게 받아서(shallow)** `status.sh` 세션 기록 칸이 ⚠️(커밋 없음)일 수 있고, 푸시 후 원격 표시가 낡아 "안 올린 커밋" 경고가 뜰 수 있다 → `git fetch --depth=60 origin +refs/heads/<가지>:refs/remotes/origin/<가지>`로 갱신(깊이를 너무 작게 받으면 main과 이어짐 확인이 실패).
- **웨일 "모바일 창"**: 넓은 PC 폭(~1300px)으로 열었다가 곧 폰 폭으로 줄인다 → 처음 폭으로 잰 배치가 틀어짐(재현: Playwright 1300px로 열고 `setViewportSize(360)`). 또 프로그램이 대신 버튼을 눌러 연 `window.open` 새 창은 CSS·JS 없이 깨짐 → 새 탭은 진짜 `<a target="_blank">` 링크로.
- **참가자용 마도서 로컬 확인:** 이야기꾼 쪽에서 `#export-make` → `route`로 `save_shared_sheet`는 가짜 번호, `get_shared_sheet`는 저장 요청 본문을 그대로 돌려줌 → 결과 링크(`#export-result input`)를 같은 context 새 페이지로 열면 저장 칸 분리까지 확인된다.
- **`.button` 스타일은 다른 구성 요소 scss보다 나중에 불러와진다** → 같은 무게 선택자(`.foo`)로는 padding·font-size가 덮어써진다. 부모 선택자를 붙여(`.tally .tally__start`) 무게를 올린다. `.button`의 입체 테두리도 `box-shadow`라 그림자 효과를 줄 때 함께 적는다.
- **`git revert HEAD` 주의:** `deploy.sh` 뒤 HEAD는 배포 커밋(docs)이다. 코드만 되돌릴 때는 `git checkout <커밋>~1 -- 파일`.
- **`git push`가 설명 없이 실패하면 Git LFS 훅을 의심한다.** 이 프로젝트는 LFS를 전혀 쓰지 않는데 훅만 잔재로 남아 푸시를 막은 적이 있다. 증상은 `error: failed to push some refs`뿐이고 전송 기록이 아예 없다.
  - 즉시 우회: `git push --no-verify`
  - 근본 해결: `.git/hooks/`의 lfs 관련 훅 4개 제거. 이 폴더는 커밋되지 않으므로 **Codespace 재구축 시 되살아날 수 있다.**

---

## 10. 업데이트 안내 모달 다루는 법

`assets/js/constants/notice.js`의 **`NOTICE_ID`를 바꿀 때만** 모달이 뜬다. 배포할 때마다 자동으로 뜨지는 않는다.

- 같은 사용자 2회차 접속부터는 뜨지 않는다
- **기본 동작(2026-11-16 CastleQ 결정):** 창 아래 [앞으로 그만보기] 토글 스위치(체크박스 역할) + [확인]. 끈 채로 닫으면 **[캐시 삭제] 때마다 다시 뜬다**(캐시 삭제가 본 기록 `store.notice`를 비움). 켜고 닫으면 그 공지 번호를 `localStorage.pg_notice_dismissed`에 남겨 캐시 삭제 뒤에도 안 뜬다
- 하위 항목은 `["항목", ["하위 1", "하위 2"]]` 배열로 쓴다. 링크 글자에 대괄호를 보이려면 `[[글자]](주소)`
- **완전 첫 방문자에게는 띄우지 않는다** (함정 ⑧)
- 다음 공지는 이 파일의 날짜 번호와 항목만 고친다. 다른 파일은 손대지 않는다
- 같은 항목을 `templates/partials/acknowledgements.html.twig`(사이트 안 릴리즈 노트 목록)에도 날짜 제목과 함께 **맨 위에** 추가한다(최신순)
- **문구는 최대한 간소하게, 앱 이용자 관점에서 알아야 할 내용만 짧은 문장으로 쓴다.** 내부 구현·원인 설명은 넣지 않는다
- 항목 안 줄바꿈은 `notice.js`에서는 `\n`, 릴리즈 노트 목록에서는 `<br>`로 쓴다
- 설명 그림은 `NOTICE_IMAGES`(`public/img/notice/<날짜>-*.webp`, 상대 경로) — 옆으로 밀어 넘김·점 표시. 다음 공지에서 그림이 없으면 `[]`로 비운다. 참가자용 마도서(별도 저장 칸)에서는 안내가 뜨지 않는다

---

## 11. 이 문서에 없는 것

다음은 공개 저장소에 두지 않는다.

- 데이터베이스 접속 상세와 운영 조회문
- 시트 공유 기능의 방어 설계 상세
- 과거 종결된 버그의 상세 이력, 채택하지 않은 설계안
- 캐릭터 뽑기(`claim.html` · DB 함수 `claim_slot` · `slots`의 `alignment`·`player_key` 칸)의 서버 쪽 동작 설계 — 계획서 `/workspaces/BOTC-project-note/plans/2026-11-16-claim-weight.md`. 공개하면 안 되는 운영 설계라 비공개 저장소에만 둔다. 이 기능을 고치기 전에 반드시 그 계획서를 먼저 읽는다

**이 내용들은 `/workspaces/BOTC-project-note/pgplus_REF_v5.md`(별도 비공개 저장소)에 있다.** 위 항목이 필요한 작업이면 그 파일을 검색해서 읽어라. 내용을 이 문서(CLAUDE.md)나 공개 저장소 어디에도 옮겨 적지 마라.

**사고가 나서 복구가 필요하면 같은 비공개 저장소(`CastleQ/BOTC-project-note`)의 `복구안내.md`부터 본다.** 증상별 첫 조치와 자세한 기록 위치가 있다. 새 사고는 세션 기록에 경위를 쓰고 그 표에 한 줄 추가한다.

---

## 12. 현재 상태

> 이 항목은 빨리 낡는다. **반드시 `bash status.sh`로 실제 값을 확인하고, 이 줄과 다르면 실제 값을 따른다.**

- 2026-10-30 기준 VERSION 0.15.3, 내장 시트 공식 3종 + manifest 21종
- 진행 중: 시트 데이터 작업 — 내장 홈브류 스크립트 추가 및 기존 내장 시트 점검
- 보류: `ballad-of-seat-7` 시트의 정보 단계 중복 (시트 데이터가 아니라 `sheet.js` 코드 문제로 판단, 새 시트 입고 후 별도 처리) / 그리모어 타원 배치