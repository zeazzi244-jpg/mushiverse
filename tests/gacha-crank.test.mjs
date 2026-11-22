import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const crank = source.match(/function installGachaCrank\(\)\{[\s\S]*?\n\}/)[0];

function gesture() {
  const listeners = new Map();
  const draws = [];
  const handle = {
    getBoundingClientRect: () => ({left: 0, top: 0, width: 60, height: 60}),
    setPointerCapture() {},
    style: {setProperty() {}, removeProperty() {}},
    classList: {toggle() {}, remove() {}},
  };
  runInNewContext(crank + '\ninstallGachaCrank();', {
    document: {addEventListener: (type, callback) => listeners.set(type, callback)},
    el: () => null,
    draw: count => draws.push(count),
  });
  function send(type, degrees, radius = 26, pointerId = 1) {
    const angle = degrees * Math.PI / 180;
    listeners.get(type)({
      type, pointerId, button: 0, isPrimary: true,
      clientX: 30 + radius * Math.cos(angle),
      clientY: 30 + radius * Math.sin(angle),
      target: {closest: () => handle},
    });
  }
  return {send, draws};
}

test('one continuous turn in either direction draws once on release', () => {
  for (const direction of [-1, 1]) {
    const {send, draws} = gesture();
    send('pointerdown', 170);
    for (const offset of [30, 60, 90, 120, 150]) send('pointermove', 170 + direction * offset);
    assert.deepEqual(draws, []);
    send('pointerup', 170 + direction * 150);
    send('lostpointercapture', 170);
    assert.deepEqual(draws, [1]);
  }
});

test('taps, short turns, straight swipes, and cancelled turns never draw', () => {
  const {send, draws} = gesture();
  for (const angles of [[], [30, 60], [180]]) {
    send('pointerdown', 0);
    for (const angle of angles) send('pointermove', angle);
    send('pointerup', angles.at(-1) ?? 0);
  }
  send('pointerdown', 0);
  for (const angle of [40, 80, 120]) send('pointermove', angle);
  send('pointercancel', 120);
  send('pointerup', 120);
  assert.deepEqual(draws, []);
});
