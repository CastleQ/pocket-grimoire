# 미사용 자료 (중국 시나리오)

华灯初上(hdcs)·山雨欲来(syyl) 두 시나리오의 데이터다.
포그플러스에서 쓰지 않으므로 앱 데이터에서 떼어내 여기에 보관한다.
삭제하지 않는 이유는 훗날 공식화 등의 움직임이 있을 수 있기 때문이다.

## 보관 파일

| 파일 | 내용 |
|---|---|
| `characters-chinese.json` | 캐릭터 68종 |
| `zh_CN-chinese.json` | 중국어 번역 67종 |
| `jinx-chinese-pairs.json` | 공식 캐릭터와 얽혀 있던 진크스 72쌍 |
| `jinx-chinese.json` | 중국 전용 진크스 (원래도 앱이 읽지 않던 파일) |
| `editions-chinese.json` | 시나리오 2종 |

## 되살리는 방법

1. `characters-chinese.json` 의 68종을 `assets/data/characters.json` 에 합친다
2. `zh_CN-chinese.json` 을 `assets/data/characters/zh_CN.json` 에 합친다
3. `jinx-chinese-pairs.json` 을 `assets/data/jinx.json` 에 합친다
   (같은 id 가 이미 있으면 그 항목의 `jinx` 배열에 이어 붙인다)
4. `editions-chinese.json` 의 2종을 `assets/data/editions.json` 에 합친다
5. `setup.sh` 의 에디션 삽입 SQL 에 `('hdcs','华灯初上'),('syyl','山雨欲来')` 를 되돌린다
6. `setup.sh` 와 `deploy.sh` 의 캐릭터 수 검증 기준(175)을 240 으로 되돌린다
7. `bash setup.sh --reset-db` 로 DB 를 새로 만든다

원본 포켓그리모어 저장소에서 최신 데이터를 다시 받아오는 방법도 있다.

## 주의

`import` 명령에는 삭제 기능이 없다. 데이터를 빼는 것만으로는 DB 에서 사라지지
않으므로, 반드시 `--reset-db` 로 DB 를 새로 만들어야 한다.
