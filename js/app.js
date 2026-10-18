(function (global) {
  function state() {
    return global.Pz.state;
  }

  function storage() {
    return global.Pz.storage;
  }

  function ui() {
    return global.Pz.ui;
  }

  const app = {
    session: null,
    theme: 'system',
    tab: 'tabelle',

    setTheme(mode) {
      this.theme = mode;
      storage().saveTheme(mode);
      applyTheme(mode);
      ui().syncTheme();
      if (this.tab === 'verlauf' && this.session) ui().renderActiveTab();
    },

    setTab(tab) {
      // Tabs (Tabelle/Verlauf/Statistik) gibt es nur in einem laufenden Spiel.
      if (!this.session) return;
      this.tab = tab;
      ui().renderActiveTab();
    },

    showWelcome() {
      this.session = null;
      const loaded = storage().loadSession();
      ui().renderWelcome({ hasSession: Boolean(loaded && loaded.players && loaded.players.length) });
    },

    continueGame() {
      const loaded = storage().loadSession();
      if (!loaded || loaded.reset || !loaded.players || !loaded.players.length) {
        ui().renderWelcome({ hasSession: false });
        return;
      }
      this.session = loaded;
      storage().saveLastPlayers(loaded.players.map((p) => p.name));
      this.tab = 'tabelle';
      ui().renderGame();
    },

    newGame() {
      if (this.session && this.session.players) {
        storage().saveLastPlayers(this.session.players.map((p) => p.name));
      } else {
        const loaded = storage().loadSession();
        if (loaded && loaded.players) {
          storage().saveLastPlayers(loaded.players.map((p) => p.name));
        }
      }
      storage().clearSession();
      this.session = null;
      ui().renderSetup(storage().loadLastPlayers());
    },

    startGame(players) {
      this.session = { version: 1, players: players, hands: [], bockRemaining: 0 };
      storage().saveLastPlayers(players.map((p) => p.name));
      const ok = storage().saveSessionNow(this.session);
      if (!ok) ui().showToast('Speichern fehlgeschlagen — Speicher voll oder blockiert.');
      this.tab = 'tabelle';
      ui().renderGame();
    },

    addHand(entry) {
      const players = this.session.players;
      const hands = this.session.hands;
      const active =
        entry.active && entry.active.length ? entry.active.slice() : state().suggestActive(players, hands);
      const winners = entry.winners.slice();
      const check = state().validateEntry({ n: entry.n, winners: winners, active: active });
      if (!check.valid) return;
      const fromBockQueue = Boolean(this.session.bockRemaining > 0);
      if (fromBockQueue) {
        this.session.bockRemaining = Math.max(0, this.session.bockRemaining - 1);
      }
      const hand = {
        id: state().createId(),
        n: entry.n,
        baseN: Number.isInteger(entry.baseN) ? entry.baseN : entry.n,
        bock: Boolean(entry.bock),
        fromBockQueue: fromBockQueue,
        winners: winners,
        active: active,
        soloistId: state().deriveSoloist(winners, active),
      };
      hands.push(hand);
      storage().saveSession(this.session);
      ui().renderActiveTab();
      ui().showToast('Runde ' + hands.length + ' eingetragen · Rückgängig?', {
        actionLabel: 'Runde löschen',
        onAction: () => this.undo(),
      });
    },

    updateHand(index, entry) {
      const hands = this.session.hands;
      if (index < 0 || index >= hands.length) return;
      const prev = hands[index];
      const active = entry.active && entry.active.length ? entry.active.slice() : prev.active.slice();
      const winners = entry.winners.slice();
      const check = state().validateEntry({ n: entry.n, winners: winners, active: active });
      if (!check.valid) return;
      hands[index] = {
        id: prev.id,
        n: entry.n,
        baseN: Number.isInteger(entry.baseN) ? entry.baseN : entry.n,
        bock: Boolean(entry.bock),
        fromBockQueue: Boolean(prev.fromBockQueue),
        winners: winners,
        active: active,
        soloistId: state().deriveSoloist(winners, active),
      };
      storage().saveSession(this.session);
      ui().renderActiveTab();
      ui().showToast('Runde ' + (index + 1) + ' aktualisiert');
    },

    deleteHand(index) {
      const hands = this.session.hands;
      if (index < 0 || index >= hands.length) return;
      const removed = hands.splice(index, 1)[0];
      if (removed.fromBockQueue) {
        this.session.bockRemaining = Math.min(99, (this.session.bockRemaining || 0) + 1);
      }
      storage().saveSession(this.session);
      ui().renderActiveTab();
      ui().showToast('Runde ' + (index + 1) + ' gelöscht · Rückgängig?', {
        actionLabel: 'Wiederherstellen',
        onAction: () => {
          hands.splice(index, 0, removed);
          if (removed.fromBockQueue) {
            this.session.bockRemaining = Math.max(0, (this.session.bockRemaining || 0) - 1);
          }
          storage().saveSession(this.session);
          ui().renderActiveTab();
          ui().showToast('Runde ' + (index + 1) + ' wiederhergestellt');
        },
      });
    },

    undo() {
      const hands = this.session.hands;
      if (!hands.length) return;
      this.deleteHand(hands.length - 1);
    },

    addBockRound() {
      if (!this.session) return;
      const count = this.session.players.length;
      const prev = this.session.bockRemaining || 0;
      this.session.bockRemaining = Math.min(99, prev + count);
      storage().saveSession(this.session);
      ui().renderActiveTab();
      ui().showToast('Bockrunde (+' + count + ' Hände) aktiv', {
        actionLabel: 'Rückgängig',
        onAction: () => {
          this.session.bockRemaining = prev;
          storage().saveSession(this.session);
          ui().renderActiveTab();
        },
      });
    },
  };

  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
  }

  function boot() {
    app.theme = storage().loadTheme();
    applyTheme(app.theme);
    ui().init(app);
    bindPersistenceFlush();
    bindSystemThemeWatch();

    const loaded = storage().loadSession();
    if (loaded && loaded.reset) {
      ui().showToast('Gespeichertes Spiel war nicht lesbar — Neues Spiel nötig.');
      ui().renderWelcome({ hasSession: false });
    } else if (loaded && loaded.players && loaded.players.length) {
      ui().renderWelcome({ hasSession: true });
    } else {
      ui().renderWelcome({ hasSession: false });
    }

    registerSW();
  }

  function bindPersistenceFlush() {
    function flush() {
      if (!app.session) return;
      const res = storage().flushPending ? storage().flushPending() : null;
      if (res === false) ui().showToast('Speichern fehlgeschlagen — Speicher voll oder blockiert.');
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  function bindSystemThemeWatch() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (app.theme !== 'system') return;
      if (app.tab === 'verlauf' && app.session) ui().renderActiveTab();
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
  }

  function promptUpdate(worker) {
    ui().showToast('Update verfügbar — neu laden', {
      actionLabel: 'Neu laden',
      duration: 0,
      onAction: () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
      },
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    window.addEventListener('load', () => {
      const hadController = Boolean(navigator.serviceWorker.controller);

      navigator.serviceWorker
        .register('sw.js')
        .then((reg) => {
          // Update may already be waiting (e.g. installed while page was open).
          if (reg.waiting && navigator.serviceWorker.controller) {
            promptUpdate(reg.waiting);
          }
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                promptUpdate(sw);
              }
            });
          });
        })
        .catch(() => {});

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  global.Pz = global.Pz || {};
  global.Pz.app = app;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
