/**
 * 마도서 / 밤 순서 / 정보 토큰 접이식 메뉴를 열 때 아래로 미끄러지듯 펼친다.
 * - 약 0.5초, 처음엔 빠르고 끝으로 갈수록 느려지는(지수 감속) 움직임.
 * - 여는 순간 바로 open 상태가 되므로, 펼쳐지는 동안에도 보이는 부분은 눌러진다.
 * - 닫을 때는 기존처럼 바로 닫는다. 움직임 줄이기 설정을 켠 기기에서는 효과 없음.
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

    if (!details || !summary || !body || reduceMotion) {
        return;
    }

    summary.addEventListener("click", (event) => {

        // 이미 열려 있으면(닫기) 또는 제목 옆 부가 버튼(토큰 잠금 등)을 누른 경우는 기존 동작.
        if (
            details.open
            || event.defaultPrevented
            || event.target.closest(".details__summary-aside")
        ) {
            return;
        }

        event.preventDefault();
        details.open = true;

        const height = body.scrollHeight;

        if (!height || typeof body.animate !== "function") {
            return;
        }

        body.style.overflow = "hidden";

        const animation = body.animate(
            [{ height: "0px" }, { height: height + "px" }],
            { duration: DURATION, easing: EASE_OUT_EXPO }
        );

        animation.onfinish = animation.oncancel = () => {
            body.style.overflow = "";
        };

    });

});
