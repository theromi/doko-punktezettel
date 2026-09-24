(function (global) {
  const PALETTE_LIGHT = [
    '#E69F00',
    '#56B4E9',
    '#009E73',
    '#A67C00',
    '#0072B2',
    '#D55E00',
    '#CC79A7',
    '#000000',
    '#6B6B6B',
    '#8854D0',
  ];

  const PALETTE_DARK = [
    '#E69F00',
    '#56B4E9',
    '#009E73',
    '#F0E442',
    '#3D8BFD',
    '#D55E00',
    '#CC79A7',
    '#E8E8E8',
    '#B0B0B0',
    '#B280D9',
  ];

  const DASHES = ['', '6 3', '2 3', '8 3 2 3', '1 3', '10 4', '4 2 1 2', '3 1', '12 3', '5 5'];
  const MARKERS = ['circle', 'square', 'triangle', 'diamond', 'cross', 'star', 'plus', 'wye', 'triangle-down', 'hex'];

  function state() {
    return global.Pz.state;
  }

  function effectiveTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light') return 'light';
    if (attr === 'dark') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function palette() {
    return effectiveTheme() === 'dark' ? PALETTE_DARK : PALETTE_LIGHT;
  }

  function markerPath(kind, x, y, r) {
    switch (kind) {
      case 'square':
        return 'M' + (x - r) + ',' + (y - r) + 'h' + 2 * r + 'v' + 2 * r + 'h' + -2 * r + 'z';
      case 'triangle':
        return 'M' + x + ',' + (y - r) + 'L' + (x + r) + ',' + (y + r) + 'L' + (x - r) + ',' + (y + r) + 'z';
      case 'triangle-down':
        return 'M' + x + ',' + (y + r) + 'L' + (x + r) + ',' + (y - r) + 'L' + (x - r) + ',' + (y - r) + 'z';
      case 'diamond':
        return 'M' + x + ',' + (y - r) + 'L' + (x + r) + ',' + y + 'L' + x + ',' + (y + r) + 'L' + (x - r) + ',' + y + 'z';
      case 'cross':
        return 'M' + (x - r) + ',' + (y - r) + 'L' + (x + r) + ',' + (y + r) + 'M' + (x + r) + ',' + (y - r) + 'L' + (x - r) + ',' + (y + r);
      case 'plus':
        return 'M' + (x - r) + ',' + y + 'H' + (x + r) + 'M' + x + ',' + (y - r) + 'V' + (y + r);
      case 'star':
        return 'M' + x + ',' + (y - r) + 'L' + (x + r * 0.4) + ',' + (y + r * 0.3) + 'L' + (x + r) + ',' + (y + r * 0.3) + 'L' + (x + r * 0.5) + ',' + (y + r * 0.7) + 'L' + (x + r * 0.7) + ',' + (y + r) + 'L' + x + ',' + (y + r * 0.75) + 'L' + (x - r * 0.7) + ',' + (y + r) + 'L' + (x - r * 0.5) + ',' + (y + r * 0.7) + 'L' + (x - r) + ',' + (y + r * 0.3) + 'L' + (x - r * 0.4) + ',' + (y + r * 0.3) + 'z';
      case 'wye':
        return 'M' + x + ',' + y + 'L' + x + ',' + (y - r) + 'M' + x + ',' + y + 'L' + (x + r * 0.87) + ',' + (y + r * 0.5) + 'M' + x + ',' + y + 'L' + (x - r * 0.87) + ',' + (y + r * 0.5);
      case 'hex':
        return 'M' + (x + r) + ',' + y + 'L' + (x + r / 2) + ',' + (y + r * 0.87) + 'L' + (x - r / 2) + ',' + (y + r * 0.87) + 'L' + (x - r) + ',' + y + 'L' + (x - r / 2) + ',' + (y - r * 0.87) + 'L' + (x + r / 2) + ',' + (y - r * 0.87) + 'z';
      default:
        return 'M' + (x + r) + ',' + y + 'A' + r + ',' + r + ' 0 1 1 ' + (x - r) + ',' + y + 'A' + r + ',' + r + ' 0 1 1 ' + (x + r) + ',' + y;
    }
  }

  function el(name, attrs, children) {
    attrs = attrs || {};
    children = children || [];
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v != null && v !== '') node.setAttribute(k, String(v));
    }
    for (const child of children) node.appendChild(child);
    return node;
  }

  function textNode(str) {
    return document.createTextNode(str);
  }

  function fmt(v) {
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  }

  function buildData(players, hands) {
    const totalsMap = state().totals(players, hands);
    const points = players.map((p) => ({ id: p.id, name: p.name, ys: [0] }));
    for (const hand of hands) {
      const scores = state().scoreHand(hand);
      for (const p of players) {
        const s = scores[p.id] || 0;
        const series = points.find((pt) => pt.id === p.id);
        series.ys.push(series.ys[series.ys.length - 1] + s);
      }
    }
    const lastTotals = players.map((p) => p.name + ' ' + fmt(totalsMap[p.id])).join(', ');
    const summary = 'Kumulierte Punkte über ' + hands.length + ' Hände. Aktuelle Summen: ' + lastTotals;
    return { points, totalsMap, summary };
  }

  function buildTable(players, hands, points) {
    const table = document.createElement('table');
    table.className = 'graph-table';
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const corner = document.createElement('th');
    corner.textContent = 'Hand';
    hr.appendChild(corner);
    for (const p of players) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = p.name;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    const rows = points[0] ? points[0].ys.length : 1;
    for (let i = 0; i < rows; i += 1) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = String(i);
      tr.appendChild(th);
      for (const pt of points) {
        const td = document.createElement('td');
        td.textContent = fmt(pt.ys[i]);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  function niceTicks(min, max, count) {
    const span = max - min;
    if (span <= 0) return [Math.round(min)];
    const step = Math.pow(10, Math.floor(Math.log10(span / count)));
    const err = span / count / step;
    let s = step;
    if (err >= 7.5) s = step * 10;
    else if (err >= 3.5) s = step * 5;
    else if (err >= 1.5) s = step * 2;
    const start = Math.ceil(min / s) * s;
    const ticks = [];
    for (let v = start; v <= max + 1e-9; v += s) {
      ticks.push(Math.round(v * 1000) / 1000);
    }
    if (!ticks.includes(0) && min <= 0 && max >= 0) ticks.push(0);
    ticks.sort((a, b) => a - b);
    return ticks;
  }

  function renderGraph(container, players, hands) {
    container.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'graph-wrap';

    if (hands.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Noch keine Hände — trage die erste Runde ein';
      wrap.appendChild(empty);
      container.appendChild(wrap);
      return;
    }

    const pal = palette();
    const data = buildData(players, hands);
    const points = data.points;
    const totalsMap = data.totalsMap;
    const summary = data.summary;

    const W = 720;
    const H = 360;
    const m = { top: 16, right: 16, bottom: 36, left: 44 };
    const iw = W - m.left - m.right;
    const ih = H - m.top - m.bottom;

    let yMin = 0;
    let yMax = 0;
    for (const s of points) {
      for (const y of s.ys) {
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
    if (yMin === yMax) {
      yMin = Math.min(0, yMin - 1);
      yMax = Math.max(1, yMax + 1);
    } else {
      const pad = Math.max(1, (yMax - yMin) * 0.08);
      yMin -= pad;
      yMax += pad;
      if (yMin > 0) yMin = 0;
      if (yMax < 0) yMax = 0;
    }

    const n = hands.length;
    const xOf = (i) => m.left + (n === 0 ? 0 : (i / n) * iw);
    const yOf = (v) => m.top + ((yMax - v) / (yMax - yMin)) * ih;

    const svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      class: 'graph-svg',
      role: 'img',
      'aria-label': summary,
    });

    const yTicks = niceTicks(yMin, yMax, 5);
    for (const t of yTicks) {
      const y = yOf(t);
      svg.appendChild(
        el('line', {
          x1: m.left,
          x2: m.left + iw,
          y1: y,
          y2: y,
          class: t === 0 ? 'grid-zero' : 'grid-line',
        })
      );
      svg.appendChild(
        el('text', { x: m.left - 8, y: y + 4, class: 'axis-label', 'text-anchor': 'end' }, [
          textNode(String(t)),
        ])
      );
    }

    const xStep = n <= 12 ? 1 : Math.ceil(n / 12);
    for (let i = 0; i <= n; i += 1) {
      if (i !== 0 && i !== n && i % xStep !== 0) continue;
      const x = xOf(i);
      svg.appendChild(
        el('line', {
          x1: x,
          x2: x,
          y1: m.top,
          y2: m.top + ih,
          class: 'grid-line x',
        })
      );
      svg.appendChild(
        el('text', { x: x, y: H - 10, class: 'axis-label', 'text-anchor': 'middle' }, [
          textNode(String(i)),
        ])
      );
    }

    points.forEach((s, idx) => {
      const color = pal[idx % pal.length];
      const dash = DASHES[idx % DASHES.length];
      const marker = MARKERS[idx % MARKERS.length];
      const d = s.ys.map((y, i) => (i === 0 ? 'M' : 'L') + xOf(i) + ',' + yOf(y)).join('');
      svg.appendChild(
        el('path', {
          d: d,
          class: 'series-line',
          stroke: color,
          'stroke-dasharray': dash || null,
          'data-player': s.id,
        })
      );
      // Decimate markers on long games: lines stay full-res, markers are sparse
      // so a 200-hand game doesn't create thousands of SVG nodes.
      const markerStep = n > 80 ? Math.ceil(n / 80) : 1;
      s.ys.forEach((y, i) => {
        if (markerStep > 1 && i % markerStep !== 0 && i !== n) return;
        const x = xOf(i);
        const yy = yOf(y);
        const mp = markerPath(marker, x, yy, 4);
        svg.appendChild(
          el('path', {
            d: mp,
            class: 'series-marker',
            stroke: color,
            fill: marker === 'cross' || marker === 'plus' || marker === 'wye' ? 'none' : color,
          })
        );
      });
    });

    wrap.appendChild(svg);

    const legend = document.createElement('ul');
    legend.className = 'graph-legend';
    players.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'graph-legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'graph-swatch';
      swatch.style.background = pal[idx % pal.length];
      const name = document.createElement('span');
      name.textContent = p.name;
      const val = document.createElement('span');
      val.className = 'graph-legend-total';
      val.textContent = fmt(totalsMap[p.id] || 0);
      li.appendChild(swatch);
      li.appendChild(name);
      li.appendChild(val);
      legend.appendChild(li);
    });
    wrap.appendChild(legend);

    const details = document.createElement('details');
    details.className = 'graph-table-fallback';
    const summaryEl = document.createElement('summary');
    summaryEl.textContent = 'Als Tabelle';
    details.appendChild(summaryEl);
    details.appendChild(buildTable(players, hands, points));
    wrap.appendChild(details);

    container.appendChild(wrap);
  }

  const graph = { renderGraph };
  global.Pz = global.Pz || {};
  global.Pz.graph = graph;
  if (typeof module === 'object' && module.exports) module.exports = graph;
})(typeof globalThis !== 'undefined' ? globalThis : this);
