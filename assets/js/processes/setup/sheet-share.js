// 시트 링크 공유 (C-2)
//
// 시트 데이터를 Supabase 장부에 저장하고 짧은 링크를 받아 클립보드에 넣는다.
// 저장·조회는 모두 함수(RPC)를 통해서만 이루어지며, 테이블 직접 접근은
// RLS로 차단되어 있다.
//
// ⚠️ 이 파일은 브라우저에서 도는 코드다. 폴리필이 꺼져 있으므로
//    async / await 를 쓰지 않고 Promise 체인으로만 작성한다. (규약 C-8)

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const MAX_BYTES = 900000;   // 서버 상한 1MB보다 낮게 잡아 여유를 둔다
const MIN_BYTES = 20;
const RESET_DELAY = 5000;

function sbHeaders() {
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    };
}

/**
 * 장부에 시트를 저장하고 링크 번호(토큰)를 받아온다.
 */
function saveSharedSheet(payload) {

    return fetch(SUPABASE_URL + "/rest/v1/rpc/save_shared_sheet", {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({ p_json: payload })
    }).then(function (response) {

        if (!response.ok) {
            return response.text().then(function (text) {
                throw new Error("서버 응답 " + response.status + ": " + text);
            });
        }

        return response.json();

    }).then(function (token) {

        if (typeof token !== "string" || token.length < 10) {
            throw new Error("서버가 올바른 링크 번호를 주지 않았습니다.");
        }

        return token;

    });

}

/**
 * 예전 브라우저용 복사 수단. 성공하면 true.
 */
function legacyCopy(text) {

    const area = document.createElement("textarea");

    area.value = text;
    area.setAttribute("readonly", "readonly");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, text.length);

    let copied = false;

    try {
        copied = document.execCommand("copy");
    } catch (ignore) {
        copied = false;
    }

    area.remove();

    return copied;

}

/**
 * 클립보드에 넣는다. 실패해도 예외를 던지지 않고 false 를 돌려준다.
 */
function copyLink(text) {

    if (navigator.clipboard && navigator.clipboard.writeText) {

        return navigator.clipboard.writeText(text).then(function () {
            return true;
        }).catch(function () {
            return legacyCopy(text);
        });

    }

    return Promise.resolve(legacyCopy(text));

}

/**
 * 결과를 화면에 보여준다. 글자는 textContent 로만 넣는다.
 */
function showResult(container, message, link) {

    container.textContent = "";
    container.hidden = false;

    const text = document.createElement("p");

    text.textContent = message;
    container.append(text);

    if (!link) {
        return;
    }

    const field = document.createElement("input");

    field.type = "text";
    field.readOnly = true;
    field.value = link;
    field.style.width = "100%";
    field.addEventListener("focus", function () {
        field.select();
    });

    container.append(field);

}

/**
 * 공유 버튼을 켠다.
 *
 * @param {Function} getPayload 지금 시트 내용을 돌려주는 함수.
 */
export function initSheetShare(getPayload) {

    const button = document.querySelector("#share-sheet");
    const result = document.querySelector("#share-sheet-result");

    if (!button || !result) {
        return;
    }

    const label = button.querySelector(".button__text");
    const idle = label ? label.textContent : "";
    let timer = null;

    function setLabel(text) {

        if (label) {
            label.textContent = text;
        }

    }

    function restore() {

        window.clearTimeout(timer);

        timer = window.setTimeout(function () {
            setLabel(idle);
            button.disabled = false;
        }, RESET_DELAY);

    }

    button.addEventListener("click", function () {

        const payload = getPayload();
        const size = JSON.stringify(payload).length;

        if (size < MIN_BYTES) {
            showResult(result, "공유할 시트 내용이 없습니다.", "");
            return;
        }

        if (size > MAX_BYTES) {
            showResult(result, "시트가 너무 커서 공유할 수 없습니다.", "");
            return;
        }

        button.disabled = true;
        setLabel("링크 만드는 중…");
        result.hidden = true;

        saveSharedSheet(payload).then(function (token) {

            const url = new URL("sheet.html", window.location.href);

            url.search = "";
            url.hash = "";
            url.searchParams.set("s", token);

            const link = url.toString();

            return copyLink(link).then(function (copied) {

                if (copied) {
                    setLabel("✅ 복사 완료");
                    showResult(result, "✅ 링크가 복사되었습니다", link);
                } else {
                    setLabel("링크 생성됨");
                    showResult(
                        result,
                        "아래 주소를 길게 눌러 복사해 주세요.",
                        link
                    );
                }

            });

        }).catch(function (error) {

            setLabel("실패");
            showResult(result, "공유에 실패했습니다: " + error.message, "");

        }).then(function () {

            restore();

        });

    });

}