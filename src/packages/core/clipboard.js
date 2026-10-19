/**
 * The text clipboard shared by Notepad, WordPad, Calculator and Character Map.
 *
 * Not every copy goes through `copyText`: Ctrl+C and Ctrl+X are handled by the
 * browser itself, which writes the selection straight to the system clipboard
 * without asking this module. Clipboard Viewer reads `s.clipboard`, so those
 * copies have to be noted here as they happen - otherwise a note copied with
 * the keyboard would never appear in it, while the same text copied from the
 * Edit menu would.
 */
export function installClipboard(s) {
    s.copyText = text => {
        s.clipboard = { type: 'text', text: String(text) };
        navigator.clipboard?.writeText(String(text)).catch(() => { });
    };
    s.pasteText = async () => {
        /* An empty result must come back as null: insert('') deletes the
           selection, so a failed or empty paste must be a no-op, not a wipe. */
        if (s.clipboard?.type === 'text')
            return s.clipboard.text || null;
        try {
            return (await navigator.clipboard.readText()) || null;
        }
        catch {
            return null;
        }
    };
    if (typeof document === 'undefined')
        return;
    /* The field the user worked in last. A text box keeps its selection while
       the pointer goes elsewhere - onto a menu, into another window - and a
       copy is about that selection, not about whichever window the menus
       happen to belong to. */
    let lastField = null;
    const remember = event => {
        const target = event.target;
        if (target && /^(?:INPUT|TEXTAREA)$/.test(target.tagName))
            lastField = target;
    };
    for (const type of ['focusin', 'pointerdown', 'keydown', 'input'])
        document.addEventListener(type, remember, true);
    /**
     * The text a copy or cut is about to take. A selected piece of a text
     * field is read from the field; anything else selected on the page - a
     * WordPad document, help text - is read from the page selection. An empty
     * answer means there was nothing selected, and the clipboard keeps what it
     * had, as it would on a desktop where Copy with no selection does nothing.
     */
    const textIn = field => {
        if (typeof field?.value !== 'string')
            return '';
        const { selectionStart: start, selectionEnd: end, value } = field;
        return end > start ? value.slice(start, end) : '';
    };
    const copiedText = () => {
        const active = document.activeElement;
        /* The caret's own selection first; then a selection made anywhere on
           the page, which is how a WordPad document or help text is copied;
           then the text box the user left behind for a menu. */
        if (active && /^(?:INPUT|TEXTAREA)$/.test(active.tagName)) {
            const selected = textIn(active);
            if (selected)
                return selected;
        }
        const onPage = String(document.getSelection?.() ?? '');
        if (onPage)
            return onPage;
        return textIn(lastField);
    };
    for (const type of ['copy', 'cut'])
        document.addEventListener(type, () => {
            const text = copiedText();
            if (text)
                s.clipboard = { type: 'text', text };
        });
}
