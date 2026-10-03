// 마도서 [게임 내보내기] — 마도서 화면을 그림으로 만들어 복사·저장한다.
//
// 흐름: 선택 창(지우고 내보내기 / 승패 표시) → (승패 표시면) 승리 팀 선택 →
//       그림 만들기 → 결과 창에서 [클립보드에 복사] / [이미지로 저장]
//
// 마도서를 통째로 복사한 사본을 화면 밖에 붙이고, 지우기·승패 글자는 그 사본에만
// 적용한 뒤 찍는다. 실제 마도서는 전혀 바뀌지 않는다.
// 촬영은 modern-screenshot(브라우저가 직접 그린 모습 그대로)으로 한다.
// html2canvas 는 CSS 를 흉내 내 다시 그리는 방식이라 토큰의 grid 배치·여러 겹 배경·
// 안쪽 그림자를 못 그려 토큰이 갈색 원으로 나왔다.
// 촬영 도구는 이 기능을 쓸 때만 따로 불러온다(첫 화면 용량 절약).
import Dialog from "../../classes/Dialog.js";
import {
    lookupOne,
    lookupOneCached
} from "../../utils/elements.js";

// 참가자가 아닌 토큰. 지우고 내보내기에서도 그대로 둔다.
const KEEP_TEAMS = ["fabled", "loric"];

const WINNERS = {
    good: { text: "선팀 승", colour: "#2f6fe0" },
    evil: { text: "악팀 승", colour: "#d62828" }
};

// 토큰은 grid 한 칸에 그림·이름·숫자를 겹쳐 쌓는다(grid-area: 1 / -1).
// 촬영 도구가 칸 크기를 "150px"처럼 고정해 옮겨 적으면 -1 이 두 번째 칸을 가리켜
// 그림·이름이 옆으로 밀려난다. 촬영하는 사본에서만 같은 뜻의 1 / 1 로 바꾼다.
const COPY_CLASS = "pad-wrapper--export";
const COPY_CSS = [
    ".character > *", ".reminder > *",
    ".character::before", ".character::after",
    ".reminder::before", ".reminder::after"
].map((selector) => "." + COPY_CLASS + " " + selector).join(",")
    + "{grid-area:1 / 1 !important}"
    // 밤 순서 숫자(첫날 밤 왼쪽·다른 밤 오른쪽)는 margin auto 로 좌우에 붙는데,
    // 촬영 도구가 이를 옮기지 못해 둘 다 왼쪽에 겹쳤다. 좌우 정렬로 대신 붙인다.
    + "." + COPY_CLASS + " .character::before{justify-self:start}"
    + "." + COPY_CLASS + " .character::after{justify-self:end}"
    + "." + COPY_CLASS + " .character.is-upside-down::before{justify-self:end}"
    + "." + COPY_CLASS + " .character.is-upside-down::after{justify-self:start}";

const optionDialog = Dialog.create(lookupOne("#game-export"));
const winnerDialog = Dialog.create(lookupOne("#game-export-winner"));
const resultDialog = Dialog.create(lookupOne("#game-export-result"));

const blankInput = lookupOne("#export-blank");
const winnerInput = lookupOne("#export-winner");
const status = lookupOne("#export-status");
const image = lookupOne("#export-image");
const copyButton = lookupOne("#export-copy");
const saveButton = lookupOne("#export-save");

let blob = null;
let imageUrl = "";

function setStatus(text) {
    status.textContent = text;
}

function resetResult() {

    if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
    }

    blob = null;
    imageUrl = "";
    image.hidden = true;
    image.removeAttribute("src");
    copyButton.disabled = true;
    saveButton.disabled = true;

}

/**
 * 참가자 토큰을 빈 토큰으로 만든다: 그림·캐릭터 이름·사망 표시·밤 순서 숫자·잎을
 * 모두 지우고 참가자 이름만 남긴다.
 *
 * @param {Element} token  .js--token--wrapper 사본.
 */
function blankToken(token) {

    const character = token.querySelector(".js--character");

    token.classList.remove("is-dead", "is-upside-down");

    if (!character) {
        return;
    }

    Array.from(character.attributes).forEach(({ name }) => {

        if (name.startsWith("data-")) {
            character.removeAttribute(name);
        }

    });
    character.className = "character";
    character.querySelectorAll(
        ".character__image, .character__text, .character__shroud"
    ).forEach((element) => element.remove());

}

/**
 * 촬영용 사본을 만들어 화면 밖에 붙인다.
 *
 * @param  {Object} settings  { blank, winner }
 * @return {Element}          사본(.pad-wrapper). 다 쓰면 지운다.
 */
function buildCopy(settings) {

    const live = lookupOneCached(".js--pad");
    const children = Array.from(live.children);
    const keep = new Set();

    live.pad.characters.forEach(({ character, token }) => {

        if (KEEP_TEAMS.includes(character.getTeam())) {
            keep.add(children.indexOf(token));
        }

    });

    const style = window.getComputedStyle(live);
    const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    // 스크롤 밖으로 나간 토큰까지 모두 담기도록 판을 내용 크기만큼 펼친다.
    const width = Math.max(live.clientWidth, live.scrollWidth) + borderX;
    const height = Math.max(live.clientHeight, live.scrollHeight) + borderY;

    const copy = live.closest(".pad-wrapper").cloneNode(true);
    const pad = copy.querySelector(".js--pad");

    copy.classList.add(COPY_CLASS);
    copy.setAttribute("aria-hidden", "true");
    Object.assign(copy.style, {
        position: "fixed",
        top: "0",
        left: "-100000px",
        width: width + "px",
        margin: "0",
        pointerEvents: "none"
    });
    // 상자 크기 계산이 border-box 라 테두리 두께까지 더한 값이다.
    Object.assign(pad.style, {
        width: width + "px",
        height: height + "px",
        overflow: "hidden",
        resize: "none"
    });
    copy.querySelectorAll(".pad-wrapper__icon").forEach((icon) => icon.remove());
    // 토큰 그림은 "보일 때 불러오기"라 화면 밖 사본에서는 영영 안 불려
    // 촬영 도구가 시간 제한(30초)까지 기다렸다. 사본은 바로 불러온다.
    copy.querySelectorAll("img").forEach((img) => {
        img.loading = "eager";
    });

    const tally = copy.querySelector("#grimoire-tally");

    if (tally) {
        tally.removeAttribute("id");
    }

    if (settings.blank) {

        Array.from(pad.children).forEach((token, index) => {

            if (token.dataset.token === "reminder") {
                token.remove();
            } else if (token.dataset.token === "character" && !keep.has(index)) {
                blankToken(token);
            }

        });

    }

    if (settings.winner) {

        if (tally) {
            tally.remove();
        }

        // 게임이 끝났으므로 모든 참가자를 생존으로 보여 준다
        // (회색 처리·수의·유령표가 모두 is-dead 하나에 달려 있다).
        copy.querySelectorAll(".js--character.is-dead").forEach((character) => {
            character.classList.remove("is-dead");
        });

        const winner = WINNERS[settings.winner];
        const banner = document.createElement("div");
        const inner = Math.min(width - borderX, height - borderY);

        banner.textContent = winner.text;
        Object.assign(banner.style, {
            position: "absolute",
            inset: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // 토큰(z-index 1 이상) 아래, 마도서 배경 바로 위에 깐다.
            zIndex: "0",
            fontFamily: "var(--serif-font)",
            fontWeight: "bold",
            fontSize: Math.round(inner * 0.16) + "px",
            lineHeight: "1",
            whiteSpace: "nowrap",
            color: winner.colour,
            textShadow: "0 0 0.06em #fff, 0 0 0.12em #fff, 0.03em 0.03em 0.08em #000",
            pointerEvents: "none"
        });
        pad.prepend(banner);

    }

    document.body.append(copy);

    return copy;

}

function capture(settings) {

    let copy = null;
    const sheet = document.createElement("style");

    function cleanUp() {

        sheet.remove();

        if (copy) {
            copy.remove();
        }

    }

    return import("modern-screenshot").then(({ domToBlob }) => {

        sheet.textContent = COPY_CSS;
        document.head.append(sheet);
        copy = buildCopy(settings);

        return (
            document.fonts && document.fonts.ready
            ? document.fonts.ready
            : Promise.resolve()
        ).then(() => domToBlob(copy, {
            type: "image/png",
            // 글꼴은 woff2 한 벌만 담는다(같은 글꼴의 woff 예비 파일까지 받지 않게).
            font: { preferredFormat: "woff2" },
            scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1))
        }));

    }).then((result) => {

        cleanUp();

        if (!result) {
            throw new Error("그림을 만들지 못했습니다.");
        }

        return result;

    }, (error) => {

        cleanUp();
        throw error;

    });

}

function run(settings) {

    resetResult();
    setStatus("마도서 그림을 만드는 중이에요…");
    resultDialog.show();

    capture(settings).then((result) => {

        blob = result;
        imageUrl = URL.createObjectURL(result);
        image.src = imageUrl;
        image.hidden = false;
        copyButton.disabled = false;
        saveButton.disabled = false;
        setStatus("");

    }).catch((error) => {

        console.error(error);
        setStatus("그림을 만들지 못했어요. 다시 시도해 주세요.");

    });

}

lookupOne("#export-game").addEventListener("click", () => {
    blankInput.checked = false;
    winnerInput.checked = false;
});

lookupOne("#export-yes").addEventListener("click", () => {

    optionDialog.hide();

    if (winnerInput.checked) {
        winnerDialog.show();
        return;
    }

    run({ blank: blankInput.checked, winner: "" });

});

lookupOne("#game-export-winner").addEventListener("click", ({ target }) => {

    const button = target.closest("[data-export-winner]");

    if (!button) {
        return;
    }

    winnerDialog.hide();
    run({ blank: blankInput.checked, winner: button.dataset.exportWinner });

});

// 휴대폰에서는 [클립보드에 복사] 대신 [공유하기]를 쓴다.
// 안드로이드 클립보드는 그림 대신 임시 파일 주소(content://…)를 담는다.
// 그림 붙여넣기를 지원하지 않는 앱(카카오톡 입력창 등)에는 그 주소가 글자로 붙는다.
// 공유하기는 휴대폰 공유 창으로 그림 파일을 그대로 넘긴다.
// PC 브라우저 일부도 공유를 지원하지만, PC는 클립보드 복사가 잘 되므로 그대로 둔다.
// 판정 기준: 주 입력이 터치(손가락)이고, 그림 파일 공유를 지원할 때.
const useShare = (() => {

    try {

        return (
            typeof window.matchMedia === "function"
            && window.matchMedia("(pointer: coarse)").matches
            && typeof navigator.share === "function"
            && typeof navigator.canShare === "function"
            && navigator.canShare({
                files: [new File([""], "grimoire.png", { type: "image/png" })]
            })
        );

    } catch (ignore) {
        return false;
    }

})();

if (useShare) {
    copyButton.textContent = "공유하기";
}

// 한글 파일 이름은 일부 브라우저에서 "download"로 바뀌어 영문으로 둔다.
function makeFileName() {

    const now = new Date();
    const two = (number) => String(number).padStart(2, "0");

    return "grimoire-" + now.getFullYear() + two(now.getMonth() + 1)
        + two(now.getDate()) + "-" + two(now.getHours()) + two(now.getMinutes())
        + ".png";

}

function shareImage() {

    const file = new File([blob], makeFileName(), { type: "image/png" });

    navigator.share({ files: [file] }).then(() => {
        setStatus("");
    }).catch((error) => {

        // 공유 창에서 그냥 닫은 경우는 실패가 아니다.
        if (error && error.name === "AbortError") {
            return;
        }

        console.error(error);
        setStatus("공유하지 못했어요. [이미지로 저장]을 눌러 저장한 뒤 보내 주세요.");

    });

}

function copyImage() {

    const supported = (
        navigator.clipboard
        && typeof navigator.clipboard.write === "function"
        && typeof window.ClipboardItem === "function"
    );

    if (!supported) {
        setStatus("이 브라우저는 그림 복사를 지원하지 않아요. 그림을 길게 눌러 복사하거나 [이미지로 저장]을 눌러 주세요.");
        return;
    }

    navigator.clipboard.write([
        new window.ClipboardItem({ "image/png": blob })
    ]).then(() => {
        setStatus("클립보드에 복사했어요. 원하는 곳에 붙여넣기 하세요.");
    }).catch((error) => {
        console.error(error);
        setStatus("복사하지 못했어요. 그림을 길게 눌러 복사하거나 [이미지로 저장]을 눌러 주세요.");
    });

}

copyButton.addEventListener("click", () => {

    if (!blob) {
        return;
    }

    if (useShare) {
        shareImage();
    } else {
        copyImage();
    }

});

saveButton.addEventListener("click", () => {

    if (!imageUrl) {
        return;
    }

    const link = document.createElement("a");

    link.href = imageUrl;
    link.download = makeFileName();
    document.body.append(link);
    link.click();
    link.remove();

});

resultDialog.on(Dialog.HIDE, resetResult);
