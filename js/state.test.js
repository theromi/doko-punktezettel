const assert = require('node:assert/strict');
const {
  suggestActive,
  scoreHand,
  totals,
  series,
  stats,
  validateEntry,
  deriveSoloist,
  makePlayers,
  normalizeNames,
  isSoloSplit,
  formatPreview,
  activeCountFor,
} = require('./state.js');

let passed = 0;

function ids(n, prefix = 'p') {
  return Array.from({ length: n }, (_, i) => String(prefix) + String(i));
}

function playersFrom(idList) {
  return idList.map((id, i) => ({ id: id, name: 'S' + (i + 1) }));
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok  ' + name);
  } catch (err) {
    console.error('FAIL ' + name);
    console.error(err);
    process.exitCode = 1;
  }
}

test('scoreHand non-solo 2v2 is zero-sum ±N', () => {
  const hand = { n: 3, winners: ['a', 'b'], active: ['a', 'b', 'c', 'd'] };
  const s = scoreHand(hand);
  assert.deepStrictEqual(s, { a: 3, b: 3, c: -3, d: -3 });
  assert.strictEqual(Object.values(s).reduce((x, y) => x + y, 0), 0);
  assert.strictEqual(deriveSoloist(hand.winners, hand.active), null);
});

test('scoreHand solo won 1v3 gives +3N / −N', () => {
  const hand = { n: 2, winners: ['a'], active: ['a', 'b', 'c', 'd'] };
  const s = scoreHand(hand);
  assert.deepStrictEqual(s, { a: 6, b: -2, c: -2, d: -2 });
  assert.strictEqual(Object.values(s).reduce((x, y) => x + y, 0), 0);
  assert.strictEqual(deriveSoloist(hand.winners, hand.active), 'a');
  assert.ok(isSoloSplit(hand.winners, hand.active));
});

test('scoreHand solo lost 3v1 gives −3N / +N', () => {
  const hand = { n: 2, winners: ['b', 'c', 'd'], active: ['a', 'b', 'c', 'd'] };
  const s = scoreHand(hand);
  assert.deepStrictEqual(s, { a: -6, b: 2, c: 2, d: 2 });
  assert.strictEqual(Object.values(s).reduce((x, y) => x + y, 0), 0);
  assert.strictEqual(deriveSoloist(hand.winners, hand.active), 'a');
});

test('scoreHand 3-player 1v2 is solo ±2N / ∓N', () => {
  const won = scoreHand({ n: 3, winners: ['a'], active: ['a', 'b', 'c'] });
  assert.deepStrictEqual(won, { a: 6, b: -3, c: -3 });
  assert.strictEqual(Object.values(won).reduce((x, y) => x + y, 0), 0);
  const lost = scoreHand({ n: 3, winners: ['b', 'c'], active: ['a', 'b', 'c'] });
  assert.deepStrictEqual(lost, { a: -6, b: 3, c: 3 });
  assert.strictEqual(Object.values(lost).reduce((x, y) => x + y, 0), 0);
});

test('scoreHand invariant sum==0 for all splits', () => {
  const cases = [
    { n: 1, winners: ['a'], active: ['a', 'b', 'c'] },
    { n: 1, winners: ['a', 'b'], active: ['a', 'b', 'c'] },
    { n: 5, winners: ['a'], active: ['a', 'b', 'c', 'd'] },
    { n: 5, winners: ['a', 'b', 'c'], active: ['a', 'b', 'c', 'd'] },
    { n: 5, winners: ['a', 'b'], active: ['a', 'b', 'c', 'd'] },
    { n: 7, winners: ['c'], active: ['a', 'b', 'c', 'd'] },
    { n: 9, winners: ['a', 'c'], active: ['a', 'b', 'c', 'd'] },
  ];
  for (const hand of cases) {
    const s = scoreHand(hand);
    assert.strictEqual(Object.values(s).reduce((x, y) => x + y, 0), 0, JSON.stringify(hand));
  }
});

test('validateEntry accepts valid 4-player entry', () => {
  const r = validateEntry({ n: 2, winners: ['a', 'b'], active: ['a', 'b', 'c', 'd'] });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.errors.length, 0);
});

test('validateEntry rejects bad N, empty/all winners, winner not active', () => {
  assert.strictEqual(validateEntry({ n: 0, winners: ['a'], active: ['a', 'b', 'c', 'd'] }).valid, false);
  assert.strictEqual(validateEntry({ n: 1000, winners: ['a'], active: ['a', 'b', 'c', 'd'] }).valid, false);
  assert.strictEqual(validateEntry({ n: 1.5, winners: ['a'], active: ['a', 'b', 'c', 'd'] }).valid, false);
  assert.strictEqual(validateEntry({ n: 1, winners: [], active: ['a', 'b', 'c', 'd'] }).valid, false);
  assert.strictEqual(validateEntry({ n: 1, winners: ['a', 'b', 'c', 'd'], active: ['a', 'b', 'c', 'd'] }).valid, false);
  assert.strictEqual(validateEntry({ n: 1, winners: ['x'], active: ['a', 'b', 'c', 'd'] }).valid, false);
  assert.strictEqual(validateEntry({ n: 1, winners: ['a'], active: ['a', 'b'] }).valid, false);
  assert.strictEqual(validateEntry({ n: 1, winners: ['a'], active: ['a', 'b', 'c', 'd', 'e'] }).valid, false);
});

test('validateEntry accepts 3-player roster', () => {
  assert.strictEqual(validateEntry({ n: 1, winners: ['a'], active: ['a', 'b', 'c'] }).valid, true);
  assert.strictEqual(validateEntry({ n: 1, winners: ['a', 'b'], active: ['a', 'b', 'c'] }).valid, true);
});

test('suggestActive P≤4 returns all in roster order', () => {
  const p3 = playersFrom(ids(3));
  assert.deepStrictEqual(suggestActive(p3, []), p3.map((p) => p.id));
  const p4 = playersFrom(ids(4));
  assert.deepStrictEqual(suggestActive(p4, [{ active: ['p0', 'p1', 'p2', 'p3'] }]), p4.map((p) => p.id));
});

test('suggestActive empty hands returns opposite sitters', () => {
  const players = playersFrom(ids(6));
  const active = suggestActive(players, []);
  assert.strictEqual(active.length, 4);
  const sitters = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'].filter((id) => !active.includes(id));
  const i0 = Number(sitters[0].slice(1));
  const i1 = Number(sitters[1].slice(1));
  const dist = Math.min(Math.abs(i0 - i1), 6 - Math.abs(i0 - i1));
  assert.strictEqual(dist, 3, 'sitters ' + sitters.join(','));
});

test('suggestActive empty hands 5 players returns first four', () => {
  const players = playersFrom(ids(5));
  assert.deepStrictEqual(suggestActive(players, []), ['p0', 'p1', 'p2', 'p3']);
});

function rotationRun(playerCount, handCount) {
  const idList = ids(playerCount);
  const players = playersFrom(idList);
  const hands = [];
  for (let i = 0; i < handCount; i += 1) {
    const active = suggestActive(players, hands);
    hands.push({
      id: `h${i}`,
      n: 1,
      winners: active.slice(0, Math.max(1, Math.floor(active.length / 2))),
      active,
      soloistId: null,
    });
  }
  return { idList, hands };
}

function playedCounts(idList, hands) {
  const counts = {};
  for (const id of idList) counts[id] = 0;
  for (const hand of hands) {
    for (const id of hand.active) counts[id] += 1;
  }
  return counts;
}

test('rotation fairness 5 players over 20 hands', () => {
  const { idList, hands } = rotationRun(5, 20);
  const counts = playedCounts(idList, hands);
  const values = Object.values(counts);
  assert.ok(Math.max(...values) - Math.min(...values) <= 1, JSON.stringify(counts));
  assert.strictEqual(values.reduce((a, b) => a + b, 0), 20 * 4);
});

test('rotation fairness 6 players over 20 hands', () => {
  const { idList, hands } = rotationRun(6, 20);
  const counts = playedCounts(idList, hands);
  const values = Object.values(counts);
  assert.ok(Math.max(...values) - Math.min(...values) <= 1, JSON.stringify(counts));
  assert.ok(Math.min(...values) >= 12, JSON.stringify(counts));
  assert.strictEqual(values.reduce((a, b) => a + b, 0), 20 * 4);
});

test('rotation fairness 6 players over full cycles', () => {
  const { idList, hands } = rotationRun(6, 24);
  const counts = playedCounts(idList, hands);
  const values = Object.values(counts);
  assert.strictEqual(Math.max(...values) - Math.min(...values), 0, JSON.stringify(counts));
});

test('6 players sit out as opposite pairs, never twice in a row', () => {
  const { idList, hands } = rotationRun(6, 30);
  const half = idList.length / 2;
  for (const hand of hands) {
    const sitters = idList.filter((id) => !hand.active.includes(id));
    assert.strictEqual(sitters.length, 2);
    const i0 = idList.indexOf(sitters[0]);
    const i1 = idList.indexOf(sitters[1]);
    const dist = Math.min(Math.abs(i0 - i1), idList.length - Math.abs(i0 - i1));
    assert.strictEqual(dist, half, sitters.join(',') + ' should be opposite');
  }
  const last = {};
  hands.forEach((hand, i) => {
    for (const id of idList) {
      const sat = !hand.active.includes(id);
      if (sat && last[id] === i - 1) {
        assert.fail(id + ' sits out two consecutive hands');
      }
      if (sat) last[id] = i;
    }
  });
});

test('6 players: opposite pair rotates fairly', () => {
  const { idList, hands } = rotationRun(6, 30);
  const sitCounts = {};
  for (const id of idList) sitCounts[id] = 0;
  for (const hand of hands) {
    for (const id of idList) if (!hand.active.includes(id)) sitCounts[id] += 1;
  }
  const values = Object.values(sitCounts);
  assert.ok(Math.max(...values) - Math.min(...values) <= 1, JSON.stringify(sitCounts));
});

test('7 players sitters are spread around the table', () => {
  const { idList, hands } = rotationRun(7, 21);
  const P = idList.length;
  for (const hand of hands) {
    const sitters = idList.filter((id) => !hand.active.includes(id));
    assert.strictEqual(sitters.length, 3);
    const idxs = sitters.map((id) => idList.indexOf(id)).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 0; i < idxs.length; i += 1) {
      gaps.push((idxs[(i + 1) % idxs.length] - idxs[i] + P) % P);
    }
    const minGap = Math.min.apply(null, gaps);
    assert.ok(minGap >= 2, 'sitters ' + sitters.join(',') + ' gaps ' + gaps.join(','));
  }
});

test('rotation fairness 3 and 4 players never pause', () => {
  for (const n of [3, 4]) {
    const { idList, hands } = rotationRun(n, 20);
    const counts = playedCounts(idList, hands);
    for (const c of Object.values(counts)) assert.strictEqual(c, 20);
  }
});

test('rotation is consecutive sliding window for 5 players', () => {
  const { hands } = rotationRun(5, 6);
  assert.deepStrictEqual(hands[0].active, ['p0', 'p1', 'p2', 'p3']);
  assert.deepStrictEqual(hands[1].active, ['p1', 'p2', 'p3', 'p4']);
  assert.deepStrictEqual(hands[2].active, ['p2', 'p3', 'p4', 'p0']);
  assert.deepStrictEqual(hands[3].active, ['p3', 'p4', 'p0', 'p1']);
  assert.deepStrictEqual(hands[4].active, ['p4', 'p0', 'p1', 'p2']);
  assert.deepStrictEqual(hands[5].active, ['p0', 'p1', 'p2', 'p3']);
  const pauses = hands.map((h) => ['p0', 'p1', 'p2', 'p3', 'p4'].find((id) => !h.active.includes(id)));
  assert.deepStrictEqual(pauses, ['p4', 'p0', 'p1', 'p2', 'p3', 'p4']);
});

test('6 players: dealer pair rotates left around the table', () => {
  const idList = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];
  const players = playersFrom(idList);
  const hands = [];
  const pairHeads = [];
  for (let i = 0; i < 6; i += 1) {
    const active = suggestActive(players, hands);
    const sitters = idList.filter((id) => !active.includes(id));
    pairHeads.push(sitters.map((id) => idList.indexOf(id)).sort((a, b) => a - b)[0]);
    hands.push({ id: 'h' + i, n: 1, winners: [active[0]], active, soloistId: null });
  }
  assert.deepStrictEqual(pairHeads, [1, 2, 0, 1, 2, 0]);
});

test('rotation 3/4 players always all active', () => {
  const { hands: h3 } = rotationRun(3, 8);
  for (const h of h3) assert.strictEqual(h.active.length, 3);
  const { hands: h4 } = rotationRun(4, 8);
  for (const h of h4) assert.strictEqual(h.active.length, 4);
});

test('manual swap affects subsequent fairness', () => {
  const players = playersFrom(ids(5));
  const hands = [];
  const a1 = suggestActive(players, hands);
  hands.push({ id: 'h1', n: 1, winners: [a1[0]], active: ['p0', 'p1', 'p2', 'p4'], soloistId: null });
  const a2 = suggestActive(players, hands);
  assert.ok(a2.includes('p3'), 'p3 should rotate in after sitting out');
  assert.ok(a2.includes('p0') || a2.includes('p1') || a2.includes('p2') || a2.includes('p4'));
  assert.strictEqual(a2.length, 4);
});

test('totals and series are consistent', () => {
  const players = playersFrom(['a', 'b', 'c', 'd']);
  const hands = [
    { id: 'h1', n: 2, winners: ['a'], active: ['a', 'b', 'c', 'd'], soloistId: 'a' },
    { id: 'h2', n: 1, winners: ['b', 'c'], active: ['a', 'b', 'c', 'd'], soloistId: null },
  ];
  const t = totals(players, hands);
  assert.deepStrictEqual(t, { a: 5, b: -1, c: -1, d: -3 });
  assert.strictEqual(Object.values(t).reduce((x, y) => x + y, 0), 0);
  const s = series(players, hands);
  assert.deepStrictEqual(s.a, [0, 6, 5]);
  assert.deepStrictEqual(s.b, [0, -2, -1]);
  assert.deepStrictEqual(s.c, [0, -2, -1]);
  assert.deepStrictEqual(s.d, [0, -2, -3]);
});

test('stats counts played, won, quotes, solos', () => {
  const players = playersFrom(['a', 'b', 'c', 'd', 'e']);
  const hands = [
    { id: 'h1', n: 1, winners: ['a'], active: ['a', 'b', 'c', 'd'], soloistId: 'a' },
    { id: 'h2', n: 1, winners: ['b', 'e'], active: ['b', 'c', 'd', 'e'], soloistId: null },
  ];
  const st = stats(players, hands);
  const by = Object.fromEntries(st.map((s) => [s.id, s]));
  assert.strictEqual(by.a.handsPlayed, 1);
  assert.strictEqual(by.a.gewonnen, 1);
  assert.strictEqual(by.a.gewinnquote, 1);
  assert.strictEqual(by.a.solosGewonnen, 1);
  assert.strictEqual(by.a.solosVerloren, 0);
  assert.strictEqual(by.e.handsPlayed, 1);
  assert.strictEqual(by.e.gewonnen, 1);
  assert.strictEqual(by.e.punkte, 1);
  assert.strictEqual(by.a.avgProHand, 3);
  assert.strictEqual(by.e.handsPlayed, 1);
  const unused = st.find((s) => s.id === 'e');
  assert.strictEqual(unused.handsPlayed, 1);
  assert.strictEqual(st.find((s) => s.id === 'a').punkte, 3);
});

test('stats zero-division safe for never played', () => {
  const players = playersFrom(['a', 'b', 'c']);
  const st = stats(players, []);
  for (const s of st) {
    assert.strictEqual(s.gewinnquote, null);
    assert.strictEqual(s.avgProHand, null);
    assert.strictEqual(s.handsPlayed, 0);
    assert.strictEqual(s.punkte, 0);
  }
});

test('normalizeNames trims, drops empty, suffixes duplicates, caps 20', () => {
  assert.deepStrictEqual(normalizeNames(['  Anna ', '', 'Bernd', 'Anna', 'Anna']), [
    'Anna',
    'Bernd',
    'Anna (2)',
    'Anna (3)',
  ]);
  const long = normalizeNames(['x'.repeat(20), 'x'.repeat(20)]);
  assert.strictEqual(long[0].length, 20);
  assert.strictEqual(long[1], 'x'.repeat(16) + ' (2)');
  assert.ok(long[1].length <= 20);
});

test('makePlayers creates unique ids', () => {
  const ps = makePlayers(['A', 'B', 'C', 'D']);
  assert.strictEqual(ps.length, 4);
  assert.strictEqual(new Set(ps.map((p) => p.id)).size, 4);
  assert.deepStrictEqual(ps.map((p) => p.name), ['A', 'B', 'C', 'D']);
});

test('activeCountFor', () => {
  assert.strictEqual(activeCountFor(3), 3);
  assert.strictEqual(activeCountFor(4), 4);
  assert.strictEqual(activeCountFor(5), 4);
  assert.strictEqual(activeCountFor(10), 4);
});

test('formatPreview renders signs and solo values', () => {
  const players = playersFrom(['a', 'b', 'c', 'd']);
  const text = formatPreview(players, {
    n: 2,
    winners: ['a'],
    active: ['a', 'b', 'c', 'd'],
  });
  assert.strictEqual(text, 'S1 +6 · S2 −2 · S3 −2 · S4 −2');
});

console.log(`\n${passed} tests passed`);
if (process.exitCode) {
  console.error('Some tests failed');
} else {
  console.log('All tests passed');
}
