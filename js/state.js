(function (global) {
  function createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  }

  function normalizeNames(rawNames) {
    const trimmed = rawNames.map((n) => String(n ?? '').trim().slice(0, 20)).filter((n) => n.length > 0);
    const seen = new Set();
    const out = [];
    for (const name of trimmed) {
      let candidate = name;
      if (seen.has(candidate)) {
        let i = 2;
        for (;;) {
          const suffix = ' (' + i + ')';
          candidate = name.slice(0, 20 - suffix.length) + suffix;
          if (!seen.has(candidate)) break;
          i += 1;
        }
      }
      seen.add(candidate);
      out.push(candidate);
    }
    return out;
  }

  function makePlayers(names) {
    return normalizeNames(names).map((name) => ({ id: createId(), name }));
  }

  function deriveSoloist(winners, active) {
    const winnerSet = new Set(winners);
    const losers = active.filter((id) => !winnerSet.has(id));
    if (winners.length === 1) return winners[0];
    if (losers.length === 1) return losers[0];
    return null;
  }

  function isSoloSplit(winners, active) {
    return deriveSoloist(winners, active) !== null;
  }

  function scoreHand(hand) {
    const n = hand.n;
    const winners = hand.winners;
    const active = hand.active;
    const winnerSet = new Set(winners);
    const scores = {};
    const soloistId = deriveSoloist(winners, active);
    if (soloistId !== null) {
      const k = active.length - 1;
      const soloistWon = winnerSet.has(soloistId);
      for (const id of active) {
        if (id === soloistId) scores[id] = soloistWon ? k * n : -k * n;
        else scores[id] = soloistWon ? -n : n;
      }
    } else {
      for (const id of active) {
        scores[id] = winnerSet.has(id) ? n : -n;
      }
    }
    return scores;
  }

  function validateEntry(entry) {
    const errors = [];
    const n = entry && entry.n;
    const winners = entry && Array.isArray(entry.winners) ? entry.winners : null;
    const active = entry && Array.isArray(entry.active) ? entry.active : null;

    if (!Number.isInteger(n) || n < 1 || n > 999) {
      errors.push('N muss eine ganze Zahl von 1 bis 999 sein.');
    }
    if (!active || (active.length !== 3 && active.length !== 4)) {
      errors.push('Es müssen 3 oder 4 aktive Spieler im Spiel sein.');
    } else if (new Set(active).size !== active.length) {
      errors.push('Aktive Spieler müssen eindeutig sein.');
    }
    if (!winners || !active || !winners.every((id) => active.includes(id))) {
      errors.push('Gewinner müssen aus den aktiven Spielern stammen.');
    }
    if (winners && new Set(winners).size !== winners.length) {
      errors.push('Gewinner müssen eindeutig sein.');
    }
    if (!winners || winners.length === 0 || (active && winners.length >= active.length)) {
      errors.push('Es muss mindestens einen Gewinner und einen Verlierer geben.');
    }
    return { valid: errors.length === 0, errors };
  }

  function activeCountFor(playerCount) {
    return Math.min(4, playerCount);
  }

  function streakOf(id, hands) {
    let streak = 0;
    for (let i = hands.length - 1; i >= 0; i -= 1) {
      if (hands[i].active.includes(id)) streak += 1;
      else break;
    }
    return streak;
  }

  function waitOf(id, hands) {
    for (let i = hands.length - 1; i >= 0; i -= 1) {
      if (hands[i].active.includes(id)) return hands.length - 1 - i;
    }
    return hands.length;
  }

  function pickHeadToDrop(activeOrder, hands, fromEnd) {
    if (activeOrder.length === 0) return null;
    const n = activeOrder.length;
    let head = activeOrder[fromEnd ? n - 1 : 0];
    let maxStreak = -1;
    for (let k = 0; k < n; k += 1) {
      const id = activeOrder[fromEnd ? n - 1 - k : k];
      const streak = streakOf(id, hands);
      if (streak > maxStreak) {
        maxStreak = streak;
        head = id;
      }
    }
    return head;
  }

  function pickTailToAppend(playerIds, activeOrder, hands) {
    const activeSet = new Set(activeOrder);
    const idle = playerIds.filter((id) => !activeSet.has(id));
    if (idle.length === 0) return null;
    let tail = idle[0];
    let maxWait = -1;
    for (const id of idle) {
      const wait = waitOf(id, hands);
      if (wait > maxWait) {
        maxWait = wait;
        tail = id;
      }
    }
    return tail;
  }

  function suggestActive(players, hands) {
    const ids = players.map((p) => p.id);
    const P = ids.length;
    if (P <= 4) return ids.slice();
    const nOut = P - 4;

    if (nOut === 1) {
      if (hands.length === 0) return ids.slice(0, 4);
      const lastActive = hands[hands.length - 1].active.slice();
      const head = pickHeadToDrop(lastActive, hands, false);
      const tail = pickTailToAppend(ids, lastActive, hands);
      const next = lastActive.filter((id) => id !== head);
      if (tail) next.push(tail);
      return next;
    }

    let primary;
    if (hands.length === 0) {
      primary = ids[Math.min(4, P - 1)];
    } else {
      primary = pickHeadToDrop(hands[hands.length - 1].active, hands, true);
    }
    if (!primary) primary = ids[Math.min(4, P - 1)];

    const firstIdx = ids.indexOf(primary);
    const sitters = [];
    for (let i = 0; i < nOut; i += 1) {
      const idx = (firstIdx + Math.round((i * P) / nOut)) % P;
      const id = ids[idx];
      if (sitters.indexOf(id) === -1) sitters.push(id);
    }
    for (const id of ids) {
      if (sitters.length >= nOut) break;
      if (sitters.indexOf(id) === -1) sitters.push(id);
    }
    return ids.filter((id) => sitters.indexOf(id) === -1);
  }

  function suggestSwapOut(activeOrder, hands) {
    return pickHeadToDrop(activeOrder, hands, false);
  }

  function suggestSwapIn(playerIds, activeOrder, hands) {
    return pickTailToAppend(playerIds, activeOrder, hands);
  }

  function totals(players, hands) {
    const result = {};
    for (const p of players) result[p.id] = 0;
    for (const hand of hands) {
      const scores = scoreHand(hand);
      for (const id of Object.keys(scores)) {
        result[id] = (result[id] || 0) + scores[id];
      }
    }
    return result;
  }

  function series(players, hands) {
    const result = {};
    for (const p of players) result[p.id] = [0];
    for (const hand of hands) {
      const scores = scoreHand(hand);
      for (const p of players) {
        const prev = result[p.id][result[p.id].length - 1];
        result[p.id].push(prev + (scores[p.id] || 0));
      }
    }
    return result;
  }

  function stats(players, hands) {
    return players.map((p) => {
      let punkte = 0;
      let gespielt = 0;
      let gewonnen = 0;
      let solosGewonnen = 0;
      let solosVerloren = 0;
      for (const hand of hands) {
        const scores = scoreHand(hand);
        punkte += scores[p.id] || 0;
        const played = hand.active.includes(p.id);
        if (played) gespielt += 1;
        if (played && hand.winners.includes(p.id)) gewonnen += 1;
        if (hand.soloistId === p.id) {
          if (hand.winners.includes(p.id)) solosGewonnen += 1;
          else solosVerloren += 1;
        }
      }
      return {
        id: p.id,
        name: p.name,
        punkte,
        handsPlayed: gespielt,
        gewonnen,
        gewinnquote: gespielt > 0 ? gewonnen / gespielt : null,
        avgProHand: gespielt > 0 ? punkte / gespielt : null,
        solosGewonnen,
        solosVerloren,
      };
    });
  }

  function formatPreview(players, entry) {
    const scores = scoreHand(entry);
    return players
      .filter((p) => entry.active.includes(p.id))
      .map((p) => {
        const s = scores[p.id] || 0;
        const sign = s > 0 ? '+' : s < 0 ? '−' : '';
        return p.name + ' ' + sign + Math.abs(s);
      })
      .join(' · ');
  }

  const state = {
    createId,
    normalizeNames,
    makePlayers,
    deriveSoloist,
    isSoloSplit,
    scoreHand,
    validateEntry,
    activeCountFor,
    pickHeadToDrop,
    pickTailToAppend,
    suggestActive,
    suggestSwapOut,
    suggestSwapIn,
    totals,
    series,
    stats,
    formatPreview,
  };

  global.Pz = global.Pz || {};
  global.Pz.state = state;
  if (typeof module === 'object' && module.exports) module.exports = state;
})(typeof globalThis !== 'undefined' ? globalThis : this);
