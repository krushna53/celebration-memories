/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, Math, Date, Set, Map, JSON, ArrayBuffer, DataView, Uint8Array, require });
  return exports;
}
const edit = load('supabase/functions/life-story/edit.ts');
const structure = load('supabase/functions/life-story/structure.ts');

const scene = (over = {}) => ({
  photoUrl: 'p', clipUrl: null, clipSeconds: null, narrationUrl: 'n', narrationSeconds: 5, caption: '', motion: 'zoom_in', ...over,
});

test('scenes are timed to their voiceover, between an intro and an outro card', () => {
  const { edit: e, durationSeconds } = edit.buildFilmEdit({
    title: 'Mahesh <J.> Shah', subtitle: '', lifeSpan: '1951 – present', coverUrl: 'cover', musicUrl: 'music',
    scenes: [scene({ narrationSeconds: 5 }), scene({ narrationSeconds: 1, narrationUrl: null })],
  });
  // 5 intro + (0.5 + 5 + 0.9) + minimum 4 + 5 outro
  assert.equal(durationSeconds, 5 + 6.4 + edit.MIN_SCENE_SECONDS + 5);
  const html = JSON.stringify(e);
  assert.ok(html.includes('Mahesh &lt;J.&gt; Shah'), 'title is HTML-escaped');
  assert.equal(e.timeline.soundtrack.src, 'music');
  const audio = e.timeline.tracks.flatMap((t) => t.clips).filter((c) => c.asset.type === 'audio');
  assert.equal(audio.length, 1, 'a scene without narration gets no audio clip');
  assert.equal(audio[0].start, 5 + edit.NARRATION_LEAD_IN);
});

test('a Grok clip shorter than its scene hands over to the still photo with a slow zoom', () => {
  const { edit: e } = edit.buildFilmEdit({
    title: 'T', subtitle: '', lifeSpan: '', coverUrl: null, musicUrl: null,
    scenes: [scene({ clipUrl: 'clip', clipSeconds: 3, narrationSeconds: 8 })],
  });
  const clips = e.timeline.tracks.flatMap((t) => t.clips);
  const video = clips.find((c) => c.asset.type === 'video');
  const still = clips.find((c) => c.asset.type === 'image' && c.effect);
  assert.equal(video.length, 3);
  assert.equal(video.asset.volume, 0);
  assert.equal(still.start, 5 + 3);
  assert.equal(still.length, edit.sceneSeconds(8) - 3);
  assert.equal(e.timeline.soundtrack, undefined, 'no music → no soundtrack');
});

test('clip lengths requested from Grok stay within 3–15 whole seconds', () => {
  assert.equal(edit.clipRequestSeconds(0), 4);
  assert.equal(edit.clipRequestSeconds(6.2), 8);
  assert.equal(edit.clipRequestSeconds(40), 15);
});

test('pcmToWav writes a 44-byte header and the right duration', () => {
  const wav = edit.pcmToWav(new Uint8Array(48000));
  assert.equal(wav.length, 48044);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
  assert.equal(edit.pcmSeconds(48000), 1);
});

test('parseStructure drops unknown and duplicate photos and caps animated scenes', () => {
  const raw = {
    title: 'Mahesh J. Shah', subtitle: 'A Life of Love', life_span: '1951 – present',
    chapters: [
      { title: 'Childhood', period: '1951 – 1968', body: 'Born in a village.', photo_refs: ['P1', 'P9', 'P2'] },
      { title: 'Marriage', period: '', body: 'He met Jagruti.', photo_refs: ['P2', 'P3'] },
      { title: '', period: '', body: 'no title → dropped', photo_refs: [] },
    ],
    photos: [{ ref: 'P1', caption: 'Village school', year_label: '1958', description: 'A boy' }, { ref: 'P9', caption: 'x', year_label: '', description: '' }],
    scenes: [
      { photo_ref: 'P1', narration: 'It began in a village.', caption: '1951', motion: 'zoom_in', animate: true, animation_prompt: 'He smiles' },
      { photo_ref: 'P1', narration: 'Same photo again.', caption: '', motion: 'sideways', animate: true, animation_prompt: 'x' },
      { photo_ref: 'P3', narration: 'They married.', caption: '', motion: 'pan_left', animate: true, animation_prompt: 'They turn' },
      { photo_ref: 'P2', narration: '', caption: '', motion: 'zoom_out', animate: false, animation_prompt: '' },
    ],
  };
  const s = structure.parseStructure(raw, ['P1', 'P2', 'P3'], 1);
  assert.equal(s.chapters.length, 2);
  assert.deepEqual([...s.chapters[0].photoRefs], ['P1', 'P2']);
  assert.deepEqual([...s.chapters[1].photoRefs], ['P3'], 'P2 already placed in chapter 1');
  assert.equal(s.photos.length, 1, 'P9 was never shown to the model');
  assert.equal(s.scenes.length, 3, 'empty narration dropped');
  assert.equal(s.scenes[1].photoRef, '', 'a photo is used in one scene at most');
  assert.equal(s.scenes[1].motion, 'zoom_in', 'unknown motion falls back');
  assert.equal(s.scenes.filter((x) => x.animate).length, 1, 'animated scenes capped');
  assert.equal(s.scenes[2].animationPrompt, '');
});

test('parseStructure returns null when nothing usable came back', () => {
  assert.equal(structure.parseStructure({ chapters: [], scenes: [] }, [], 6), null);
  assert.equal(structure.parseStructure('nope', [], 6), null);
});
