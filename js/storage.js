(function (global) {
  const SESSION_KEY = 'punktezettel.session.v1';
  const THEME_KEY = 'punktezettel.theme.v1';
  const SUPPORTED_VERSION = 1;

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function backupCorrupt(payload) {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const key = SESSION_KEY + '.corrupt.' + ts + '.' + rand;
    try {
      localStorage.setItem(key, payload);
    } catch (e) {
      // ignore (quota or unavailable)
    }
    try {
      pruneCorruptBackups();
    } catch (e) {
      // ignore
    }
    console.warn('Punktezettel: corrupt session payload backed up under', key);
  }

  function pruneCorruptBackups() {
    const prefix = SESSION_KEY + '.corrupt.';
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) keys.push(k);
    }
    keys.sort();
    while (keys.length > 3) {
      const oldest = keys.shift();
      try {
        localStorage.removeItem(oldest);
      } catch (e) {
        break;
      }
    }
  }

  function isValidHandShape(h, playerIds) {
    if (!h || typeof h.id !== 'string' || h.id.length === 0) return false;
    if (!Number.isInteger(h.n) || h.n < 1 || h.n > 999) return false;
    if (!Array.isArray(h.active) || (h.active.length !== 3 && h.active.length !== 4)) return false;
    if (!Array.isArray(h.winners)) return false;
    if (new Set(h.active).size !== h.active.length) return false;
    if (new Set(h.winners).size !== h.winners.length) return false;
    if (h.winners.length === 0 || h.winners.length >= h.active.length) return false;
    const playerSet = new Set(playerIds);
    for (const id of h.active) {
      if (typeof id !== 'string' || !playerSet.has(id)) return false;
    }
    const activeSet = new Set(h.active);
    for (const id of h.winners) {
      if (typeof id !== 'string' || !activeSet.has(id)) return false;
    }
    return true;
  }

  function deriveSoloistId(winners, active) {
    const winnerSet = new Set(winners);
    const losers = active.filter((id) => !winnerSet.has(id));
    if (winners.length === 1) return winners[0];
    if (losers.length === 1) return losers[0];
    return null;
  }

  function loadSession() {
    const raw = safeGet(SESSION_KEY);
    if (raw == null) return null;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      backupCorrupt(raw);
      return null;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      backupCorrupt(raw);
      return null;
    }
    if (data.version !== SUPPORTED_VERSION) {
      backupCorrupt(raw);
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (e) {
        // ignore
      }
      console.warn('Punktezettel: unsupported session version, reset');
      return { reset: true, reason: 'version' };
    }
    if (!Array.isArray(data.players) || !Array.isArray(data.hands)) {
      backupCorrupt(raw);
      return null;
    }
    const players = data.players
      .filter((p) => p && typeof p.id === 'string' && p.id.length > 0 && typeof p.name === 'string')
      .map((p) => ({ id: p.id, name: p.name.trim().slice(0, 20) }))
      .filter((p) => p.name.length > 0);
    const playerIds = players.map((p) => p.id);
    if (players.length < 3 || players.length > 10 || new Set(playerIds).size !== playerIds.length) {
      backupCorrupt(raw);
      return null;
    }
    let dropped = 0;
    const hands = [];
    for (const h of data.hands) {
      if (
        !h ||
        typeof h.id !== 'string' ||
        !Number.isInteger(h.n) ||
        !Array.isArray(h.winners) ||
        !Array.isArray(h.active)
      ) {
        dropped += 1;
        continue;
      }
      const clean = {
        id: h.id,
        n: h.n,
        winners: h.winners.filter((id) => typeof id === 'string'),
        active: h.active.filter((id) => typeof id === 'string'),
        soloistId: typeof h.soloistId === 'string' ? h.soloistId : null,
      };
      if (!isValidHandShape(clean, playerIds)) {
        dropped += 1;
        continue;
      }
      // Re-derive soloist so tampered / stale values can't skew stats.
      clean.soloistId = deriveSoloistId(clean.winners, clean.active);
      hands.push(clean);
    }
    if (dropped > 0) {
      console.warn('Punktezettel: dropped ' + dropped + ' invalid hand(s) from stored session');
    }
    return { players, hands };
  }

  let saveTimer = null;
  let pendingSession = null;

  // Returns true on success, false when storage is unavailable/full.
  function persist(session) {
    const payload = JSON.stringify({
      version: SUPPORTED_VERSION,
      players: session.players,
      hands: session.hands,
    });
    return safeSet(SESSION_KEY, payload);
  }

  function saveSession(session) {
    pendingSession = session;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const ok = persist(pendingSession);
      pendingSession = null;
      if (!ok && typeof console !== 'undefined' && console.warn) {
        console.warn('Punktezettel: autosave failed (storage full or blocked)');
      }
    }, 150);
  }

  function saveSessionNow(session) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    pendingSession = null;
    return persist(session);
  }

  // Synchronously flush a pending debounced write (call on pagehide).
  // Returns true/false when a write happened, null when nothing pending.
  function flushPending() {
    if (!saveTimer || !pendingSession) return null;
    clearTimeout(saveTimer);
    saveTimer = null;
    const ok = persist(pendingSession);
    pendingSession = null;
    return ok;
  }

  function clearSession() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      // ignore
    }
  }

  function loadTheme() {
    const raw = safeGet(THEME_KEY);
    if (raw === 'system' || raw === 'light' || raw === 'dark') return raw;
    return 'system';
  }

  function saveTheme(mode) {
    safeSet(THEME_KEY, mode);
  }

  const storage = {
    loadSession,
    saveSession,
    saveSessionNow,
    flushPending,
    clearSession,
    loadTheme,
    saveTheme,
  };

  global.Pz = global.Pz || {};
  global.Pz.storage = storage;
  if (typeof module === 'object' && module.exports) module.exports = storage;
})(typeof globalThis !== 'undefined' ? globalThis : this);
