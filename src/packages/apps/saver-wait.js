/**
 * The wait time shared by the Screen Saver tab in Display Properties and the
 * Power applet.
 *
 * `saverMinutes` is the only value the desktop polls, so both dialogs edit it
 * directly. Power shows a short list of presets and must still be able to show
 * (and keep) a value typed in Display, which is why the current value becomes
 * a custom entry instead of being rounded to the nearest preset.
 */
export const SAVER_WAITS = [[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [10, '10 minutes'], [30, '30 minutes']];

/** Coerces a stored wait value to non-negative minutes. */
export function saverWaitMinutes(value) {
    const minutes = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(minutes) && minutes >= 0 ? minutes : 0;
}

/** Presets for the Power applet, plus the current value when it is not one. */
export function saverWaitOptions(value) {
    const minutes = saverWaitMinutes(value);
    const options = SAVER_WAITS.map(([preset, label]) => ({ value: String(preset), label }));
    if (!SAVER_WAITS.some(([preset]) => preset === minutes))
        options.unshift({ value: String(minutes), label: `${minutes} minutes (custom)` });
    return options;
}
