import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './dom-shim.mjs';

const { menus } = installDom();
const { popup, closeMenus } = await import('../src/packages/ui/menu.js');

const rowsOf = menu => [...menu.children[0].children].filter(n => n.tagName === 'BUTTON');
const enter = row => row.dispatchEvent({ type: 'pointerenter' });
const arrowLeft = row => row.dispatchEvent({ type: 'keydown', key: 'ArrowLeft' });

const layered = () => popup([
    {
        label: 'Programs', items: [
            { label: 'Accessories', items: [{ label: 'Notepad', action: () => { } }] },
            { label: 'Games', items: [{ label: 'Solitaire', action: () => { } }] }
        ]
    }
], 0, 0);

test('ArrowLeft closes a submenu without orphaning or eating the menus around it', () => {
    closeMenus();
    const root = layered();
    enter(rowsOf(root)[0]);
    const programs = menus.children[1];
    assert.ok(programs, 'the Programs submenu opens');
    enter(rowsOf(programs)[0]);
    const accessories = menus.children[2];
    assert.ok(accessories, 'the Accessories submenu opens');
    arrowLeft(rowsOf(accessories)[0]);
    assert.ok(!menus.children.includes(accessories), 'ArrowLeft closes the submenu it came from');
    assert.ok(menus.children.includes(programs), 'the menu above stays open');
    enter(rowsOf(programs)[1]);
    assert.ok(menus.children.includes(programs), 'hovering after an ArrowLeft does not swallow the open menu');
    assert.ok(menus.children.length >= 3, 'the hovered row can still open its submenu');
    closeMenus();
});

test('opening one submenu replaces its sibling submenu, not the whole stack', () => {
    closeMenus();
    const root = layered();
    enter(rowsOf(root)[0]);
    const programs = menus.children[1];
    enter(rowsOf(programs)[0]);
    const first = menus.children[2];
    enter(rowsOf(programs)[1]);
    assert.ok(!menus.children.includes(first), 'the previous submenu is replaced');
    assert.ok(menus.children.includes(programs) && menus.children.includes(root), 'the parent chain survives the switch');
    closeMenus();
});
