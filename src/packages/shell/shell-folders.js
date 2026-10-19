import { normalizePath, parentPath } from '@win95/core/filesystem.js';

/**
 * The desktop and the Recycle Bin are folders on the volume, so Explorer can
 * delete or rename them like anything else - and a backup can arrive without
 * them, since a restore only checks that every parent directory exists.
 *
 * The shell still has to draw. Reading one of these folders through here gives
 * an empty list instead of an exception, and when only the folder itself went
 * missing its place is put back: it belongs to the shell, not to a document the
 * user might have deleted. A folder whose own parent is gone is left alone -
 * renaming C:\Windows deliberately takes everything under it along, and
 * recreating C:\Windows\Desktop there would leave a stray empty Windows folder.
 */
export function shellFolder(fs, path) {
    const wanted = normalizePath(path);
    try {
        if (fs.get(wanted)?.type !== 'folder' && fs.get(parentPath(wanted))?.type === 'folder')
            fs.ensureFolders(wanted);
        return fs.list(wanted);
    }
    catch {
        return [];
    }
}
