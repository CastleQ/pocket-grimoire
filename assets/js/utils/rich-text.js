/**
 * 이야기꾼 지시문의 서식을 처리하는 공용 도구.
 *
 * 시트 이미지(sheet.js)와 그리모어의 밤 순서 목록(CharacterToken.js)이
 * 같은 규칙으로 글자를 꾸미도록 한곳에 모아 둔다.
 */

// 지시문에 쓰이는 서식 기호를 한 번에 찾아내는 규칙.
//
//   *별표*     → 굵게 (기호 제거)
//   [대괄호]   → 굵게 (기호 유지)
//   "쌍따옴표" → 기울임 (기호 유지, 곧은 따옴표·곡선 따옴표 모두)
//
// 서식을 늘릴 때는 이 규칙과 appendRichText 의 분기를 한 곳씩만 손보면 된다.
export const RICH_PATTERN = /(\*[^*]+\*|\[[^\]]+\]|"[^"]+"|\u201c[^\u201d]+\u201d)/;

// 캐릭터 능력 설명용. 여기서 별표는 "첫날 밤 제외"를 뜻하는 각주라 강조가
// 아니다. 짝으로 묶어 지워버리면 각주가 사라지므로 대괄호와 따옴표만 본다.
export const RICH_PATTERN_PLAIN = /(\[[^\]]+\]|"[^"]+"|\u201c[^\u201d]+\u201d)/;

// :reminder: 자리에 넣을 표시. 정발 번역 데이터가 "여기서 리마인더 토큰을
// 놓으세요"라는 뜻으로 쓰는 자리표시자다.
export const REMINDER_MARK = "\u25cf";

/**
 * 글자를 서식에 맞춰 잘라 붙인다. 안쪽에 또 서식이 있으면 재귀로 처리한다.
 *
 * 글자는 반드시 createTextNode 로만 넣는다. 공유 링크로 남이 만든 시트를 여는
 * 구조이므로 innerHTML 을 쓰면 안 된다.
 *
 * @param {Element} target
 *        글자를 담을 요소.
 * @param {String} text
 *        원본 글자.
 * @param {Boolean} [plain]
 *        참이면 별표를 강조로 보지 않고 글자 그대로 둔다.
 */
export function appendRichText(target, text, plain) {

    const pattern = plain ? RICH_PATTERN_PLAIN : RICH_PATTERN;

    String(text || "").split(pattern).forEach((chunk) => {

        if (!chunk) {
            return;
        }

        const head = chunk.charAt(0);
        const tail = chunk.charAt(chunk.length - 1);

        if (chunk.length > 2) {

            // *별표* — 기호를 지우고 굵게.
            if (head === "*" && tail === "*") {

                const strong = document.createElement("strong");

                appendRichText(strong, chunk.slice(1, -1), plain);
                target.append(strong);

                return;

            }

            // [대괄호] — 기호를 남기고 굵게.
            if (head === "[" && tail === "]") {

                const strong = document.createElement("strong");

                strong.append(document.createTextNode(head));
                appendRichText(strong, chunk.slice(1, -1), plain);
                strong.append(document.createTextNode(tail));
                target.append(strong);

                return;

            }

            // "쌍따옴표" — 기호를 남기고 기울임.
            if (
                (head === "\"" && tail === "\"")
                || (head === "\u201c" && tail === "\u201d")
            ) {

                const emphasis = document.createElement("em");

                emphasis.append(document.createTextNode(head));
                appendRichText(emphasis, chunk.slice(1, -1), plain);
                emphasis.append(document.createTextNode(tail));
                target.append(emphasis);

                return;

            }

        }

        target.append(document.createTextNode(chunk));

    });

}

/**
 * 이야기꾼 지시문을 요소 안에 채운다. :reminder: 는 토큰 표시로 바꾸고,
 * 나머지 서식은 appendRichText 가 처리한다.
 *
 * @param {Element} target
 *        글자를 담을 요소. 원래 있던 내용은 지운다.
 * @param {String} text
 *        원본 지시문.
 */
export function appendReminderText(target, text) {

    target.textContent = "";

    appendRichText(
        target,
        String(text || "").split(":reminder:").join(REMINDER_MARK)
    );

}
