import { STORE_KEY } from "../utils/play-mode.js";
import Store from "../classes/Store.js";
import Dialog from "../classes/Dialog.js";
import {
    lookupOne
} from "../utils/elements.js";
import {
    NOTICE_ID,
    NOTICE_TITLE,
    NOTICE_ITEMS
} from "../constants/notice.js";

const store = Store.create(STORE_KEY);

// 항목 안의 [글자](https://주소) 를 새 창 링크로 바꿔 붙인다. 나머지는 글자 그대로.
// 글자에 대괄호를 보이고 싶으면 [[글자]](주소) — 안쪽 [ ]까지 링크 글자가 된다.
const LINK = /\[((?:\[[^\]]*\]|[^\]])+)\]\((https:\/\/[^)\s]+)\)/g;

function appendText(item, text) {

    let last = 0;

    text.replace(LINK, (whole, label, url, index) => {

        item.append(text.slice(last, index));

        const link = document.createElement("a");

        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;
        item.append(link);
        last = index + whole.length;

        return whole;

    });

    item.append(text.slice(last));

}

// [앞으로 그만보기]로 닫은 공지 번호. 마도서 저장소(store)와 따로 둬서 [캐시 삭제]로 지워지지 않는다.
// (본 기록 store.notice 는 캐시 삭제 때 비운다 → 그만보기를 안 했으면 캐시 삭제 뒤 다시 뜬다. clear-cache.js)
const DISMISS_KEY = "pg_notice_dismissed";

function readDismissed() {
    try {
        return window.localStorage.getItem(DISMISS_KEY) || "";
    } catch (ignore) {
        return "";
    }
}

// 항목 하나: 글자, 또는 ["글자", ["하위 항목", …]]
function drawItem(entry) {

    const [text, children] = Array.isArray(entry) ? entry : [entry, []];
    const item = document.createElement("li");

    // 항목 안의 줄바꿈(\n)을 그대로 보여준다.
    item.style.whiteSpace = "pre-line";
    appendText(item, text);

    if (children && children.length) {
        const sub = document.createElement("ul");
        children.forEach((child) => sub.append(drawItem(child)));
        item.append(sub);
    }

    return item;

}

// 알릴 내용이 없으면 아무것도 하지 않는다.
if (NOTICE_ID && NOTICE_ITEMS.length) {

    const seen = store.getNotice();
    const isReturning = Boolean(store.getVersion());

    // 처음 온 사람에게는 띄우지 않는다. 바뀐 점을 알리는 안내이므로 전에 쓰던
    // 사람에게만 의미가 있다. 저장된 판번호가 있으면 전에 쓰던 사람이다.
    if (isReturning && seen !== NOTICE_ID && readDismissed() !== NOTICE_ID) {

        const dialog = lookupOne("#update-notice");
        const body = lookupOne("#update-notice-body");

        if (dialog && body) {

            const heading = document.createElement("h3");
            const list = document.createElement("ul");

            heading.textContent = NOTICE_TITLE;

            NOTICE_ITEMS.forEach((entry) => list.append(drawItem(entry)));

            body.textContent = "";
            body.append(heading);
            body.append(list);

            const notice = Dialog.create(dialog);

            // [확인]이든 ×든 닫을 때 체크돼 있으면 이 공지는 다시 안 띄운다.
            notice.on(Dialog.HIDE, () => {
                if (lookupOne("#update-notice-dismiss").checked) {
                    try {
                        window.localStorage.setItem(DISMISS_KEY, NOTICE_ID);
                    } catch (ignore) {
                        // localStorage 사용 불가 시 무시
                    }
                }
            });

            notice.show();

        }

    }

    // 띄웠든 아니든 이번 번호를 본 것으로 남긴다. 그래야 두 번째 접속부터는
    // 뜨지 않고, 처음 온 사람도 다음 공지부터 정상으로 받게 된다.
    store.setNotice(NOTICE_ID);

}
