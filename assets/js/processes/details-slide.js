/**
 * 마도서 / 밤 순서 / 정보 토큰 접이식 메뉴를 열고 닫을 때 위아래로 미끄러지듯 움직인다.
 * - 약 0.5초, 처음엔 빠르고 끝으로 갈수록 느려지는(지수 감속) 움직임.
 * - 열 때는 누르는 순간 바로 open 상태가 되므로, 펼쳐지는 동안에도 보이는 부분은 눌러진다.
 * - 닫을 때는 다 접힌 뒤에 닫힌다. 움직이는 도중 다시 누르면 그 높이에서 반대로 움직인다.
 * - 움직임 줄이기 설정을 켠 기기에서는 효과 없이 바로 열고 닫는다.
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

    function slide(from, to, onDone) {

        if (running) {
            running.onfinish = null;
            running.oncancel = null;
            running.cancel();
        }

        body.style.overflow = "hidden";
        running = body.animate(
            [{ height: from + "px" }, { height: to + "px" }],
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
        const from = closing ? body.getBoundingClientRect().height : 0;

        closing = false;
        details.open = true;
        slide(from, body.scrollHeight);

    }

    function slideClose() {

        closing = true;
        slide(body.getBoundingClientRect().height, 0, () => {

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
