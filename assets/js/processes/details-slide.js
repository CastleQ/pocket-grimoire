/**
 * 마도서 / 밤 순서 / 정보 토큰 접이식 메뉴를 열고 닫을 때 위아래로 미끄러지듯 움직인다.
 * - 약 0.5초, 처음엔 빠르고 끝으로 갈수록 느려지는(지수 감속) 움직임.
 * - 열 때는 누르는 순간 바로 open 상태가 되므로, 펼쳐지는 동안에도 보이는 부분은 눌러진다.
 * - 닫을 때는 다 접힌 뒤에 닫힌다. 움직이는 도중 다시 누르면 그 높이에서 반대로 움직인다.
 * - 움직임 줄이기 설정을 켠 기기에서는 효과 없이 바로 열고 닫는다.
 * - 높이와 함께 안쪽 위아래 여백도 움직인다. 상자 크기 계산(border-box)상 높이만 줄이면
 *   여백(약 24px)에서 멈췄다가 마지막에 툭 닫혀 버벅이는 것처럼 보였다.
 */

const SLIDE_IDS = ["grimoire", "night-order", "info-tokens"];
const DURATION = 500;
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

const reduceMotion = (
    typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
);

SLIDE_IDS.forEach((id) => {

    const details = document.getElementById(id);
    const summary = details && details.querySelector(":scope > summary");
    const body = details && details.querySelector(":scope > .details__body");

    if (
        !details
        || !summary
        || !body
        || reduceMotion
        || typeof body.animate !== "function"
    ) {
        return;
    }

    let running = null;
    let closing = false;

    // 펼쳐진 상태의 위아래 여백(스타일시트 값). 움직이는 중이 아닐 때 한 번 읽어 둔다.
    const bodyStyle = window.getComputedStyle(body);
    const padTop = bodyStyle.paddingTop;
    const padBottom = bodyStyle.paddingBottom;

    function current() {

        const style = window.getComputedStyle(body);

        return {
            height: body.getBoundingClientRect().height + "px",
            paddingTop: style.paddingTop,
            paddingBottom: style.paddingBottom
        };

    }

    const shut = { height: "0px", paddingTop: "0px", paddingBottom: "0px" };

    function slide(from, to, onDone) {

        if (running) {
            running.onfinish = null;
            running.oncancel = null;
            running.cancel();
        }

        body.style.overflow = "hidden";
        running = body.animate(
            [from, to],
            { duration: DURATION, easing: EASE_OUT_EXPO }
        );

        const finish = () => {

            running = null;
            body.style.overflow = "";

            if (onDone) {
                onDone();
            }

        };

        running.onfinish = finish;
        running.oncancel = finish;

    }

    function slideOpen() {

        // 접히는 도중에 다시 누르면 지금 높이에서 다시 펼친다.
        const from = closing ? current() : shut;

        closing = false;
        details.open = true;
        slide(from, {
            height: body.scrollHeight + "px",
            paddingTop: padTop,
            paddingBottom: padBottom
        });

    }

    function slideClose() {

        closing = true;
        slide(current(), shut, () => {

            if (closing) {
                closing = false;
                details.open = false;
            }

        });

    }

    summary.addEventListener("click", (event) => {

        // 제목 옆 부가 버튼(토큰 잠금 등)을 누른 경우는 기존 동작.
        if (
            event.defaultPrevented
            || event.target.closest(".details__summary-aside")
        ) {
            return;
        }

        event.preventDefault();

        if (details.open && !closing) {
            slideClose();
        } else {
            slideOpen();
        }

    });

});
