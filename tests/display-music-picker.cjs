/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: name => {
    if (name in mocks) return mocks[name];
    throw new Error(name);
  } });
  return exports;
}
const music = load('lib/reel-music.ts', {});
const playlist = load('lib/display-music.ts', { zod: require('zod'), '@/lib/reel-music': music });
const initial = [{ choice: 'celebration', path: null }, { choice: 'custom', path: 'event/slideshow-music/own.mp3' }];
function harness(result = { success: true }) {
  const states = [];
  const calls = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const component = load('features/admin/display/display-music-picker.tsx', {
    react: { useState: value => {
      const index = cursor++;
      if (!(index in states)) states[index] = value;
      return [states[index], value => { states[index] = value; }];
    }, useRef: () => ({ current: null }), useEffect: () => {} },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': Object.fromEntries(['ArrowDown','ArrowUp','Loader2','Music','Pause','Play','Upload','X'].map(k => [k,k])),
    '@/components/ui/button': { Button: 'button' }, '@/lib/reel-music': music,
    '@/lib/display-music': playlist, '@/lib/stale-deploy': { staleDeployMessage: () => null },
    '@/lib/supabase/client': { supabaseBrowser: () => ({ storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) } }) },
    '@/features/admin/display/display-music-actions': {
      setDisplayMusicAction: async (...args) => { calls.push(JSON.parse(JSON.stringify(args))); return result; },
      requestDisplayMusicUploadAction: async () => ({ success: true, data: { bucket: 'audio', path: 'event/slideshow-music/new.mp3', token: 'signed' } }),
    },
  });
  function render() { cursor = 0; return component.DisplayMusicPicker({ eventId: 'event', initialTracks: initial }); }
  return { render, calls };
}
function find(node, predicate) {
  if (Array.isArray(node)) { for (const child of node) { const found = find(child,predicate); if (found) return found; } return null; }
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return find(node.props?.children,predicate);
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('preset selection preserves existing tracks and uses the playlist action contract', async () => {
  const h = harness();
  const input = find(h.render(), node => node.type === 'input' && node.props.type === 'checkbox' && !node.props.checked);
  input.props.onChange(); await settle();
  assert.equal(h.calls[0].length, 2);
  assert.equal(h.calls[0][0], 'event');
  assert.deepEqual(h.calls[0][1].slice(0,2), initial);
  assert.equal(h.calls[0][1].length, 3);
});

test('custom song upload appends to the playlist', async () => {
  const h = harness();
  find(h.render(), node => node.type === 'input' && node.props.type === 'file').props.onChange({ target: { files: [{ type: 'audio/mpeg', name: 'new.mp3', size: 100 }], value: 'file' } });
  await settle();
  assert.deepEqual(h.calls[0][1], [...initial, { choice: 'custom', path: 'event/slideshow-music/new.mp3' }]);
});

test('reordering saves the full ordered playlist and no music saves an empty playlist', async () => {
  const h = harness();
  find(h.render(), node => node.props?.['aria-label']?.startsWith('Move ') && node.props['aria-label'].endsWith(' down') && !node.props.disabled).props.onClick();
  await settle();
  assert.deepEqual(h.calls[0][1], [initial[1], initial[0]]);
  find(h.render(), node => node.type === 'button' && node.props.children === 'No music').props.onClick();
  await settle();
  assert.deepEqual(h.calls[1][1], []);
});

test('failed save preserves the selected playlist and shows an error', async () => {
  const h = harness({ success: false, error: 'Save unavailable' });
  find(h.render(), node => node.type === 'button' && node.props.children === 'No music').props.onClick();
  await settle();
  const tree = h.render();
  assert.equal(find(tree, node => node.props?.role === 'alert').props.children, 'Save unavailable');
  assert.ok(find(tree, node => node.props?.['aria-label'] === 'Song order'));
});
