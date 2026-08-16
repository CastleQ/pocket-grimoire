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

const store = Store.create("pocket-grimoire");

// 알릴 내용이 없으면 아무것도 하지 않는다.
if (NOTICE_ID && NOTICE_ITEMS.length) {

    const seen = store.getNotice();
    const isReturning = Boolean(store.getVersion());

    // 처음 온 사람에게는 띄우지 않는다. 바뀐 점을 알리는 안내이므로 전에 쓰던
    // 사람에게만 의미가 있다. 저장된 판번호가 있으면 전에 쓰던 사람이다.
    if (isReturning && seen !== NOTICE_ID) {

        const dialog = lookupOne("#update-notice");
        const body = lookupOne("#update-notice-body");

        if (dialog && body) {

            const heading = document.createElement("h3");
            const list = document.createElement("ul");

            heading.textContent = NOTICE_TITLE;

            NOTICE_ITEMS.forEach((text) => {

                const item = document.createElement("li");

                item.textContent = text;
                list.append(item);

            });

            body.textContent = "";
            body.append(heading);
            body.append(list);

            Dialog.create(dialog).show();

        }

    }

    // 띄웠든 아니든 이번 번호를 본 것으로 남긴다. 그래야 두 번째 접속부터는
    // 뜨지 않고, 처음 온 사람도 다음 공지부터 정상으로 받게 된다.
    store.setNotice(NOTICE_ID);

}
