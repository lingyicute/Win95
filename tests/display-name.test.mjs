import test from 'node:test';
import assert from 'node:assert/strict';
import { displayName } from '../src/packages/core/filesystem.js';

test('shortcuts drop their .lnk everywhere', () => {
    assert.equal(displayName({ path: 'C:\\Desktop\\Shortcut to Notes.lnk', type: 'file' }), 'Shortcut to Notes');
    assert.equal(displayName({ path: 'C:\\Desktop\\notes.v2.lnk', type: 'file' }), 'notes.v2');
});

test('hidden extensions drop one suffix from files only', () => {
    assert.equal(displayName({ path: 'C:\\Docs\\Report.docx', type: 'file' }, true), 'Report');
    assert.equal(displayName({ path: 'C:\\Docs\\Report.docx', type: 'file' }, false), 'Report.docx');
    assert.equal(displayName({ path: 'C:\\Docs\\archive.tar.gz', type: 'file' }, true), 'archive.tar');
    assert.equal(displayName({ path: 'C:\\Docs\\noext', type: 'file' }, true), 'noext');
});

test('folders keep their names, dots and all', () => {
    assert.equal(displayName({ path: 'C:\\Docs\\My.Stuff', type: 'folder' }, true), 'My.Stuff');
    assert.equal(displayName({ path: 'C:\\Docs\\My.Stuff', type: 'folder' }, false), 'My.Stuff');
});
