/**
 * 첫날 밤의 "하수인 정보"·"악마 정보" 단계를 다루는 공용 도구.
 *
 * 이 두 단계는 공식 밤 순서에 반드시 들어가지만 앱의 캐릭터 목록
 * (characters.json)에는 캐릭터로 존재하지 않는다. 그래서 화면을 그릴 때
 * 직접 만들어 끼워 넣어야 하는데, 그리모어의 밤 순서 목록과 시트 이미지가
 * 각자 계산하면 서로 다른 순서가 나온다. 계산과 문구를 여기 한곳에 모은다.
 */

// 정보 단계의 문구와 기본 순번.
//
// defaultOrder 의 19·23 은 "공식 밤시트 번호"다. 황혼을 1번으로 세고 정보
// 단계까지 포함해 매긴 값이다. 반면 앱의 firstNight 숫자는 황혼과 정보 단계를
// 빼고 매겨져 있어 눈금이 다르다(예: 미치광이 = 공식 21번 / 앱 19번).
// 그래서 이 값은 기준 삼을 이웃을 하나도 못 찾았을 때만 쓰는 최후의 값이며,
// 평소에는 resolveInfoOrders 가 이웃 사이를 계산해 앱 눈금에 맞춘 값을 낸다.
export const NIGHT_INFO_STEPS = [
    {
        id: "minioninfo",
        name: "하수인 정보",
        team: "minion",
        defaultOrder: 19,
        reminder: "7명 이상이 플레이 중이라면, 모든 하수인을 깨웁니다. *이 사람이 악마입니다* 토큰을 보여줍니다. 악마를 가리킵니다."
    },
    {
        id: "demoninfo",
        name: "악마 정보",
        team: "demon",
        defaultOrder: 23,
        reminder: "7명 이상이 플레이 중이라면, 악마를 깨웁니다. *이들이 당신의 하수인입니다* 토큰을 보여줍니다. 모든 하수인을 번갈아가며 가리킵니다. *이 캐릭터는 참여하지 않습니다* 토큰을 보여줍니다. 참가중이지 않은 선한 캐릭터 토큰 3개를 보여줍니다."
    }
];

const NIGHT_INFO_IDS = NIGHT_INFO_STEPS.map(({ id }) => id);

/**
 * ID 를 견주기 좋게 다듬는다. 시트마다 표기가 조금씩 다르기 때문이다.
 * (예: "minion_info", "Minion-Info" → "minioninfo")
 *
 * @param  {String} id
 *         원본 ID.
 * @return {String}
 *         기호를 없애고 소문자로 바꾼 ID.
 */
export function normaliseInfoId(id) {
    return String(id || "").replace(/[-_]/g, "").toLowerCase();
}

/**
 * 이름을 견주기 좋게 다듬는다. 띄어쓰기만 다른 "하수인 정보"와 "하수인정보"를
 * 같은 것으로 보기 위해서다.
 *
 * @param  {String} name
 *         원본 이름.
 * @return {String}
 *         공백을 없앤 이름.
 */
export function normaliseInfoName(name) {
    return String(name || "").replace(/\s+/g, "");
}

/**
 * 지금 밤 순서에 올라와 있는 캐릭터들의 순번을 이름표로 정리한다.
 *
 * 시트마다 ID 표기가 다르므로(예: "19_out"), 끝의 숫자를 뗀 형태도 함께
 * 등록해 둔다.
 *
 * @param  {Array.<Object>} entries
 *         { id, order } 짝의 목록. 부르는 쪽에서 이 모양으로 맞춰 넘긴다.
 * @return {Map}
 *         다듬은 ID → 순번.
 */
export function buildOrderLookup(entries) {

    const lookup = new Map();

    entries.forEach((entry) => {

        if (!entry) {
            return;
        }

        const order = Number(entry.order);

        if (!(order > 0)) {
            return;
        }

        const key = normaliseInfoId(entry.id);

        if (key && !lookup.has(key)) {
            lookup.set(key, order);
        }

        const stripped = key.replace(/\d+$/, "");

        if (stripped && !lookup.has(stripped)) {
            lookup.set(stripped, order);
        }

    });

    return lookup;

}

/**
 * 목록의 항목 하나가 지금 몇 번 순번인지 찾는다.
 *
 * @param  {String} key
 *         다듬은 ID.
 * @param  {Map} lookup
 *         {@link buildOrderLookup} 가 만든 이름표.
 * @return {Number|null}
 *         찾은 순번. 그 캐릭터가 지금 없으면 null.
 */
function lookupOrder(key, lookup) {

    if (lookup.has(key)) {
        return lookup.get(key);
    }

    const stripped = key.replace(/\d+$/, "");

    if (stripped && lookup.has(stripped)) {
        return lookup.get(stripped);
    }

    return null;

}

/**
 * 순서가 적힌 목록을 훑어, 정보 단계가 들어갈 자리의 순번을 계산한다.
 *
 * 정보 항목 앞뒤로 "지금 실제로 있는" 캐릭터를 찾아 그 사이를 균등하게 나눈다.
 * 예를 들어 앞이 19번, 뒤가 22번이고 그 사이에 정보 항목이 하나라면 20.5번이
 * 된다. 소수점을 쓰는 이유는 기존 캐릭터의 번호를 건드리지 않고 사이에 끼우기
 * 위해서다.
 *
 * @param  {Array.<String>} list
 *         순서가 적힌 ID 목록. 시트의 `_meta.firstNight` 또는 공식 순번표.
 * @param  {Map} lookup
 *         {@link buildOrderLookup} 가 만든 이름표.
 * @return {Map}
 *         정보 항목 ID → 계산된 순번. 계산할 수 없으면 담기지 않는다.
 */
export function resolveInfoOrders(list, lookup) {

    const resolved = new Map();

    if (!Array.isArray(list)) {
        return resolved;
    }

    const gaps = [];
    let gap = null;
    let previousOrder = null;

    list.forEach((entry) => {

        const key = normaliseInfoId(entry);

        if (NIGHT_INFO_IDS.indexOf(key) > -1) {

            if (!gap) {

                gap = {
                    before: previousOrder,
                    after: null,
                    ids: []
                };
                gaps.push(gap);

            }

            gap.ids.push(key);
            return;

        }

        const order = lookupOrder(key, lookup);

        if (order === null) {
            return;
        }

        if (gap) {

            gap.after = order;
            gap = null;

        }

        previousOrder = order;

    });

    gaps.forEach(({ before, after, ids }) => {

        let start = 0;
        let span = 1;

        if (before !== null && after !== null) {

            start = before;
            span = after - before;

        } else if (before !== null) {
            start = before;
        } else if (after !== null) {
            start = after - 1;
        } else {
            return;
        }

        // 앞뒤 순번이 뒤집힌 이상한 데이터라면 균등 분배를 포기하고 1칸만 쓴다.
        if (!(span > 0)) {
            span = 1;
        }

        ids.forEach((id, index) => {
            resolved.set(id, start + span * ((index + 1) / (ids.length + 1)));
        });

    });

    return resolved;

}

/**
 * 정보 단계 하나가 들어갈 순번을 정한다. 우선순위는 세 단계다.
 *
 *   1. 시트가 `_meta.firstNight` 에 적어 둔 자리
 *   2. 공식 순번표(night-order.json)에서의 자리
 *   3. 둘 다 못 구하면 defaultOrder
 *
 * @param  {Object} step
 *         {@link NIGHT_INFO_STEPS} 의 항목 하나.
 * @param  {Map} declaredOrders
 *         시트 선언으로 계산한 순번 모음. 없으면 빈 Map.
 * @param  {Map} officialOrders
 *         공식 순번표로 계산한 순번 모음.
 * @return {Number}
 *         이 단계가 들어갈 순번.
 */
export function pickInfoOrder(step, declaredOrders, officialOrders) {

    if (declaredOrders && declaredOrders.has(step.id)) {
        return declaredOrders.get(step.id);
    }

    if (officialOrders && officialOrders.has(step.id)) {
        return officialOrders.get(step.id);
    }

    return step.defaultOrder;

}
