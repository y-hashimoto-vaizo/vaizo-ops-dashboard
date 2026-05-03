/* =========================================================
   VAIZO OPS Dashboard - Frontend (v2.0)
   - 完全白黒（Design Policy v1）
   - 4章構成: 01 TODAY / 02 GOALS / 03 PORTFOLIO / 04 ALL TASKS
   ========================================================= */

(function () {
  'use strict';

  const CFG = window.VAIZO_OPS_CONFIG || {};
  const STATE = {
    raw: null,
    tasks: [],
    goals: [],
    masters: { depts: [], owners: [], statuses: [], priorities: [] },
    filter: { search: '', dept: '', owner: '', status: '', priority: '', sort: 'deadline' },
    viewer: ''
  };

  /* ============ BOOT ============ */
  document.addEventListener('DOMContentLoaded', async () => {
    if (await checkGate()) init();
  });

  function init() {
    document.getElementById('sheetLink').href = CFG.spreadsheetUrl || '#';
    document.getElementById('refreshBtn').addEventListener('click', () => loadAndRender(true));
    document.getElementById('searchInput').addEventListener('input', onFilterChange);
    document.getElementById('filterDept').addEventListener('change', onFilterChange);
    document.getElementById('filterOwner').addEventListener('change', onFilterChange);
    document.getElementById('filterStatus').addEventListener('change', onFilterChange);
    document.getElementById('filterPriority').addEventListener('change', onFilterChange);
    document.getElementById('sortKey').addEventListener('change', onFilterChange);
    document.getElementById('resetFilter').addEventListener('click', resetFilter);
    document.getElementById('viewerSelect').addEventListener('change', (e) => setViewer(e.target.value));

    // ビュアー初期決定: URL ?owner= > localStorage > 全社
    const urlOwner = new URLSearchParams(location.search).get('owner');
    const stored = localStorage.getItem('vaizo_ops_viewer');
    STATE.viewer = urlOwner || stored || '';
    if (STATE.viewer) {
      document.querySelector('.hero').classList.add('hero--personal');
      STATE.filter.owner = STATE.viewer;
    }

    loadAndRender(false);
    setInterval(() => loadAndRender(false), CFG.refreshIntervalMs || 300000);
  }

  /* ============ PASSWORD GATE ============ */
  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function checkGate() {
    const gate = document.getElementById('gate');
    if (!CFG.passHash) { gate.classList.add('gate--hidden'); return Promise.resolve(true); }
    if (localStorage.getItem('vaizo_ops_auth') === CFG.passHash) {
      gate.classList.add('gate--hidden');
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const form = document.getElementById('gateForm');
      const input = document.getElementById('gateInput');
      const err = document.getElementById('gateError');
      setTimeout(() => input.focus(), 0);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hex = await sha256Hex(input.value);
        if (hex === CFG.passHash) {
          localStorage.setItem('vaizo_ops_auth', CFG.passHash);
          gate.classList.add('gate--hidden');
          resolve(true);
        } else {
          err.hidden = false;
          input.value = '';
          input.focus();
        }
      });
    });
  }

  /* ============ DATA LOAD ============ */
  async function loadAndRender(isManual) {
    if (isManual) showStatus('読み込み中…');
    try {
      const res = await fetch('./data.json?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      STATE.raw = data;
      parse(data);
      render();
      hideStatus();
      document.getElementById('updatedAt').textContent = formatDateTime(new Date(data.updatedAt || Date.now()));
    } catch (err) {
      console.error(err);
      showStatus('data.json 読み込み失敗: ' + err.message);
    }
  }

  function parse(data) {
    // TASKS: [空, ID, タイトル, 事業部, 担当, ステータス, 優先度, 締切, 次の1手]
    STATE.tasks = (data.tasks || []).slice(1)
      .filter(r => r[1] && String(r[1]).trim())
      .map(r => ({
        id: String(r[1] || '').trim(),
        title: String(r[2] || '').trim(),
        dept: cleanCell(r[3]),
        owner: cleanCell(r[4]),
        status: cleanCell(r[5]),
        priority: cleanCell(r[6]),
        deadline: String(r[7] || '').trim(),
        next: String(r[8] || '').trim(),
        deadlineDate: parseDeadline(r[7])
      }));

    // GOALS
    STATE.goals = (data.goals || []).slice(1)
      .filter(r => r[0])
      .map(r => ({
        id: String(r[0] || '').trim(),
        type: String(r[1] || '').trim(),
        parent: String(r[2] || '').trim(),
        title: String(r[3] || '').trim(),
        kpi: String(r[4] || '').trim(),
        progress: Number(r[5]) || 0,
        target: Number(r[6]) || 0,
        status: String(r[7] || '').trim()
      }));

    // MASTERS
    const m = data.masters || [];
    STATE.masters = {
      depts: pickColumn(m, 0),
      owners: pickColumn(m, 1),
      statuses: pickColumn(m, 2),
      priorities: pickColumn(m, 3)
    };
  }
  function cleanCell(v) {
    const s = String(v || '').trim();
    if (['担当者', '状態', '優先度', '事業部'].includes(s)) return '';
    return s;
  }
  function pickColumn(rows, idx) {
    return rows.slice(1).map(r => String(r[idx] || '').trim()).filter(Boolean);
  }
  function parseDeadline(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
    const jp = s.match(/(\d{1,2})月(\d{1,2})日/);
    if (jp) {
      const today = new Date();
      const cand = new Date(today.getFullYear(), +jp[1] - 1, +jp[2]);
      if (cand < today && (today - cand) > 180 * 86400000) cand.setFullYear(today.getFullYear() + 1);
      return cand;
    }
    return null;
  }
  function daysFromToday(date) {
    if (!date) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }

  /* ============ VIEWER ============ */
  function viewableTasks() {
    return STATE.viewer ? STATE.tasks.filter(t => t.owner === STATE.viewer) : STATE.tasks;
  }
  function setViewer(name) {
    STATE.viewer = name || '';
    const hero = document.querySelector('.hero');
    if (STATE.viewer) {
      localStorage.setItem('vaizo_ops_viewer', STATE.viewer);
      hero.classList.add('hero--personal');
    } else {
      localStorage.removeItem('vaizo_ops_viewer');
      hero.classList.remove('hero--personal');
    }
    const url = new URL(location.href);
    if (STATE.viewer) url.searchParams.set('owner', STATE.viewer);
    else url.searchParams.delete('owner');
    history.replaceState({}, '', url);
    STATE.filter.owner = STATE.viewer;
    document.getElementById('filterOwner').value = STATE.viewer;
    render();
  }

  /* ============ RENDER ============ */
  function render() {
    populateFilters();
    renderNow();
    renderSummary();
    renderWeek();
    renderGoals();
    renderPortfolio();
    renderTasks();
  }

  function populateFilters() {
    const fill = (id, items, value) => {
      const sel = document.getElementById(id);
      const v = value || sel.value;
      sel.innerHTML = '<option value="">' + sel.options[0].textContent + '</option>';
      items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = it; opt.textContent = it;
        if (it === v) opt.selected = true;
        sel.appendChild(opt);
      });
    };
    fill('filterDept', STATE.masters.depts, STATE.filter.dept);
    fill('filterOwner', STATE.masters.owners, STATE.filter.owner);
    fill('filterStatus', STATE.masters.statuses, STATE.filter.status);
    fill('filterPriority', STATE.masters.priorities, STATE.filter.priority);
    fill('viewerSelect', STATE.masters.owners, STATE.viewer);
  }

  /* ---------- 01 NOW (overdue + today) ---------- */
  function renderNow() {
    const items = [];
    viewableTasks().forEach(t => {
      if (t.status === '完了') return;
      const d = daysFromToday(t.deadlineDate);
      if (d === null) return;
      if (d <= 0) items.push({ ...t, days: d });
    });
    items.sort((a, b) => a.days - b.days);

    document.getElementById('nowCount').textContent = items.length;

    const list = document.getElementById('nowList');
    if (items.length === 0) {
      list.innerHTML = '<li class="now__empty">いま動かすべき案件はありません。</li>';
      return;
    }
    list.innerHTML = items.map(t => {
      const isToday = t.days === 0;
      const tag = isToday ? 'TODAY' : 'OVERDUE';
      const deadlineLabel = isToday ? 'TODAY' : `${Math.abs(t.days)}d OVER`;
      return `
        <li class="now__item">
          <span class="now__tag ${isToday ? 'now__tag--today' : ''}">${tag}</span>
          <div>
            <span class="now__id">${escapeHtml(t.id)}</span>
            <span class="now__title-text">${escapeHtml(t.title)}</span>
          </div>
          <span class="now__deadline">${deadlineLabel}</span>
          <span class="now__sub">${escapeHtml(t.dept || '—')} · ${escapeHtml(t.owner || '—')}${t.next ? ' · ' + escapeHtml(t.next) : ''}</span>
        </li>`;
    }).join('');
  }

  /* ---------- 01 SUMMARY ---------- */
  function renderSummary() {
    const tasks = viewableTasks();
    const c = countBy(tasks, t => t.status || '未設定');
    document.getElementById('sumInProgress').textContent = c['進行中'] || 0;
    document.getElementById('sumNotStarted').textContent = c['未着手'] || 0;
    document.getElementById('sumOnHold').textContent = c['保留'] || 0;
    document.getElementById('sumDone').textContent = c['完了'] || 0;
    const subText = STATE.viewer
      ? `${STATE.viewer} 担当 ${tasks.length} 件`
      : `全社 ${tasks.length} 件`;
    document.getElementById('summarySub').textContent = subText;
  }

  /* ---------- 01 THIS WEEK (1〜7 days ahead) ---------- */
  function renderWeek() {
    const items = [];
    viewableTasks().forEach(t => {
      if (t.status === '完了') return;
      const d = daysFromToday(t.deadlineDate);
      if (d === null || d < 1 || d > 7) return;
      items.push({ ...t, days: d });
    });
    items.sort((a, b) => a.days - b.days);

    document.getElementById('weekCount').textContent = items.length;

    const list = document.getElementById('weekList');
    if (items.length === 0) {
      list.innerHTML = '<li class="week__empty">7日以内の締切はありません。</li>';
      return;
    }
    list.innerHTML = items.map(t => {
      const dateLabel = formatShortDate(t.deadlineDate);
      const wday = ['日','月','火','水','木','金','土'][t.deadlineDate.getDay()];
      return `
        <li class="week__item">
          <span class="week__when">${dateLabel} (${wday})<br>+${t.days}d</span>
          <div>
            <span class="now__id">${escapeHtml(t.id)}</span>
            <span class="week__main">${escapeHtml(t.title)}</span>
            <div class="week__sub">${escapeHtml(t.dept || '—')} · ${escapeHtml(t.owner || '—')}${t.next ? ' · ' + escapeHtml(t.next) : ''}</div>
          </div>
        </li>`;
    }).join('');
  }

  /* ---------- 02 GOALS ---------- */
  function renderGoals() {
    const tree = document.getElementById('goalsTree');
    if (STATE.goals.length === 0) {
      tree.innerHTML = '<p style="color:var(--c-mute);padding:24px;">GOALS データがありません</p>';
      return;
    }
    const order = { ANNUAL: 1, Q: 2, MONTH: 3 };
    const sorted = [...STATE.goals].sort((a, b) => (order[a.type] || 9) - (order[b.type] || 9));
    tree.innerHTML = sorted.map(g => {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
      return `
        <div class="goal goal--${g.type}">
          <div class="goal__type is-mono">${g.type}</div>
          <div>
            <div class="goal__title">${escapeHtml(g.title)}</div>
            <div class="goal__kpi">${escapeHtml(g.kpi)} &nbsp;·&nbsp; ${formatNum(g.progress)} / ${formatNum(g.target)}</div>
          </div>
          <div class="goal__bar"><div class="goal__bar-fill" style="width:${pct}%"></div></div>
          <div class="goal__pct is-mono">${pct}%</div>
        </div>`;
    }).join('');
  }

  /* ---------- 03 PORTFOLIO (Cross-tab: 事業部 × 担当者) ---------- */
  function renderPortfolio() {
    const tasks = STATE.tasks; // ポートフォリオは常に全社視点
    const depts = uniq(tasks.map(t => t.dept).filter(Boolean));
    const owners = STATE.masters.owners.length
      ? STATE.masters.owners
      : uniq(tasks.map(t => t.owner).filter(Boolean));

    // 件数取得
    const cell = (dept, owner) => tasks.filter(t => t.dept === dept && t.owner === owner).length;
    const rowTotal = dept => tasks.filter(t => t.dept === dept).length;
    const colTotal = owner => tasks.filter(t => t.owner === owner).length;

    // 濃淡（density）計算
    const all = depts.flatMap(d => owners.map(o => cell(d, o))).filter(n => n > 0);
    const max = all.length ? Math.max(...all) : 0;
    const density = n => {
      if (n === 0) return 0;
      const r = n / max;
      if (r > 0.66) return 3;
      if (r > 0.33) return 2;
      return 1;
    };

    const head = `
      <thead>
        <tr>
          <th></th>
          ${owners.map(o => `<th>${escapeHtml(o)}</th>`).join('')}
          <th>合計</th>
        </tr>
      </thead>`;
    const body = `
      <tbody>
        ${depts.map(d => `
          <tr>
            <th>${escapeHtml(d)}</th>
            ${owners.map(o => {
              const n = cell(d, o);
              return `<td><span class="cross__num ${n === 0 ? 'cross__num--zero' : ''}" data-density="${density(n)}">${n === 0 ? '─' : n}</span></td>`;
            }).join('')}
            <td><span class="cross__num is-mono">${rowTotal(d)}</span></td>
          </tr>`).join('')}
      </tbody>`;
    const foot = `
      <tfoot>
        <tr>
          <th>合計</th>
          ${owners.map(o => `<td>${colTotal(o)}</td>`).join('')}
          <td>${tasks.length}</td>
        </tr>
      </tfoot>`;
    document.getElementById('portfolio').innerHTML = `<table class="cross">${head}${body}${foot}</table>`;
  }

  /* ---------- 04 TASKS ---------- */
  function renderTasks() {
    const f = STATE.filter;
    let rows = STATE.tasks.filter(t => {
      if (f.dept && t.dept !== f.dept) return false;
      if (f.owner && t.owner !== f.owner) return false;
      if (f.status && t.status !== f.status) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.search) {
        const q = f.search.toLowerCase();
        if (!(t.id + ' ' + t.title + ' ' + t.next).toLowerCase().includes(q)) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      switch (f.sort) {
        case 'priority': return priorityRank(b.priority) - priorityRank(a.priority);
        case 'id': return a.id.localeCompare(b.id, undefined, { numeric: true });
        case 'status': return statusRank(a.status) - statusRank(b.status);
        case 'deadline':
        default: {
          const da = a.deadlineDate ? a.deadlineDate.getTime() : Infinity;
          const db = b.deadlineDate ? b.deadlineDate.getTime() : Infinity;
          return da - db;
        }
      }
    });

    document.getElementById('taskCount').textContent = rows.length + ' / ' + STATE.tasks.length + ' TASKS';

    const tbody = document.getElementById('tasksTbody');
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="tasks__empty">該当タスクなし</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(t => `
      <tr>
        <td class="tasks__id">${escapeHtml(t.id)}</td>
        <td class="tasks__title">${escapeHtml(t.title)}</td>
        <td>${escapeHtml(t.dept)}</td>
        <td>${escapeHtml(t.owner)}</td>
        <td>${t.status ? `<span class="pill pill--${t.status}">${t.status}</span>` : ''}</td>
        <td>${renderPriority(t.priority)}</td>
        <td><span class="${deadlineCls(t)}">${escapeHtml(t.deadline) || '—'}</span></td>
        <td>${escapeHtml(t.next)}</td>
      </tr>`).join('');
  }

  function renderPriority(p) {
    if (!p) return '';
    const dots = { '高': '●●●', '中': '●●○', '低': '●○○' }[p] || '';
    return `<span class="pri">${dots}<span style="margin-left:6px;letter-spacing:0.08em;">${p}</span></span>`;
  }
  function deadlineCls(t) {
    const d = daysFromToday(t.deadlineDate);
    if (d === null) return 'deadline deadline--none';
    if (d < 0) return 'deadline deadline--overdue';
    if (d === 0) return 'deadline deadline--today';
    if (d <= 7) return 'deadline deadline--soon';
    return 'deadline deadline--later';
  }

  /* ============ EVENTS ============ */
  function onFilterChange() {
    STATE.filter.search = document.getElementById('searchInput').value;
    STATE.filter.dept = document.getElementById('filterDept').value;
    STATE.filter.owner = document.getElementById('filterOwner').value;
    STATE.filter.status = document.getElementById('filterStatus').value;
    STATE.filter.priority = document.getElementById('filterPriority').value;
    STATE.filter.sort = document.getElementById('sortKey').value;
    renderTasks();
  }
  function resetFilter() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterDept').value = '';
    document.getElementById('filterOwner').value = STATE.viewer || '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPriority').value = '';
    document.getElementById('sortKey').value = 'deadline';
    onFilterChange();
  }

  /* ============ STATUS BAR ============ */
  function showStatus(msg) {
    const bar = document.getElementById('statusBar');
    bar.textContent = msg;
    bar.hidden = false;
  }
  function hideStatus() { document.getElementById('statusBar').hidden = true; }

  /* ============ UTIL ============ */
  function countBy(arr, fn) {
    return arr.reduce((acc, x) => { const k = fn(x); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  }
  function uniq(arr) { return Array.from(new Set(arr)); }
  function priorityRank(p) { return { '高': 3, '中': 2, '低': 1 }[p] || 0; }
  function statusRank(s) { return { '進行中': 1, '未着手': 2, '保留': 3, '完了': 4 }[s] || 9; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatNum(n) { return Number(n || 0).toLocaleString(); }
  function formatDateTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function formatShortDate(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }
})();
