/* AI-CLO PTITHCM V12.6.12 — persistent user filters and scoped bulk account actions. */
(() => {
'use strict';

const previousUsers = window.users;
if (typeof previousUsers !== 'function') return;

if (!document.querySelector('link[data-aiclo-user-bulk-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/system/user-bulk.css?v=12.6.12';
  link.dataset.aicloUserBulkCss = '1';
  document.head.appendChild(link);
}

const teacherRoles = ['teacher', 'lecturer', 'giangvien'];
const selectedSystem = new Set();
const selectedCourse = new Set();
let selectedCourseSubject = '';

const norm = v => String(v ?? '').trim().toLowerCase();
const systemFilterKey = () => `aiclo:user-filters:v1:${state.user?.id || 'guest'}:system`;
const courseFilterKey = () => `aiclo:user-filters:v1:${state.user?.id || 'guest'}:course:${state.subjectId || 'none'}`;

function readSession(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || '{}') || {}; }
  catch { return {}; }
}
function writeSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value || {})); }
  catch {}
}

async function accountAction(body) {
  const { data, error } = await db.functions.invoke('admin-users', { body });
  if (error) {
    let message = error.message;
    try {
      const detail = await error.context?.json();
      message = detail?.error || message;
    } catch {}
    throw new Error(message || 'Không thực hiện được thao tác tài khoản.');
  }
  if (!data?.success) throw new Error(data?.error || 'Không thực hiện được thao tác tài khoản.');
  return data;
}

function showPasswordResults(data) {
  const rows = Array.isArray(data?.results) ? data.results : [];
  const success = rows.filter(x => x.success && x.temporary_password);
  const failed = rows.filter(x => !x.success);
  const payload = success.map(x => `${x.full_name || x.email || x.id}\t${x.email || ''}\t${x.temporary_password}`).join('\n');
  modal('Mật khẩu tạm mới', `<div class="bulk-password-result">
    <p class="hint">Mật khẩu tạm chỉ hiển thị trong kết quả thao tác này. Hãy sao chép trước khi đóng.</p>
    ${success.length ? `<div class="table-wrap"><table><thead><tr><th>Người dùng</th><th>Email</th><th>Mật khẩu tạm</th></tr></thead><tbody>${success.map(x => `<tr><td><b>${esc(x.full_name || 'Chưa đặt tên')}</b></td><td>${esc(x.email || '')}</td><td><code>${esc(x.temporary_password)}</code></td></tr>`).join('')}</tbody></table></div><div class="form-actions"><button id="bulkCopyPasswords" type="button" class="secondary">Sao chép tất cả</button></div>` : '<p>Không có mật khẩu nào được tạo.</p>'}
    ${failed.length ? `<div class="bulk-password-errors"><b>${failed.length} tài khoản không xử lý được</b>${failed.map(x => `<p>${esc(x.full_name || x.email || x.id)}: ${esc(x.error || 'Không xác định')}</p>`).join('')}</div>` : ''}
  </div>`);
  const copy = $('#bulkCopyPasswords');
  if (copy) copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      toast('Đã sao chép danh sách mật khẩu tạm');
    } catch {
      toast('Không thể sao chép tự động; hãy sao chép trực tiếp trong bảng.', true);
    }
  };
}

function makeBulkBar(scope, selected, getVisibleIds, handlers) {
  const bar = document.createElement('div');
  bar.className = 'user-bulk-bar hidden';
  bar.dataset.bulkScope = scope;
  bar.innerHTML = `<div class="user-bulk-count"><b data-bulk-count>0</b><span>tài khoản đã chọn</span></div>
    <div class="user-bulk-actions">
      <button type="button" class="secondary" data-bulk-select-all>Chọn tất cả</button>
      <button type="button" class="secondary" data-bulk-ban>Tạm khóa</button>
      <button type="button" class="secondary" data-bulk-reset>Sinh lại mật khẩu</button>
      <button type="button" class="link-btn" data-bulk-clear>Bỏ chọn</button>
    </div>`;

  const refresh = () => {
    const count = selected.size;
    bar.classList.toggle('hidden', count === 0);
    const el = $('[data-bulk-count]', bar);
    if (el) el.textContent = String(count);
  };

  $('[data-bulk-select-all]', bar).onclick = () => {
    getVisibleIds().forEach(id => selected.add(id));
    handlers.syncChecks();
    refresh();
  };
  $('[data-bulk-clear]', bar).onclick = () => {
    selected.clear();
    handlers.syncChecks();
    refresh();
  };
  $('[data-bulk-ban]', bar).onclick = async () => {
    if (!selected.size) return;
    await handlers.ban([...selected]);
  };
  $('[data-bulk-reset]', bar).onclick = async () => {
    if (!selected.size) return;
    await handlers.reset([...selected]);
  };

  return { bar, refresh };
}

function checkboxCell(id, disabled = false) {
  const td = document.createElement('td');
  td.className = 'user-select-cell';
  td.innerHTML = `<input type="checkbox" class="user-row-check" data-bulk-user="${esc(id)}" ${disabled ? 'disabled' : ''} aria-label="Chọn tài khoản">`;
  return td;
}

function addSelectHeading(table) {
  const row = table?.tHead?.rows?.[0];
  if (!row || row.querySelector('.user-select-heading')) return;
  const th = document.createElement('th');
  th.className = 'user-select-heading';
  th.setAttribute('aria-label', 'Chọn');
  th.textContent = '';
  row.prepend(th);
}

function restoreSystemFilters(container) {
  const search = $('#userSearch', container), roleSelect = $('#userRole', container), status = $('#userStatus', container);
  if (!search || !roleSelect || !status) return;
  const saved = readSession(systemFilterKey());
  if (typeof saved.search === 'string') search.value = saved.search;
  if ([...roleSelect.options].some(o => o.value === saved.role)) roleSelect.value = saved.role;
  if ([...status.options].some(o => o.value === saved.status)) status.value = saved.status;

  const save = () => writeSession(systemFilterKey(), { search: search.value, role: roleSelect.value, status: status.value });
  search.addEventListener('input', save);
  roleSelect.addEventListener('change', save);
  status.addEventListener('change', save);

  // Một lần vẽ lại là đủ vì draw() đọc đồng thời cả ba bộ lọc.
  search.dispatchEvent(new Event('input', { bubbles: true }));
}

function enhanceSystemAdmin(container) {
  if (state.space !== 'system' || role() !== 'admin') return;
  const tbody = $('#userRows', container), table = tbody?.closest('table'), wrap = table?.closest('.user-system-table');
  if (!tbody || !table || !wrap) return;

  restoreSystemFilters(container);
  addSelectHeading(table);

  let barApi;
  const visibleIds = () => [...tbody.querySelectorAll('.user-row-check:not(:disabled)')].map(x => x.dataset.bulkUser).filter(Boolean);
  const syncChecks = () => {
    tbody.querySelectorAll('.user-row-check').forEach(x => { x.checked = selectedSystem.has(x.dataset.bulkUser); });
  };

  const handlers = {
    syncChecks,
    ban: async ids => {
      if (!await confirmAction('Tạm khóa tài khoản', `Tạm khóa ${ids.length} tài khoản đã chọn? Admin không bị tác động.`, { confirmLabel: 'Tạm khóa', danger: true })) return;
      try {
        const data = await accountAction({ action: 'bulk_ban', user_ids: ids });
        selectedSystem.clear();
        toast(`Đã tạm khóa ${data.success_count || 0} tài khoản${data.failed_count ? ` · ${data.failed_count} không xử lý được` : ''}`);
        window.AICLO_VIEW_TRANSITION?.invalidate?.('users');
        await render();
      } catch (ex) { err(ex); }
    },
    reset: async ids => {
      if (!await confirmAction('Sinh lại mật khẩu', `Sinh mật khẩu tạm mới cho ${ids.length} tài khoản đã chọn?`, { confirmLabel: 'Sinh mật khẩu mới' })) return;
      try {
        const data = await accountAction({ action: 'bulk_reset_password', user_ids: ids });
        showPasswordResults(data);
      } catch (ex) { err(ex); }
    }
  };

  const existingBar = container.querySelector('[data-bulk-scope="system"]');
  if (existingBar) existingBar.remove();
  barApi = makeBulkBar('system', selectedSystem, visibleIds, handlers);
  wrap.before(barApi.bar);

  const decorate = () => {
    addSelectHeading(table);
    [...tbody.rows].forEach(row => {
      if (row.querySelector('.user-row-check')) return;
      const manage = row.querySelector('[data-manage-user]');
      if (!manage) { const empty=row.querySelector('.empty'); if(empty) empty.colSpan=table.tHead?.rows?.[0]?.cells?.length||empty.colSpan; return; }
      const id = manage.dataset.manageUser;
      const originalRoleCell = row.cells[2];
      const isAdmin = /admin/i.test(originalRoleCell?.textContent || '');
      row.prepend(checkboxCell(id, isAdmin));
    });
    syncChecks();
    barApi.refresh();
  };

  tbody.addEventListener('change', e => {
    const box = e.target.closest('.user-row-check');
    if (!box) return;
    box.checked ? selectedSystem.add(box.dataset.bulkUser) : selectedSystem.delete(box.dataset.bulkUser);
    barApi.refresh();
  });
  const observer = new MutationObserver(decorate);
  observer.observe(tbody, { childList: true });
  decorate();
}

async function fetchCourseStudents() {
  if (!state.subjectId) return [];
  const members = await q('subject_members', 'user_id,role', x => x.eq('subject_id', state.subjectId).eq('role', 'student'));
  const ids = [...new Set(members.map(x => x.user_id).filter(Boolean))];
  return ids.length ? q('profiles', 'id,full_name,email,mssv,role,is_active', x => x.in('id', ids).order('full_name')) : [];
}

function restoreCourseFilters(body) {
  const search = $('#classMemberSearch', body) || $('#classSearch', body);
  const status = $('#classMemberStatus', body);
  if (!search) return;
  const saved = readSession(courseFilterKey());
  if (typeof saved.search === 'string') search.value = saved.search;
  if (status && [...status.options].some(o => o.value === saved.status)) status.value = saved.status;
  const save = () => writeSession(courseFilterKey(), { search: search.value, status: status?.value || 'all' });
  search.addEventListener('input', save);
  status?.addEventListener('change', save);
  search.dispatchEvent(new Event('input', { bubbles: true }));
  if (status) status.dispatchEvent(new Event('change', { bubbles: true }));
}

function enhanceCourseStudentTable(body, profiles) {
  const tbody = $('#classMemberRows', body) || $('#classRows', body);
  const table = tbody?.closest('table'), wrap = table?.closest('.table-wrap');
  if (!tbody || !table || !wrap) { selectedCourse.clear(); return; }

  restoreCourseFilters(body);
  addSelectHeading(table);
  const byEmail = new Map(profiles.map(p => [norm(p.email), p]));

  let barApi;
  const getProfileForRow = row => {
    const text = norm(row.textContent);
    for (const [email, p] of byEmail) if (email && text.includes(email)) return p;
    return null;
  };
  const visibleIds = () => [...tbody.querySelectorAll('.user-row-check:not(:disabled)')].map(x => x.dataset.bulkUser).filter(Boolean);
  const syncChecks = () => tbody.querySelectorAll('.user-row-check').forEach(x => { x.checked = selectedCourse.has(x.dataset.bulkUser); });

  const handlers = {
    syncChecks,
    ban: async ids => {
      if (!await confirmAction('Tạm khóa sinh viên', `Tạm khóa ${ids.length} sinh viên đã chọn trong học phần này?`, { confirmLabel: 'Tạm khóa', danger: true })) return;
      try {
        const data = await accountAction({ action: 'bulk_ban', user_ids: ids, subject_id: state.subjectId });
        selectedCourse.clear();
        toast(`Đã tạm khóa ${data.success_count || 0} sinh viên${data.failed_count ? ` · ${data.failed_count} không xử lý được` : ''}`);
        window.AICLO_VIEW_TRANSITION?.invalidate?.('users', state.subjectId, 'course');
        await render();
      } catch (ex) { err(ex); }
    },
    reset: async ids => {
      if (!await confirmAction('Sinh lại mật khẩu', `Sinh mật khẩu tạm mới cho ${ids.length} sinh viên đã chọn?`, { confirmLabel: 'Sinh mật khẩu mới' })) return;
      try {
        const data = await accountAction({ action: 'bulk_reset_password', user_ids: ids, subject_id: state.subjectId });
        showPasswordResults(data);
      } catch (ex) { err(ex); }
    }
  };

  const existingBar = body.querySelector('[data-bulk-scope="course"]');
  if (existingBar) existingBar.remove();
  barApi = makeBulkBar('course', selectedCourse, visibleIds, handlers);
  wrap.before(barApi.bar);

  const decorate = () => {
    addSelectHeading(table);
    [...tbody.rows].forEach(row => {
      if (row.querySelector('.user-row-check')) return;
      const p = getProfileForRow(row);
      if (!p) { const empty=row.querySelector('.empty'); if(empty) empty.colSpan=table.tHead?.rows?.[0]?.cells?.length||empty.colSpan; return; }
      row.prepend(checkboxCell(p.id, false));
    });
    syncChecks();
    barApi.refresh();
  };

  tbody.addEventListener('change', e => {
    const box = e.target.closest('.user-row-check');
    if (!box) return;
    box.checked ? selectedCourse.add(box.dataset.bulkUser) : selectedCourse.delete(box.dataset.bulkUser);
    barApi.refresh();
  });
  const observer = new MutationObserver(decorate);
  observer.observe(tbody, { childList: true });
  decorate();
}

async function enhanceCourseMembers(container) {
  if (state.space !== 'course' || !canTeach() || !state.subjectId) return;
  if (selectedCourseSubject !== state.subjectId) { selectedCourse.clear(); selectedCourseSubject = state.subjectId; }
  const body = $('#v109MembersBody', container) || container;
  let profiles = [];
  try { profiles = await fetchCourseStudents(); }
  catch (ex) { console.warn('Không tải được danh sách sinh viên cho thao tác hàng loạt', ex); return; }

  let observer = null;
  const watch = () => observer?.observe(body, { childList: true });
  const enhanceNow = () => {
    // Chỉ trang/tab sinh viên có classRows hoặc classMemberRows; tab giảng viên không bị tác động.
    observer?.disconnect();
    enhanceCourseStudentTable(body, profiles);
    watch();
  };

  if (body.dataset.bulkObserverBound === '1') { enhanceNow(); return; }
  body.dataset.bulkObserverBound = '1';
  observer = new MutationObserver(() => {
    clearTimeout(body._bulkTimer);
    body._bulkTimer = setTimeout(enhanceNow, 0);
  });
  enhanceNow();
}

window.users = async function(container) {
  const result = await previousUsers(container);
  if (state.space === 'system' && role() === 'admin') {
    selectedSystem.clear();
    enhanceSystemAdmin(container);
  } else if (state.space === 'course' && canTeach()) {
    selectedCourse.clear();
    await enhanceCourseMembers(container);
  }
  return result;
};

window.AICLO_USER_BULK = Object.freeze({ version: '12.6.12' });
})();
