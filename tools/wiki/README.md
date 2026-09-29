# 캐릭터 가이드 (공식 위키 번역) 작업 안내

Blood on the Clocktower 공식 위키(`wiki.bloodontheclocktower.com`)의 캐릭터 문서를
제작사의 비영리 번역 허가에 따라 한국어로 옮겨, 캐릭터 뽑기 화면(`claim.html`)에서
**[캐릭터 공식 Wiki 읽어보기]** 로 보여준다.

## 파일

| 경로 | 내용 |
|---|---|
| `public/guide.html` | 페이지 틀. 위키 모양 재현 + 제목·그림·유형·대사 가림막(누르는 동안만 보임) |
| `public/guide/data/chars/<id>.json` | 캐릭터별 한국어 번역 (id는 앱 id, 예: `washerwoman`) |
| `public/guide/data/roles.json` | 정발 이름·유형·능력·대사 — **자동 생성, 손으로 고치지 않는다** |
| `public/guide/data/index.json` | 번역이 있는 캐릭터 목록 — **자동 생성** |
| `public/guide/data/pages/<판>.json` | 판 문서(점철되는 혼란·피로 물든 달·화단에 꽃피운 이단) 줄거리·게임 방식 한국어 번역. 캐릭터 도감 에디션 페이지가 읽는다. 표기는 캐릭터 번역과 같다(`{c:id}`, `**굵게**`) |
| `tools/wiki/src-pages/<판>.json` | 판 문서 영어 원문 + 위키 판번호. `build-guide-data.js`가 번역과 칸 구조를 대조한다 |
| `public/guide/data/catalog.json` | 캐릭터 도감 사이트(`CastleQ/botc-wiki-ko`)용 분류 목록(id·이름·유형·판) — **자동 생성**. 위치·형식을 바꾸면 도감이 깨진다 |
| `public/guide/data/jinxes.json` | 관련 징크스(앱의 징크스 문구) — **자동 생성**. 위키 징크스 표는 따로 번역하지 않고, 앱 징크스를 위키 기준으로 최신화해 쓴다(아래 징크스 도구) |
| `public/guide/img/` | 위키 장식 이미지(배경·양피지·액자·로고·판 로고). 원본을 줄여 webp로 저장 |
| `tools/wiki/fetch-src.js` | 위키 원문 수집. `node tools/wiki/fetch-src.js <id> ...` (있으면 SKIP, `--force`로 다시) |
| `tools/wiki/src/<id>.json` | 영어 원문 + 위키 판번호(oldid). 사이트에는 나가지 않음 |
| `tools/wiki/glossary.csv` | 용어집. `한글_official` 칸 우선, 비어 있으면 `한글_variants` |
| `tools/wiki/build-guide-data.js` | roles.json·index.json·catalog.json 생성 + 점검. `bake.sh`가 자동 실행 |
| `tools/wiki/fetch-jinx.js` | 공식 징크스 전체 수집(위키 Djinn 문서) → `tools/wiki/jinx-src.json` |
| `tools/wiki/jinx-ko/<묶음>.json` | 징크스 한국어 원고. 묶음 = 두 캐릭터 중 앞선 에디션(`tb`·`bmr`·`snv`·`exp`) |
| `tools/wiki/apply-jinx.js` | 묶음 단위로 앱 징크스(`assets/data/jinx.json`·`assets/data/jinxes/ko_KR.json`)에 반영. `node tools/wiki/apply-jinx.js tb`. 삭제가 있으면 `bash setup.sh --reset-db`, 반영 후 VERSION 인상 |
| `tools/wiki/make-review-csv.js` | 검수용 표(CSV) 생성 → 구글 드라이브에 시트로 올린다. `node tools/wiki/make-review-csv.js <id> ...` |

## 번역 파일 규칙

- 영어 원문(`src`)과 **섹션·블록 순서와 개수가 같아야 한다.** 검수 시트에서 문장 단위로 짝을 맞추는 기준이다. 다르면 점검 도구가 FAIL.
- 블록 종류: `p`(문단) / `ul`(목록, 배열) / `example`(액자 예시 상자)
- 본문 표기
  - `{c:id}` — 캐릭터 이름. 정발 이름이 자동으로 들어가고 선(파랑)/악(빨강) 색이 입혀진다. 번역된 다른 캐릭터면 링크가 된다.
  - `**굵게**` — 알림 토큰 이름 등 (정발 알림 토큰 이름을 쓴다)
  - `{ability}` — 이 캐릭터의 정발 능력 문구
- 캐릭터 이름 뒤 조사(은/는, 이/가, 을/를)는 **정발 이름의 받침 기준**으로 적는다. 예: 수사관**이**, 성결자**를**
- 캐릭터 이름·능력·대사·알림 토큰 이름은 `tools/official-master.json`(정발 기준)을 따른다.

## 확정 용어 (2026-09-28, CastleQ)

Bluffing → 블러핑 / Claim → 주장하다 / Tips & Tricks → 팁과 요령 / How to Run → 진행 방법 / Appears in → 수록 에디션

## 진행 순서

점철되는 혼란 → 피로 물든 달 → 화단에 꽃피운 이단 → 실험 캐릭터 → 여행자·전설

판마다: 원문 수집(`src`) → 번역 초안(`chars`) → 구글 시트 검수(`영어 원문 | 번역 | 검수 의견`) → 반영 → `node tools/wiki/build-guide-data.js` 점검 → 로컬 확인 → 배포 허가(C-14)

## 알려진 제약

- 위키 일반 문서 주소는 자동 요청을 **418로 거절**한다. 수집 도구는 MediaWiki API(`api.php?action=parse`)를 쓴다.
- 클라우드 세션은 환경의 네트워크 설정에서 `wiki.bloodontheclocktower.com`이 허용돼 있어야 한다 (2026-09-28 허용).
- 악한 캐릭터는 "Bluffing" 대신 "Fighting the ~"(~에 맞서는 방법) 섹션이 있다. 키는 `fighting-the-<이름>`.
- 유형 아이콘(위키 메인의 물음표 그림)은 `guide/img/generic_<유형>.webp`(200px)로 둔다. 캐릭터 도감(botc-wiki-ko) 메인이 읽는다 — 이름을 바꾸지 않는다.
- 판 로고는 `guide/img/logo_<판>.webp`로 저장하고 `guide.html`의 `EDITIONS`에 추가한다 (현재 `tb`·`bmr`·`snv`).
- 캐릭터 그림은 저장소의 `public/img/official/<id>_0.webp`를 쓴다.
