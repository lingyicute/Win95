/** The text clipboard shared by Notepad, WordPad, Calculator and Character Map. */
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
}
