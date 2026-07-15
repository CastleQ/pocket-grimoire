import Token from "./Token.js";
import Template from "./Template.js";

/**
 * A version of {@link Token} for reminder tokens.
 * @extends Token
 */
export default class ReminderToken extends Token {

    /**
     * Sets the templates that will be access when drawing views.
     *
     * @param {Object} templates
     *        A map of keys to {@link Template} instances.
     */
    static setTemplates(templates) {

        /**
         * The templates that all instances will access.
         * @type {Object}
         */
        this.templates = templates;

    }

    /**
     * A collection of all global reminders - reminders that aren't attached to
     * any character but might still be useful for play.
     * @type {Array.<ReminderToken>}
     */
    static global = [];

    /**
     * Adds a reminder to {@link ReminderToken.global}.
     *
     * @param {ReminderToken} reminder
     *        Global reminder to add.
     */
    static addGlobal(reminder) {
        this.global.push(reminder);
    }

    /**
     * Exposes {@link ReminderToken.global}.
     *
     * @return {Array.<ReminderToken>}
     *         All global reminders.
     */
    static getGlobal() {
        return this.global;
    }

    /**
     * 시트와 무관하게 항상 존재하는 "커스텀 알림" 리마인더를 만든다.
     * 이미지가 없고, 이야기꾼이 자유롭게 텍스트를 적을 수 있다.
     *
     * @return {ReminderToken}
     */
    static createCustom() {
        return new this({
            id: "custom-alert:0",
            characterId: "custom-alert",
            characterName: "커스텀 알림",
            text: "",
            image: "",
            isGlobal: true,
            isCustom: true
        });
    }

    /**
     * @inheritDoc
     */
    processData(data) {

        // Provide some default values so that .get() methods don't worry about
        // missing data and instead worry about typos.

        return {
            id: "",
            text: "",
            image: "",
            characterId: "",
            characterName: "",
            isGlobal: false,
            isCustom: false,
            ...data
        };

    }

    /**
     * 커스텀 알림의 텍스트를 갱신한다.
     *
     * @param  {String} text
     * @return {ReminderToken}
     */
    setText(text) {
        this.data.text = text;
        return this;
    }

    /**
     * Draws the reminder token.
     *
     * @return {DocumentFragment}
     *         Populated token.
     */
    drawToken() {

        const {
            image,
            text,
            characterName,
            isCustom
        } = this.data;
        // image가 선/악 배열이면 기본색([0])을 사용한다.
        const src = Array.isArray(image) ? (image[0] || "") : (image || "");
        // 커스텀 알림: 내용이 비어 있으면 "커스텀 알림" 라벨을 대신 보여준다.
        const customLabel = (text && text.trim()) ? text : "커스텀 알림";
        // 커스텀은 이미지가 없다. 빈 src("")는 레이아웃 박스를 만들지 못해 목록에서
        // 토큰이 작아지므로, 투명 1x1 이미지를 넣어 다른 리마인더와 같은 크기를 확보한다.
        const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

        return this.constructor.templates.token.draw({
            ".js--reminder--name"(element) {
                element.textContent = isCustom ? "" : characterName;
            },
            ".js--reminder--text"(element) {
                element.textContent = isCustom ? "" : text;
            },
            ".js--reminder--custom"(element) {
                element.textContent = isCustom ? customLabel : "";
            },
            ".js--reminder--image"(element) {
                element.src = isCustom ? TRANSPARENT_PIXEL : src;
                const root = element.closest(".reminder");
                if (root) {
                    root.classList.toggle("is-custom", Boolean(isCustom));
                }
            }
        });

    }

    /**
     * Draws the reminder list item.
     *
     * @return {DocumentFragment}
     *         Populated reminder list item.
     */
    drawList() {

        const {
            id,
            isGlobal
        } = this.data;

        return this.constructor.templates.list.draw({
            ".js--reminder-list--item,.js--reminder-list--button"(element) {
                element.dataset.reminderId = id;
            },
            ".js--reminder-list--item"(element) {
                element.classList.toggle("is-global", isGlobal);
            },
            ".js--reminder-list--button": (element) => {
                element.append(this.drawToken());
            },
            ".js--reminder-list--checkbox"(element) {
                element.value = id;
            }
        });

    }


}