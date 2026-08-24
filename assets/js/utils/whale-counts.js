/**
 * 대왕고래 양동이 — 인원수 기본값 계산.
 *
 * 공식 인원 배분표를 그대로 따른다. 이야기꾼이 화면에서 고칠 수 있으므로
 * 어디까지나 처음 제시하는 값일 뿐이다.
 */

/** 참가 인원별 [마을주민, 외지인, 하수인, 악마]. */
const TABLE = {
    5:  [3, 0, 1, 1],
    6:  [3, 1, 1, 1],
    7:  [5, 0, 1, 1],
    8:  [5, 1, 1, 1],
    9:  [5, 2, 1, 1],
    10: [7, 0, 2, 1],
    11: [7, 1, 2, 1],
    12: [7, 2, 2, 1],
    13: [9, 0, 3, 1],
    14: [9, 1, 3, 1],
    15: [9, 2, 3, 1]
};

/**
 * 참가 인원에 맞는 유형별 기본 인원수를 돌려준다.
 *
 * @param  {Number} total
 *         참가 인원.
 * @return {Object}
 *         유형별 기본 인원수.
 */
export function defaultCounts(total) {

    const row = TABLE[Math.min(Math.max(total, 5), 15)] || TABLE[15];

    return {
        townsfolk: row[0],
        outsider: row[1],
        minion: row[2],
        demon: row[3]
    };

}
