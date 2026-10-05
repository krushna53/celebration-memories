const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, Error, console, require: (name) => {
    if (name === 'server-only') return {};
    if (name.startsWith('node:')) return require(name);
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const media = load('lib/curated-media.ts');
test('video names and MIME are canonical, including empty OS MIME', () => {
  assert.equal(media.curatedMediaFile('clip.jpg', 'video/mp4', 100).fileName, 'clip.mp4');
  assert.equal(media.curatedMediaFile('clip.MP4', '', 100).contentType, 'video/mp4');
  assert.equal(media.curatedMediaFile('photo.mp4', 'image/jpeg', 100).fileName, 'photo.jpg');
  assert.equal(media.isVideoMedia('/media/gallery/e/clip.mp4?e=123&s=signature'), true);
  assert.equal(media.isVideoMedia('/image.jpg?name=clip.mp4'), false);
});
test('video and photo limits are independently enforced', () => {
  media.curatedMediaFile('clip.mp4', 'video/mp4', 300 * 1024 * 1024);
  for (const size of [0, -1, NaN, Infinity, 300 * 1024 * 1024 + 1]) {
    assert.throws(() => media.curatedMediaFile('clip.mp4', 'video/mp4', size));
  }
  assert.throws(() => media.curatedMediaFile('photo.jpg', 'image/jpeg', 51 * 1024 * 1024));
  assert.throws(() => media.curatedMediaFile('clip.mov', 'video/quicktime', 100));
});
test('cross-event and traversal paths are rejected', () => {
  media.assertEventMediaPath('veda', 'veda/gallery/clip.mp4');
  for (const path of ['mgm/gallery/clip.mp4', 'veda/../mgm/clip.mp4', 'veda/%2e%2e/clip.mp4', 'veda\\gallery\\clip.mp4']) {
    assert.throws(() => media.assertEventMediaPath('veda', path));
  }
});
test('both upload services issue signed gallery uploads with the correct MIME', async () => {
  const paths = [];
  const uploads = load('services/uploads.ts', {
    '@/lib/curated-media': media,
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ storage: { from: (bucket) => {
      assert.equal(bucket, 'gallery');
      return { createSignedUploadUrl: async (path) => { paths.push(path); return { data: { token: 'token', signedUrl: '/upload' }, error: null }; } };
    } } }) },
    '@/lib/media-url': { isPrivateMediaBucket: () => true, signedMediaPath: (bucket, path) => `/media/${bucket}/${path}?signed=true` },
    '@/types/memory': {},
    '@/services/storage-quota': { assertEventStorageAvailable: async () => {}, StorageQuotaError: class StorageQuotaError extends Error {} },
  });
  for (const fn of [uploads.createSignedGalleryUpload, uploads.createSignedTimelineImageUpload]) {
    const result = await fn({ eventId: 'veda', fileName: 'clip', contentType: 'video/mp4', fileSize: 1024 });
    assert.equal(result.contentType, 'video/mp4');
    assert.equal(media.isVideoMedia(result.viewUrl), true);
  }
  assert.match(paths[0], /^veda\/gallery\/.+\.mp4$/);
  assert.match(paths[1], /^veda\/timeline\/.+\.mp4$/);
});
test('a full event refuses new upload links with the quota message', async () => {
  class StorageQuotaError extends Error {}
  let signed = 0;
  const uploads = load('services/uploads.ts', {
    '@/lib/curated-media': media,
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ storage: { from: () => ({ createSignedUploadUrl: async () => { signed++; return { data: { token: 't', signedUrl: '/u' }, error: null }; } }) } }) },
    '@/lib/media-url': { isPrivateMediaBucket: () => true, signedMediaPath: (bucket, path) => `/media/${bucket}/${path}` },
    '@/types/memory': {},
    '@/services/storage-quota': {
      StorageQuotaError,
      assertEventStorageAvailable: async (eventId, bytes) => {
        assert.equal(eventId, 'veda');
        assert.equal(bytes, 2048);
        throw new StorageQuotaError('This event has used all 5 GB of its storage.');
      },
    },
  });
  await assert.rejects(
    uploads.createSignedGalleryUpload({ eventId: 'veda', fileName: 'p.jpg', contentType: 'image/jpeg', fileSize: 2048 }),
    (err) => err instanceof uploads.UploadValidationError && /used all 5 GB/.test(err.message),
  );
  assert.equal(signed, 0, 'no upload link may be issued once the event is full');
});
function galleryActions(allowed) {
  const calls = { deleted: [], revalidated: [], saved: [] };
  const actions = load('features/admin/gallery/actions.ts', {
    '@/lib/curated-media': media,
    'next/cache': { revalidatePath: (...args) => calls.revalidated.push(args) },
    '@/services/admin-auth': { requireAdminForOrganizerArea: async (eventId, area) => {
      assert.equal(eventId, 'veda'); assert.equal(area, 'gallery');
      if (!allowed) throw new Error('Not authorized');
      return { id: 'owner' };
    } },
    '@/services/uploads': {},
    '@/services/gallery-photos': { getGalleryPhotoById: async () => ({ id: 'photo', eventId: 'veda' }), createGalleryPhoto: async (input) => calls.saved.push(input) },
    '@/services/recycle-bin': { moveToTrash: async (...args) => calls.deleted.push(args) },
    '@/services/event-snapshots': { snapshotGallery: async () => {} },
    '@/lib/ai-gallery-tagger': {}, '@/services/external-media': {},
    '@/services/gallery-auto-tag': { resolveGalleryUpload: async ({ category, caption }) => ({ category, caption, autoTagged: false }) },
  });
  return { actions, calls };
}
test('owner deletion moves the selected gallery item to trash and refreshes public pages', async () => {
  const { actions, calls } = galleryActions(true);
  assert.equal((await actions.deleteGalleryPhotoAction('photo')).success, true);
  assert.deepEqual(calls.deleted, [['gallery', 'photo']]);
  assert.ok(calls.revalidated.some(([path]) => path === '/events/[slug]'));
});
test('unauthorized deletion cannot modify gallery content', async () => {
  const { actions, calls } = galleryActions(false);
  assert.equal((await actions.deleteGalleryPhotoAction('photo')).success, false);
  assert.equal(calls.deleted.length, 0);
});
test('confirming an upload cannot attach another event’s file', async () => {
  const { actions, calls } = galleryActions(true);
  assert.equal((await actions.confirmGalleryUploadAction('veda', 'family', 'mgm/gallery/clip.mp4', '')).success, false);
  assert.equal(calls.saved.length, 0);
});
