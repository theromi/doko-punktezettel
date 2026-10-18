(function (global) {
  function state() {
    return global.Pz.state;
  }

  let app = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function bindTheme() {
    const select = $('#theme-select');
    select.value = app.theme;
    select.addEventListener('change', () => {
      app.setTheme(select.value);
    });
  }

  function syncThemeControl() {
    const select = $('#theme-select');
    if (select && select.value !== app.theme) select.value = app.theme;
  }

  function bindTabs() {
    const tabbar = $('#tabbar');
    tabbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      app.setTab(btn.dataset.tab);
      btn.focus();
    });
    tabbar.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tabs = Array.from(tabbar.querySelectorAll('.tab'));
      const idx = tabs.indexOf(document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(idx + dir + tabs.length) % tabs.length];
      app.setTab(next.dataset.tab);
      next.focus();
    });
  }

  function bindDialogDismiss(dialog) {
    dialog.addEventListener('click', (ev) => {
      if (ev.target === dialog) dialog.close();
    });
  }

  function init(appApi) {
    app = appApi;
    bindTheme();
    bindTabs();
    bindDialogDismiss($('#hand-sheet'));
    bindDialogDismiss($('#confirm-dialog'));
  }

  function removeFab() {
    const oldFab = $('#fab-new');
    if (oldFab) oldFab.remove();
  }

  function renderWelcome(opts) {
    removeFab();
    const hasSession = opts.hasSession;
    const screen = $('#screen');
    screen.className = 'screen no-tabs';
    $('#tabbar').hidden = true;
    const cont = hasSession
      ? '<button type="button" class="btn btn-primary" id="btn-continue">Fortsetzen</button>'
      : '';
    screen.innerHTML =
      '<div class="welcome-card">' +
      '<h2>Punktezettel</h2>' +
      '<p class="lede">Doppelkopf-Punktezettel. Gewinner antippen, N eintragen — der Rest ergibt sich.</p>' +
      '<p class="sheet-help">N = fertiger Spielwert (Re/Kontra etc. vorher einrechnen).</p>' +
      '<div class="btn-row">' +
      cont +
      '<button type="button" class="btn ' + (hasSession ? '' : 'btn-primary') + '" id="btn-new">Neues Spiel</button>' +
      '</div>' +
      '<p class="privacy">Bleibt auf dem Gerät, kein Konto, kein Server.</p>' +
      '</div>';
    if (hasSession) {
      $('#btn-continue').addEventListener('click', () => app.continueGame());
    }
    $('#btn-new').addEventListener('click', () => {
      if (hasSession) {
        confirmDialog({
          title: 'Neues Spiel?',
          body: 'Das aktuelle Spiel wird gelöscht.',
          confirmLabel: 'Löschen',
          onConfirm: () => app.newGame(),
        });
      } else {
        app.newGame();
      }
    });
  }

  function makeNameRow(index, initialValue) {
    const row = document.createElement('div');
    row.className = 'name-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 20;
    input.autocomplete = 'off';
    input.placeholder = 'Spieler ' + index;
    input.setAttribute('aria-label', 'Name Spieler ' + index);
    if (initialValue) input.value = initialValue;
    row.appendChild(input);
    return row;
  }

  function renderSetup(initialNames) {
    removeFab();
    const remembered = Array.isArray(initialNames) ? initialNames : [];
    const screen = $('#screen');
    screen.className = 'screen no-tabs';
    $('#tabbar').hidden = true;
    screen.innerHTML =
      '<div class="setup-card">' +
      '<h2>Neues Spiel</h2>' +
      '<p class="lede">Mindestens 3, höchstens 6 Namen — am besten in Sitzreihenfolge am Tisch (für die automatische Aussetz-Rotation).</p>' +
      '<div class="name-list" id="name-list"></div>' +
      '<div class="setup-tools">' +
      '<button type="button" class="btn btn-ghost" id="btn-add-player">+ Spieler</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-clear-names">Namen leeren</button>' +
      '</div>' +
      '<p class="setup-error" id="setup-error" role="alert"></p>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn-primary" id="btn-start">Spiel starten</button>' +
      '<button type="button" class="btn" id="btn-back">Zurück</button>' +
      '</div>' +
      '<p class="privacy">Bleibt auf dem Gerät, kein Konto, kein Server.</p>' +
      '</div>';
    const list = $('#name-list');
    const initialCount = Math.min(6, Math.max(4, remembered.length));
    for (let i = 0; i < initialCount; i += 1) {
      list.appendChild(makeNameRow(i + 1, remembered[i] || ''));
    }
    if (initialCount >= 6) $('#btn-add-player').disabled = true;
    $('#btn-add-player').addEventListener('click', () => {
      const count = list.querySelectorAll('input').length;
      if (count >= 6) return;
      list.appendChild(makeNameRow(count + 1));
      if (count + 1 >= 6) $('#btn-add-player').disabled = true;
      list.lastElementChild.querySelector('input').focus();
    });
    $('#btn-clear-names').addEventListener('click', () => {
      list.querySelectorAll('input').forEach((el) => {
        el.value = '';
      });
      const first = list.querySelector('input');
      if (first) first.focus();
    });
    $('#btn-start').addEventListener('click', () => {
      const inputs = Array.from(list.querySelectorAll('input'));
      const names = inputs.map((el) => el.value);
      const filled = names.map((n) => n.trim()).filter(Boolean);
      const err = $('#setup-error');
      if (filled.length < 3) {
        err.textContent = 'Bitte mindestens 3 Namen eintragen.';
        return;
      }
      if (filled.length > 6) {
        err.textContent = 'Höchstens 6 Namen.';
        return;
      }
      err.textContent = '';
      const players = state().makePlayers(names);
      if (players.length < 3) {
        err.textContent = 'Bitte mindestens 3 Namen eintragen.';
        return;
      }
      app.startGame(players);
    });
    $('#btn-back').addEventListener('click', () => app.showWelcome());
  }

  function renderGame() {
    $('#tabbar').hidden = false;
    syncTabs();
    renderActiveTab();
  }

  function syncTabs() {
    document.querySelectorAll('.tab').forEach((btn) => {
      const active = btn.dataset.tab === app.tab;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
      btn.tabIndex = active ? 0 : -1;
    });
    syncThemeControl();
  }

  function renderActiveTab() {
    syncTabs();
    const screen = $('#screen');
    screen.className = 'screen';
    removeFab();
    if (app.tab === 'tabelle') renderTable(screen);
    else if (app.tab === 'verlauf') renderVerlauf(screen);
    else renderStatistik(screen);
    if (app.tab === 'tabelle') {
      const fab = document.createElement('button');
      fab.type = 'button';
      fab.id = 'fab-new';
      fab.className = 'fab';
      fab.textContent = 'Neue Runde';
      fab.addEventListener('click', () => openHandSheet());
      document.body.appendChild(fab);
    }
  }

  function scoreClass(v) {
    if (v > 0) return 'pos';
    if (v < 0) return 'neg';
    return '';
  }

  function formatScore(v) {
    if (v > 0) return '+' + v;
    if (v < 0) return '−' + Math.abs(v);
    return '0';
  }

  function formatDecimal(v) {
    const r = Math.round(v * 10) / 10;
    return String(r).replace('.', ',');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderTable(screen) {
    const players = app.session.players;
    const hands = app.session.hands;
    const t = state().totals(players, hands);
    const info = state().nextRoundInfo(players, hands);
    const nextLabel =
      info.sitters.length > 0
        ? 'Aussetzen: ' + info.sitters.map((p) => escapeHtml(p.name)).join(', ')
        : info.dealer
          ? 'Geber: ' + escapeHtml(info.dealer.name)
          : '';
    const bockRem = app.session.bockRemaining || 0;
    const bockInfo = bockRem > 0 ? ' · <span class="bock-badge">BOCK: ' + bockRem + '</span>' : '';
    const subText =
      hands.length +
      ' ' +
      (hands.length === 1 ? 'Hand' : 'Hände') +
      (nextLabel ? ' · ' + nextLabel : '') +
      bockInfo;

    const header =
      '<div class="sheet-toolbar">' +
      '<div>' +
      '<h2>Tabelle</h2>' +
      '<div class="sub">' + subText + '</div>' +
      '</div>' +
      '<div class="toolbar-actions">' +
      '<button type="button" class="btn" id="btn-bock">+ Bockrunde</button>' +
      '<button type="button" class="btn" id="btn-undo"' + (hands.length === 0 ? ' disabled' : '') + '>Rückgängig</button>' +
      '</div>' +
      '</div>';
    const cols = players.map((p) => '<th scope="col">' + escapeHtml(p.name) + '</th>').join('');
    const totalCells = players
      .map((p) => {
        const v = t[p.id] || 0;
        return '<td class="' + scoreClass(v) + '">' + formatScore(v) + '</td>';
      })
      .join('');
    const rows = hands
      .map((hand, idx) => {
        const scores = state().scoreHand(hand);
        const cells = players
          .map((p) => {
            if (!hand.active.includes(p.id)) return '<td class="pause" title="setzt aus">–</td>';
            const v = scores[p.id] || 0;
            return '<td class="' + scoreClass(v) + '">' + formatScore(v) + '</td>';
          })
          .join('');
        const showSolo = Boolean(hand.soloistId && hand.active.length > 3);
        const solo = showSolo ? '<span class="solo-badge" title="Solo">SOLO</span>' : '';
        const bock = hand.bock ? '<span class="bock-badge" title="Bockrunde (×2)">BOCK</span>' : '';
        return (
          '<tr data-hand-index="' + idx + '" tabindex="0" role="button" aria-label="Runde ' + (idx + 1) + ' bearbeiten">' +
          '<th scope="row">' + (idx + 1) + solo + bock + '</th>' +
          cells +
          '</tr>'
        );
      })
      .join('');
    const hint =
      hands.length === 0
        ? '<p class="hint">Noch keine Hände — tippe auf „Neue Runde“.</p>'
        : '<p class="hint">Tipp: Zeile antippen, um eine Runde zu bearbeiten oder zu löschen.</p>';
    screen.innerHTML =
      header +
      '<div class="table-scroll">' +
      '<table class="sheet">' +
      '<thead>' +
      '<tr><th scope="col">Hand</th>' + cols + '</tr>' +
      '</thead>' +
      '<tfoot>' +
      '<tr class="totals-row"><th scope="row">Summe</th>' + totalCells + '</tr>' +
      '</tfoot>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>' +
      hint;
    const scroller = screen.querySelector('.table-scroll');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    $('#btn-undo').addEventListener('click', () => app.undo());
    $('#btn-bock').addEventListener('click', () => app.addBockRound());
    const tbody = screen.querySelector('tbody');
    if (tbody) {
      tbody.addEventListener('click', (ev) => {
        const tr = ev.target.closest('tr[data-hand-index]');
        if (!tr) return;
        openHandSheet(Number(tr.dataset.handIndex));
      });
      tbody.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        const tr = ev.target.closest('tr[data-hand-index]');
        if (!tr) return;
        ev.preventDefault();
        openHandSheet(Number(tr.dataset.handIndex));
      });
    }
  }

  function renderVerlauf(screen) {
    screen.innerHTML = '<h2>Verlauf</h2><div id="graph-host"></div>';
    global.Pz.graph.renderGraph($('#graph-host'), app.session.players, app.session.hands);
  }

  function renderStatistik(screen) {
    const rows = state().stats(app.session.players, app.session.hands);
    const body = rows
      .map((s) => {
        const q = s.gewinnquote == null ? '–' : Math.round(s.gewinnquote * 100) + '%';
        const avg = s.avgProHand == null ? '–' : formatDecimal(s.avgProHand);
        return (
          '<tr>' +
          '<th scope="row">' + escapeHtml(s.name) + '</th>' +
          '<td class="' + scoreClass(s.punkte) + '">' + formatScore(s.punkte) + '</td>' +
          '<td>' + s.handsPlayed + '</td>' +
          '<td>' + s.gewonnen + '</td>' +
          '<td>' + q + '</td>' +
          '<td>' + avg + '</td>' +
          '<td>' + s.solosGewonnen + '</td>' +
          '<td>' + s.solosVerloren + '</td>' +
          '</tr>'
        );
      })
      .join('');
    screen.innerHTML =
      '<h2>Statistik</h2>' +
      '<p class="lede">Gewinnquote = gewonnen / gespielt. Ø pro Hand ignoriert Pausen.</p>' +
      '<div class="stats-wrap">' +
      '<table class="stats">' +
      '<thead>' +
      '<tr>' +
      '<th scope="col">Spieler</th>' +
      '<th scope="col">Punkte</th>' +
      '<th scope="col">Hände</th>' +
      '<th scope="col">Gewonnen</th>' +
      '<th scope="col">Quote</th>' +
      '<th scope="col">Ø/Hand</th>' +
      '<th scope="col">Solo +</th>' +
      '<th scope="col">Solo −</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' + body + '</tbody>' +
      '</table>' +
      '</div>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn-danger" id="btn-new-game">Neues Spiel</button>' +
      '</div>' +
      '<p class="privacy">Bleibt auf dem Gerät, kein Konto, kein Server.</p>';
    $('#btn-new-game').addEventListener('click', () => {
      confirmDialog({
        title: 'Neues Spiel?',
        body: 'Das aktuelle Spiel wird gelöscht.',
        confirmLabel: 'Löschen',
        onConfirm: () => app.newGame(),
      });
    });
  }

  function clampN(v) {
    if (!Number.isFinite(v)) return 1;
    return Math.min(999, Math.max(0, v));
  }

  function effectiveN(baseN, bock) {
    return bock ? clampN(baseN * 2) : baseN;
  }

  function openHandSheet(editIndex) {
    const dialog = $('#hand-sheet');
    const players = app.session.players;
    const hands = app.session.hands;
    const isEdit = Number.isInteger(editIndex) && editIndex >= 0 && editIndex < hands.length;
    let sheetState;
    if (isEdit) {
      const hand = hands[editIndex];
      sheetState = {
        editIndex: editIndex,
        n: Number.isInteger(hand.baseN) ? hand.baseN : hand.n,
        bock: Boolean(hand.bock),
        active: hand.active.slice(),
        winners: new Set(hand.winners),
        focusKey: null,
      };
    } else {
      const suggested = state().suggestActive(players, hands);
      sheetState = {
        editIndex: null,
        n: 1,
        bock: Boolean((app.session.bockRemaining || 0) > 0),
        active: suggested.slice(),
        winners: new Set(),
        focusKey: null,
      };
    }
    renderHandSheet(dialog, players, sheetState);
    if (!dialog.open) dialog.showModal();
    const first = dialog.querySelector('#n-row .chip[aria-pressed="true"]') || dialog.querySelector('#n-row .chip');
    if (first) first.focus();
  }

  function renderPreviewContent(players, entry, bock) {
    const showSolo = entry.active.length > 3 && state().isSoloSplit(entry.winners, entry.active);
    const soloBadge = showSolo ? '<span class="solo-badge">SOLO</span>' : '';
    const bockBadge = bock ? '<span class="bock-badge">BOCK ×2</span>' : '';
    const badges = soloBadge || bockBadge ? '<div class="preview-badges">' + soloBadge + bockBadge + '</div>' : '';
    return badges + escapeHtml(state().formatPreview(players, entry));
  }

  function renderHandSheet(dialog, players, sheetState) {
    const isEdit = sheetState.editIndex != null;
    const activeSet = new Set(sheetState.active);

    const playerChips = players
      .map((p) => {
        const isActive = activeSet.has(p.id);
        const isWin = sheetState.winners.has(p.id);
        if (isActive) {
          return (
            '<button type="button" class="chip" data-toggle-win="' + p.id + '" aria-pressed="' + isWin + '">' + escapeHtml(p.name) + '</button>'
          );
        }
        return (
          '<button type="button" class="chip is-paused" disabled>' +
          escapeHtml(p.name) +
          '<span class="chip-sub">setzt aus</span>' +
          '</button>'
        );
      })
      .join('');

    const nChips = [0, 1, 2, 3, 4, 5, 6]
      .map(
        (v) =>
          '<button type="button" class="chip" data-n="' + v + '" aria-pressed="' + (sheetState.n === v) + '">' + v + '</button>'
      )
      .join('');

    const bockRemCount = !isEdit && (app.session.bockRemaining || 0) > 0 ? ' (' + app.session.bockRemaining + ')' : '';
    const bockChip =
      '<button type="button" class="chip" id="bock-toggle" aria-pressed="' +
      sheetState.bock +
      '">Bock ×2' +
      bockRemCount +
      '</button>';

    const effN = effectiveN(sheetState.n, sheetState.bock);
    const entry = {
      n: effN,
      baseN: sheetState.n,
      bock: sheetState.bock,
      winners: Array.from(sheetState.winners),
      active: sheetState.active,
    };
    const validation = state().validateEntry(entry);
    const previewHtml = validation.valid
      ? renderPreviewContent(players, entry, sheetState.bock)
      : escapeHtml('Gewinner wählen, um die Vorschau zu sehen.');

    const titleText = isEdit ? 'Runde ' + (sheetState.editIndex + 1) + ' bearbeiten' : 'Neue Runde';
    const saveLabel = isEdit ? 'Speichern' : 'Eintragen';
    const deleteBtn = isEdit
      ? '<button type="button" class="btn btn-danger" id="sheet-delete">Löschen</button>'
      : '';

    dialog.innerHTML =
      '<div class="sheet-panel">' +
      '<div class="sheet-header">' +
      '<h2 id="sheet-title">' + titleText + '</h2>' +
      '<button type="button" class="btn btn-ghost" id="sheet-close">Schließen</button>' +
      '</div>' +
      '<p class="sheet-help">N = fertiger Spielwert (Re/Kontra etc. vorher einrechnen).</p>' +
      '<span class="field-label">Spielwert N</span>' +
      '<div class="chip-row" id="n-row">' +
      nChips +
      '<span class="stepper">' +
      '<button type="button" id="n-minus" aria-label="N verringern">−</button>' +
      '<input type="number" id="n-input" min="0" max="999" step="1" value="' + sheetState.n + '" aria-label="Spielwert N">' +
      '<button type="button" id="n-plus" aria-label="N erhöhen">+</button>' +
      '</span>' +
      bockChip +
      '</div>' +
      '<span class="field-label">Gewinner antippen</span>' +
      '<div class="chip-row" id="player-row">' + playerChips + '</div>' +
      '<div class="preview" id="preview">' + previewHtml + '</div>' +
      '<div class="sheet-actions">' +
      deleteBtn +
      '<button type="button" class="btn" id="sheet-cancel">Abbrechen</button>' +
      '<button type="button" class="btn btn-primary" id="sheet-save"' + (validation.valid ? '' : ' disabled') + '>' + saveLabel + '</button>' +
      '</div>' +
      '</div>';

    $('#sheet-close').addEventListener('click', () => dialog.close());
    $('#sheet-cancel').addEventListener('click', () => dialog.close());
    if (isEdit) {
      $('#sheet-delete').addEventListener('click', () => {
        dialog.close();
        app.deleteHand(sheetState.editIndex);
      });
    }
    $('#sheet-save').addEventListener('click', () => {
      const e = {
        n: effectiveN(sheetState.n, sheetState.bock),
        baseN: sheetState.n,
        bock: sheetState.bock,
        winners: Array.from(sheetState.winners),
        active: sheetState.active,
      };
      const v = state().validateEntry(e);
      if (!v.valid) return;
      dialog.close();
      if (isEdit) app.updateHand(sheetState.editIndex, e);
      else app.addHand(e);
    });

    $('#n-row').addEventListener('click', (ev) => {
      const chip = ev.target.closest('[data-n]');
      if (chip) {
        sheetState.n = Number(chip.dataset.n);
        sheetState.focusKey = 'n-' + sheetState.n;
        renderHandSheet(dialog, players, sheetState);
        return;
      }
      if (ev.target.id === 'bock-toggle') {
        sheetState.bock = !sheetState.bock;
        sheetState.focusKey = 'bock';
        renderHandSheet(dialog, players, sheetState);
        return;
      }
      if (ev.target.id === 'n-minus') {
        sheetState.n = clampN(sheetState.n - 1);
        sheetState.focusKey = 'n-minus';
        renderHandSheet(dialog, players, sheetState);
      } else if (ev.target.id === 'n-plus') {
        sheetState.n = clampN(sheetState.n + 1);
        sheetState.focusKey = 'n-plus';
        renderHandSheet(dialog, players, sheetState);
      }
    });

    $('#n-input').addEventListener('input', (ev) => {
      // Live validation without full re-render so multi-digit typing keeps focus.
      const v = Number(ev.target.value);
      const saveBtn = dialog.querySelector('#sheet-save');
      const preview = dialog.querySelector('#preview');
      if (ev.target.value.trim() === '' || !Number.isInteger(v) || v < 0 || v > 999) {
        if (saveBtn) saveBtn.disabled = true;
        return;
      }
      sheetState.n = v;
      const live = {
        n: effectiveN(sheetState.n, sheetState.bock),
        baseN: sheetState.n,
        bock: sheetState.bock,
        winners: Array.from(sheetState.winners),
        active: sheetState.active,
      };
      const validation = state().validateEntry(live);
      if (saveBtn) saveBtn.disabled = !validation.valid;
      if (preview) {
        if (validation.valid) {
          preview.innerHTML = renderPreviewContent(players, live, sheetState.bock);
        } else {
          preview.textContent = 'Gewinner wählen, um die Vorschau zu sehen.';
        }
      }
      dialog.querySelectorAll('#n-row .chip[data-n]').forEach((chip) => {
        chip.setAttribute('aria-pressed', String(Number(chip.dataset.n) === sheetState.n));
      });
    });

    $('#n-input').addEventListener('change', (ev) => {
      const v = Number(ev.target.value);
      sheetState.n = ev.target.value.trim() !== '' && Number.isFinite(v) ? clampN(Math.round(v)) : 1;
      sheetState.focusKey = 'n-input';
      renderHandSheet(dialog, players, sheetState);
    });

    $('#player-row').addEventListener('click', (ev) => {
      const winBtn = ev.target.closest('[data-toggle-win]');
      if (winBtn) {
        const id = winBtn.dataset.toggleWin;
        if (sheetState.winners.has(id)) sheetState.winners.delete(id);
        else sheetState.winners.add(id);
        sheetState.focusKey = 'win-' + id;
        renderHandSheet(dialog, players, sheetState);
      }
    });

    if (sheetState.focusKey) {
      const key = sheetState.focusKey;
      let focused = null;
      if (key === 'bock') {
        focused = dialog.querySelector('#bock-toggle');
      } else if (key.indexOf('n-') === 0 && key.length >= 2) {
        const suffix = key.slice(2);
        if (suffix === 'minus') focused = dialog.querySelector('#n-minus');
        else if (suffix === 'plus') focused = dialog.querySelector('#n-plus');
        else if (suffix === 'input') focused = dialog.querySelector('#n-input');
        else focused = dialog.querySelector('[data-n="' + suffix + '"]');
      } else if (key.indexOf('win-') === 0) {
        focused = dialog.querySelector('[data-toggle-win="' + key.slice(4) + '"]');
      }
      if (focused) focused.focus();
    }
  }

  function showToast(message, opts) {
    opts = opts || {};
    const actionLabel = opts.actionLabel;
    const onAction = opts.onAction;
    const duration = opts.duration == null ? 3200 : opts.duration;
    const toast = $('#toast');
    toast.textContent = '';
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);
    if (actionLabel && onAction) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => {
        hideToast();
        onAction();
      });
      toast.appendChild(btn);
    }
    toast.hidden = false;
    clearTimeout(showToast._t);
    if (duration > 0) {
      showToast._t = setTimeout(hideToast, duration);
    }
  }

  function hideToast() {
    $('#toast').hidden = true;
  }

  function confirmDialog(opts) {
    const dialog = $('#confirm-dialog');
    dialog.innerHTML =
      '<div class="confirm-panel">' +
      '<h2 id="confirm-title">' + escapeHtml(opts.title) + '</h2>' +
      '<p class="lede">' + escapeHtml(opts.body) + '</p>' +
      '<div class="sheet-actions">' +
      '<button type="button" class="btn" id="confirm-cancel">Abbrechen</button>' +
      '<button type="button" class="btn btn-primary" id="confirm-ok">' + escapeHtml(opts.confirmLabel) + '</button>' +
      '</div>' +
      '</div>';
    $('#confirm-cancel').addEventListener('click', () => dialog.close());
    $('#confirm-ok').addEventListener('click', () => {
      dialog.close();
      opts.onConfirm();
    });
    dialog.showModal();
  }

  const ui = {
    init,
    renderWelcome,
    renderSetup,
    renderGame,
    renderActiveTab,
    openHandSheet,
    showToast,
    hideToast,
    syncTheme: syncThemeControl,
  };

  global.Pz = global.Pz || {};
  global.Pz.ui = ui;
  if (typeof module === 'object' && module.exports) module.exports = ui;
})(typeof globalThis !== 'undefined' ? globalThis : this);
