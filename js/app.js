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
      this.tab = 'tabelle';
      ui().renderGame();
    },

    newGame() {
      storage().clearSession();
      this.session = null;
      ui().renderSetup();
    },

    startGame(players) {
      this.session = { version: 1, players: players, hands: [] };
      const ok = storage().saveSessionNow(this.session);
      if (!ok) ui().showToast('Speichern fehlgeschlagen — Speicher voll oder blockiert.');
      this.tab = 'tabelle';
      ui().renderGame();
    },

    persistOrWarn() {
      if (!this.session) return true;
      const ok = storage().saveSessionNow(this.session);
      if (!ok) ui().showToast('Speichern fehlgeschlagen — Speicher voll oder blockiert.');
      return ok;
    },

    addHand(entry) {
      const players = this.session.players;
      const hands = this.session.hands;
      const active =
        entry.active && entry.active.length ? entry.active.slice() : state().suggestActive(players, hands);
      const winners = entry.winners.slice();
      const check = state().validateEntry({ n: entry.n, winners: winners, active: active });
      if (!check.valid) return;
      const hand = {
        id: state().createId(),
        n: entry.n,
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

    undo() {
      const hands = this.session.hands;
      if (!hands.length) return;
      hands.pop();
      storage().saveSession(this.session);
      ui().renderActiveTab();
      ui().showToast('Runde ' + (hands.length + 1) + ' gelöscht');
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
        if (refreshing) return;
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
