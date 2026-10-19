import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * A path in a help topic is a string inside a string: 'C:\\My Documents' has to
 * be written with two backslashes, because a single one in front of a letter the
 * JavaScript escape table does not know is dropped without a word. The Chinese
 * "Working with files" topic had it that way, and the topic that teaches where
 * documents live told the reader C:My Documents.
 *
 * Every topic in both languages is checked here against the shape of a real
 * path: a drive letter is always followed by a backslash. Prose that names a
 * drive - "the same C: drive as Explorer" - has a space after the colon and is
 * left alone.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const { helpTopic, helpTopicsOrder } = await import('../src/packages/apps/utilities.js');

const topics = () => helpTopicsOrder().map(key => [key, helpTopic(key, 'en'), helpTopic(key, 'zh')]);

test('every help topic keeps the backslash after a drive letter', () => {
    for (const [key, en, zh] of topics()) {
        for (const [lang, topic] of [['en', en], ['zh', zh]]) {
            if (!topic)
                continue;
            const text = `${topic.title}\n${topic.body}`;
            /* 'C:My Documents' is a swallowed '\M'; 'C: drive' is prose. */
            const swallowed = [...text.matchAll(/\b([A-Za-z]):(?=[A-Za-z<])/g)].map(m => m[0]);
            assert.deepEqual(swallowed, [], `${key} (${lang}) lost a backslash: ${swallowed.join(', ')}`);
        }
    }
});

test('the topic that says where documents live spells the path', () => {
    for (const lang of ['en', 'zh']) {
        assert.match(helpTopic('files', lang).body, /C:\\My Documents/, `${lang} names the folder`);
    }
});

test('the command-prompt examples keep their paths and line breaks', () => {
    const body = helpTopic('dos', 'en').body;
    const pre = body.slice(body.indexOf('<pre>'), body.indexOf('</pre>'));
    for (const line of ['CD "C:\\My Documents"', 'TYPE "Read Me.txt"', 'ECHO Hello &gt; hello.txt', 'TREE C:\\'])
        assert.ok(pre.includes(line), `the example block shows ${line}`);
    assert.ok((pre.match(/\n/g) || []).length >= 5, 'each example is on its own line');
});

test('no topic is written twice into the same page', () => {
    const keys = helpTopicsOrder();
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.includes('welcome') && keys.includes('dos'), 'the contents list still has its topics');
    for (const key of keys) {
        const en = helpTopic(key, 'en');
        assert.equal(en, helpTopic(key, 'en'), 'reading a topic does not change it');
    }
});
