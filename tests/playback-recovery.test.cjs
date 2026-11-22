const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app/js/player.js', 'utf8');
const loadSource = source.slice(source.indexOf('async function load('), source.indexOf('// Original file playing:'));
const failSource = source.slice(source.indexOf('async function fail('), source.indexOf('export async function close('));

function player({ hasPlayed = false, hls = true } = {}) {
  const requests = [], timers = [], failures = [], streams = [];
  class Hls {
    static Events = { ERROR: 'error', LEVEL_LOADED: 'level' };
    static isSupported() { return true; }
    constructor() { streams.push(this); this.recoveries = 0; this.starts = 0; }
    on(event, callback) { this.error = (type) => callback(event, { type, fatal: true }); }
    startLoad() { this.starts++; }
    recoverMediaError() { this.recoveries++; }
    once() {}
    destroy() {}
    loadSource() {}
    attachMedia() {}
  }
  const context = vm.createContext({
    S: { g: 'g', item: { Id: 'movie' }, trackKnown: true, hasPlayed, v: { play: async () => {}, addEventListener() {} } },
    groups: { use() {} },
    jf: {
      async playback(id, options) { requests.push(options); return { hls, url: 'stream', audio: [] }; },
      stopTranscode() {},
      reportStart() {},
    },
    desktop: null, canSwitchAudio: false, window: { Hls },
    setTimeout(callback) { timers.push(callback); },
    spin() {}, toast() {}, pos: () => 3900, attachNativeAudio() {}, applySubtitles() {},
    paintButtons() {}, emit() {}, discord() {}, paintPlay() {},
    playbackFailure(error) { failures.push(error.message); return { message: error.message }; },
    esc: (message) => message,
    root: () => ({ insertAdjacentHTML() {} }),
    $: (selector) => selector === '[data-p=retry]' ? {} : null,
  });
  vm.runInContext(loadSource + failSource + '\nglobalThis.load = load;', context);
  return { context, requests, streams, failures, timers };
}

test('an exhausted network failure never starts a full transcode', async () => {
  const { context, requests, streams, failures } = player();
  await context.load();
  for (let i = 0; i < 4; i++) streams[0].error('networkError');
  assert.equal(requests.length, 1);
  assert.match(failures[0], /server stopped sending/);
});

test('a mid-movie media failure restarts the same stream once at the current position', async () => {
  const { context, requests, streams, failures } = player({ hasPlayed: true });
  await context.load();
  for (let i = 0; i < 3; i++) streams[0].error('mediaError');
  await new Promise(setImmediate);
  assert.equal(streams[0].recoveries, 2);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].start, 3900);
  assert.equal(Boolean(requests[1].forceTranscode), false);
  for (let i = 0; i < 3; i++) streams[1].error('mediaError');
  assert.equal(requests.length, 2);
  assert.match(failures[0], /couldn't decode/);
});

test('a startup media failure still permits the compatibility transcode', async () => {
  const { context, requests, streams } = player();
  await context.load();
  for (let i = 0; i < 3; i++) streams[0].error('mediaError');
  assert.equal(requests[1].forceTranscode, true);
});

test('errors and delayed retries from an old stream leave a newer load alone', async () => {
  const { context, requests, streams, timers } = player();
  await context.load();
  streams[0].error('networkError');
  await context.load(120);
  for (const timer of timers) timer();
  for (let i = 0; i < 3; i++) streams[0].error('mediaError');
  assert.equal(streams[0].starts, 0);
  assert.equal(requests.length, 2);
});
