/* =========================================================
   VAIZO OPS Dashboard - Frontend
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
    viewer: ''  // 選択中のVAIZER。空 = 全社ビュー
  };

  // ============ BOOT ============
  document.addEventListener('DOMContentLoaded', async () => {
    if (await checkGate()) init();
  });

  // ============ PASSWORD GATE ============
  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function checkGate() {
    const gate = document.getElementById('gate');
    if (!CFG.passHash) {
      gate.classList.add('gate--hidden');
      return Promise.resolve(true);
    }
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

    // 個人ビューの初期決定: URL ?owner= > localStorage > 空（全社）
    const params = new URLSearchParams(location.search);
    const urlOwner = params.get('owner');
    const stored = localStorage.getItem('vaizo_ops_viewer');
    STATE.viewer = urlOwner || stored || '';
    if (STATE.viewer) {
      document.querySelector('.hero').classList.add('hero--personal');
      STATE.filter.owner = STATE.viewer;
    }

    loadAndRender(false);
    setInterval(() => loadAndRender(false), CFG.refreshIntervalMs || 300000);
  }

  // ============ DATA LOAD ============
  async function loadAndRender(isManual) {
    if (isManual) showStatus('読み込み中…', 'info');
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
      showStatus('data.json が読み込めません。スプレッドシートに変更があった場合は Claude に「ダッシュボード更新」と頼んでください。', 'warn');
    }
  }

  // ============ PARSE ============
  function parse(data) {
    // TASKS: header行 + データ
    const tRows = data.tasks || [];
    const tHeader = tRows[0] || [];
    // 列構成（既存スプシ）: [空, ID, タイトル, 事業部, 担当, ステータス, 優先度, 締切, 次の1手]
    STATE.tasks = tRows.slice(1)
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

    // GOALS: [ID, 階層, 親目標ID, タイトル, KPI/KR, 進捗値, 目標値, 状態]
    const gRows = data.goals || [];
    STATE.goals = gRows.slice(1)
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

    // MASTERS: [事業部, 担当者, 状態, 優先度]
    const mRows = data.masters || [];
    STATE.masters = {
      depts: pickColumn(mRows, 0),
      owners: pickColumn(mRows, 1),
      statuses: pickColumn(mRows, 2),
      priorities: pickColumn(mRows, 3)
    };
  }

  function cleanCell(v) {
    const s = String(v || '').trim();
    // プレースホルダ "担当者" "状態" "優先度" は空扱い
    if (['担当者', '状態', '優先度', '事業部'].includes(s)) return '';
    return s;
  }

  function pickColumn(rows, idx) {
    return rows.slice(1).map(r => String(r[idx] || '').trim()).filter(Boolean);
  }

  // 締切パース（YYYY-MM-DD 形式優先、それ以外は M月D日 形式も拾う）
  function parseDeadline(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    // YYYY-MM-DD
    const isoMatch = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
    }
    // M月D日
    const jpMatch = s.match(/(\d{1,2})月(\d{1,2})日/);
    if (jpMatch) {
      const today = new Date();
      const y = today.getFullYear();
      const m = +jpMatch[1] - 1;
      const d = +jpMatch[2];
      // 過去6ヶ月以内なら今年、それ以外は来年扱い
      const candidate = new Date(y, m, d);
      if (candidate < today && (today - candidate) > 180 * 86400000) {
        candidate.setFullYear(y + 1);
      }
      return candidate;
    }
    return null;
  }

  function daysFromToday(date) {
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  // ============ RENDER ============
  function render() {
    populateFilters();
    renderKPI();
    renderAlerts();
    renderGoals();
    renderMatrix();
    renderDeptBars();
    renderTasks();
  }

  function populateFilters() {
    const fill = (id, items, currentValue) => {
      const sel = document.getElementById(id);
      const val = currentValue || sel.value;
      sel.innerHTML = '<option value="">' + sel.options[0].textContent + '</option>';
      items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = it;
        opt.textContent = it;
        if (it === val) opt.selected = true;
        sel.appendChild(opt);
      });
    };
    fill('filterDept', STATE.masters.depts, STATE.filter.dept);
    fill('filterOwner', STATE.masters.owners, STATE.filter.owner);
    fill('filterStatus', STATE.masters.statuses, STATE.filter.status);
    fill('filterPriority', STATE.masters.priorities, STATE.filter.priority);
    fill('viewerSelect', STATE.masters.owners, STATE.viewer);
  }

  // 個人ビューの場合は viewer のタスクだけ、それ以外は全社
  function viewableTasks() {
    return STATE.viewer
      ? STATE.tasks.filter(t => t.owner === STATE.viewer)
      : STATE.tasks;
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
    // URLに反映（共有しやすくするため）
    const url = new URL(location.href);
    if (STATE.viewer) url.searchParams.set('owner', STATE.viewer);
    else url.searchParams.delete('owner');
    history.replaceState({}, '', url);
    // テーブルの担当フィルタも連動
    STATE.filter.owner = STATE.viewer;
    document.getElementById('filterOwner').value = STATE.viewer;
    render();
  }

  // ---------- KPI ----------
  function renderKPI() {
    const tasks = viewableTasks();
    const counts = countBy(tasks, t => t.status || '未設定');
    const total = tasks.length;
    const inProgress = counts['進行中'] || 0;
    const notStarted = counts['未着手'] || 0;
    const onHold = counts['保留'] || 0;
    const done = counts['完了'] || 0;

    const subSuffix = STATE.viewer ? `（${STATE.viewer}担当）` : '';
    const kpis = [
      { label: 'TOTAL', value: total, sub: '登録タスク' + subSuffix },
      { label: 'IN PROGRESS', value: inProgress, sub: '進行中' },
      { label: 'NOT STARTED', value: notStarted, sub: '未着手' },
      { label: 'ON HOLD', value: onHold, sub: '保留' },
      { label: 'DONE', value: done, sub: '完了' }
    ];

    document.getElementById('kpiGrid').innerHTML = kpis.map(k => `
      <div class="kpi">
        <div class="kpi__label">${k.label}</div>
        <div class="kpi__value">${k.value}</div>
        <div class="kpi__sub">${k.sub}</div>
      </div>
    `).join('');
  }

  // ---------- DEADLINE ALERTS ----------
  function renderAlerts() {
    const overdue = [];
    const today = [];
    const soon = [];

    viewableTasks().forEach(t => {
      if (t.status === '完了') return;
      const d = daysFromToday(t.deadlineDate);
      if (d === null) return;
      if (d < 0) overdue.push({ ...t, days: d });
      else if (d === 0) today.push({ ...t, days: d });
      else if (d <= 7) soon.push({ ...t, days: d });
    });

    overdue.sort((a, b) => a.days - b.days);
    today.sort((a, b) => a.title.localeCompare(b.title));
    soon.sort((a, b) => a.days - b.days);

    const card = (cls, title, items, suffix) => `
      <div class="alert-card ${cls}">
        <div class="alert-card__head">
          <h3 class="alert-card__title">${title}</h3>
          <div class="alert-card__count">${items.length}</div>
        </div>
        <ul class="alert-card__list">
          ${items.length === 0
            ? '<li class="alert-card__empty">該当なし</li>'
            : items.map(t => `
              <li class="alert-card__item">
                <div class="alert-card__item-title">${escapeHtml(t.id)} ${escapeHtml(t.title)}</div>
                <div class="alert-card__item-meta">${suffix(t)}</div>
                <div class="alert-card__item-sub">${escapeHtml(t.dept || '')} / ${escapeHtml(t.owner || '')}</div>
              </li>`).join('')}
        </ul>
      </div>
    `;

    document.getElementById('alertGrid').innerHTML = [
      card('alert-card--overdue', '締切超過', overdue, t => `${Math.abs(t.days)}日超過`),
      card('alert-card--today', '本日締切', today, t => 'TODAY'),
      card('alert-card--soon', '7日以内', soon, t => `あと${t.days}日`)
    ].join('');
  }

  // ---------- GOALS ----------
  function renderGoals() {
    if (STATE.goals.length === 0) {
      document.getElementById('goalsTree').innerHTML = '<p style="color:#999">GOALS データがありません</p>';
      return;
    }
    // 並び順: ANNUAL → Q → MONTH（親子ツリー）
    const sorted = [...STATE.goals].sort((a, b) => {
      const order = { ANNUAL: 1, Q: 2, MONTH: 3 };
      return (order[a.type] || 9) - (order[b.type] || 9);
    });

    document.getElementById('goalsTree').innerHTML = sorted.map(g => {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
      return `
        <div class="goal-row goal-row--${g.type}">
          <div class="goal-row__type">${g.type}</div>
          <div>
            <div class="goal-row__title">${escapeHtml(g.title)}</div>
            <div class="goal-row__title-kpi">${escapeHtml(g.kpi)}: ${formatNum(g.progress)} / ${formatNum(g.target)}</div>
          </div>
          <div class="goal-row__bar"><div class="goal-row__bar-fill" style="width:${pct}%"></div></div>
          <div class="goal-row__pct">${pct}%</div>
        </div>
      `;
    }).join('');
  }

  // ---------- MATRIX ----------
  function renderMatrix() {
    const owners = STATE.masters.owners.length ? STATE.masters.owners : Array.from(new Set(STATE.tasks.map(t => t.owner).filter(Boolean)));
    const statuses = ['進行中', '未着手', '保留', '完了'];

    const head = `<tr><th>担当 \\ 状態</th>${statuses.map(s => `<th>${s}</th>`).join('')}<th>合計</th></tr>`;

    const body = owners.map(o => {
      const cells = statuses.map(s => {
        const cnt = STATE.tasks.filter(t => t.owner === o && t.status === s).length;
        return `<td class="matrix__cell ${cnt === 0 ? 'matrix__cell--zero' : ''}">${cnt}</td>`;
      }).join('');
      const total = STATE.tasks.filter(t => t.owner === o).length;
      return `<tr><td>${escapeHtml(o)}</td>${cells}<td class="matrix__cell">${total}</td></tr>`;
    }).join('');

    const totalRow = `<tr>
      <td>合計</td>
      ${statuses.map(s => `<td>${STATE.tasks.filter(t => t.status === s).length}</td>`).join('')}
      <td>${STATE.tasks.length}</td>
    </tr>`;

    document.getElementById('matrix').innerHTML = `
      <table class="matrix">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
        <tfoot>${totalRow}</tfoot>
      </table>
    `;
  }

  // ---------- DEPT BARS ----------
  function renderDeptBars() {
    const sourceTasks = viewableTasks();
    const depts = Array.from(new Set(sourceTasks.map(t => t.dept).filter(Boolean))).sort();
    const statuses = ['未着手', '進行中', '完了', '保留'];

    document.getElementById('deptBars').innerHTML = depts.map(d => {
      const tasks = sourceTasks.filter(t => t.dept === d);
      const total = tasks.length;
      const segs = statuses.map(s => {
        const cnt = tasks.filter(t => t.status === s).length;
        const w = total ? (cnt / total) * 100 : 0;
        if (cnt === 0) return '';
        return `<div class="dept-row__seg dept-row__seg--${s}" style="width:${w}%" title="${s}: ${cnt}件">${cnt}</div>`;
      }).join('');
      return `
        <div class="dept-row">
          <div class="dept-row__label">${escapeHtml(d)}</div>
          <div class="dept-row__bar">${segs}</div>
          <div class="dept-row__total">${total}件</div>
        </div>
      `;
    }).join('');
  }

  // ---------- TASKS TABLE ----------
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
      tbody.innerHTML = '<tr><td colspan="8" class="tasks-table__empty">該当タスクなし</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(t => `
      <tr>
        <td class="tasks-table__id">${escapeHtml(t.id)}</td>
        <td class="tasks-table__title">${escapeHtml(t.title)}</td>
        <td>${escapeHtml(t.dept)}</td>
        <td>${escapeHtml(t.owner)}</td>
        <td>${t.status ? `<span class="pill pill--${t.status}">${t.status}</span>` : ''}</td>
        <td>${t.priority ? `<span class="pri pri--${t.priority}">${t.priority}</span>` : ''}</td>
        <td class="${deadlineCls(t)}">${escapeHtml(t.deadline) || '<span class="deadline--none">—</span>'}</td>
        <td>${escapeHtml(t.next)}</td>
      </tr>
    `).join('');
  }

  function deadlineCls(t) {
    const d = daysFromToday(t.deadlineDate);
    if (d === null) return 'deadline deadline--none';
    if (d < 0) return 'deadline deadline--overdue';
    if (d === 0) return 'deadline deadline--today';
    if (d <= 7) return 'deadline deadline--soon';
    return 'deadline';
  }

  // ============ EVENTS ============
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
    document.getElementById('filterOwner').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPriority').value = '';
    document.getElementById('sortKey').value = 'deadline';
    onFilterChange();
  }

  // ============ STATUS BAR ============
  function showStatus(msg, type) {
    const bar = document.getElementById('statusBar');
    bar.textContent = msg;
    bar.className = 'status-bar status-bar--' + (type || 'info');
    bar.hidden = false;
  }
  function hideStatus() { document.getElementById('statusBar').hidden = true; }

  // ============ UTIL ============
  function countBy(arr, fn) {
    return arr.reduce((acc, x) => { const k = fn(x); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  }
  function priorityRank(p) { return { '高': 3, '中': 2, '低': 1 }[p] || 0; }
  function statusRank(s) { return { '進行中': 1, '未着手': 2, '保留': 3, '完了': 4 }[s] || 9; }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function formatNum(n) { return Number(n || 0).toLocaleString(); }
  function formatDateTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
})();
