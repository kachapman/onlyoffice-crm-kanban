/**
 * Vanguard CRM — multi-group opportunity board (local test portal)
 */

const DEFAULT_PORTAL = "https://office.vanguardadj.com";
const GROUPS_STORAGE_KEY = "oo_board_groups_v2";
const CALENDARS_STORAGE_KEY = "oo_board_calendars_v1";
const NOTES_TILES_STORAGE_KEY = "oo_board_notes_v1";
const LAYOUT_STORAGE_KEY = "oo_board_layout_v2";
const HIDDEN_FEED_STORAGE_KEY = "oo_board_hidden_feed_v1";
const FEED_KEYWORD_STORAGE_KEY = "oo_board_feed_keyword_v1";
const GROUP_TEMPLATES_STORAGE_KEY = "oo_board_group_templates_v1";
const FEED_DAYS = 90;
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_MAX_EVENTS = 200;
const FEED_HISTORY_PAGE_SIZE = 100;
const FEED_MAIL_SEARCH = "CRM. New event added to";
const FEED_MAIL_SEARCHES = [FEED_MAIL_SEARCH, "CRM New event added to"];
const FEED_MAIL_PAGE_SIZE = 60;
const FEED_INITIAL_HISTORY_PAGES = 3;
const FEED_INITIAL_MAIL_PAGES = 2;
const OPP_CUSTOM_FIELD_ENRICH_CONCURRENCY = 5;
const HIDDEN_FEED_RETENTION_DAYS = 30;
const HIDDEN_FEED_RETENTION_MS = HIDDEN_FEED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const PANEL_TILE_AUTO_REFRESH_MS = 60 * 60 * 1000;
const DASHBOARD_IDLE_STOP_MS = 3 * 60 * 60 * 1000;
/** Set true when create-opportunity custom user field save is fixed (see ISSUES.md). */
const CREATE_OPP_USER_FIELDS_ENABLED = false;

let userProfileReady = false;
let profileSaveTimer = null;

const state = {
  portalUrl: localStorage.getItem("oo_portal_url") || DEFAULT_PORTAL,
  stages: [],
  allTags: [],
  groups: [],
  currentUser: null,
  currentUserId: null,
  currentUserName: "",
  currentUserEmail: "",
  portalUsers: [],
  tasks: [],
  tileLayout: { order: [], widths: {}, heights: {} },
  hiddenFeedEntries: new Map(),
  feedKeywordFilter: "",
  feedNotificationsCache: [],
  feedFetchedAt: null,
  feedRawItems: [],
  feedPagination: null,
  feedLoading: false,
  calendarTiles: [],
  calendarCache: {},
  notesTiles: [],
  opportunityById: new Map(),
  groupTemplates: [],
  customFieldDefs: [],
  customFieldById: new Map(),
  taskCategories: [],
  newTaskOpportunity: { id: null, title: "" },
  dealEdit: null,
  quickNote: null,
  historyCategories: [],
  newOpportunityDraft: null,
};

function crmOpportunityUrl(id) {
  const base = state.portalUrl.replace(/\/$/, "");
  return `${base}/Products/CRM/Deals.aspx?id=${id}`;
}

function crmTaskUrl(task) {
  const ent = task.entity;
  if (ent?.entityType === "opportunity" && ent.entityId) {
    return crmOpportunityUrl(ent.entityId);
  }
  const base = state.portalUrl.replace(/\/$/, "");
  return `${base}/Products/CRM/Tasks.aspx`;
}

function groupFilterSummary(group) {
  const parts = [];
  if (group.tagTitles?.length) parts.push(`Tags: ${group.tagTitles.join(", ")}`);
  if (group.contactLabel) parts.push(`Contact: ${group.contactLabel}`);
  if (group.stageId) {
    const st = state.stages.find((s) => String(s.id) === String(group.stageId));
    if (st) parts.push(`Filter stage: ${st.title}`);
  }
  if (group.groupBy === "stage" && group.visibleStageIds?.length) {
    const n = group.visibleStageIds.length;
    const total = state.stages.length;
    if (n < total) parts.push(`${n} stage columns`);
  }
  if (group.groupBy === "stage" && group.showEmptyStages === false) {
    parts.push("Hiding empty stages");
  }
  if (group.dealStatus && group.dealStatus !== "all") {
    parts.push(group.dealStatus === "open" ? "Open deals" : "Closed deals");
  }
  if (group.showOnlyRedOpportunities) parts.push("Red opportunities only");
  return parts.join(" · ");
}

/** DOM refs must never be persisted — only live on in-memory group objects. */
const GROUP_RUNTIME_KEYS = ["_el", "_setFiltersCollapsed"];

function stripGroupRuntimeFields(group) {
  if (!group || typeof group !== "object") return {};
  const out = { ...group };
  for (const key of GROUP_RUNTIME_KEYS) delete out[key];
  return out;
}

function groupDomEl(group) {
  const el = group?._el;
  return el && typeof el.querySelectorAll === "function" ? el : null;
}

function updateGroupFilterSummary(group) {
  const root = groupDomEl(group);
  if (!root) return;
  const text = groupFilterSummary(group);
  root.querySelectorAll(".group-filter-summary, .group-filter-summary-compact").forEach((el) => {
    el.textContent = text;
  });
}

const $ = (sel, root = document) => root.querySelector(sel);

function showToast(message, isError = false) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), 5000);
}

function unwrap(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.response)) return data.response;
  if (data.response && typeof data.response === "object" && !Array.isArray(data.response)) {
    return [data.response];
  }
  return [];
}

/** GET /api/2.0/crm/opportunity/tag/{id} returns plain tag title strings. */
function unwrapEntityTags(data) {
  const raw = unwrap(data);
  if (!raw.length && typeof data?.response === "string") {
    const s = data.response.trim();
    return s ? [s] : [];
  }
  return raw
    .map((t) => (typeof t === "string" ? t.trim() : normalizeTagTitle(t)))
    .filter(Boolean);
}

function sameUserId(a, b) {
  if (a == null || b == null || a === "" || b === "") return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function loadLayoutFromStorage() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY) || localStorage.getItem("oo_board_layout_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          order: Array.isArray(parsed.order) ? parsed.order : [],
          widths: parsed.widths && typeof parsed.widths === "object" ? parsed.widths : {},
          heights: parsed.heights && typeof parsed.heights === "object" ? parsed.heights : {},
          collapsed: parsed.collapsed && typeof parsed.collapsed === "object" ? parsed.collapsed : {},
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { order: [], widths: {}, heights: {}, collapsed: {} };
}

function hiddenFeedCutoffTime() {
  return Date.now() - HIDDEN_FEED_RETENTION_MS;
}

function normalizeHiddenFeedEntries(raw) {
  const map = new Map();
  if (!Array.isArray(raw)) return map;
  const nowIso = new Date().toISOString();
  const cutoff = hiddenFeedCutoffTime();
  for (const item of raw) {
    let key = "";
    let hiddenAt = nowIso;
    let snapshot = null;
    if (typeof item === "string") {
      key = item.trim();
    } else if (item && typeof item === "object") {
      key = String(item.key || "").trim();
      hiddenAt = String(item.hiddenAt || "").trim() || nowIso;
      const snap = item.snapshot;
      if (snap && typeof snap === "object") {
        snapshot = {
          id: snap.id,
          title: String(snap.title || "").slice(0, 300),
          text: String(snap.text || "").slice(0, 500),
          author: String(snap.author || "").slice(0, 200),
          date: snap.date != null ? String(snap.date) : null,
        };
      }
    }
    if (!key || map.has(key)) continue;
    const hiddenMs = new Date(hiddenAt).getTime();
    if (!Number.isNaN(hiddenMs) && hiddenMs < cutoff) continue;
    map.set(key, { hiddenAt, snapshot });
  }
  return map;
}

function pruneHiddenFeedEntries(map = state.hiddenFeedEntries) {
  const cutoff = hiddenFeedCutoffTime();
  for (const [key, entry] of map) {
    const hiddenMs = new Date(entry.hiddenAt).getTime();
    if (Number.isNaN(hiddenMs) || hiddenMs < cutoff) map.delete(key);
  }
  return map;
}

function hiddenFeedEntriesToPayload(map) {
  const cutoff = hiddenFeedCutoffTime();
  const rows = [];
  for (const [key, entry] of map) {
    const hiddenMs = new Date(entry.hiddenAt).getTime();
    if (Number.isNaN(hiddenMs) || hiddenMs < cutoff) continue;
    const row = { key, hiddenAt: entry.hiddenAt };
    if (entry.snapshot) row.snapshot = entry.snapshot;
    rows.push(row);
  }
  return rows;
}

function serializeHiddenFeedEntries() {
  pruneHiddenFeedEntries();
  return hiddenFeedEntriesToPayload(state.hiddenFeedEntries);
}

function isFeedKeyHidden(key) {
  const entry = state.hiddenFeedEntries.get(key);
  if (!entry) return false;
  const hiddenMs = new Date(entry.hiddenAt).getTime();
  if (Number.isNaN(hiddenMs) || hiddenMs < hiddenFeedCutoffTime()) {
    state.hiddenFeedEntries.delete(key);
    return false;
  }
  return true;
}

function loadHiddenFeedEntriesFromStorage() {
  try {
    const raw = localStorage.getItem(HIDDEN_FEED_STORAGE_KEY);
    if (raw) return normalizeHiddenFeedEntries(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Map();
}

function saveHiddenFeedEntries() {
  const payload = serializeHiddenFeedEntries();
  localStorage.setItem(HIDDEN_FEED_STORAGE_KEY, JSON.stringify(payload));
  scheduleUserProfileSave();
  updateFeedHiddenToolbarButton();
}

function applyFeedUserPreferences(profile) {
  if (!profile || typeof profile !== "object") return;
  if (profile.feedKeywordFilter != null) {
    state.feedKeywordFilter = String(profile.feedKeywordFilter || "");
  }
  if (profile.hiddenFeedKeys != null) {
    state.hiddenFeedEntries = normalizeHiddenFeedEntries(profile.hiddenFeedKeys);
    pruneHiddenFeedEntries();
  }
  syncFeedKeywordInput();
  updateFeedHiddenToolbarButton();
}

function syncFeedKeywordInput() {
  const kw = $("#feed-keyword-filter");
  if (kw) kw.value = state.feedKeywordFilter || "";
}

function feedWindowStart() {
  return Date.now() - FEED_DAYS * 24 * 60 * 60 * 1000;
}

function feedFilterPlaceholder() {
  return "Filter new events by keyword";
}

function syncFeedFilterPlaceholder() {
  const kw = $("#feed-keyword-filter");
  if (kw) kw.placeholder = feedFilterPlaceholder();
}

function isWithinFeedWindow(date) {
  if (!date) return true;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return true;
  return t >= feedWindowStart();
}

function feedNotificationKey(it) {
  const when = it.date ? new Date(it.date).getTime() : 0;
  return `${it.id}-${when}-${(it.text || "").slice(0, 80)}-${it.author || ""}`;
}

function saveLayoutToStorage() {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.tileLayout));
  scheduleUserProfileSave();
}

function defaultTileOrder() {
  return [
    "tile-feed",
    "tile-tasks",
    ...state.groups.map((g) => `group-${g.id}`),
    ...state.calendarTiles.map((c) => calendarTileId(c)),
    ...activeNotesTiles().map((n) => notesTileId(n)),
  ];
}

function notesTileId(notes) {
  return `notes-${notes.id}`;
}

function calendarTileId(cal) {
  return `calendar-${cal.id}`;
}

function isAutoRefreshTileId(tileId) {
  return PANEL_TILE_IDS.has(tileId) || (typeof tileId === "string" && tileId.startsWith("calendar-"));
}

function getCalendarByTileId(tileId) {
  const id = String(tileId || "").replace(/^calendar-/, "");
  return state.calendarTiles.find((c) => c.id === id) || null;
}

function ensureTileLayout() {
  const order = state.tileLayout.order?.length ? [...state.tileLayout.order] : defaultTileOrder();
  const known = new Set(defaultTileOrder());
  const filtered = order.filter((id) => known.has(id));
  for (const id of known) {
    if (!filtered.includes(id)) filtered.push(id);
  }
  state.tileLayout.order = filtered;
  for (const id of PANEL_TILE_IDS) {
    if (state.tileLayout.heights?.[id]) delete state.tileLayout.heights[id];
    if (!state.tileLayout.widths[id]) state.tileLayout.widths[id] = "half";
  }
  saveLayoutToStorage();
}

function tileWidth(tileId) {
  const w = state.tileLayout.widths[tileId];
  if (w === "quarter" || w === "half") return w;
  return "full";
}

function tileHeight(tileId) {
  return state.tileLayout.heights[tileId] === "double" ? "double" : "normal";
}

function setTileWidth(tileId, width) {
  state.tileLayout.widths[tileId] =
    width === "quarter" ? "quarter" : width === "half" ? "half" : "full";
  saveLayoutToStorage();
}

function setTileHeight(tileId, height) {
  state.tileLayout.heights[tileId] = height === "double" ? "double" : "normal";
  saveLayoutToStorage();
}

function tileBodyCollapsed(tileId) {
  return state.tileLayout.collapsed?.[tileId] === true;
}

function setTileBodyCollapsed(tileId, collapsed) {
  if (!state.tileLayout.collapsed) state.tileLayout.collapsed = {};
  if (collapsed) state.tileLayout.collapsed[tileId] = true;
  else delete state.tileLayout.collapsed[tileId];
  saveLayoutToStorage();
  mountDashboardTiles();
}

/** Tiles that fetch CRM (or calendar feed) data when expanded. Notes tiles are local-only. */
function isCrmDataTileId(tileId) {
  if (!tileId) return false;
  if (tileId === "tile-feed" || tileId === "tile-tasks") return true;
  if (tileId.startsWith("group-") || tileId.startsWith("calendar-")) return true;
  return false;
}

function shouldFetchTileCrmData(tileId) {
  return isCrmDataTileId(tileId) && !tileBodyCollapsed(tileId);
}

function groupForTileId(tileId) {
  if (!tileId?.startsWith("group-")) return null;
  const groupId = tileId.slice("group-".length);
  return state.groups.find((g) => String(g.id) === String(groupId)) || null;
}

function dashboardTileIdsForLoad() {
  const ids = [...PINNED_TILE_IDS, ...(state.tileLayout.order || [])];
  return [...new Set(ids.filter(Boolean))];
}

function showTileCollapsedHint(tileId, message) {
  const tileEl = document.querySelector(`[data-tile-id="${tileId}"]`);
  if (!tileEl || !tileBodyCollapsed(tileId)) return;
  if (tileId === "tile-feed") {
    const list = $("#notification-feed", tileEl);
    if (list) list.innerHTML = `<li class="feed-collapsed-hint">${escapeHtml(message)}</li>`;
    updatePanelTileCount("tile-feed", 0);
    return;
  }
  if (tileId === "tile-tasks") {
    const wrap = $(".tasks-by-user", tileEl);
    if (wrap) wrap.innerHTML = `<p class="tile-collapsed-hint">${escapeHtml(message)}</p>`;
    updatePanelTileCount("tile-tasks", 0);
    return;
  }
  if (tileId.startsWith("group-")) {
    const group = groupForTileId(tileId);
    const board = group?._el ? $(".board", group._el) : null;
    if (board) board.innerHTML = `<p class="tile-collapsed-hint">${escapeHtml(message)}</p>`;
    const countEl = group?._el?.querySelector(".board-group-count");
    if (countEl) countEl.textContent = "—";
    return;
  }
  if (tileId.startsWith("calendar-")) {
    const body = tileEl.querySelector(".calendar-month-body");
    if (body) body.innerHTML = `<p class="tile-collapsed-hint">${escapeHtml(message)}</p>`;
  }
}

function updateDashboardStatusText() {
  const openOpps = countOpenOpportunities();
  const openTasks = state.tasks.length;
  const skipped = dashboardTileIdsForLoad().filter(
    (id) => isCrmDataTileId(id) && tileBodyCollapsed(id)
  ).length;
  let text = `${openOpps} open opportunities · ${openTasks} open tasks`;
  if (skipped) text += ` · ${skipped} minimized tile${skipped === 1 ? "" : "s"} skipped`;
  const status = $("#status-text");
  if (status) status.textContent = text;
}

async function loadTileCrmData(tileId, { quiet = false, force = false } = {}) {
  if (!tileId || (!force && !shouldFetchTileCrmData(tileId))) return;

  if (tileId === "tile-feed") {
    await loadNotificationFeed({ force });
    return;
  }
  if (tileId === "tile-tasks") {
    await loadTasks();
    return;
  }
  if (tileId.startsWith("calendar-")) {
    const cal = getCalendarByTileId(tileId);
    if (cal) await loadCalendarForTile(cal, { quiet });
    return;
  }
  if (tileId.startsWith("group-")) {
    const group = groupForTileId(tileId);
    if (group) await refreshGroup(group, { force: true });
  }
}

async function loadExpandedDashboardTiles({ quiet = false } = {}) {
  const jobs = dashboardTileIdsForLoad()
    .filter((tileId) => shouldFetchTileCrmData(tileId))
    .map((tileId) => loadTileCrmData(tileId, { quiet }));
  if (!jobs.length) {
    for (const tileId of dashboardTileIdsForLoad()) {
      if (isCrmDataTileId(tileId) && tileBodyCollapsed(tileId)) {
        showTileCollapsedHint(tileId, "Minimized — expand to load");
      }
    }
    updateDashboardStatusText();
    return;
  }
  await Promise.all(jobs);
  updateDashboardStatusText();
}

const PINNED_TILE_IDS = ["tile-feed", "tile-tasks"];
const PANEL_TILE_IDS = new Set(PINNED_TILE_IDS);

function saveFeedKeywordToStorage() {
  localStorage.setItem(FEED_KEYWORD_STORAGE_KEY, state.feedKeywordFilter || "");
  scheduleUserProfileSave();
}

function collectDashboardTileNodes() {
  const nodes = new Map();
  for (const container of [
    $("#dashboard-tiles-pinned"),
    $("#dashboard-panel-row"),
    $("#dashboard-tiles"),
  ]) {
    if (!container) continue;
    for (const child of [...container.children]) {
      if (child.dataset.tileId) nodes.set(child.dataset.tileId, child);
    }
  }
  return nodes;
}

function applyTileBodyCollapsed(tileEl, tileId) {
  if (!tileEl || !tileId) return;
  const collapsed = tileBodyCollapsed(tileId);
  tileEl.classList.toggle("tile-body-collapsed", collapsed);
  if (collapsed) {
    tileEl.classList.remove("tile-half", "tile-quarter", "tile-double");
  } else {
    applyTileLayoutClasses(tileEl, tileId);
  }
}

function applyTileLayoutClasses(tileEl, tileId) {
  if (!tileEl || !tileId) return;
  if (tileBodyCollapsed(tileId)) {
    tileEl.classList.remove("tile-half", "tile-quarter", "tile-double", "tasks-tile-full");
    return;
  }
  if (PANEL_TILE_IDS.has(tileId)) {
    if (state.tileLayout.heights?.[tileId]) {
      delete state.tileLayout.heights[tileId];
      saveLayoutToStorage();
    }
    tileEl.classList.add("panel-tile");
    tileEl.classList.remove("tile-double", "tile-half", "tile-quarter", "tasks-tile-full");
    const w = tileWidth(tileId);
    const panelHalf = w === "half" || w === "quarter";
    tileEl.classList.toggle("panel-width-half", panelHalf);
    tileEl.classList.toggle("panel-width-full", w === "full");
    tileEl.classList.toggle("tasks-tile-full", tileId === "tile-tasks" && w === "full");
    syncPanelRowLayout();
    return;
  }
  const w = tileWidth(tileId);
  const h = tileHeight(tileId);
  tileEl.classList.remove("tile-half", "tile-quarter");
  if (w === "half") tileEl.classList.add("tile-half");
  else if (w === "quarter") tileEl.classList.add("tile-quarter");
  tileEl.classList.toggle("tile-double", h === "double");
}

function createCollapseTileButton(tileEl, tileId) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-ghost btn-collapse-tile tile-btn tile-btn-icon";
  const sync = () => {
    const collapsed = tileBodyCollapsed(tileId);
    const title = collapsed ? "Expand tile" : "Minimize tile";
    setTileLayoutIconButton(btn, collapsed ? TILE_ICON_TILE_EXPAND : TILE_ICON_MINIMIZE, title);
    btn.classList.toggle("tile-btn-active", collapsed);
    btn.setAttribute("aria-expanded", String(!collapsed));
    applyTileBodyCollapsed(tileEl, tileId);
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasCollapsed = tileBodyCollapsed(tileId);
    setTileBodyCollapsed(tileId, !wasCollapsed);
    sync();
    if (wasCollapsed && isCrmDataTileId(tileId)) {
      loadTileCrmData(tileId).catch((err) => showToast(err.message, true));
    } else if (!wasCollapsed && isCrmDataTileId(tileId)) {
      showTileCollapsedHint(tileId, "Minimized — expand to load");
    }
  });
  sync();
  return btn;
}

function attachTileCollapseButton(tileEl, tileId) {
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar, :scope > .group-tile-bar");
  if (!toolbar) return;
  const layoutBtns = toolbar.querySelector(".tile-layout-btns");
  if (!layoutBtns || layoutBtns.querySelector(".btn-collapse-tile")) return;
  const collapseBtn = createCollapseTileButton(tileEl, tileId);
  layoutBtns.insertBefore(collapseBtn, layoutBtns.firstChild);
}

function confirmDialog({ title, message, confirmLabel = "OK", danger = true }) {
  return new Promise((resolve) => {
    const modal = $("#confirm-modal");
    const titleEl = $("#confirm-modal-title");
    const msgEl = $("#confirm-modal-message");
    const okBtn = $("#confirm-modal-ok");
    const cancelBtn = $("#confirm-modal-cancel");
    if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
      resolve(window.confirm(message));
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle("btn-danger", danger);
    okBtn.classList.toggle("btn-primary", !danger);
    modal.classList.remove("hidden");

    const close = (result) => {
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      modal.querySelectorAll("[data-confirm-dismiss]").forEach((el) => {
        el.removeEventListener("click", onCancel);
      });
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };

    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    modal.querySelectorAll("[data-confirm-dismiss]").forEach((el) => {
      el.addEventListener("click", onCancel);
    });
    document.addEventListener("keydown", onKey);
    cancelBtn.focus();
  });
}

const TILE_ICON_WINDOW_RESTORE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="12" height="12" rx="1"/><rect x="8" y="4" width="12" height="12" rx="1"/></svg>`;

const TILE_ICON_WINDOW_MAXIMIZE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`;

const TILE_ICON_HEIGHT_EXPAND = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/></svg>`;

const TILE_ICON_WINDOW_QUARTER = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="4" height="14" rx="0.5"/><rect x="10" y="5" width="4" height="14" rx="0.5"/><rect x="16" y="5" width="4" height="14" rx="0.5"/></svg>`;

const TILE_ICON_MINIMIZE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20h14"/></svg>`;

const TILE_ICON_TILE_EXPAND = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`;

const TILE_ICON_COPY = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

const TILE_ICON_CALENDAR = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;

const TILE_ICON_PRINT = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/><path d="M6 10V6h12v4"/></svg>`;

const TILE_ICON_NOTE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`;

const TILE_ICON_PIN = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z"/></svg>`;

const TILE_ICON_REMOVE = `<svg class="tile-remove-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

const TILE_ICON_SAVE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l2.8 2.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>`;

const FEED_LOADING_SPINNER_HTML = `<svg class="feed-loading-spinner" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

function setTileLayoutIconButton(btn, iconHtml, title) {
  btn.classList.add("tile-btn", "tile-btn-icon");
  btn.innerHTML = iconHtml;
  btn.title = title;
  btn.setAttribute("aria-label", title);
}

function createTileIconActionButton(iconHtml, title, extraClass = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn btn-ghost tile-btn tile-btn-icon ${extraClass}`.trim();
  setTileLayoutIconButton(btn, iconHtml, title);
  return btn;
}

function createTileRemoveButton(title, extraClass = "") {
  return createTileIconActionButton(TILE_ICON_REMOVE, title, `btn-tile-remove ${extraClass}`.trim());
}

function closeAllTileMenus() {
  document.querySelectorAll(".tile-menu").forEach((menu) => menu.classList.add("hidden"));
  document.querySelectorAll(".tile-menu-trigger").forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
  });
}

function bindTileMenuDismiss() {
  if (document.body.dataset.tileMenuDismissBound) return;
  document.body.dataset.tileMenuDismissBound = "1";
  document.addEventListener("click", () => closeAllTileMenus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllTileMenus();
  });
}

function createTileMenu({ label, className = "", items }) {
  bindTileMenuDismiss();
  const wrap = document.createElement("div");
  wrap.className = "tile-menu-wrap";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = `btn btn-ghost tile-menu-trigger ${className}`.trim();
  trigger.textContent = label;
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "tile-menu hidden";
  menu.setAttribute("role", "menu");
  for (const item of items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "tile-menu-item";
    if (item.danger) row.classList.add("tile-menu-item--danger");
    row.textContent = item.label;
    row.setAttribute("role", "menuitem");
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllTileMenus();
      item.onSelect();
    });
    menu.appendChild(row);
  }
  wrap.appendChild(trigger);
  wrap.appendChild(menu);
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.classList.contains("hidden");
    closeAllTileMenus();
    if (willOpen) {
      menu.classList.remove("hidden");
      trigger.setAttribute("aria-expanded", "true");
    }
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
  return wrap;
}

function createLayoutButtons({ showDoubleHeight = true, showQuarterWidth = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "tile-layout-btns";

  let quarterBtn = null;
  if (showQuarterWidth) {
    quarterBtn = document.createElement("button");
    quarterBtn.type = "button";
    setTileLayoutIconButton(quarterBtn, TILE_ICON_WINDOW_QUARTER, "Quarter width (1/4)");
    wrap.appendChild(quarterBtn);
  }

  const halfBtn = document.createElement("button");
  halfBtn.type = "button";
  setTileLayoutIconButton(halfBtn, TILE_ICON_WINDOW_RESTORE, "Half width (1/2)");

  const fullBtn = document.createElement("button");
  fullBtn.type = "button";
  setTileLayoutIconButton(fullBtn, TILE_ICON_WINDOW_MAXIMIZE, "Full width");

  wrap.appendChild(halfBtn);
  wrap.appendChild(fullBtn);

  let tallBtn = null;
  if (showDoubleHeight) {
    tallBtn = document.createElement("button");
    tallBtn.type = "button";
    setTileLayoutIconButton(tallBtn, TILE_ICON_HEIGHT_EXPAND, "Double tile height (two grid rows)");
    wrap.appendChild(tallBtn);
  }
  return { wrap, quarterBtn, halfBtn, fullBtn, tallBtn };
}

function bindTileLayoutButtons(tileEl, tileId, halfBtn, fullBtn, tallBtn, quarterBtn = null) {
  const syncTileLayout = () => {
    const w = tileWidth(tileId);
    const h = tileHeight(tileId);
    if (quarterBtn) quarterBtn.classList.toggle("tile-btn-active", w === "quarter");
    halfBtn.classList.toggle("tile-btn-active", w === "half");
    fullBtn.classList.toggle("tile-btn-active", w === "full");
    if (tallBtn) tallBtn.classList.toggle("tile-btn-active", h === "double");
    applyTileLayoutClasses(tileEl, tileId);
    if (tileId === "tile-tasks") renderTasksByUser();
    if (PANEL_TILE_IDS.has(tileId)) syncPanelRowLayout();
  };
  quarterBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setTileWidth(tileId, "quarter");
    syncTileLayout();
  });
  halfBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setTileWidth(tileId, "half");
    syncTileLayout();
  });
  fullBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setTileWidth(tileId, "full");
    syncTileLayout();
  });
  if (tallBtn) {
    tallBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setTileHeight(tileId, tileHeight(tileId) === "double" ? "normal" : "double");
      syncTileLayout();
    });
  }
  syncTileLayout();
  return syncTileLayout;
}

function createTileChrome(tileId, label) {
  const toolbar = document.createElement("div");
  toolbar.className = "tile-toolbar";
  toolbar.draggable = true;
  toolbar.dataset.tileId = tileId;

  const hint = document.createElement("span");
  hint.className = "tile-drag-hint";
  hint.textContent = "⋮⋮";
  hint.setAttribute("aria-hidden", "true");

  const isPanel = PANEL_TILE_IDS.has(tileId);
  if (isPanel) {
    hint.classList.add("hidden");
    toolbar.draggable = false;
  }

  const name = document.createElement("span");
  name.className = "tile-toolbar-title";
  name.textContent = label;

  const countBadge = document.createElement("span");
  countBadge.className = "tile-toolbar-count";
  countBadge.dataset.tileCountFor = tileId;
  countBadge.textContent = "(0)";

  const spacer = document.createElement("span");
  spacer.className = "tile-toolbar-spacer";

  const { wrap, halfBtn, fullBtn, tallBtn } = createLayoutButtons({
    showDoubleHeight: !isPanel,
  });

  toolbar.appendChild(hint);
  toolbar.appendChild(name);
  toolbar.appendChild(countBadge);
  toolbar.appendChild(spacer);
  toolbar.appendChild(wrap);

  return { toolbar, halfBtn, fullBtn, tallBtn };
}

function syncPanelRowLayout() {
  const row = $("#dashboard-panel-row");
  const pinned = $("#dashboard-tiles-pinned");
  if (!row) return;
  const anyFull = PINNED_TILE_IDS.some((id) => tileWidth(id) === "full" && !tileBodyCollapsed(id));
  row.classList.toggle("panel-row-has-full", anyFull);
  if (pinned) pinned.classList.toggle("panel-row-has-full", anyFull);
}

function updatePanelTileCount(tileId, count) {
  document.querySelectorAll(`[data-tile-count-for="${tileId}"]`).forEach((el) => {
    el.textContent = `(${count})`;
  });
}

function ensurePanelToolbarCount(tileEl, tileId) {
  if (!PANEL_TILE_IDS.has(tileId)) return;
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar");
  if (!toolbar) return;
  toolbar.draggable = false;
  const hint = toolbar.querySelector(".tile-drag-hint");
  if (hint) hint.classList.add("hidden");
  if (!toolbar.querySelector(`[data-tile-count-for="${tileId}"]`)) {
    const countBadge = document.createElement("span");
    countBadge.className = "tile-toolbar-count";
    countBadge.dataset.tileCountFor = tileId;
    countBadge.textContent = "(0)";
    const title = toolbar.querySelector(".tile-toolbar-title");
    if (title) title.after(countBadge);
    else toolbar.insertBefore(countBadge, toolbar.querySelector(".tile-toolbar-spacer"));
  }
}

function ensurePanelLayoutButtons(tileEl, tileId) {
  if (!PANEL_TILE_IDS.has(tileId)) return;
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar");
  if (!toolbar || toolbar.querySelector(".tile-layout-btns")) return;
  const { wrap, halfBtn, fullBtn, tallBtn } = createLayoutButtons({ showDoubleHeight: false });
  toolbar.appendChild(wrap);
  bindTileLayoutButtons(tileEl, tileId, halfBtn, fullBtn, tallBtn);
}

function bindTileChrome(tileEl, tileId) {
  if (!tileEl.querySelector(":scope > .tile-toolbar")) {
    const { toolbar, halfBtn, fullBtn, tallBtn } = createTileChrome(tileId, tileEl.dataset.tileLabel || "Section");
    bindTileLayoutButtons(tileEl, tileId, halfBtn, fullBtn, tallBtn);
    tileEl.prepend(toolbar);
    bindTileDragDrop(tileEl, tileId, toolbar);
  } else {
    ensurePanelToolbarCount(tileEl, tileId);
    ensurePanelLayoutButtons(tileEl, tileId);
  }
  attachTileCollapseButton(tileEl, tileId);
  applyTileBodyCollapsed(tileEl, tileId);
  if (isAutoRefreshTileId(tileId)) ensureTileAutoRefreshButton(tileEl, tileId);
  if (tileId === "tile-feed") ensureFeedHiddenToolbarButton(tileEl);
  if (tileId === "tile-tasks") ensureTasksNewTaskButton(tileEl);
}

function bindTileDragDrop(tileEl, tileId, toolbar) {
  if (PANEL_TILE_IDS.has(tileId)) return;

  toolbar.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", tileId);
    e.dataTransfer.effectAllowed = "move";
    tileEl.classList.add("dragging");
  });
  toolbar.addEventListener("dragend", () => {
    tileEl.classList.remove("dragging");
    document.querySelectorAll(".dashboard-tile.drag-over").forEach((n) => n.classList.remove("drag-over"));
  });

  tileEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    tileEl.classList.add("drag-over");
  });
  tileEl.addEventListener("dragleave", () => tileEl.classList.remove("drag-over"));
  tileEl.addEventListener("drop", (e) => {
    e.preventDefault();
    tileEl.classList.remove("drag-over");
    const fromId = e.dataTransfer.getData("text/plain");
    if (!fromId || fromId === tileId) return;
    const order = [...state.tileLayout.order];
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(tileId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, fromId);
    state.tileLayout.order = order;
    saveLayoutToStorage();
    mountDashboardTiles();
  });
}

function loadGroupTemplates() {
  try {
    const raw = localStorage.getItem(GROUP_TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveGroupTemplatesToStorage() {
  localStorage.setItem(GROUP_TEMPLATES_STORAGE_KEY, JSON.stringify(state.groupTemplates));
  scheduleUserProfileSave();
}

function groupConfigSnapshot(group) {
  return JSON.parse(JSON.stringify(stripGroupRuntimeFields(group)));
}

function applyGroupTemplate(group, template) {
  const cfg = stripGroupRuntimeFields(template.config || template);
  const keep = { id: group.id, opportunities: group.opportunities || [], _el: groupDomEl(group) };
  Object.assign(group, newGroup(), cfg, keep);
  const el = groupDomEl(group);
  if (el) {
    el.dataset.tileLabel = group.name || "Opportunity group";
    const nameInput = $(".group-tile-name", el);
    if (nameInput) nameInput.value = group.name;
    updateGroupFilterSummary(group);
  }
}

function bindGroupTileChrome(section, group, tileId) {
  if (section.querySelector(":scope > .group-tile-bar")) return;

  const toolbar = document.createElement("div");
  toolbar.className = "tile-toolbar group-tile-bar";
  toolbar.draggable = true;
  toolbar.dataset.tileId = tileId;

  const hint = document.createElement("span");
  hint.className = "tile-drag-hint";
  hint.textContent = "⋮⋮";
  hint.setAttribute("aria-hidden", "true");

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "group-tile-name";
  nameInput.placeholder = "Group label";
  nameInput.value = group.name || "";
  nameInput.setAttribute("aria-label", "Group label");

  const countEl = document.createElement("span");
  countEl.className = "group-tile-count board-group-count";
  countEl.textContent = "0 deals";

  const summaryCompactBar = document.createElement("span");
  summaryCompactBar.className = "group-filter-summary-compact";
  summaryCompactBar.textContent = groupFilterSummary(group);

  const toggleFiltersBtn = document.createElement("button");
  toggleFiltersBtn.type = "button";
  toggleFiltersBtn.className = "btn btn-ghost btn-toggle-filters";
  toggleFiltersBtn.textContent = "Hide filters";

  const templateSelect = document.createElement("select");
  templateSelect.className = "group-tile-templates";
  templateSelect.title = "Apply a saved template";
  const tplOpt0 = document.createElement("option");
  tplOpt0.value = "";
  tplOpt0.textContent = "Templates…";
  templateSelect.appendChild(tplOpt0);
  for (const t of state.groupTemplates) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    templateSelect.appendChild(opt);
  }

  const saveTplBtn = createTileIconActionButton(
    TILE_ICON_SAVE,
    "Save current filters as a template",
    "btn-save-template"
  );

  const removeBtn = createTileRemoveButton("Remove this grouping from the board", "btn-remove-group");

  const { wrap, halfBtn, fullBtn, tallBtn } = createLayoutButtons();

  toolbar.appendChild(hint);
  toolbar.appendChild(nameInput);
  toolbar.appendChild(countEl);
  toolbar.appendChild(summaryCompactBar);
  toolbar.appendChild(toggleFiltersBtn);
  toolbar.appendChild(templateSelect);
  toolbar.appendChild(saveTplBtn);
  toolbar.appendChild(removeBtn);
  toolbar.appendChild(wrap);

  section.prepend(toolbar);
  bindTileLayoutButtons(section, tileId, halfBtn, fullBtn, tallBtn);
  bindTileDragDrop(section, tileId, toolbar);
  attachTileCollapseButton(section, tileId);

  const setFiltersCollapsed = (collapsed) => {
    group.filtersCollapsed = collapsed;
    section.classList.toggle("filters-collapsed", collapsed);
    toggleFiltersBtn.setAttribute("aria-expanded", String(!collapsed));
    toggleFiltersBtn.textContent = collapsed ? "Show filters" : "Hide filters";
    saveGroupsToStorage();
  };
  setFiltersCollapsed(!!group.filtersCollapsed);
  toggleFiltersBtn.addEventListener("click", () => setFiltersCollapsed(!group.filtersCollapsed));

  nameInput.addEventListener("input", () => {
    group.name = nameInput.value;
    section.dataset.tileLabel = group.name || "Opportunity group";
    saveGroupsToStorage();
  });
  nameInput.addEventListener("change", () => {
    group.name = nameInput.value.trim() || "New group";
    nameInput.value = group.name;
    section.dataset.tileLabel = group.name;
    saveGroupsToStorage();
  });

  templateSelect.addEventListener("change", () => {
    const id = templateSelect.value;
    templateSelect.value = "";
    if (!id) return;
    const tpl = state.groupTemplates.find((t) => t.id === id);
    if (!tpl) return;
    applyGroupTemplate(group, tpl);
    saveGroupsToStorage();
    renderBoardGroups();
    refreshGroup(group).catch((err) => showToast(err.message, true));
    showToast(`Applied template “${tpl.name}”`);
  });

  saveTplBtn.addEventListener("click", () => {
    const name = prompt("Template name", group.name || "My filters");
    if (!name?.trim()) return;
    const tpl = { id: crypto.randomUUID(), name: name.trim(), config: groupConfigSnapshot(group) };
    state.groupTemplates.push(tpl);
    saveGroupTemplatesToStorage();
    renderBoardGroups();
    showToast(`Saved template “${tpl.name}”`);
  });

  removeBtn.addEventListener("click", async () => {
    if (state.groups.length <= 1) {
      showToast("Keep at least one group", true);
      return;
    }
    const label = group.name?.trim() || "this group";
    const ok = await confirmDialog({
      title: "Remove grouping?",
      message: `Remove “${label}” from the board? This cannot be undone.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    const tid = `group-${group.id}`;
    state.groups = state.groups.filter((g) => g.id !== group.id);
    state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
    delete state.tileLayout.widths[tid];
    delete state.tileLayout.heights[tid];
    saveGroupsToStorage();
    saveLayoutToStorage();
    renderBoardGroups();
    refreshAll();
  });

  group._setFiltersCollapsed = setFiltersCollapsed;
}

function mountPanelTile(node, tileId, parent) {
  if (!node || !parent) return;
  parent.appendChild(node);
  node.classList.remove("tile-half", "tile-double", "tasks-tile-full");
  node.classList.toggle("panel-slot-left", tileId === "tile-feed");
  node.classList.toggle("panel-slot-right", tileId === "tile-tasks");
  applyTileBodyCollapsed(node, tileId);
  if (!tileBodyCollapsed(tileId)) applyTileLayoutClasses(node, tileId);
}

function mountDashboardTiles() {
  const root = $("#dashboard-tiles");
  const panelRow = $("#dashboard-panel-row");
  const pinnedRoot = $("#dashboard-tiles-pinned");
  if (!root) return;
  ensureTileLayout();

  const nodes = collectDashboardTileNodes();
  if (pinnedRoot) pinnedRoot.innerHTML = "";
  if (panelRow) panelRow.innerHTML = "";
  root.innerHTML = "";

  let hasPinned = false;
  for (const tileId of PINNED_TILE_IDS) {
    const node = nodes.get(tileId);
    if (!node) continue;
    if (tileBodyCollapsed(tileId)) {
      mountPanelTile(node, tileId, pinnedRoot);
      hasPinned = true;
    } else {
      mountPanelTile(node, tileId, panelRow);
    }
  }

  if (pinnedRoot) pinnedRoot.classList.toggle("hidden", !hasPinned);
  syncPanelRowLayout();

  for (const tileId of state.tileLayout.order) {
    if (PANEL_TILE_IDS.has(tileId)) continue;
    const node = nodes.get(tileId);
    if (!node) continue;
    root.appendChild(node);
    applyTileLayoutClasses(node, tileId);
    applyTileBodyCollapsed(node, tileId);
  }
}

function renderFeedTile() {
  const tileId = "tile-feed";
  let tile = document.querySelector(`[data-tile-id="${tileId}"]`);
  if (!tile) {
    tile = document.createElement("section");
    tile.className = "dashboard-tile panel feed-panel";
    tile.dataset.tileId = tileId;
    tile.dataset.tileLabel = "CRM notifications";
    tile.innerHTML = `
      <div class="panel-header panel-header-feed">
        <input type="search" id="feed-keyword-filter" class="feed-keyword-filter" placeholder="${escapeHtml(feedFilterPlaceholder())}" autocomplete="off" />
        <span class="feed-loading-indicator hidden" title="Loading notifications" aria-label="Loading notifications">${FEED_LOADING_SPINNER_HTML}</span>
        <span class="panel-sub feed-range-hint">Last ${FEED_DAYS} days</span>
      </div>
      <ul id="notification-feed" class="feed-list" aria-live="polite"></ul>
    `;
    $("#dashboard-panel-row")?.appendChild(tile);
    bindTileChrome(tile, tileId);
    bindFeedInfiniteScroll();
    const kw = $("#feed-keyword-filter", tile);
    if (kw) {
      kw.value = state.feedKeywordFilter || "";
      kw.addEventListener("input", () => {
        state.feedKeywordFilter = kw.value;
        saveFeedKeywordToStorage();
        renderFeedNotificationList();
      });
    }
  }
  applyTileLayoutClasses(tile, tileId);
  ensurePanelToolbarCount(tile, tileId);
  ensurePanelLayoutButtons(tile, tileId);
  ensureTileAutoRefreshButton(tile, tileId);
  ensureFeedHiddenToolbarButton(tile);
  syncFeedFilterPlaceholder();
  const kw = $("#feed-keyword-filter", tile);
  if (kw) {
    kw.value = state.feedKeywordFilter || "";
    if (!kw.dataset.bound) {
      kw.dataset.bound = "1";
      kw.addEventListener("input", () => {
        state.feedKeywordFilter = kw.value;
        saveFeedKeywordToStorage();
        renderFeedNotificationList();
      });
    }
  }
  bindFeedInfiniteScroll();
  return tile;
}

function renderTasksTile() {
  const tileId = "tile-tasks";
  let tile = document.querySelector(`[data-tile-id="${tileId}"]`);
  if (!tile) {
    tile = document.createElement("section");
    tile.className = "dashboard-tile panel tasks-panel";
    tile.dataset.tileId = tileId;
    tile.dataset.tileLabel = "Tasks";
    tile.innerHTML = `
      <div class="panel-header panel-header-tasks">
        <label class="tasks-filter-label panel-sub">
          User
          <select id="tasks-user-filter"></select>
        </label>
      </div>
      <div id="tasks-by-user" class="tasks-by-user"></div>
    `;
    $("#dashboard-panel-row")?.appendChild(tile);
    bindTileChrome(tile, tileId);
  }
  applyTileLayoutClasses(tile, tileId);
  ensurePanelToolbarCount(tile, tileId);
  ensurePanelLayoutButtons(tile, tileId);
  ensureTileAutoRefreshButton(tile, tileId);
  ensureTasksNewTaskButton(tile);
  if (tile && !tile.dataset.tasksFilterBound) {
    tile.dataset.tasksFilterBound = "1";
    $("#tasks-user-filter", tile)?.addEventListener("change", () => {
      loadTasks().catch((err) => showToast(err.message, true));
    });
  }
  return tile;
}

function refreshDashboardTileLayouts() {
  document.querySelectorAll(".dashboard-tile[data-tile-id]").forEach((el) => {
    const id = el.dataset.tileId;
    attachTileCollapseButton(el, id);
    applyTileBodyCollapsed(el, id);
    if (tileBodyCollapsed(id) && isCrmDataTileId(id)) {
      const msg =
        id === "tile-feed"
          ? "Minimized — expand to load notifications"
          : id === "tile-tasks"
            ? "Minimized — expand to load tasks"
            : id.startsWith("calendar-")
              ? "Minimized — expand to load calendar"
              : "Minimized — expand to load deals";
      showTileCollapsedHint(id, msg);
    }
  });
}

function parseApiError(body, status) {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return body.slice(0, 300) || `HTTP ${status}`;
    }
  }
  if (body?.message) return String(body.message);
  if (body?.error?.message) return String(body.error.message);
  if (body?.error) return typeof body.error === "string" ? body.error : JSON.stringify(body.error);
  if (body?.detail) return typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
  return `HTTP ${status}`;
}

async function api(path, options = {}) {
  const headers = { Accept: "application/json", ...options.headers };
  if (state.portalUrl) headers["X-OnlyOffice-Portal"] = state.portalUrl;

  const res = await fetch(`/api/proxy${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(res.ok ? "Invalid JSON from server" : text.slice(0, 300) || res.statusText);
  }
  if (!res.ok) throw new Error(parseApiError(body, res.status));
  return body;
}

function newGroup(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: "New group",
    dealStatus: "open",
    tagTitles: [],
    contactId: "",
    contactLabel: "",
    stageId: "",
    stageType: "",
    search: "",
    groupBy: "stage",
    sortBy: "stage",
    sortOrder: "ascending",
    filtersCollapsed: false,
    visibleStageIds: [],
    stageColumnsConfigured: false,
    showEmptyStages: true,
    showOnlyRedOpportunities: false,
    opportunities: [],
    ...overrides,
  };
}

function ensureVisibleStageIds(group) {
  if (!Array.isArray(group.visibleStageIds)) group.visibleStageIds = [];
  if (!group.stageColumnsConfigured && state.stages.length) {
    group.visibleStageIds = state.stages.map((s) => String(s.id));
  }
}

function isStageColumnVisible(group, stageId) {
  if (!group.stageColumnsConfigured) return true;
  return (group.visibleStageIds || []).includes(String(stageId));
}

function getOpportunityContactLabel(opp) {
  const contact = opp.contact || opp.Contact;
  if (contact && typeof contact === "object") {
    return (
      contact.displayName ||
      contact.DisplayName ||
      contact.title ||
      contact.Title ||
      contact.company ||
      ""
    ).trim();
  }
  return String(contact || opp.contactTitle || opp.ContactTitle || "").trim();
}

function loadGroupsFromStorage() {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((g) => stripGroupRuntimeFields(g));
      }
    }
  } catch {
    /* ignore */
  }
  return [
    newGroup({ name: "Open pipeline", dealStatus: "open", groupBy: "stage" }),
    newGroup({ name: "Tagged deals", dealStatus: "all", groupBy: "tag", tagTitles: [] }),
  ];
}

function saveGroupsToStorage() {
  const slim = state.groups.map((g) => {
    const { opportunities, ...rest } = stripGroupRuntimeFields(g);
    return rest;
  });
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(slim));
  scheduleUserProfileSave();
}

function stripCalendarRuntimeFields(cal) {
  const { _el, _loading, ...rest } = cal;
  return rest;
}

function newCalendarTile(overrides = {}) {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    name: "Calendar",
    feedUrl: "",
    timezone: "",
    viewYear: now.getFullYear(),
    viewMonth: now.getMonth() + 1,
    ...overrides,
  };
}

const CALENDAR_TZ_COMMON = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Panama",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];

const CALENDAR_TZ_FALLBACK = [
  ...CALENDAR_TZ_COMMON,
  "America/Detroit",
  "America/Indiana/Indianapolis",
  "America/Boise",
  "America/Vancouver",
  "Europe/Berlin",
  "Australia/Sydney",
];

let calendarTimezoneOptionsCache = null;

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function resolveCalendarTimezone(cal) {
  if (cal?.timezone) return cal.timezone;
  const tid = cal ? calendarTileId(cal) : "";
  const fromCache = tid ? state.calendarCache[tid]?.timezone : "";
  if (fromCache) return fromCache;
  return getBrowserTimezone();
}

function getCalendarTimezoneOptionList() {
  if (calendarTimezoneOptionsCache) return calendarTimezoneOptionsCache;
  let all = [];
  try {
    if (typeof Intl !== "undefined" && Intl.supportedValuesOf) {
      all = Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* ignore */
  }
  if (!all.length) all = [...CALENDAR_TZ_FALLBACK];
  const commonSet = new Set(CALENDAR_TZ_COMMON);
  const rest = all.filter((tz) => !commonSet.has(tz)).sort((a, b) => a.localeCompare(b));
  calendarTimezoneOptionsCache = { common: [...CALENDAR_TZ_COMMON], rest };
  return calendarTimezoneOptionsCache;
}

function formatTimezoneLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const abbr = parts.find((p) => p.type === "timeZoneName")?.value;
    const label = tz.replace(/_/g, " ");
    return abbr ? `${label} (${abbr})` : label;
  } catch {
    return tz.replace(/_/g, " ");
  }
}

function populateCalendarTimezoneSelect(select, selectedTz) {
  if (!select) return;
  const { common, rest } = getCalendarTimezoneOptionList();
  const selected = selectedTz || getBrowserTimezone();
  select.innerHTML = "";

  const addGroup = (label, zones) => {
    const og = document.createElement("optgroup");
    og.label = label;
    for (const tz of zones) {
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = formatTimezoneLabel(tz);
      if (tz === selected) opt.selected = true;
      og.appendChild(opt);
    }
    select.appendChild(og);
  };

  addGroup("Common", common);
  addGroup("All timezones", rest);
  if (![...common, ...rest].includes(selected)) {
    const opt = document.createElement("option");
    opt.value = selected;
    opt.textContent = formatTimezoneLabel(selected);
    opt.selected = true;
    select.insertBefore(opt, select.firstChild);
  }
}

function getZonedParts(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (type) => {
    const p = parts.find((x) => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function wallTimeInZoneToUtc(year, month, day, hour, minute, timeZone) {
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 6; i++) {
    const p = getZonedParts(utc, timeZone);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const delta = target - actual;
    if (Math.abs(delta) < 1000) break;
    utc += delta;
  }
  return utc;
}

function eventStartUtcMs(ev) {
  const s = ev?.start;
  if (!s || s.allDay) return null;
  if (s.iso && String(s.iso).endsWith("Z")) return new Date(s.iso).getTime();
  return wallTimeInZoneToUtc(
    s.year,
    s.month,
    s.day,
    s.hour ?? 0,
    s.minute ?? 0,
    s.tzid || "UTC"
  );
}

function eventEndUtcMs(ev) {
  const e = ev?.end || ev?.start;
  if (!e || e.allDay) return null;
  if (e.iso && String(e.iso).endsWith("Z")) return new Date(e.iso).getTime();
  return wallTimeInZoneToUtc(
    e.year,
    e.month,
    e.day,
    e.hour ?? 0,
    e.minute ?? 0,
    e.tzid || ev?.start?.tzid || "UTC"
  );
}

function allDayRangeFloating(ev) {
  const start = eventDateParts(ev.start);
  if (!start || start.y == null) return null;
  const end = eventDateParts(ev.end) || start;
  let ey = end.y ?? start.y;
  let em = end.m ?? start.m;
  let ed = end.d ?? start.d;
  if (ev.end?.allDay && ev.start?.allDay) {
    const endMs = Date.UTC(ey, em - 1, ed);
    const adj = new Date(endMs - 86400000);
    ey = adj.getUTCFullYear();
    em = adj.getUTCMonth() + 1;
    ed = adj.getUTCDate();
  }
  return { start, end: { y: ey, m: em, d: ed } };
}

function todayYmdInTimezone(timeZone) {
  return getZonedParts(Date.now(), timeZone);
}

function loadCalendarsFromStorage() {
  try {
    const raw = localStorage.getItem(CALENDARS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => stripCalendarRuntimeFields(c));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveCalendarsToStorage() {
  const slim = state.calendarTiles.map((c) => stripCalendarRuntimeFields(c));
  localStorage.setItem(CALENDARS_STORAGE_KEY, JSON.stringify(slim));
  scheduleUserProfileSave();
}

const CALENDAR_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function calendarViewMonthLabel(cal) {
  const m = CALENDAR_MONTH_NAMES[(cal.viewMonth || 1) - 1] || "";
  return `${m} ${cal.viewYear || ""}`.trim();
}

function shiftCalendarViewMonth(cal, delta) {
  let y = cal.viewYear || new Date().getFullYear();
  let m = cal.viewMonth || new Date().getMonth() + 1;
  m += delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  cal.viewYear = y;
  cal.viewMonth = m;
  saveCalendarsToStorage();
}

function eventDateParts(dt) {
  if (!dt) return null;
  return { y: dt.year, m: dt.month, d: dt.day };
}

function eventOnCalendarDay(ev, year, month, day, timeZone) {
  if (ev.start?.allDay) {
    const range = allDayRangeFloating(ev);
    if (!range) return false;
    const cell = Date.UTC(year, month - 1, day);
    const s = Date.UTC(range.start.y, range.start.m - 1, range.start.d);
    const e = Date.UTC(range.end.y, range.end.m - 1, range.end.d);
    return cell >= s && cell <= e;
  }
  const startMs = eventStartUtcMs(ev);
  if (!Number.isFinite(startMs)) return false;
  let endMs = eventEndUtcMs(ev);
  if (!Number.isFinite(endMs)) endMs = startMs + 3600000;
  const dayStart = wallTimeInZoneToUtc(year, month, day, 0, 0, timeZone);
  const dayEnd = wallTimeInZoneToUtc(year, month, day, 23, 59, timeZone) + 60000;
  return startMs < dayEnd && endMs >= dayStart;
}

function eventSortKeyInTimezone(ev, timeZone) {
  if (ev.start?.allDay) return 0;
  const ms = eventStartUtcMs(ev);
  if (!Number.isFinite(ms)) return 0;
  const p = getZonedParts(ms, timeZone);
  return p.hour * 60 + p.minute;
}

function formatEventTimeInTimezone(ev, timeZone) {
  if (ev.start?.allDay) return "";
  const ms = eventStartUtcMs(ev);
  if (!Number.isFinite(ms)) return "";
  const p = getZonedParts(ms, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} `;
}

function eventsForCalendarDay(events, year, month, day, timeZone) {
  return events
    .filter((ev) => ev.status !== "CANCELLED" && eventOnCalendarDay(ev, year, month, day, timeZone))
    .sort((a, b) => {
      const sa = eventSortKeyInTimezone(a, timeZone);
      const sb = eventSortKeyInTimezone(b, timeZone);
      if (sa !== sb) return sa - sb;
      return String(a.summary || "").localeCompare(String(b.summary || ""));
    });
}

function buildCalendarMonthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    cells.push({ year: py, month: pm, day: d, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month, day: d, outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    let ny = last.year;
    let nm = last.month;
    let nd = last.day + 1;
    if (nd > new Date(ny, nm, 0).getDate()) {
      nd = 1;
      nm += 1;
      if (nm > 12) {
        nm = 1;
        ny += 1;
      }
    }
    cells.push({ year: ny, month: nm, day: nd, outside: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    let ny = last.year;
    let nm = last.month;
    let nd = last.day + 1;
    if (nd > new Date(ny, nm, 0).getDate()) {
      nd = 1;
      nm += 1;
      if (nm > 12) {
        nm = 1;
        ny += 1;
      }
    }
    cells.push({ year: ny, month: nm, day: nd, outside: true });
  }
  return cells;
}

function renderCalendarMonthBody(section, cal) {
  const body = $(".calendar-month-body", section);
  if (!body) return;
  const tid = calendarTileId(cal);
  const cache = state.calendarCache[tid];
  const events = cache?.events || [];
  const y = cal.viewYear || new Date().getFullYear();
  const m = cal.viewMonth || new Date().getMonth() + 1;
  const tz = resolveCalendarTimezone(cal);
  const today = todayYmdInTimezone(tz);
  const cells = buildCalendarMonthGrid(y, m);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = '<div class="calendar-month-grid" role="grid" aria-label="Monthly calendar">';
  html += '<div class="calendar-weekdays" role="row">';
  for (const wd of weekdays) {
    html += `<div class="calendar-weekday" role="columnheader">${escapeHtml(wd)}</div>`;
  }
  html += '</div><div class="calendar-days" role="rowgroup">';

  for (const cell of cells) {
    const isToday =
      cell.year === today.year && cell.month === today.month && cell.day === today.day;
    const dayEvents = eventsForCalendarDay(events, cell.year, cell.month, cell.day, tz);
    const cls = [
      "calendar-day",
      cell.outside ? "calendar-day-outside" : "",
      isToday ? "calendar-day-today" : "",
    ]
      .filter(Boolean)
      .join(" ");
    html += `<div class="${cls}" role="gridcell" data-date="${cell.year}-${String(cell.month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}">`;
    html += `<div class="calendar-day-num">${cell.day}</div>`;
    html += '<div class="calendar-day-events">';
    const maxShow = 3;
    for (let i = 0; i < Math.min(dayEvents.length, maxShow); i++) {
      const ev = dayEvents[i];
      const color = ev.color || "#6e4bdb";
      const time = formatEventTimeInTimezone(ev, tz);
      const uidAttr = escapeHtml(ev.uid || "");
      html += `<button type="button" class="calendar-event-chip" data-event-uid="${uidAttr}" style="--event-color:${escapeHtml(color)}" title="${escapeHtml((time + ev.summary).trim())}">`;
      html += `<span class="calendar-event-dot" aria-hidden="true"></span>`;
      html += `<span class="calendar-event-label">${escapeHtml(time + (ev.summary || ""))}</span>`;
      html += "</button>";
    }
    if (dayEvents.length > maxShow) {
      html += `<div class="calendar-more-events">+${dayEvents.length - maxShow} more</div>`;
    }
    html += "</div></div>";
  }
  html += "</div></div>";
  body.innerHTML = html;

  const monthLabel = $(".calendar-month-label", section);
  if (monthLabel) monthLabel.textContent = calendarViewMonthLabel(cal);
  const countEl = $(".calendar-tile-count", section);
  if (countEl) {
    const inMonth = events.filter((ev) => {
      if (ev.status === "CANCELLED") return false;
      for (const cell of cells) {
        if (!cell.outside && eventOnCalendarDay(ev, cell.year, cell.month, cell.day, tz)) return true;
      }
      return false;
    }).length;
    countEl.textContent = `${inMonth} events`;
  }

  bindCalendarEventClicks(section, cal);
}

function findCalendarEventByUid(cal, uid) {
  if (!uid) return null;
  const tid = calendarTileId(cal);
  const events = state.calendarCache[tid]?.events || [];
  return events.find((ev) => ev.uid === uid) || null;
}

function formatCalendarEventWhen(ev, timeZone) {
  const pad = (n) => String(n).padStart(2, "0");
  if (ev.start?.allDay) {
    const s = ev.start;
    const range = allDayRangeFloating(ev);
    const startLabel = `${s.year}-${pad(s.month)}-${pad(s.day)}`;
    if (range && (range.end.y !== s.year || range.end.m !== s.month || range.end.d !== s.day)) {
      return `All day · ${startLabel} – ${range.end.y}-${pad(range.end.m)}-${pad(range.end.d)}`;
    }
    return `All day · ${startLabel}`;
  }
  const startMs = eventStartUtcMs(ev);
  if (!Number.isFinite(startMs)) return "";
  const sp = getZonedParts(startMs, timeZone);
  let label = `${sp.year}-${pad(sp.month)}-${pad(sp.day)} ${pad(sp.hour)}:${pad(sp.minute)}`;
  const endMs = eventEndUtcMs(ev);
  if (Number.isFinite(endMs) && endMs > startMs) {
    const ep = getZonedParts(endMs, timeZone);
    label += ` – ${ep.year}-${pad(ep.month)}-${pad(ep.day)} ${pad(ep.hour)}:${pad(ep.minute)}`;
  }
  return label;
}

function openCalendarEventModal(ev, cal) {
  const modal = $("#calendar-event-modal");
  const titleEl = $("#calendar-event-modal-title");
  const bodyEl = $("#calendar-event-modal-body");
  if (!modal || !titleEl || !bodyEl) return;

  const tz = resolveCalendarTimezone(cal);
  const color = ev.color || "#6e4bdb";
  titleEl.innerHTML = `<span class="calendar-event-modal-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(ev.summary || "Event")}`;

  const rows = [];
  const when = formatCalendarEventWhen(ev, tz);
  if (when) rows.push({ label: "When", value: when });
  if (ev.status && ev.status !== "CONFIRMED") rows.push({ label: "Status", value: ev.status });
  if (ev.organizer) rows.push({ label: "Organizer", value: ev.organizer });
  if (ev.location) {
    const loc = ev.location;
    if (/^https?:\/\//i.test(loc)) {
      rows.push({
        label: "Location",
        html: `<a href="${escapeHtml(loc)}" target="_blank" rel="noopener noreferrer">${escapeHtml(loc)}</a>`,
      });
    } else {
      rows.push({ label: "Location", value: loc });
    }
  }
  if (ev.url) {
    rows.push({
      label: "Link",
      html: `<a href="${escapeHtml(ev.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.url)}</a>`,
    });
  }
  const calName = state.calendarCache[calendarTileId(cal)]?.name;
  if (calName) rows.push({ label: "Calendar", value: calName });
  if (ev.categories?.length) rows.push({ label: "Categories", value: ev.categories.join(", ") });
  if (ev.recurrence || ev.rrule) {
    rows.push({ label: "Repeats", value: ev.recurrence || ev.rrule });
  }
  if (ev.attendees?.length) {
    const list = ev.attendees
      .map((a) => escapeHtml(a.label || a.name || a.email || ""))
      .filter(Boolean)
      .join("<br/>");
    if (list) {
      rows.push({ label: "Attendees", html: `<div class="calendar-event-attendees">${list}</div>` });
    }
  }
  if (ev.transparency) {
    const t = String(ev.transparency).toUpperCase();
    rows.push({
      label: "Show as",
      value: t === "TRANSPARENT" ? "Free" : t === "OPAQUE" ? "Busy" : ev.transparency,
    });
  }
  if (ev.visibility) rows.push({ label: "Visibility", value: ev.visibility });
  if (ev.priority != null && ev.priority !== "") {
    rows.push({ label: "Priority", value: String(ev.priority) });
  }
  if (ev.geo) rows.push({ label: "Location (coordinates)", value: ev.geo });
  if (ev.created) rows.push({ label: "Created", value: ev.created });
  if (ev.lastModified) rows.push({ label: "Modified", value: ev.lastModified });
  if (ev.dtstamp && ev.dtstamp !== ev.lastModified) rows.push({ label: "Stamp", value: ev.dtstamp });
  if (ev.sequence != null && ev.sequence !== "") rows.push({ label: "Sequence", value: String(ev.sequence) });

  let bodyHtml = "";
  for (const row of rows) {
    bodyHtml += `<div class="calendar-event-detail-row"><span class="calendar-event-detail-label">${escapeHtml(row.label)}</span>`;
    if (row.html) bodyHtml += `<div class="calendar-event-detail-value">${row.html}</div>`;
    else bodyHtml += `<div class="calendar-event-detail-value">${escapeHtml(row.value)}</div>`;
    bodyHtml += "</div>";
  }
  if (ev.description) {
    bodyHtml += `<div class="calendar-event-detail-row calendar-event-detail-description"><span class="calendar-event-detail-label">Description</span>`;
    bodyHtml += `<div class="calendar-event-detail-value calendar-event-detail-desc-text">${escapeHtml(ev.description)}</div></div>`;
  }
  if (!bodyHtml) bodyHtml = '<p class="calendar-event-detail-empty">No additional details.</p>';
  if (ev.uid) {
    bodyHtml += `<p class="calendar-event-detail-uid" title="Event UID">${escapeHtml(ev.uid)}</p>`;
  }
  bodyEl.innerHTML = bodyHtml;
  modal.classList.remove("hidden");
}

function closeCalendarEventModal() {
  $("#calendar-event-modal")?.classList.add("hidden");
}

function bindCalendarEventClicks(section, cal) {
  if (!section || section.dataset.calendarEventsBound) return;
  section.dataset.calendarEventsBound = "1";
  section.addEventListener("click", (e) => {
    const chip = e.target.closest(".calendar-event-chip");
    if (!chip) return;
    e.stopPropagation();
    const uid = chip.dataset.eventUid;
    const ev = findCalendarEventByUid(cal, uid);
    if (ev) openCalendarEventModal(ev, cal);
  });
}

function bindCalendarEventModal() {
  const modal = $("#calendar-event-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";
  $("#calendar-event-modal-close")?.addEventListener("click", closeCalendarEventModal);
  modal.querySelectorAll("[data-calendar-event-dismiss]").forEach((el) => {
    el.addEventListener("click", closeCalendarEventModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeCalendarEventModal();
  });
}

async function fetchCalendarFeed(feedUrl) {
  const q = new URLSearchParams({ url: feedUrl }).toString();
  const res = await fetch(`/api/calendar/feed?${q}`, { credentials: "same-origin" });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    const snippet = text.slice(0, 300) || res.statusText;
    if (res.status === 404 && /<!DOCTYPE/i.test(text)) {
      throw new Error(
        "Calendar API not found. Restart the dashboard server (./start.sh) so it loads the latest server.py."
      );
    }
    throw new Error(res.ok ? "Invalid JSON from server" : snippet);
  }
  if (!res.ok) throw new Error(parseApiError(body, res.status));
  return body;
}

async function loadCalendarForTile(cal, { quiet = false } = {}) {
  const tid = calendarTileId(cal);
  if (tileBodyCollapsed(tid)) {
    showTileCollapsedHint(tid, "Minimized — expand to load calendar");
    return;
  }
  const section = cal._el;
  if (section) section.classList.toggle("calendar-loading", true);
  try {
    const data = await fetchCalendarFeed(cal.feedUrl);
    state.calendarCache[tid] = {
      name: data.name,
      timezone: data.timezone,
      events: Array.isArray(data.events) ? data.events : [],
      fetchedAt: Date.now(),
    };
    if (data.name && (!cal.name || cal.name === "Calendar")) {
      cal.name = data.name;
      saveCalendarsToStorage();
      const nameInput = section?.querySelector(".calendar-tile-name");
      if (nameInput) nameInput.value = cal.name;
      if (section) section.dataset.tileLabel = cal.name;
    }
    if (!cal.timezone && data.timezone) {
      cal.timezone = data.timezone;
      saveCalendarsToStorage();
    }
    const tzSelect = section?.querySelector(".calendar-tz-select");
    if (tzSelect) {
      populateCalendarTimezoneSelect(tzSelect, resolveCalendarTimezone(cal));
    }
    if (section) renderCalendarMonthBody(section, cal);
  } catch (err) {
    if (!quiet) showToast(err.message, true);
    const body = section?.querySelector(".calendar-month-body");
    if (body) {
      body.innerHTML = `<p class="calendar-error">${escapeHtml(err.message || "Could not load calendar")}</p>`;
    }
    throw err;
  } finally {
    if (section) section.classList.remove("calendar-loading");
  }
}

function bindCalendarTileChrome(section, cal, tileId) {
  if (section.querySelector(":scope > .group-tile-bar")) return;

  const toolbar = document.createElement("div");
  toolbar.className = "tile-toolbar group-tile-bar calendar-tile-bar";
  toolbar.draggable = true;
  toolbar.dataset.tileId = tileId;

  const hint = document.createElement("span");
  hint.className = "tile-drag-hint";
  hint.textContent = "⋮⋮";
  hint.setAttribute("aria-hidden", "true");

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "group-tile-name calendar-tile-name";
  nameInput.placeholder = "Calendar label";
  nameInput.value = cal.name || "";
  nameInput.setAttribute("aria-label", "Calendar label");

  const countEl = document.createElement("span");
  countEl.className = "group-tile-count calendar-tile-count";
  countEl.textContent = "0 events";

  const nav = document.createElement("div");
  nav.className = "calendar-month-nav";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn btn-ghost btn-calendar-nav";
  prevBtn.textContent = "‹";
  prevBtn.title = "Previous month";
  const monthLabel = document.createElement("span");
  monthLabel.className = "calendar-month-label";
  monthLabel.textContent = calendarViewMonthLabel(cal);
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-ghost btn-calendar-nav";
  nextBtn.textContent = "›";
  nextBtn.title = "Next month";
  nav.appendChild(prevBtn);
  nav.appendChild(monthLabel);
  nav.appendChild(nextBtn);

  const tzWrap = document.createElement("label");
  tzWrap.className = "calendar-tz-label";
  const tzSelect = document.createElement("select");
  tzSelect.className = "calendar-tz-select";
  tzSelect.title = "Display timezone";
  tzSelect.setAttribute("aria-label", "Calendar timezone");
  populateCalendarTimezoneSelect(tzSelect, resolveCalendarTimezone(cal));
  tzWrap.appendChild(tzSelect);

  const removeBtn = createTileRemoveButton("Remove this calendar tile from the dashboard", "btn-remove-calendar");

  const { wrap, halfBtn, fullBtn, tallBtn } = createLayoutButtons();

  toolbar.appendChild(hint);
  toolbar.appendChild(nameInput);
  toolbar.appendChild(countEl);
  toolbar.appendChild(nav);
  toolbar.appendChild(tzWrap);
  toolbar.appendChild(removeBtn);
  toolbar.appendChild(wrap);

  section.prepend(toolbar);
  bindTileLayoutButtons(section, tileId, halfBtn, fullBtn, tallBtn);
  bindTileDragDrop(section, tileId, toolbar);
  attachTileCollapseButton(section, tileId);
  ensureTileAutoRefreshButton(section, tileId);

  const syncMonth = () => {
    monthLabel.textContent = calendarViewMonthLabel(cal);
    renderCalendarMonthBody(section, cal);
  };

  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    shiftCalendarViewMonth(cal, -1);
    syncMonth();
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    shiftCalendarViewMonth(cal, 1);
    syncMonth();
  });

  tzSelect.addEventListener("click", (e) => e.stopPropagation());
  tzSelect.addEventListener("change", (e) => {
    e.stopPropagation();
    cal.timezone = tzSelect.value;
    saveCalendarsToStorage();
    renderCalendarMonthBody(section, cal);
  });

  nameInput.addEventListener("input", () => {
    cal.name = nameInput.value;
    section.dataset.tileLabel = cal.name || "Calendar";
    saveCalendarsToStorage();
  });
  nameInput.addEventListener("change", () => {
    cal.name = nameInput.value.trim() || "Calendar";
    nameInput.value = cal.name;
    section.dataset.tileLabel = cal.name;
    saveCalendarsToStorage();
  });

  removeBtn.addEventListener("click", async () => {
    const label = cal.name?.trim() || "this calendar";
    const ok = await confirmDialog({
      title: "Remove calendar tile?",
      message: `Remove “${label}” from the dashboard?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    const tid = calendarTileId(cal);
    state.calendarTiles = state.calendarTiles.filter((c) => c.id !== cal.id);
    delete state.calendarCache[tid];
    state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
    delete state.tileLayout.widths[tid];
    delete state.tileLayout.heights[tid];
    saveCalendarsToStorage();
    saveLayoutToStorage();
    renderBoardGroups();
  });
}

function renderCalendarTiles(dash) {
  for (const cal of state.calendarTiles) {
    const tileId = calendarTileId(cal);
    const section = document.createElement("section");
    section.className = "dashboard-tile board-group board-group-tile calendar-tile";
    section.dataset.tileId = tileId;
    section.dataset.tileLabel = cal.name || "Calendar";
    section.dataset.calendarId = cal.id;
    section.innerHTML = `<div class="calendar-month-body"><p class="calendar-loading-hint">Loading calendar…</p></div>`;
    dash.appendChild(section);
    bindCalendarTileChrome(section, cal, tileId);
    cal._el = section;
    applyTileLayoutClasses(section, tileId);
    applyTileBodyCollapsed(section, tileId);
    const tid = calendarTileId(cal);
    if (tileBodyCollapsed(tileId)) {
      const body = section.querySelector(".calendar-month-body");
      if (body) {
        body.innerHTML =
          '<p class="tile-collapsed-hint">Minimized — expand to load calendar</p>';
      }
    } else if (state.calendarCache[tid]) {
      renderCalendarMonthBody(section, cal);
    } else {
      const body = section.querySelector(".calendar-month-body");
      if (body) body.innerHTML = '<p class="calendar-loading-hint">Loading calendar…</p>';
    }
  }
}

function stripNotesRuntimeFields(notes) {
  const { _el, _saveTimer, ...rest } = notes;
  return rest;
}

/** Fallback when CRM opportunity user-field definitions are not loaded yet. */
const CHECKLIST_FIELD_NAMES_FALLBACK = [
  "Measurement Report",
  "Insurance Documents",
  "Inspection Photos",
];

/** Checkbox user fields used for the “Missing Checklist info” card warning and Claim checklist preset. */
function opportunityChecklistFieldLabels() {
  if (!state.customFieldDefs.length) return [...CHECKLIST_FIELD_NAMES_FALLBACK];

  const defs = state.customFieldDefs;
  let inChecklistSection = false;
  const sectionLabels = [];

  for (const def of defs) {
    const label = customFieldLabel(def);
    const code = customFieldTypeCode(def);
    if (code === 4) {
      const key = normalizeUserFieldLabelKey(label);
      if (key.includes("checklist") || key.includes("claim")) {
        inChecklistSection = true;
        continue;
      }
      if (inChecklistSection) break;
      continue;
    }
    if (inChecklistSection && code === 3 && !isCreateOppExcludedUserField(def) && label) {
      sectionLabels.push(label);
    }
  }
  if (sectionLabels.length) return sectionLabels;

  const matched = [];
  for (const def of defs) {
    if (customFieldTypeCode(def) !== 3) continue;
    if (isCreateOppExcludedUserField(def)) continue;
    const label = customFieldLabel(def);
    if (!label) continue;
    if (CHECKLIST_FIELD_NAMES_FALLBACK.some((name) => fieldNameMatches(label, [name]))) {
      matched.push(label);
    }
  }
  if (matched.length) return matched;

  const checkboxes = [];
  for (const def of defs) {
    if (customFieldTypeCode(def) !== 3) continue;
    if (isCreateOppExcludedUserField(def)) continue;
    const label = customFieldLabel(def);
    if (label) checkboxes.push(label);
  }
  return checkboxes.length ? checkboxes : [...CHECKLIST_FIELD_NAMES_FALLBACK];
}

function notesClaimChecklistContent() {
  const lines = opportunityChecklistFieldLabels().map((label) => `- [ ] ${label}`);
  return `## Claim checklist\n\n${lines.join("\n")}\n`;
}

const NOTES_ADD_PRESETS = [
  { id: "blank", label: "Blank notes", name: "Notes", content: "" },
  { id: "daily", label: "Daily", name: "Daily", content: "## Today\n\n- [ ] \n" },
  { id: "followups", label: "Follow-ups", name: "Follow-ups", content: "## Follow-ups\n\n- [ ] \n" },
  { id: "week", label: "This week", name: "This week", content: "## This week\n\n- [ ] \n" },
  { id: "checklist", label: "Claim checklist", name: "Claim checklist", content: null },
];

function notesPresetContent(preset) {
  if (!preset) return "";
  if (preset.id === "checklist") return notesClaimChecklistContent();
  return preset.content || "";
}

const NOTES_ACCENT_OPTIONS = [
  { value: "", label: "No accent" },
  { value: "#5b8def", label: "Blue" },
  { value: "#3d9a6a", label: "Green" },
  { value: "#c9a227", label: "Gold" },
  { value: "#c45c5c", label: "Red" },
  { value: "#9b7ed9", label: "Purple" },
];

function newNotesTile(overrides = {}) {
  const base = {
    id: crypto.randomUUID(),
    name: "Notes",
    content: "",
    viewMode: "edit",
    defaultViewMode: null,
    accent: "",
    updatedAt: null,
  };
  const merged = { ...base, ...overrides };
  if (merged.defaultViewMode !== "preview" && merged.defaultViewMode !== "edit") {
    merged.defaultViewMode = null;
  }
  return merged;
}

function activeNotesTiles() {
  return state.notesTiles.filter((n) => !n.archived);
}

function archivedNotesTiles() {
  return state.notesTiles.filter((n) => n.archived);
}

async function archiveNotesTile(notes) {
  const label = notes.name?.trim() || "this notes tile";
  const ok = await confirmDialog({
    title: "Archive notes tile?",
    message: `Archive “${label}”? It will be hidden from the dashboard. Restore its text later from File → Restore from archive on any notes tile.`,
    confirmLabel: "Archive",
    danger: false,
  });
  if (!ok) return;
  notes.archived = true;
  notes.archivedAt = new Date().toISOString();
  touchNotesTile(notes);
  const tid = notesTileId(notes);
  state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
  delete state.tileLayout.widths[tid];
  delete state.tileLayout.heights[tid];
  delete state.tileLayout.collapsed?.[tid];
  saveLayoutToStorage();
  scheduleUserProfileSave();
  renderBoardGroups();
  showToast("Notes tile archived");
}

function applyArchivedNotesContentToTile(targetNotes, archived) {
  if (!targetNotes || !archived) return;
  targetNotes.content = archived.content || "";
  touchNotesTile(targetNotes);
  scheduleNotesTileSave(targetNotes);
  if (targetNotes._el) {
    syncNotesTileBody(targetNotes._el, targetNotes);
  }
  showToast(`Loaded archive from “${archived.name?.trim() || "Notes"}”`);
}

function openNotesRestoreFromArchiveModal(targetNotes) {
  const modal = $("#notes-archive-restore-modal");
  const list = $("#notes-archive-restore-list");
  if (!modal || !list) return;

  const archived = archivedNotesTiles().sort((a, b) => {
    const ta = new Date(a.archivedAt || 0).getTime();
    const tb = new Date(b.archivedAt || 0).getTime();
    return tb - ta;
  });

  list.innerHTML = "";
  if (!archived.length) {
    list.innerHTML = `<li class="notes-archive-restore-empty">No archived notes yet. Use File → Archive to save a tile to the archive.</li>`;
  } else {
    for (const entry of archived) {
      const li = document.createElement("li");
      li.className = "notes-archive-restore-item";
      const meta = document.createElement("button");
      meta.type = "button";
      meta.className = "notes-archive-restore-pick";
      const title = entry.name?.trim() || "Notes";
      const when = entry.archivedAt ? new Date(entry.archivedAt).toLocaleString() : "Unknown date";
      meta.innerHTML = `<span class="notes-archive-restore-name">${escapeHtml(title)}</span><span class="notes-archive-restore-date">${escapeHtml(when)}</span>`;
      meta.addEventListener("click", () => {
        applyArchivedNotesContentToTile(targetNotes, entry);
        closeNotesRestoreFromArchiveModal();
      });
      li.appendChild(meta);
      list.appendChild(li);
    }
  }

  modal.classList.remove("hidden");
  modal.dataset.targetNotesId = targetNotes.id;
}

function closeNotesRestoreFromArchiveModal() {
  const modal = $("#notes-archive-restore-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  delete modal.dataset.targetNotesId;
}

function bindNotesArchiveRestoreModal() {
  const modal = $("#notes-archive-restore-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";
  $("#notes-archive-restore-close")?.addEventListener("click", closeNotesRestoreFromArchiveModal);
  modal.querySelectorAll("[data-notes-archive-dismiss]").forEach((el) => {
    el.addEventListener("click", closeNotesRestoreFromArchiveModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeNotesRestoreFromArchiveModal();
    }
  });
}

function applyNotesDefaultViewOnLoad(notes) {
  if (notes.defaultViewMode === "preview") notes.viewMode = "preview";
  else if (notes.defaultViewMode === "edit") notes.viewMode = "edit";
}

function notesFilenameSafe(name) {
  return (
    String(name || "notes")
      .trim()
      .replace(/[^\w.\- ]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "notes"
  );
}

function notesTextStats(text) {
  const s = String(text || "");
  const words = s.trim() ? s.trim().split(/\s+/).length : 0;
  return { chars: s.length, words };
}

function formatNotesDateStamp() {
  const d = new Date();
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return d.toLocaleString();
  }
}

function formatNotesUpdatedLabel(iso) {
  if (!iso) return "Not saved yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function syncNotesUpdatedFooter(section, notes) {
  if (!section) return;
  const footer = $(".notes-tile-footer", section);
  const label = $(".notes-updated-label", section);
  const statsEl = $(".notes-stats-label", section);
  if (!footer || !label) return;
  const text = formatNotesUpdatedLabel(notes.updatedAt);
  label.textContent = text ? `Last updated ${text}` : "Not saved yet";
  footer.title = text ? `Last saved to server: ${text}` : "Saves automatically to the server";
  if (statsEl) {
    const { words, chars } = notesTextStats(notes.content);
    statsEl.textContent = `${words} words · ${chars} characters`;
  }
}

function touchNotesTile(notes) {
  notes.updatedAt = new Date().toISOString();
  syncNotesUpdatedFooter(notes._el, notes);
}

function buildUserProfilePayload() {
  const slimGroups = state.groups.map((g) => {
    const { opportunities, ...rest } = stripGroupRuntimeFields(g);
    return rest;
  });
  return {
    updatedAt: new Date().toISOString(),
    groups: slimGroups,
    tileLayout: state.tileLayout,
    calendarTiles: state.calendarTiles.map((c) => stripCalendarRuntimeFields(c)),
    notesTiles: state.notesTiles.map((n) => stripNotesRuntimeFields(n)),
    groupTemplates: state.groupTemplates,
    hiddenFeedKeys: serializeHiddenFeedEntries(),
    feedKeywordFilter: state.feedKeywordFilter || "",
  };
}

function applyUserProfile(profile) {
  if (!profile || typeof profile !== "object") return;

  const groups = Array.isArray(profile.groups) ? profile.groups : [];
  state.groups = groups.length
    ? groups.map((g) => ({ ...newGroup(), ...stripGroupRuntimeFields(g), opportunities: [] }))
    : loadGroupsFromStorage().map((g) => ({ ...newGroup(), ...stripGroupRuntimeFields(g), opportunities: [] }));

  const layout = profile.tileLayout;
  if (layout && typeof layout === "object") {
    state.tileLayout = {
      order: Array.isArray(layout.order) ? layout.order : [],
      widths: layout.widths && typeof layout.widths === "object" ? layout.widths : {},
      heights: layout.heights && typeof layout.heights === "object" ? layout.heights : {},
      collapsed: layout.collapsed && typeof layout.collapsed === "object" ? layout.collapsed : {},
    };
  } else {
    state.tileLayout = loadLayoutFromStorage();
  }

  state.calendarTiles = Array.isArray(profile.calendarTiles)
    ? profile.calendarTiles.map((c) => ({ ...newCalendarTile(), ...stripCalendarRuntimeFields(c) }))
    : [];

  state.notesTiles = Array.isArray(profile.notesTiles)
    ? profile.notesTiles.map((n) => ({ ...newNotesTile(), ...stripNotesRuntimeFields(n) }))
    : [];

  state.groupTemplates = Array.isArray(profile.groupTemplates) ? profile.groupTemplates : [];
}

function persistProfileToLocalStorage() {
  const payload = buildUserProfilePayload();
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(payload.groups));
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload.tileLayout));
  localStorage.setItem(CALENDARS_STORAGE_KEY, JSON.stringify(payload.calendarTiles));
  localStorage.setItem(NOTES_TILES_STORAGE_KEY, JSON.stringify(payload.notesTiles));
  localStorage.setItem(GROUP_TEMPLATES_STORAGE_KEY, JSON.stringify(payload.groupTemplates));
  localStorage.setItem(HIDDEN_FEED_STORAGE_KEY, JSON.stringify(payload.hiddenFeedKeys));
  localStorage.setItem(FEED_KEYWORD_STORAGE_KEY, payload.feedKeywordFilter);
}

function profileHasDashboardData(profile) {
  if (!profile) return false;
  return (
    (Array.isArray(profile.groups) && profile.groups.length > 0) ||
    (Array.isArray(profile.calendarTiles) && profile.calendarTiles.length > 0) ||
    (Array.isArray(profile.notesTiles) && profile.notesTiles.length > 0) ||
    (Array.isArray(profile.tileLayout?.order) && profile.tileLayout.order.length > 0)
  );
}

function loadLocalUserProfileBundle() {
  return {
    groups: loadGroupsFromStorage(),
    tileLayout: loadLayoutFromStorage(),
    calendarTiles: loadCalendarsFromStorage(),
    notesTiles: loadNotesTilesFromStorage(),
    groupTemplates: loadGroupTemplates(),
    hiddenFeedKeys: hiddenFeedEntriesToPayload(loadHiddenFeedEntriesFromStorage()),
    feedKeywordFilter: localStorage.getItem(FEED_KEYWORD_STORAGE_KEY) || "",
  };
}

async function loadUserProfileFromServer() {
  userProfileReady = false;
  let serverProfile = null;
  try {
    const headers = { Accept: "application/json" };
    if (state.portalUrl) headers["X-OnlyOffice-Portal"] = state.portalUrl;
    const res = await fetch("/api/user-profile", { credentials: "same-origin", headers });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && typeof data === "object") serverProfile = data;
  } catch {
    /* fall back */
  }

  const localBundle = loadLocalUserProfileBundle();

  if (profileHasDashboardData(serverProfile)) {
    applyUserProfile(serverProfile);
    persistProfileToLocalStorage();
  } else if (
    localBundle.groups.length ||
    localBundle.calendarTiles.length ||
    localBundle.notesTiles.length ||
    localBundle.tileLayout?.order?.length
  ) {
    applyUserProfile(localBundle);
    try {
      await saveUserProfileToServer({ quiet: true });
    } catch {
      /* keep local */
    }
    persistProfileToLocalStorage();
  } else {
    applyUserProfile({
      groups: [
        newGroup({ name: "Open pipeline", dealStatus: "open", groupBy: "stage" }),
        newGroup({ name: "Tagged deals", dealStatus: "all", groupBy: "tag", tagTitles: [] }),
      ],
      tileLayout: { order: [], widths: {}, heights: {}, collapsed: {} },
      calendarTiles: [],
      notesTiles: [],
      groupTemplates: [],
    });
    persistProfileToLocalStorage();
  }

  if (serverProfile) applyFeedUserPreferences(serverProfile);
  else applyFeedUserPreferences(localBundle);

  userProfileReady = true;
}

async function saveUserProfileToServer({ quiet = false } = {}) {
  if (!userProfileReady) return;
  persistProfileToLocalStorage();
  try {
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (state.portalUrl) headers["X-OnlyOffice-Portal"] = state.portalUrl;
    const res = await fetch("/api/user-profile", {
      method: "PUT",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(buildUserProfilePayload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not save dashboard settings");
    if (Array.isArray(data.notesTiles)) {
      const byId = new Map(data.notesTiles.map((t) => [t.id, t]));
      for (const n of state.notesTiles) {
        const saved = byId.get(n.id);
        if (saved?.updatedAt) {
          n.updatedAt = saved.updatedAt;
          syncNotesUpdatedFooter(n._el, n);
        }
      }
    }
  } catch (err) {
    if (!quiet) showToast(err.message, true);
    throw err;
  }
}

function scheduleUserProfileSave() {
  if (!userProfileReady) return;
  if (profileSaveTimer) clearTimeout(profileSaveTimer);
  profileSaveTimer = setTimeout(() => {
    profileSaveTimer = null;
    saveUserProfileToServer({ quiet: true }).catch(() => {});
  }, 800);
}

function loadNotesTilesFromStorage() {
  try {
    const raw = localStorage.getItem(NOTES_TILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((n) => stripNotesRuntimeFields(n));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveNotesTilesToStorage() {
  const slim = state.notesTiles.map((n) => stripNotesRuntimeFields(n));
  localStorage.setItem(NOTES_TILES_STORAGE_KEY, JSON.stringify(slim));
  scheduleUserProfileSave();
}

function renderBasicMarkdown(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let inUl = false;
  let inOl = false;
  let inCheck = false;

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
    if (inCheck) {
      out.push("</ul>");
      inCheck = false;
    }
  };

  const inlineFormat = (raw) => {
    let s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
      const href = escapeHtml(url.trim());
      if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) return escapeHtml(label);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    });
    s = s.replace(
      /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/gi,
      (url) =>
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
    );
    return s;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    const compact = trimmed.trim();
    if (!compact) {
      closeLists();
      continue;
    }
    if (/^---+$/.test(compact) || /^\*\*\*+$/.test(compact)) {
      closeLists();
      out.push('<hr class="notes-md-hr" />');
      continue;
    }
    const hm = compact.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      closeLists();
      const level = hm[1].length;
      out.push(`<h${level} class="notes-md-h${level}">${inlineFormat(hm[2])}</h${level}>`);
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      closeLists();
      out.push(`<blockquote class="notes-md-quote">${inlineFormat(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    const checkm = compact.match(/^-\s+\[([ xX])\]\s*(.*)$/);
    if (checkm) {
      if (!inCheck) {
        closeLists();
        out.push('<ul class="notes-md-checklist">');
        inCheck = true;
      }
      const checked = checkm[1].toLowerCase() === "x";
      const body = checkm[2] || "";
      out.push(
        `<li class="notes-md-check-item" data-line="${i}"><label class="notes-md-check-label"><input type="checkbox" class="notes-md-check-input" data-line="${i}"${checked ? " checked" : ""} /><span class="notes-md-check-text">${inlineFormat(body) || "&nbsp;"}</span></label></li>`
      );
      continue;
    }
    const ulm = compact.match(/^[-*+]\s+(.+)$/);
    if (ulm) {
      if (!inUl) {
        closeLists();
        out.push('<ul class="notes-md-list">');
        inUl = true;
      }
      out.push(`<li>${inlineFormat(ulm[1])}</li>`);
      continue;
    }
    const olm = compact.match(/^\d+\.\s+(.+)$/);
    if (olm) {
      if (!inOl) {
        closeLists();
        out.push('<ol class="notes-md-list">');
        inOl = true;
      }
      out.push(`<li>${inlineFormat(olm[1])}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${inlineFormat(compact)}</p>`);
  }
  closeLists();
  return out.join("") || '<p class="notes-md-empty">Nothing to preview yet.</p>';
}

function toggleNotesCheckboxLine(notes, lineIndex, checked) {
  const lines = String(notes.content || "").split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return false;
  const line = lines[lineIndex];
  const m = line.match(/^(\s*-\s+\[)[ xX](\]\s*.*)$/);
  if (!m) return false;
  lines[lineIndex] = `${m[1]}${checked ? "x" : " "}${m[2]}`;
  notes.content = lines.join("\n");
  return true;
}

function insertNotesEditorText(editor, insert) {
  if (!editor) return;
  const start = editor.selectionStart ?? editor.value.length;
  const end = editor.selectionEnd ?? start;
  const val = editor.value;
  editor.value = val.slice(0, start) + insert + val.slice(end);
  const pos = start + insert.length;
  editor.selectionStart = editor.selectionEnd = pos;
  editor.focus();
}

function downloadNotesFile(notes, ext) {
  const body = notes.content || "";
  const type = ext === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${notesFilenameSafe(notes.name)}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Downloaded .${ext}`);
}

function printNotesPreview(section, notes) {
  const preview = $(".notes-preview", section);
  if (!preview) return;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    showToast("Allow pop-ups to print", true);
    return;
  }
  const title = escapeHtml(notes.name || "Notes");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:1.25rem;color:#111;}
h1{font-size:1.25rem;margin:0 0 1rem;}
hr{border:none;border-top:1px solid #ccc;margin:1rem 0;}
ul,ol{margin:0.35rem 0 0.35rem 1.25rem;}
del{opacity:0.65;}
code{background:#f0f0f0;padding:0.1em 0.3em;border-radius:3px;}
blockquote{border-left:3px solid #ccc;margin:0.5rem 0;padding-left:0.75rem;color:#444;}
.notes-md-checklist{list-style:none;padding-left:0;}
.notes-md-check-label{display:flex;gap:0.5rem;align-items:flex-start;}
@media print{body{margin:0.75rem;}}
</style></head><body>
<h1>${title}</h1>
${preview.innerHTML}
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

async function copyNotesClipboard(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMessage || "Copied to clipboard");
  } catch {
    showToast("Could not copy to clipboard", true);
  }
}

async function openQuickNoteModalFromNotes(notes) {
  await openQuickNoteModal();
  const bodyEl = $("#quick-note-note-body");
  if (bodyEl && notes.content) bodyEl.value = notes.content;
}

function applyNotesTileAccent(section, notes) {
  const accent = String(notes.accent || "").trim();
  if (accent) {
    section.dataset.accent = "1";
    section.style.setProperty("--notes-accent", accent);
  } else {
    delete section.dataset.accent;
    section.style.removeProperty("--notes-accent");
  }
}

function duplicateNotesTile(notes) {
  const copy = newNotesTile({
    name: `${notes.name || "Notes"} (copy)`,
    content: notes.content || "",
    viewMode: notes.viewMode,
    defaultViewMode: notes.defaultViewMode,
    accent: notes.accent || "",
    updatedAt: new Date().toISOString(),
  });
  state.notesTiles.push(copy);
  const tid = notesTileId(copy);
  if (!state.tileLayout.order.includes(tid)) state.tileLayout.order.push(tid);
  saveLayoutToStorage();
  scheduleUserProfileSave();
  renderBoardGroups();
  showToast("Notes tile duplicated");
}

async function removeNotesTile(notes) {
  const label = notes.name?.trim() || "this notes tile";
  const ok = await confirmDialog({
    title: "Remove notes tile?",
    message: `Remove “${label}” from the dashboard? This cannot be undone.`,
    confirmLabel: "Remove",
    danger: true,
  });
  if (!ok) return;
  const tid = notesTileId(notes);
  state.notesTiles = state.notesTiles.filter((n) => n.id !== notes.id);
  state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
  delete state.tileLayout.widths[tid];
  delete state.tileLayout.heights[tid];
  delete state.tileLayout.collapsed?.[tid];
  saveLayoutToStorage();
  scheduleUserProfileSave();
  renderBoardGroups();
  showToast("Notes tile removed");
}

function bindNotesPreviewInteractions(section, notes) {
  if (!section || section.dataset.notesCheckBound) return;
  section.dataset.notesCheckBound = "1";
  section.addEventListener("change", (e) => {
    const cb = e.target.closest(".notes-md-check-input");
    if (!cb || !section.contains(cb)) return;
    const lineIndex = Number(cb.dataset.line);
    if (!Number.isFinite(lineIndex)) return;
    const editor = $(".notes-editor", section);
    if (toggleNotesCheckboxLine(notes, lineIndex, cb.checked)) {
      if (editor) editor.value = notes.content;
      scheduleNotesTileSave(notes);
      syncNotesTileBody(section, notes);
    }
  });
}

function scheduleNotesTileSave(notes) {
  touchNotesTile(notes);
  saveNotesTilesToStorage();
}

function syncNotesTileBody(section, notes) {
  const editor = $(".notes-editor", section);
  const preview = $(".notes-preview", section);
  if (!editor || !preview) return;
  const isPreview = notes.viewMode === "preview";
  editor.classList.toggle("hidden", isPreview);
  preview.classList.toggle("hidden", !isPreview);
  if (!isPreview) {
    if (editor.value !== notes.content) editor.value = notes.content || "";
  } else {
    preview.innerHTML = renderBasicMarkdown(notes.content);
  }
}

function bindNotesTileChrome(section, notes, tileId) {
  if (section.querySelector(":scope > .group-tile-bar")) return;

  const toolbar = document.createElement("div");
  toolbar.className = "tile-toolbar group-tile-bar notes-tile-bar";
  toolbar.draggable = true;
  toolbar.dataset.tileId = tileId;

  const hint = document.createElement("span");
  hint.className = "tile-drag-hint";
  hint.textContent = "⋮⋮";
  hint.setAttribute("aria-hidden", "true");

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "group-tile-name notes-tile-name";
  nameInput.placeholder = "Notes label";
  nameInput.value = notes.name || "";
  nameInput.setAttribute("aria-label", "Notes label");

  const utils = document.createElement("div");
  utils.className = "notes-tile-utils";

  const mkTextBtn = (label, className, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn btn-ghost ${className}`;
    b.textContent = label;
    if (title) b.title = title;
    return b;
  };

  const fileMenu = createTileMenu({
    label: "File",
    className: "btn-notes-file-menu",
    items: [
      {
        label: "Save as .txt",
        onSelect: () => downloadNotesFile(notes, "txt"),
      },
      {
        label: "Save as .md",
        onSelect: () => downloadNotesFile(notes, "md"),
      },
      {
        label: "Archive",
        onSelect: () => {
          archiveNotesTile(notes).catch((err) => showToast(err.message, true));
        },
      },
      {
        label: "Restore from archive…",
        onSelect: () => openNotesRestoreFromArchiveModal(notes),
      },
      {
        label: "Duplicate",
        onSelect: () => duplicateNotesTile(notes),
      },
    ],
  });

  const copyBtn = createTileIconActionButton(
    TILE_ICON_COPY,
    "Copy selection, or all if nothing selected",
    "btn-notes-copy"
  );
  const dateBtn = createTileIconActionButton(
    TILE_ICON_CALENDAR,
    "Insert date and time at cursor",
    "btn-notes-date"
  );
  const printBtn = createTileIconActionButton(TILE_ICON_PRINT, "Print preview", "btn-notes-print");
  const crmBtn = createTileIconActionButton(
    TILE_ICON_NOTE,
    "Open quick note with this text",
    "btn-notes-quick-note"
  );

  const editBtn = mkTextBtn("Edit", "btn-notes-mode", "Edit mode");
  editBtn.dataset.mode = "edit";
  const previewBtn = mkTextBtn("Preview", "btn-notes-mode", "Preview mode");
  previewBtn.dataset.mode = "preview";

  const defaultPreviewBtn = createTileIconActionButton(
    TILE_ICON_PIN,
    "Always open this tile in preview on load",
    "btn-notes-default-preview btn-notes-pin"
  );

  const accentSel = document.createElement("select");
  accentSel.className = "notes-accent-select";
  accentSel.title = "Tile accent color";
  accentSel.setAttribute("aria-label", "Accent color");
  for (const opt of NOTES_ACCENT_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    accentSel.appendChild(o);
  }
  accentSel.value = notes.accent || "";

  const { wrap, quarterBtn, halfBtn, fullBtn, tallBtn } = createLayoutButtons({
    showDoubleHeight: true,
    showQuarterWidth: true,
  });

  utils.append(
    fileMenu,
    copyBtn,
    dateBtn,
    printBtn,
    crmBtn,
    accentSel,
    defaultPreviewBtn,
    editBtn,
    previewBtn
  );

  const removeBtn = createTileRemoveButton("Remove this notes tile from the dashboard", "btn-remove-notes");

  toolbar.appendChild(hint);
  toolbar.appendChild(nameInput);
  toolbar.appendChild(utils);
  toolbar.appendChild(removeBtn);
  toolbar.appendChild(wrap);

  section.prepend(toolbar);
  bindTileLayoutButtons(section, tileId, halfBtn, fullBtn, tallBtn, quarterBtn);
  bindTileDragDrop(section, tileId, toolbar);
  attachTileCollapseButton(section, tileId);
  bindNotesPreviewInteractions(section, notes);

  const syncModeButtons = () => {
    const isPreview = notes.viewMode === "preview";
    editBtn.classList.toggle("tile-btn-active", !isPreview);
    previewBtn.classList.toggle("tile-btn-active", isPreview);
    defaultPreviewBtn.classList.toggle("tile-btn-active", notes.defaultViewMode === "preview");
    syncNotesTileBody(section, notes);
    syncNotesUpdatedFooter(section, notes);
  };

  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    let text = notes.content || "";
    let msg = "Copied all";
    if (editor && notes.viewMode !== "preview") {
      const start = editor.selectionStart ?? 0;
      const end = editor.selectionEnd ?? 0;
      if (end > start) {
        text = editor.value.slice(start, end);
        msg = "Copied selection";
      }
    }
    await copyNotesClipboard(text, msg);
  });

  dateBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    const stamp = formatNotesDateStamp();
    if (editor && notes.viewMode !== "preview") {
      insertNotesEditorText(editor, stamp);
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    } else {
      notes.content = `${notes.content || ""}${notes.content ? "\n" : ""}${stamp}\n`;
      scheduleNotesTileSave(notes);
      syncNotesTileBody(section, notes);
    }
  });

  printBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (notes.viewMode !== "preview") {
      notes.viewMode = "preview";
      saveNotesTilesToStorage();
      syncModeButtons();
    }
    printNotesPreview(section, notes);
  });

  crmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openQuickNoteModalFromNotes(notes).catch((err) => showToast(err.message, true));
  });

  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeNotesTile(notes);
  });

  defaultPreviewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notes.defaultViewMode = notes.defaultViewMode === "preview" ? null : "preview";
    if (notes.defaultViewMode === "preview") notes.viewMode = "preview";
    scheduleNotesTileSave(notes);
    syncModeButtons();
    showToast(
      notes.defaultViewMode === "preview"
        ? "Will open in preview on load"
        : "Default preview on load off"
    );
  });

  accentSel.addEventListener("click", (e) => e.stopPropagation());
  accentSel.addEventListener("change", (e) => {
    e.stopPropagation();
    notes.accent = accentSel.value;
    applyNotesTileAccent(section, notes);
    scheduleNotesTileSave(notes);
  });

  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notes.viewMode = "edit";
    saveNotesTilesToStorage();
    syncModeButtons();
    $(".notes-editor", section)?.focus();
  });

  previewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notes.viewMode = "preview";
    saveNotesTilesToStorage();
    syncModeButtons();
  });

  nameInput.addEventListener("input", () => {
    notes.name = nameInput.value;
    section.dataset.tileLabel = notes.name || "Notes";
    scheduleNotesTileSave(notes);
  });
  nameInput.addEventListener("change", () => {
    notes.name = nameInput.value.trim() || "Notes";
    nameInput.value = notes.name;
    section.dataset.tileLabel = notes.name;
    scheduleNotesTileSave(notes);
  });

  const editor = $(".notes-editor", section);
  editor?.addEventListener("input", () => {
    notes.content = editor.value;
    scheduleNotesTileSave(notes);
  });

  applyNotesTileAccent(section, notes);
  syncModeButtons();
}

function renderNotesTiles(dash) {
  for (const notes of activeNotesTiles()) {
    applyNotesDefaultViewOnLoad(notes);
    const tileId = notesTileId(notes);
    const section = document.createElement("section");
    section.className = "dashboard-tile board-group board-group-tile notes-tile";
    section.dataset.tileId = tileId;
    section.dataset.tileLabel = notes.name || "Notes";
    section.dataset.notesId = notes.id;
    section.innerHTML = `
      <div class="notes-tile-body">
        <textarea class="notes-editor" placeholder="Notes &amp; to-dos — **bold**, *italic*, ~~strike~~, \`code\`, # headings, - [ ] tasks, --- rules, URLs auto-link" spellcheck="true"></textarea>
        <div class="notes-preview hidden" aria-live="polite"></div>
        <div class="notes-tile-footer" aria-live="polite">
          <span class="notes-stats-label"></span>
          <span class="notes-updated-label"></span>
        </div>
      </div>
    `;
    dash.appendChild(section);
    bindNotesTileChrome(section, notes, tileId);
    notes._el = section;
    const editor = $(".notes-editor", section);
    if (editor) editor.value = notes.content || "";
    syncNotesTileBody(section, notes);
    syncNotesUpdatedFooter(section, notes);
    applyTileLayoutClasses(section, tileId);
    applyTileBodyCollapsed(section, tileId);
  }
}

function normalizeTagTitle(tag) {
  if (tag == null) return "";
  if (typeof tag === "string") return tag.trim();
  return String(tag.title ?? tag.Title ?? tag.name ?? tag.Name ?? "").trim();
}

function buildTagCatalog() {
  const byTitleLower = new Map();
  const byId = new Map();
  for (const tag of state.allTags) {
    const title = normalizeTagTitle(tag.title ?? tag);
    const id = tag.id ?? tag.ID ?? tag.Id;
    if (title) byTitleLower.set(title.toLowerCase(), { title, id });
    if (id != null) byId.set(String(id), { title, id });
  }
  return { byTitleLower, byId };
}

function tagLookupKey(value, catalog) {
  const raw = normalizeTagTitle(value);
  if (!raw) return "";
  if (catalog?.byId?.has(raw)) {
    return catalog.byId.get(raw).title.toLowerCase();
  }
  const lower = raw.toLowerCase();
  if (catalog?.byTitleLower?.has(lower)) return lower;
  return lower;
}

function tagsEqual(a, b, catalog = buildTagCatalog()) {
  const x = tagLookupKey(a, catalog);
  const y = tagLookupKey(b, catalog);
  return x && y && x === y;
}

function getOppTagsFromRecord(opp) {
  const titles = new Set();
  const add = (t) => {
    const n = normalizeTagTitle(t);
    if (n) titles.add(n);
  };

  const sources = [
    opp.tags,
    opp.Tags,
    opp.tagList,
    opp.TagList,
    opp.tag,
    opp.Tag,
    opp.linkTags,
    opp.LinkTags,
    opp.tagsInfo,
    opp.TagsInfo,
    opp.tagAccessories,
    opp.TagAccessories,
  ];

  for (const raw of sources) {
    if (!raw) continue;
    if (Array.isArray(raw)) {
      for (const t of raw) add(t);
    } else if (typeof raw === "string") {
      raw.split(",").forEach(add);
    } else if (typeof raw === "object") {
      add(raw);
    }
  }

  return [...titles];
}

function getOppTags(opp) {
  return getOppTagsFromRecord(opp);
}

function oppHasTag(opp, tagTitle, catalog = buildTagCatalog()) {
  return getOppTagsFromRecord(opp).some((t) => tagsEqual(t, tagTitle, catalog));
}

function oppMatchesSelectedTags(opp, selectedTags, catalog = buildTagCatalog()) {
  if (!selectedTags?.length) return true;
  return selectedTags.some((sel) => oppHasTag(opp, sel, catalog));
}

async function enrichOpportunitiesTags(items) {
  const needTags = items.filter((o) => getOppTagsFromRecord(o).length === 0);
  const concurrency = 12;
  for (let i = 0; i < needTags.length; i += concurrency) {
    const chunk = needTags.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (opp) => {
        const id = opp.id ?? opp.ID;
        if (id == null) return;
        try {
          const tags = unwrapEntityTags(await api(`/api/2.0/crm/opportunity/tag/${id}`));
          if (tags.length) opp.tags = tags;
        } catch {
          /* no tags on this deal */
        }
      })
    );
  }
  return items;
}

async function fetchOpportunitiesForGroup(group) {
  const baseQs = buildFilterQuery(group);
  const catalog = buildTagCatalog();
  const data = await api(`/api/2.0/crm/opportunity/filter?${baseQs}`);
  let items = unwrap(data);

  if (group.tagTitles?.length || group.groupBy === "tag") {
    items = await enrichOpportunitiesTags(items);
  }

  if (group.tagTitles?.length) {
    items = items.filter((o) => oppMatchesSelectedTags(o, group.tagTitles, catalog));
  }

  if (group.showOnlyRedOpportunities) {
    items = items.filter(isRedOpportunity);
  }

  return items;
}

function opportunityDueDateRaw(opp) {
  return (
    opp.expectedCloseDate?.value ??
    opp.expectedCloseDate ??
    opp.ExpectedCloseDate?.value ??
    opp.ExpectedCloseDate ??
    null
  );
}

function oppDueDateMs(opp) {
  return new Date(opportunityDueDateRaw(opp) || 0).getTime();
}

function formatOppDueLabel(opp) {
  const raw = opportunityDueDateRaw(opp);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dueDateToInputValue(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toApiExpectedCloseDate(dateInputValue) {
  if (!dateInputValue) return null;
  const d = new Date(`${dateInputValue}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** CRM ApiDateTime values in PUT bodies are ISO strings (see OnlyOffice community examples). */
function crmDateTimeFromApi(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") return raw.value ?? raw.Value ?? null;
  return String(raw);
}

function serializeCrmTimestamp(dateInputValue) {
  if (!dateInputValue) return null;
  const d = new Date(`${dateInputValue}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function fetchOpportunityForUpdate(oppId) {
  const data = await api(`/api/2.0/crm/opportunity/${oppId}`);
  return data?.response ?? data?.result ?? data;
}

function buildOpportunityPutBody(opp, overrides = {}) {
  const oppId = Number(opp.id ?? opp.ID);
  const members = [];
  if (Array.isArray(opp.members)) {
    for (const m of opp.members) {
      const mid = m.id ?? m.ID;
      if (mid != null) members.push(Number(mid));
    }
  }

  const accessList = [];
  if (Array.isArray(opp.accessList)) {
    for (const u of opp.accessList) {
      const uid = u.id ?? u.ID;
      if (uid != null) accessList.push(String(uid));
    }
  }

  const responsible = opp.responsible?.id ?? opp.responsible?.ID ?? state.currentUserId;

  const body = {
    opportunityid: oppId,
    contactid: Number(opp.contact?.id ?? opp.contact?.ID ?? opp.contactId ?? 0) || 0,
    members,
    title: opp.title || opp.Title || "",
    description: opp.description ?? opp.Description ?? "",
    responsibleid: String(responsible || ""),
    bidType: Number(opp.bidType ?? opp.BidType ?? 0),
    bidValue: Number(opp.bidValue ?? opp.BidValue ?? 0),
    bidCurrencyAbbr:
      opp.bidCurrency?.abbreviation ?? opp.bidCurrency?.Abbreviation ?? opp.bidCurrencyAbbr ?? "USD",
    perPeriodValue: Number(opp.perPeriodValue ?? opp.PerPeriodValue ?? 1),
    stageid: Number(opp.stage?.id ?? opp.stage?.ID ?? opp.stageId ?? 0),
    successProbability: Number(
      opp.successProbability ?? opp.SuccessProbability ?? opp.stage?.successProbability ?? 0
    ),
    actualCloseDate: crmDateTimeFromApi(opp.actualCloseDate ?? opp.ActualCloseDate),
    expectedCloseDate: crmDateTimeFromApi(opp.expectedCloseDate ?? opp.ExpectedCloseDate),
    isPrivate: !!(opp.isPrivate ?? opp.IsPrivate),
    accessList,
    isNotify: false,
  };

  if (overrides.expectedCloseDate !== undefined) body.expectedCloseDate = overrides.expectedCloseDate;
  if (overrides.stageid !== undefined) body.stageid = overrides.stageid;
  if (overrides.successProbability !== undefined) {
    body.successProbability = overrides.successProbability;
  }
  return body;
}

async function updateOpportunityDueDate(oppId, dateInputValue) {
  const opp = await fetchOpportunityForUpdate(oppId);
  const body = buildOpportunityPutBody(opp, {
    expectedCloseDate: dateInputValue ? serializeCrmTimestamp(dateInputValue) : null,
  });
  await api(`/api/2.0/crm/opportunity/${oppId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function updateOpportunityStage(oppId, stageId) {
  const sid = Number(stageId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("Invalid stage");

  const stage = state.stages.find((s) => Number(s.id ?? s.ID) === sid);
  const opp = await fetchOpportunityForUpdate(oppId);
  const overrides = { stageid: sid };
  const stageProb = stage?.successProbability ?? stage?.SuccessProbability;
  if (stageProb != null && !Number.isNaN(Number(stageProb))) {
    overrides.successProbability = Number(stageProb);
  }

  const body = buildOpportunityPutBody(opp, overrides);
  await api(`/api/2.0/crm/opportunity/${oppId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function addOpportunityTag(oppId, tagTitle) {
  const tagName = normalizeTagTitle(tagTitle);
  if (!tagName) return;
  await api(`/api/2.0/crm/opportunity/${oppId}/tag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagName }),
  });
}

async function removeOpportunityTag(oppId, tagTitle) {
  const tagName = normalizeTagTitle(tagTitle);
  if (!tagName) return;
  await api(`/api/2.0/crm/opportunity/${oppId}/tag`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagName }),
  });
}

async function loadHistoryCategories() {
  if (state.historyCategories.length) return state.historyCategories;
  try {
    const data = await api("/api/2.0/crm/history/category");
    state.historyCategories = unwrap(data);
  } catch {
    state.historyCategories = [];
  }

  if (!state.historyCategories.length) {
    try {
      const params = new URLSearchParams({
        startIndex: "0",
        count: "80",
        entityType: "opportunity",
      });
      const data = await api(`/api/2.0/crm/history/filter?${params}`);
      const byId = new Map();
      for (const ev of unwrapHistoryEvents(data)) {
        const cat = ev.category ?? ev.Category;
        const id = cat?.id ?? cat?.ID;
        if (id == null) continue;
        byId.set(Number(id), {
          id,
          title: cat.title || cat.Title || `Category ${id}`,
        });
      }
      state.historyCategories = [...byId.values()];
    } catch {
      /* no categories */
    }
  }

  return state.historyCategories;
}

function resolveHistoryCategoryId(selectedValue) {
  const picked = Number(selectedValue);
  if (Number.isFinite(picked) && picked > 0) return picked;

  const cats = state.historyCategories;
  const preferred = cats.find((c) => /note|event|comment/i.test(String(c.title || c.Title || "")));
  if (preferred) return Number(preferred.id ?? preferred.ID);

  const first = cats[0];
  if (first) return Number(first.id ?? first.ID);

  throw new Error(
    "No event note category found in CRM. Configure history categories under CRM settings, then try again."
  );
}

function populateHistoryCategorySelect(selectEl, fieldWrapEl) {
  if (!selectEl) return;

  selectEl.innerHTML = "";
  const cats = state.historyCategories;
  if (!cats.length) {
    if (fieldWrapEl) fieldWrapEl.classList.add("hidden");
    return;
  }

  if (fieldWrapEl) fieldWrapEl.classList.toggle("hidden", cats.length <= 1);

  for (const cat of cats) {
    const opt = document.createElement("option");
    opt.value = String(cat.id ?? cat.ID ?? "");
    opt.textContent = cat.title || cat.Title || opt.value;
    selectEl.appendChild(opt);
  }

  const preferred = cats.findIndex((c) => /note|event|comment/i.test(String(c.title || c.Title || "")));
  selectEl.selectedIndex = preferred >= 0 ? preferred : 0;
}

function populateDealEditNoteCategorySelect() {
  populateHistoryCategorySelect($("#deal-edit-note-category"), $("#deal-edit-note-category-field"));
}

function populateQuickNoteCategorySelect() {
  populateHistoryCategorySelect($("#quick-note-note-category"), $("#quick-note-note-category-field"));
}

function dealEditStepError(step, err) {
  const msg = err?.message || String(err);
  return new Error(`${step}: ${msg}`);
}

function dealTagsChanged(initialTags, nextTags) {
  const catalog = buildTagCatalog();
  const initialKeys = new Set(initialTags.map((t) => tagLookupKey(t, catalog)).filter(Boolean));
  const nextKeys = new Set(nextTags.map((t) => tagLookupKey(t, catalog)).filter(Boolean));
  if (initialKeys.size !== nextKeys.size) return true;
  for (const k of nextKeys) if (!initialKeys.has(k)) return true;
  return false;
}

function resolveOppStageId(opp) {
  return opp.stage?.id ?? opp.stage?.ID ?? opp.stageId ?? opp.StageId ?? "";
}

/** Due today or earlier — matches CRM “red” overdue opportunities. */
function isRedOpportunity(opp) {
  const raw = opportunityDueDateRaw(opp);
  if (raw == null || raw === "") return false;
  const due = new Date(raw);
  if (Number.isNaN(due.getTime())) return false;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return dueDay <= today;
}

function oppCreatedMs(opp) {
  const d =
    opp.createOn?.value ??
    opp.createOn ??
    opp.created ??
    opp.Created ??
    opp.dateAndTime?.value ??
    opp.dateAndTime;
  return new Date(d || 0).getTime();
}

function isOpenOpportunity(opp) {
  const st = opp.stage?.status ?? opp.stage?.stageType;
  if (st === 1 || st === 2 || st === "ClosedAndWon" || st === "ClosedAndLost") return false;
  return st === 0 || st === "Open" || st == null || st === "";
}

function countOpenOpportunities() {
  const seen = new Set();
  let n = 0;
  for (const group of state.groups) {
    for (const opp of group.opportunities || []) {
      const id = opp.id ?? opp.ID;
      if (id == null || seen.has(String(id))) continue;
      if (!isOpenOpportunity(opp)) continue;
      seen.add(String(id));
      n += 1;
    }
  }
  return n;
}

function applyClientDealStatus(opportunities, dealStatus) {
  if (dealStatus === "all") return opportunities;
  return opportunities.filter((opp) => {
    if (dealStatus === "open") return isOpenOpportunity(opp);
    if (dealStatus === "closed") return !isOpenOpportunity(opp);
    return true;
  });
}

function buildFilterQuery(group) {
  const params = new URLSearchParams();
  params.set("startIndex", "0");
  params.set("count", "500");

  if (group.search?.trim()) params.set("filterValue", group.search.trim());

  if (group.stageType !== "") params.set("stageType", group.stageType);
  else if (group.dealStatus === "open") params.set("stageType", "0");

  if (group.stageId) params.set("opportunityStagesid", group.stageId);

  /* Tag filter is applied client-side (OR). API tag params use AND and often return no rows. */

  if (group.contactId) params.set("contactid", group.contactId);

  if (group.sortBy) params.set("sortBy", group.sortBy);
  if (group.sortOrder) params.set("sortOrder", group.sortOrder);

  return params.toString();
}

function sortCards(items, group) {
  const sortBy = group.sortBy || "stage";
  const desc = group.sortOrder === "descending";
  const mul = desc ? -1 : 1;
  const stageOrder = new Map(state.stages.map((s, i) => [Number(s.id), i]));

  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "title":
        cmp = (a.title || "").localeCompare(b.title || "");
        break;
      case "bidvalue":
        cmp = (a.bidValue || 0) - (b.bidValue || 0);
        break;
      case "dateandtime": {
        cmp = oppDueDateMs(a) - oppDueDateMs(b);
        break;
      }
      case "created": {
        cmp = oppCreatedMs(a) - oppCreatedMs(b);
        break;
      }
      default: {
        const sa = stageOrder.get(Number(a.stage?.id)) ?? 999;
        const sb = stageOrder.get(Number(b.stage?.id)) ?? 999;
        cmp = sa - sb;
        if (cmp === 0) cmp = (a.title || "").localeCompare(b.title || "");
      }
    }
    return cmp * mul;
  });
}

function stageTypeKey(opp) {
  const st = opp.stage?.status ?? opp.stage?.stageType;
  if (st === 0 || st === "Open") return "open";
  if (st === 1 || st === "ClosedAndWon") return "won";
  if (st === 2 || st === "ClosedAndLost") return "lost";
  return "other";
}

function groupOpportunities(group) {
  const sorted = sortCards(group.opportunities, group);
  const groupBy = group.groupBy;

  if (groupBy === "stage") {
    ensureVisibleStageIds(group);
    const columns = state.stages
      .filter((s) => isStageColumnVisible(group, s.id))
      .map((s) => ({
        id: Number(s.id),
        title: s.title,
        color: s.color || "#4f8cff",
        items: [],
        stageId: Number(s.id),
        empty: true,
      }));
    const byId = new Map(columns.map((c) => [c.stageId, c]));

    for (const opp of sorted) {
      const sid = Number(opp.stage?.id ?? opp.stage?.ID);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      const col = byId.get(sid);
      if (col) {
        col.items.push(opp);
        col.empty = false;
      }
    }

    if (group.showEmptyStages === false) {
      return columns.filter((c) => c.items.length > 0);
    }
    return columns;
  }

  if (groupBy === "tag") {
    const selected = (group.tagTitles || []).map(normalizeTagTitle).filter(Boolean);
    const columns = [];

    const columnTitle = (tag) => {
      const known = state.allTags.find((t) => tagsEqual(t.title || t, tag));
      return known?.title || tag;
    };

    if (selected.length > 0) {
      const catalog = buildTagCatalog();
      const byTag = new Map();
      for (const tag of selected) {
        const key = tagLookupKey(tag, catalog);
        const col = { id: tag, title: columnTitle(tag), color: "#4f8cff", items: [], stageId: null };
        byTag.set(key, col);
        columns.push(col);
      }
      for (const opp of sorted) {
        for (const sel of selected) {
          if (!oppHasTag(opp, sel, catalog)) continue;
          const col = byTag.get(tagLookupKey(sel, catalog));
          if (col) col.items.push(opp);
        }
      }
      return columns;
    }

    const map = new Map();
    const untagged = {
      id: "_untagged",
      title: "Untagged",
      color: "#8b95a8",
      items: [],
      stageId: null,
    };
    map.set("_untagged", untagged);

    for (const opp of sorted) {
      const tags = getOppTags(opp);
      if (!tags.length) {
        untagged.items.push(opp);
        continue;
      }
      for (const tag of tags) {
        const key = normalizeTagTitle(tag).toLowerCase();
        if (!map.has(key)) {
          map.set(key, { id: tag, title: columnTitle(tag), color: "#4f8cff", items: [], stageId: null });
        }
        map.get(key).items.push(opp);
      }
    }

    const out = [...map.values()].filter((c) => c.items.length > 0);
    return out.sort((a, b) => {
      if (a.id === "_untagged") return 1;
      if (b.id === "_untagged") return -1;
      return a.title.localeCompare(b.title);
    });
  }

  const order = [
    { key: "open", title: "Open", color: "#4f8cff" },
    { key: "won", title: "Closed & won", color: "#3ecf8e" },
    { key: "lost", title: "Closed & lost", color: "#f07178" },
  ];
  const map = new Map(order.map((o) => [o.key, { ...o, items: [], stageId: null }]));
  for (const opp of sorted) {
    const k = stageTypeKey(opp);
    if (map.has(k)) map.get(k).items.push(opp);
  }
  return order.map((o) => map.get(o.key)).filter((g) => g.items.length > 0);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatMoney(opp) {
  if (!opp.bidValue) return null;
  const currency = opp.bidCurrency?.abbreviation || opp.bidCurrency?.symbol || "";
  return `${Number(opp.bidValue).toLocaleString()} ${currency}`.trim();
}

function customFieldLabel(field) {
  return normalizeTagTitle(
    field?.label ?? field?.Label ?? field?.title ?? field?.Title ?? field?.name ?? field?.fieldTitle
  );
}

function customFieldTypeCode(def) {
  const ft = def?.fieldType ?? def?.FieldType ?? def?.fieldTypeTitle ?? def?.FieldTypeTitle;
  if (typeof ft === "number" && ft >= 0 && ft <= 5) return ft;
  if (typeof ft === "string") {
    const s = ft.toLowerCase().replace(/\s+/g, "");
    if (s.includes("textarea")) return 1;
    if (s.includes("selectbox") || s === "select") return 2;
    if (s.includes("checkbox") || s === "check") return 3;
    if (s.includes("heading") || s === "head") return 4;
    if (s.includes("date")) return 5;
    if (s.includes("textfield") || s === "text") return 0;
  }
  return 0;
}

/** User fields hidden from the create-opportunity modal (still exist in CRM). */
const CREATE_OPP_EXCLUDED_USER_FIELDS = new Set(
  [
    "Same Adjuster",
    "Photo Drive Link",
    "Shared Spreadsheet",
    "Trades",
    "Final RCV",
    "Zip Code",
    "State",
    "City",
    "Members",
    "Member",
  ].map((n) => normalizeUserFieldLabelKey(n))
);

function normalizeUserFieldLabelKey(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isCreateOppExcludedUserField(def) {
  const label = customFieldLabel(def);
  if (!label) return false;
  const key = normalizeUserFieldLabelKey(label);
  if (CREATE_OPP_EXCLUDED_USER_FIELDS.has(key)) return true;
  if (key === "members" || key === "member") return true;
  return false;
}

function fieldNameMatches(label, patterns) {
  const l = label.toLowerCase();
  return patterns.some((p) => {
    const pat = p.toLowerCase();
    return l === pat || l.includes(pat) || pat.includes(l);
  });
}

async function loadOpportunityCustomFieldDefs(force = false) {
  if (!force && state.customFieldDefs.length) return state.customFieldDefs;

  state.customFieldDefs = [];
  state.customFieldById = new Map();
  // Only opportunity definitions IDs are valid Keys for create/update (see CRMApi.Deals.cs).
  const paths = ["/api/2.0/crm/opportunity/customfield/definitions"];
  for (const path of paths) {
    try {
      const list = unwrap(await api(path));
      if (list.length) {
        state.customFieldDefs = list
          .slice()
          .sort((a, b) => (a.position ?? a.Position ?? 0) - (b.position ?? b.Position ?? 0));
        for (const f of state.customFieldDefs) {
          const id = customFieldDefinitionId(f);
          if (id != null) state.customFieldById.set(String(id), f);
        }
        return state.customFieldDefs;
      }
    } catch {
      /* try next path */
    }
  }
  return state.customFieldDefs;
}

const CHECKLIST_STAGE_TITLE = "New Supplement Project - Estimate Needed";

function findCustomFieldEntry(opp, ...namePatterns) {
  const lists = [
    opp.customFields,
    opp.CustomFields,
    opp.customFieldList,
    opp.CustomFieldList,
    opp.fieldValues,
    opp.FieldValues,
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
      const def = fieldId != null ? state.customFieldById.get(String(fieldId)) : null;
      const label = customFieldLabel(item) || customFieldLabel(def);
      if (!label || !fieldNameMatches(label, namePatterns)) continue;
      return item;
    }
  }

  for (const def of state.customFieldDefs) {
    if (!fieldNameMatches(customFieldLabel(def), namePatterns)) continue;
    const fieldId = def.id ?? def.ID;
    const key = fieldId != null ? String(fieldId) : null;
    if (key && opp[key] != null && opp[key] !== "") {
      return { value: opp[key], fieldId };
    }
  }

  return null;
}

function isCustomFieldChecked(opp, ...namePatterns) {
  const entry = findCustomFieldEntry(opp, ...namePatterns);
  if (!entry) return false;

  const fieldId = entry.id ?? entry.ID ?? entry.fieldId ?? entry.FieldId;
  const def = fieldId != null ? state.customFieldById.get(String(fieldId)) : null;
  const raw = entry.value ?? entry.Value ?? entry.fieldValue ?? entry.FieldValue;

  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw == null) return false;

  const text = String(raw).trim().toLowerCase();
  if (!text) return false;
  if (text === "true" || text === "yes" || text === "1" || text === "checked" || text === "on") return true;
  if (text === "false" || text === "no" || text === "0" || text === "unchecked" || text === "off") return false;

  const fieldType = String(def?.fieldType ?? def?.type ?? def?.fieldTypeTitle ?? "").toLowerCase();
  if (fieldType.includes("check") || fieldType.includes("bool")) {
    return true;
  }

  return true;
}

function isChecklistStage(opp) {
  const title = (opp.stage?.title || "").trim().toLowerCase();
  return title === CHECKLIST_STAGE_TITLE.toLowerCase();
}

function needsMissingChecklistWarning(opp) {
  if (!isChecklistStage(opp)) return false;
  return opportunityChecklistFieldLabels().some((name) => !isCustomFieldChecked(opp, name));
}

function getOppCustomFieldValue(opp, ...namePatterns) {
  const lists = [
    opp.customFields,
    opp.CustomFields,
    opp.customFieldList,
    opp.CustomFieldList,
    opp.fieldValues,
    opp.FieldValues,
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
      const def = fieldId != null ? state.customFieldById.get(String(fieldId)) : null;
      const label = customFieldLabel(item) || customFieldLabel(def);
      if (!label || !fieldNameMatches(label, namePatterns)) continue;
      const raw = item.value ?? item.Value ?? item.fieldValue ?? item.FieldValue;
      if (raw == null || raw === "") return "";
      if (typeof raw === "object") {
        return normalizeTagTitle(raw.title ?? raw.text ?? raw.value ?? raw.Value);
      }
      return String(raw).trim();
    }
  }

  for (const def of state.customFieldDefs) {
    if (!fieldNameMatches(customFieldLabel(def), namePatterns)) continue;
    const fieldId = def.id ?? def.ID;
    const key = fieldId != null ? String(fieldId) : null;
    if (key && opp[key] != null && opp[key] !== "") return String(opp[key]).trim();
  }

  return "";
}

function appendCardDetailLine(container, label, value) {
  const line = document.createElement("p");
  line.className = "card-detail-line";
  if (label) {
    const strong = document.createElement("span");
    strong.className = "card-detail-label";
    strong.textContent = `${label}: `;
    line.appendChild(strong);
  }
  line.appendChild(document.createTextNode(value));
  container.appendChild(line);
}

const CARD_ICON_PREVIEW_SCREEN = `<svg class="card-action-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;

function renderCard(opp, group, showStagePill) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.opportunityId = opp.id;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "card-preview-btn";
  previewBtn.title = "Preview deal";
  previewBtn.setAttribute("aria-label", "Preview deal");
  previewBtn.innerHTML = CARD_ICON_PREVIEW_SCREEN;
  previewBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = opp.id ?? opp.ID;
    openOpportunityPreviewModal(id, opp.title || opp.Title || "", group).catch((err) =>
      showToast(err.message, true)
    );
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "card-edit-btn";
  editBtn.title = "Edit deal";
  editBtn.setAttribute("aria-label", "Edit deal");
  editBtn.textContent = "✎";
  editBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDealEditModal(opp, group).catch((err) => showToast(err.message, true));
  });

  actions.appendChild(previewBtn);
  actions.appendChild(editBtn);
  card.appendChild(actions);

  const title = document.createElement("h3");
  title.className = "card-title";
  const link = document.createElement("a");
  link.className = "card-title-link";
  link.href = crmOpportunityUrl(opp.id);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = opp.title || "(Untitled)";
  title.appendChild(link);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const money = formatMoney(opp);
  if (money) {
    const v = document.createElement("span");
    v.className = "card-value";
    v.textContent = money;
    meta.appendChild(v);
  }

  const details = document.createElement("div");
  details.className = "card-details";

  const contactName = getOpportunityContactLabel(opp);
  if (contactName) {
    const contactEl = document.createElement("p");
    contactEl.className = "card-contact";
    contactEl.textContent = contactName;
    details.appendChild(contactEl);
  }

  const description = (opp.description || opp.Description || "").trim();
  if (description) {
    const desc = document.createElement("p");
    desc.className = "card-description";
    desc.textContent = description;
    details.appendChild(desc);
  }

  const customFieldsReady = opportunityHasCustomFieldLists(opp);
  if (customFieldsReady) {
    const crmJobId = getOppCustomFieldValue(opp, "crm job/id", "crm job", "job/id");
    if (crmJobId) appendCardDetailLine(details, "CRM Job/ID", crmJobId);

    const insuranceCarrier = getOppCustomFieldValue(opp, "insurance carrier");
    if (insuranceCarrier) appendCardDetailLine(details, "Insurance Carrier", insuranceCarrier);

    const supplementRequest = getOppCustomFieldValue(opp, "supplement request");
    if (!supplementRequest) {
      appendCardDetailLine(details, null, "No Supp Request");
    }
  }

  card.appendChild(title);
  if (meta.childElementCount) card.appendChild(meta);
  if (details.childElementCount) card.appendChild(details);

  if (showStagePill && opp.stage?.title) {
    const pill = document.createElement("span");
    pill.className = "card-stage-pill";
    pill.textContent = opp.stage.title;
    card.appendChild(pill);
  }

  if (customFieldsReady && needsMissingChecklistWarning(opp)) {
    const warn = document.createElement("p");
    warn.className = "card-checklist-warn";
    warn.textContent = "Missing Checklist info";
    card.appendChild(warn);
  }

  const dueLabel = formatOppDueLabel(opp);
  if (dueLabel) {
    const due = document.createElement("p");
    due.className = "card-due" + (isRedOpportunity(opp) ? " card-due--overdue" : "");
    due.textContent = `Due ${dueLabel}`;
    card.appendChild(due);
  }

  return card;
}

function renderGroupBoard(group, container) {
  disconnectGroupCardObserver(group.id);
  container.innerHTML = "";
  const columns = groupOpportunities(group);
  const showStagePill = group.groupBy !== "stage";

  if (!columns.length) {
    container.innerHTML = '<p class="board-loading">No opportunities match this group’s filters.</p>';
    return;
  }

  for (const col of columns) {
    const column = document.createElement("section");
    column.className = "column" + (col.items.length === 0 ? " column-empty" : "");

    const header = document.createElement("div");
    header.className = "column-header";
    header.innerHTML = `
      <span class="column-dot" style="background:${escapeHtml(col.color)}"></span>
      <span class="column-title">${escapeHtml(col.title)}</span>
      <span class="column-count">${col.items.length}</span>
    `;

    const body = document.createElement("div");
    body.className = "column-body";

    if (!col.items.length) {
      body.innerHTML = '<p class="empty-column">No deals</p>';
    } else {
      for (const opp of col.items) {
        body.appendChild(renderCard(opp, group, showStagePill));
      }
    }

    column.appendChild(header);
    column.appendChild(body);
    container.appendChild(column);
  }
  observeOpportunityCardsInGroup(group);
}

function tagMultiselectLabel(group) {
  const n = (group.tagTitles || []).length;
  if (n === 0) return "All tags";
  if (n === 1) return group.tagTitles[0];
  if (n <= 2) return group.tagTitles.join(", ");
  return `${n} tags selected`;
}

function stageColumnsLabel(group) {
  ensureVisibleStageIds(group);
  const n = group.stageColumnsConfigured ? group.visibleStageIds.length : state.stages.length;
  const total = state.stages.length;
  if (!total) return "No stages";
  if (!group.stageColumnsConfigured || n >= total) return "All stages";
  if (n === 0) return "No stages selected";
  if (n <= 2) {
    return group.visibleStageIds
      .map((id) => state.stages.find((s) => String(s.id) === String(id))?.title || id)
      .join(", ");
  }
  return `${n} stages`;
}

function syncStageGroupFiltersUI(section, group) {
  const show = group.groupBy === "stage";
  $(".stage-columns-field", section)?.classList.toggle("hidden", !show);
  $(".stage-empty-field", section)?.classList.toggle("hidden", !show);
}

function renderStageColumnsMultiselect(group, container) {
  container.innerHTML = "";
  ensureVisibleStageIds(group);

  const wrap = document.createElement("div");
  wrap.className = "multiselect";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "multiselect-trigger";
  trigger.textContent = stageColumnsLabel(group);

  const panel = document.createElement("div");
  panel.className = "multiselect-panel hidden";

  const updateTrigger = () => {
    trigger.textContent = stageColumnsLabel(group);
  };

  if (!state.stages.length) {
    panel.innerHTML = '<span style="padding:0.4rem;font-size:0.75rem;color:var(--muted)">No pipeline stages</span>';
  } else {
    for (const stage of state.stages) {
      const sid = String(stage.id);
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isStageColumnVisible(group, sid);
      cb.addEventListener("change", () => {
        if (!group.stageColumnsConfigured) {
          group.stageColumnsConfigured = true;
          group.visibleStageIds = state.stages.map((s) => String(s.id));
        }
        if (cb.checked) {
          if (!group.visibleStageIds.includes(sid)) group.visibleStageIds.push(sid);
        } else {
          group.visibleStageIds = group.visibleStageIds.filter((id) => String(id) !== sid);
        }
        updateTrigger();
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        renderGroupBoard(group, groupDomEl(group) && $(".board", groupDomEl(group)));
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(stage.title || `Stage ${sid}`));
      panel.appendChild(label);
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) panel.classList.add("hidden");
  });

  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  container.appendChild(wrap);
}

function renderTagMultiselect(group, container) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "multiselect";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "multiselect-trigger";
  trigger.textContent = tagMultiselectLabel(group);

  const panel = document.createElement("div");
  panel.className = "multiselect-panel hidden";

  const updateTrigger = () => {
    trigger.textContent = tagMultiselectLabel(group);
  };

  if (!state.allTags.length) {
    panel.innerHTML = '<span style="padding:0.4rem;font-size:0.75rem;color:var(--muted)">No tags in CRM</span>';
  } else {
    for (const tag of state.allTags) {
      const title = tag.title || tag;
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = (group.tagTitles || []).some((t) => tagsEqual(t, title));
      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (!group.tagTitles.some((t) => tagsEqual(t, title))) group.tagTitles.push(title);
        } else {
          group.tagTitles = group.tagTitles.filter((t) => !tagsEqual(t, title));
        }
        if (group.tagTitles.length > 0) {
          group.groupBy = "tag";
          const groupBySel = groupDomEl(group) && $(".group-by", groupDomEl(group));
          if (groupBySel) groupBySel.value = "tag";
        }
        updateTrigger();
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        refreshGroup(group);
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(title));
      panel.appendChild(label);
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) panel.classList.add("hidden");
  });

  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  container.appendChild(wrap);
}

async function searchContacts(query) {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({
    startIndex: "0",
    count: "25",
    filterValue: query,
    contactListView: "WithOpportunity",
  });
  const data = await api(`/api/2.0/crm/contact/filter?${params}`);
  return unwrap(data);
}

function bindContactField(group, wrap) {
  const input = $(".contact-search", wrap);
  const results = $(".contact-results", wrap);
  const selected = $(".contact-selected", wrap);
  let debounce;

  function updateSelectedUi() {
    if (group.contactId) {
      selected.innerHTML = `Contact: ${escapeHtml(group.contactLabel || "#" + group.contactId)} <span class="contact-clear" role="button" tabindex="0">clear</span>`;
      $(".contact-clear", selected)?.addEventListener("click", () => {
        group.contactId = "";
        group.contactLabel = "";
        input.value = "";
        updateSelectedUi();
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        refreshGroup(group);
      });
    } else {
      selected.textContent = "";
    }
  }

  updateSelectedUi();

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 2) {
        results.classList.add("hidden");
        return;
      }
      try {
        const contacts = await searchContacts(q);
        results.classList.remove("hidden");
        if (!contacts.length) {
          results.innerHTML = '<button type="button" disabled>No matches</button>';
          return;
        }
        for (const c of contacts) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = c.displayName || c.title || `Contact #${c.id}`;
          btn.addEventListener("click", () => {
            group.contactId = String(c.id);
            group.contactLabel = btn.textContent;
            input.value = "";
            results.classList.add("hidden");
            saveGroupsToStorage();
            updateSelectedUi();
            updateGroupFilterSummary(group);
            refreshGroup(group);
          });
          results.appendChild(btn);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    }, 350);
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) results.classList.add("hidden");
  });
}

function renderBoardGroups() {
  renderFeedTile();
  renderTasksTile();
  const dash = $("#dashboard-tiles");
  if (!dash) return;

  dash.querySelectorAll(".board-group-tile").forEach((el) => el.remove());

  for (const group of state.groups) {
    const tileId = `group-${group.id}`;
    const section = document.createElement("section");
    section.className = "dashboard-tile board-group board-group-tile";
    section.dataset.tileId = tileId;
    section.dataset.tileLabel = group.name || "Opportunity group";
    section.dataset.groupId = group.id;

    section.innerHTML = `
      <div class="board-group-header">
        <div class="group-filters-panel">
          <div class="group-filters">
            <div class="field">
              <span class="presets-label">Deals</span>
              <div class="toolbar-presets" style="margin:0">
                <button type="button" class="chip" data-status="all">All</button>
                <button type="button" class="chip" data-status="open">Open</button>
                <button type="button" class="chip" data-status="closed">Closed</button>
              </div>
            </div>
            <div class="field">
              <label>Group by</label>
              <select class="group-by">
                <option value="stage">Pipeline stage</option>
                <option value="tag">Tag</option>
                <option value="stageType">Open / won / lost</option>
              </select>
            </div>
            <div class="field">
              <label>Pipeline stage</label>
              <select class="stage-filter"><option value="">All stages</option></select>
            </div>
            <div class="field stage-columns-field hidden">
              <label>Stage columns</label>
              <div class="stage-columns-multiselect"></div>
            </div>
            <div class="field field-checkbox stage-empty-field hidden">
              <label class="checkbox-filter">
                <input type="checkbox" class="show-empty-stages" checked />
                <span>Show empty stages</span>
              </label>
            </div>
            <div class="field field-checkbox">
              <label class="checkbox-filter">
                <input type="checkbox" class="show-only-red" />
                <span>Show only red opportunities</span>
              </label>
            </div>
            <div class="field">
              <label>Tags</label>
              <div class="tag-multiselect"></div>
            </div>
            <div class="field contact-field">
              <label>Opportunity contact</label>
              <input type="search" class="contact-search" placeholder="Search name…" autocomplete="off" />
              <div class="contact-results hidden"></div>
              <div class="contact-selected"></div>
            </div>
            <div class="field">
              <label>Search</label>
              <input type="search" class="group-search" placeholder="Title…" />
            </div>
            <div class="field">
              <label>Sort by</label>
              <select class="group-sort-by">
                <option value="stage">Pipeline stage</option>
                <option value="title">Title</option>
                <option value="bidvalue">Bid value</option>
                <option value="dateandtime">Due date</option>
                <option value="created">Date created</option>
              </select>
            </div>
            <div class="field">
              <label>Order</label>
              <select class="group-sort-order">
                <option value="ascending">Oldest / A→Z first</option>
                <option value="descending">Newest / Z→A first</option>
              </select>
            </div>
          </div>
          <p class="group-filter-summary"></p>
        </div>
      </div>
      <main class="board"></main>
    `;

    updateGroupFilterSummary(group);

    section.querySelectorAll("[data-status]").forEach((btn) => {
      btn.classList.toggle("chip-active", btn.dataset.status === group.dealStatus);
      btn.addEventListener("click", () => {
        group.dealStatus = btn.dataset.status;
        section.querySelectorAll("[data-status]").forEach((b) => {
          b.classList.toggle("chip-active", b.dataset.status === group.dealStatus);
        });
        saveGroupsToStorage();
        refreshGroup(group);
      });
    });

    const groupBy = $(".group-by", section);
    groupBy.value = group.groupBy;
    groupBy.addEventListener("change", () => {
      group.groupBy = groupBy.value;
      if (group.groupBy === "stage") ensureVisibleStageIds(group);
      syncStageGroupFiltersUI(section, group);
      saveGroupsToStorage();
      updateGroupFilterSummary(group);
      renderGroupBoard(group, $(".board", section));
    });

    syncStageGroupFiltersUI(section, group);
    renderStageColumnsMultiselect(group, $(".stage-columns-multiselect", section));

    const showEmptyStages = $(".show-empty-stages", section);
    if (showEmptyStages) {
      showEmptyStages.checked = group.showEmptyStages !== false;
      showEmptyStages.addEventListener("change", () => {
        group.showEmptyStages = showEmptyStages.checked;
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        renderGroupBoard(group, $(".board", section));
      });
    }

    const showOnlyRed = $(".show-only-red", section);
    if (showOnlyRed) {
      showOnlyRed.checked = !!group.showOnlyRedOpportunities;
      showOnlyRed.addEventListener("change", () => {
        group.showOnlyRedOpportunities = showOnlyRed.checked;
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        refreshGroup(group);
      });
    }

    const stageFilter = $(".stage-filter", section);
    for (const s of state.stages) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.title;
      if (String(group.stageId) === String(s.id)) opt.selected = true;
      stageFilter.appendChild(opt);
    }
    stageFilter.addEventListener("change", () => {
      group.stageId = stageFilter.value;
      saveGroupsToStorage();
      refreshGroup(group);
    });

    $(".group-search", section).addEventListener("input", debounceForGroup(group, () => {
      group.search = $(".group-search", section).value;
      saveGroupsToStorage();
      refreshGroup(group);
    }));

    const sortBy = $(".group-sort-by", section);
    sortBy.value = group.sortBy || "stage";
    sortBy.addEventListener("change", () => {
      group.sortBy = sortBy.value;
      saveGroupsToStorage();
      renderGroupBoard(group, $(".board", section));
    });

    const sortOrder = $(".group-sort-order", section);
    sortOrder.value = group.sortOrder || "ascending";
    sortOrder.addEventListener("change", () => {
      group.sortOrder = sortOrder.value;
      saveGroupsToStorage();
      renderGroupBoard(group, $(".board", section));
    });

    renderTagMultiselect(group, $(".tag-multiselect", section));
    bindContactField(group, $(".contact-field", section));

    dash.appendChild(section);
    bindGroupTileChrome(section, group, tileId);
    group._el = section;
    if (tileBodyCollapsed(tileId)) {
      const board = $(".board", section);
      if (group.opportunities?.length && board) {
        renderGroupBoard(group, board);
        $(".board-group-count", section).textContent = `${group.opportunities.length} deals (cached)`;
      } else {
        showTileCollapsedHint(tileId, "Minimized — expand to load deals");
      }
    } else {
      renderGroupBoard(group, $(".board", section));
      $(".board-group-count", section).textContent = `${group.opportunities.length} deals`;
    }
    applyTileLayoutClasses(section, tileId);
    applyTileBodyCollapsed(section, tileId);
  }

  renderCalendarTiles(dash);
  renderNotesTiles(dash);

  ensureTileLayout();
  mountDashboardTiles();
  refreshDashboardTileLayouts();
}

function debounceForGroup(group, fn) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, 400);
  };
}

async function loadStages() {
  const data = await api("/api/2.0/crm/opportunity/stage");
  state.stages = unwrap(data).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

async function loadAllTags() {
  const data = await api("/api/2.0/crm/opportunity/tag");
  state.allTags = unwrap(data);
}

async function loadCurrentUser() {
  try {
    const data = await api("/api/2.0/people/@self");
    const me = data.response ?? data.result ?? data;
    state.currentUser = me && typeof me === "object" ? me : null;
    state.currentUserId =
      me?.id ?? me?.ID ?? me?.userId ?? me?.UserId ?? data?.id ?? data?.ID ?? null;
    state.currentUserName =
      me?.displayName || me?.DisplayName || me?.userName || me?.UserName || "";
    state.currentUserEmail = String(me?.email || me?.Email || me?.primaryEmail || me?.PrimaryEmail || "")
      .trim()
      .toLowerCase();
    return me;
  } catch {
    state.currentUser = null;
    state.currentUserId = null;
    state.currentUserName = "";
    state.currentUserEmail = "";
    return null;
  }
}

function currentUserIdentityTokens() {
  const tokens = new Set();
  if (state.currentUserId != null && state.currentUserId !== "") {
    tokens.add(String(state.currentUserId).toLowerCase());
  }
  const name = (state.currentUserName || "").trim().toLowerCase();
  if (name) tokens.add(name);
  const userName = (state.currentUser?.userName || state.currentUser?.UserName || "").trim().toLowerCase();
  if (userName) tokens.add(userName);
  const email = (state.currentUserEmail || "").trim().toLowerCase();
  if (email) tokens.add(email);
  return tokens;
}

/** CRM opportunity events when another user checks you under "notify user" (plus email). */
const CRM_NOTIFY_MARKERS = [
  /CRM\.\s*New event added to/i,
  /has added a new event to/i,
  /New event added to/i,
  /notified you/i,
  /notify user/i,
];

function parseNotifyNamesFromText(text) {
  const t = String(text || "");
  const out = [];
  const patterns = [
    /notify\s+users?\s*[:]\s*([^\n<]+)/i,
    /users?\s+to\s+notify\s*[:]\s*([^\n<]+)/i,
    /notified\s+users?\s*[:]\s*([^\n<]+)/i,
    /notify\s+user\s*[:]\s*([^\n<]+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m?.[1]) continue;
    for (const part of m[1].split(/[,;]+/)) {
      const name = part.trim();
      if (name) out.push(name);
    }
  }
  return out;
}

function notifyRecipientsFromAdditionalData(raw) {
  if (!raw) return [];
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return parseNotifyNamesFromText(raw);
    }
  }
  if (!data || typeof data !== "object") return [];
  const out = [];
  const lists = [
    data.notifyUsers,
    data.NotifyUsers,
    data.notifyUserList,
    data.NotifyUserList,
    data.usersToNotify,
    data.UsersToNotify,
    data.notifyContacts,
    data.NotifyContacts,
    data.toUsers,
    data.ToUsers,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    out.push(...list);
  }
  return out;
}

function notifyRecipientsFromEvent(ev) {
  const out = [];
  const lists = [
    ev.notifyUsers,
    ev.NotifyUsers,
    ev.notifyUserList,
    ev.NotifyUserList,
    ev.usersToNotify,
    ev.UsersToNotify,
    ev.notifyContacts,
    ev.NotifyContacts,
    ev.toUsers,
    ev.ToUsers,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    out.push(...list);
  }
  out.push(...notifyRecipientsFromAdditionalData(ev.additionalData || ev.AdditionalData));
  out.push(...parseNotifyNamesFromText(ev.content || ev.Content || ""));
  return out;
}

function mailAddressesFromMessage(mail) {
  const out = [];
  const lists = [mail.to, mail.To, mail.cc, mail.Cc, mail.bcc, mail.Bcc, mail.recipients, mail.Recipients];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry === "string") out.push(entry);
      else if (entry) {
        out.push(entry.email || entry.Email || entry.address || entry.Address || entry.title || entry.Title);
      }
    }
  }
  const single = mail.address || mail.Address;
  if (single) out.push(single);
  return out.filter(Boolean).map((a) => String(a).toLowerCase());
}

function mailIsAddressedToCurrentUser(mail) {
  const addresses = mailAddressesFromMessage(mail);
  if (!addresses.length) return true;
  const tokens = currentUserIdentityTokens();
  if (!tokens.size) return false;
  return addresses.some((addr) => {
    for (const token of tokens) {
      if (addr === token || addr.includes(token) || token.includes(addr)) return true;
    }
    return false;
  });
}

function recipientMatchesCurrentUser(recipient) {
  if (recipient == null) return false;
  const tokens = currentUserIdentityTokens();
  if (!tokens.size) return false;
  if (typeof recipient === "string") {
    const s = recipient.toLowerCase();
    for (const token of tokens) {
      if (s === token || s.includes(token) || token.includes(s)) return true;
    }
    return sameUserId(recipient, state.currentUserId);
  }
  const id = recipient.id ?? recipient.ID ?? recipient.userId;
  if (id != null && sameUserId(id, state.currentUserId)) return true;
  const name = (recipient.displayName || recipient.title || "").toLowerCase();
  const userName = (recipient.userName || recipient.UserName || "").toLowerCase();
  const myName = (state.currentUserName || "").toLowerCase();
  const myUser = (state.currentUser?.userName || state.currentUser?.UserName || "").toLowerCase();
  if (myName && name && name === myName) return true;
  if (myUser && userName && userName === myUser) return true;
  return false;
}

function normalizeCrmEntityType(raw) {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  if (n === 2) return "opportunity";
  if (n === 3) return "case";
  if (n === 1) return "contact";
  const s = String(raw).toLowerCase();
  if (s === "deal") return "opportunity";
  return s;
}

function unwrapHistoryEvents(data) {
  const direct = unwrap(data);
  if (direct.length) return direct;
  const r = data?.response;
  if (!r || typeof r !== "object") return [];
  for (const key of ["items", "Items", "events", "Events", "history", "History"]) {
    if (Array.isArray(r[key])) return r[key];
  }
  return [];
}

function parseRelationshipNotifyEvent(ev) {
  const entity = ev.entity || ev.Entity;
  const entityType = normalizeCrmEntityType(
    entity?.entityType ?? entity?.EntityType ?? ev.entityType ?? ev.EntityType
  );
  if (entityType && entityType !== "opportunity") return null;

  let id =
    entity?.entityId ??
    entity?.EntityId ??
    entity?.id ??
    entity?.ID ??
    ev.entityId ??
    ev.EntityId ??
    ev.entityID ??
    ev.EntityID ??
    ev.opportunityId;

  if (!id) {
    id = opportunityIdFromText(ev.content || ev.Content || "");
  }
  if (!id) return null;

  const title = String(
    entity?.entityTitle || entity?.EntityTitle || ev.opportunityTitle || `Opportunity #${id}`
  )
    .replace(/^CRM\.\s*New event added to\s+/i, "")
    .trim();

  const createBy = ev.createBy || ev.CreateBy || ev.createdBy || ev.CreatedBy;
  const authorId = createBy?.id ?? createBy?.ID ?? null;
  const author =
    createBy?.displayName ||
    createBy?.DisplayName ||
    displayNameForUserName(createBy?.userName || createBy?.UserName) ||
    "Another user";

  let text = toPlainDisplayText(ev.content ?? ev.Content ?? "");
  if (!text || isNotifyTemplateSpam(text)) {
    const catTitle = ev.category?.title || ev.Category?.title || ev.category?.Title;
    const catText = toPlainDisplayText(catTitle);
    if (catText && !isNotifyTemplateSpam(catText)) text = catText;
    else return null;
  }

  const date =
    ev.created?.value ??
    ev.created ??
    ev.Created?.value ??
    ev.Created ??
    ev.createOn?.value ??
    ev.createOn;

  return {
    id: Number(id),
    title,
    author,
    authorId,
    text,
    date,
    source: "history",
    notifyRecipients: notifyRecipientsFromEvent(ev),
  };
}

function indexOpportunity(opp) {
  const id = Number(opp?.id ?? opp?.ID);
  if (!Number.isFinite(id) || id <= 0) return;
  if (!state.opportunityById) state.opportunityById = new Map();
  state.opportunityById.set(id, opp);
}

function getOpportunityFromState(oppId) {
  const id = Number(oppId);
  if (!Number.isFinite(id)) return null;
  if (state.opportunityById?.has(id)) return state.opportunityById.get(id);
  for (const g of state.groups) {
    for (const o of g.opportunities || []) {
      if (Number(o.id ?? o.ID) === id) {
        indexOpportunity(o);
        return o;
      }
    }
  }
  return null;
}

function isCurrentUserOpportunityResponsible(opp) {
  if (!opp || state.currentUserId == null) return false;
  const respId =
    opp.responsible?.id ??
    opp.responsible?.ID ??
    opp.responsibleId ??
    opp.ResponsibleId ??
    opp.responsibleID;
  return respId != null && sameUserId(respId, state.currentUserId);
}

function isNotificationForLoggedInUser(item, ev = null) {
  const tokens = currentUserIdentityTokens();
  if (!tokens.size) return false;

  if (item.authorId && state.currentUserId != null && sameUserId(item.authorId, state.currentUserId)) {
    return false;
  }

  if (item.source === "mail") {
    if (item.forCurrentUser === false) return false;
    if (item.forCurrentUser === true) return true;
    return true;
  }

  const recipients = ev ? notifyRecipientsFromEvent(ev) : item.notifyRecipients || [];
  if (recipients.length) {
    return recipients.some((r) => recipientMatchesCurrentUser(r));
  }

  const blob = `${item.text || ""} ${item.title || ""}`;
  if (/notify|notified/i.test(blob) && recipientMatchesCurrentUser(blob)) {
    return true;
  }

  return false;
}

function shouldIncludeRelationshipNotifyEvent(_ev, parsed) {
  return !!parsed;
}

function applyFeedKeywordFilter(items) {
  const kw = (state.feedKeywordFilter || "").trim().toLowerCase();
  if (!kw) return items;
  return items.filter((it) => {
    const blob = `${it.title || ""} ${it.text || ""} ${it.author || ""}`.toLowerCase();
    return blob.includes(kw);
  });
}

function newFeedPagination() {
  return {
    historyStartIndex: 0,
    mailPage: 1,
    historyExhausted: false,
    mailExhausted: false,
    historySeen: new Set(),
    rawItems: [],
    loadingMore: false,
  };
}

function feedCanLoadMore() {
  const p = state.feedPagination;
  if (!p) return false;
  if ((state.feedNotificationsCache || []).length >= FEED_MAX_EVENTS) return false;
  return !p.historyExhausted || !p.mailExhausted;
}

function updateFeedLoadMoreUi() {
  const list = $("#notification-feed");
  if (!list) return;
  list.querySelector(".feed-load-more")?.remove();
  const p = state.feedPagination;
  if (!p || !feedCanLoadMore()) return;
  const li = document.createElement("li");
  li.className = "feed-load-more";
  const atCap = (state.feedNotificationsCache || []).length >= FEED_MAX_EVENTS;
  li.textContent = p.loadingMore
    ? "Loading more…"
    : atCap
      ? `Showing the ${FEED_MAX_EVENTS} most recent notifications`
      : "Scroll for older notifications";
  list.appendChild(li);
}

function updateFeedLoadingUi() {
  const tile = document.querySelector('[data-tile-id="tile-feed"]');
  const busy = state.feedLoading || state.feedPagination?.loadingMore;
  const indicator = tile?.querySelector(".feed-loading-indicator");
  if (indicator) indicator.classList.toggle("hidden", !busy);
  const hint = tile?.querySelector(".feed-range-hint");
  if (hint) {
    hint.textContent = busy ? "Loading…" : `Last ${FEED_DAYS} days`;
  }
}

function renderFeedNotificationList() {
  const list = $("#notification-feed");
  if (!list) return;

  let items = applyFeedKeywordFilter(state.feedNotificationsCache || []);
  updatePanelTileCount("tile-feed", items.length);
  updateFeedLoadingUi();

  list.innerHTML = "";
  if (!items.length) {
    if (state.feedLoading) {
      list.innerHTML = '<li class="feed-loading">Loading notifications…</li>';
      return;
    }
    const hiddenNote = state.hiddenFeedEntries.size ? " Some are hidden." : "";
    const kwNote = state.feedKeywordFilter?.trim() ? " Try clearing the keyword filter." : "";
    list.innerHTML = `<li>No new CRM events in the last ${FEED_DAYS} days.${hiddenNote}${kwNote}</li>`;
    return;
  }

  for (const it of items) {
    list.appendChild(renderFeedNotificationItem(it));
  }
  updateFeedLoadMoreUi();
}

function bindFeedInfiniteScroll() {
  const list = $("#notification-feed");
  if (!list || list.dataset.infiniteBound) return;
  list.dataset.infiniteBound = "1";
  list.addEventListener(
    "scroll",
    () => {
      if (list.scrollTop + list.clientHeight < list.scrollHeight - 72) return;
      loadMoreNotificationFeed().catch((err) => showToast(err.message, true));
    },
    { passive: true }
  );
}

function tryAddRelationshipNotifyEvent(items, seen, ev, periodFrom) {
  const parsed = parseRelationshipNotifyEvent(ev);
  if (!parsed) return;
  if (!shouldIncludeRelationshipNotifyEvent(ev, parsed)) return;
  if (!isWithinFeedWindow(parsed.date)) return;
  if (parsed.date) {
    const t = new Date(parsed.date).getTime();
    if (!Number.isNaN(t) && t < periodFrom) return;
  }
  const dedupe = `${parsed.id}-${parsed.text}-${parsed.author}-${parsed.date || ""}`;
  if (seen.has(dedupe)) return;
  seen.add(dedupe);
  items.push(parsed);
}

async function fetchFeedHistoryBatch(periodFrom, pagination) {
  const items = [];
  if (!pagination || pagination.historyExhausted) return items;

  const params = new URLSearchParams({
    startIndex: String(pagination.historyStartIndex),
    count: String(FEED_HISTORY_PAGE_SIZE),
    entityType: "opportunity",
  });

  let rows = [];
  try {
    rows = unwrapHistoryEvents(await api(`/api/2.0/crm/history/filter?${params}`));
  } catch {
    pagination.historyExhausted = true;
    return items;
  }

  if (!rows.length && pagination.historyStartIndex === 0) {
    try {
      const fallback = new URLSearchParams({
        startIndex: "0",
        count: String(FEED_HISTORY_PAGE_SIZE),
      });
      rows = unwrapHistoryEvents(await api(`/api/2.0/crm/history/filter?${fallback}`));
    } catch {
      pagination.historyExhausted = true;
      return items;
    }
  }

  for (const ev of rows) {
    tryAddRelationshipNotifyEvent(items, pagination.historySeen, ev, periodFrom);
  }

  pagination.historyStartIndex += rows.length;
  if (rows.length < FEED_HISTORY_PAGE_SIZE) pagination.historyExhausted = true;
  return items;
}

async function loadCrmRelationshipNotifyEventsBulk(periodFrom, pagination) {
  const items = [];
  let maxRows = 0;

  const primary = new URLSearchParams({
    startIndex: "0",
    count: String(FEED_MAX_EVENTS),
    entityType: "opportunity",
  });
  try {
    const rows = unwrapHistoryEvents(await api(`/api/2.0/crm/history/filter?${primary}`));
    maxRows = rows.length;
    for (const ev of rows) {
      tryAddRelationshipNotifyEvent(items, pagination.historySeen, ev, periodFrom);
    }
  } catch {
    /* history optional */
  }

  if (!maxRows) {
    try {
      const fallback = new URLSearchParams({ startIndex: "0", count: String(FEED_MAX_EVENTS) });
      const rows = unwrapHistoryEvents(await api(`/api/2.0/crm/history/filter?${fallback}`));
      maxRows = rows.length;
      for (const ev of rows) {
        tryAddRelationshipNotifyEvent(items, pagination.historySeen, ev, periodFrom);
      }
    } catch {
      /* try next query shape */
    }
  }

  pagination.historyStartIndex = Math.max(pagination.historyStartIndex, maxRows);
  pagination.historyExhausted = true;

  return items;
}

async function fetchFeedMailInitial(periodFrom, existingRaw = []) {
  const items = [];
  const seen = new Set();
  const myUserName = (state.currentUser?.userName || state.currentUser?.UserName || "").toLowerCase();
  const queries = [];
  const mailPageSize = Math.min(FEED_MAIL_PAGE_SIZE, FEED_MAX_EVENTS);

  for (const search of FEED_MAIL_SEARCHES) {
    queries.push(
      new URLSearchParams({
        search,
        page_size: String(mailPageSize),
        sortorder: "descending",
        page: "1",
        period_from: new Date(periodFrom).toISOString(),
      }),
      new URLSearchParams({
        search,
        page_size: String(mailPageSize),
        sortorder: "descending",
        page: "1",
      })
    );
  }

  const atFeedCap = () => buildFeedNotificationList([...existingRaw, ...items]).length >= FEED_MAX_EVENTS;

  for (const q of queries) {
    if (atFeedCap()) break;
    try {
      const rows = unwrap(await api(`/api/2.0/mail/messages?${q}`));
      for (const mail of rows) {
        if (atFeedCap()) break;
        const parsed = parseMailNotifyMessage(mail);
        if (!parsed) continue;
        if (!isWithinFeedWindow(parsed.date)) continue;
        const fromAddr = String(
          (typeof mail.from === "string" ? mail.from : mail.from?.email || mail.from?.Email) || ""
        ).toLowerCase();
        if (myUserName && fromAddr && fromAddr === myUserName) continue;
        const dedupe = `${parsed.id}-${parsed.text}-${parsed.author}-${parsed.date || ""}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        items.push(parsed);
      }
    } catch {
      /* try next query */
    }
  }

  return items;
}

async function fetchFeedMailBatch(periodFrom, pagination) {
  const items = [];
  if (!pagination || pagination.mailExhausted) return items;

  const myUserName = (state.currentUser?.userName || state.currentUser?.UserName || "").toLowerCase();
  const q = new URLSearchParams({
    search: FEED_MAIL_SEARCH,
    page_size: String(FEED_MAIL_PAGE_SIZE),
    sortorder: "descending",
    page: String(pagination.mailPage),
    period_from: new Date(periodFrom).toISOString(),
  });

  let rows = [];
  try {
    rows = unwrap(await api(`/api/2.0/mail/messages?${q}`));
  } catch {
    pagination.mailExhausted = true;
    return items;
  }

  for (const mail of rows) {
    const parsed = parseMailNotifyMessage(mail);
    if (!parsed) continue;
    if (!isWithinFeedWindow(parsed.date)) continue;
    const fromAddr = String(
      (typeof mail.from === "string" ? mail.from : mail.from?.email || mail.from?.Email) || ""
    ).toLowerCase();
    if (myUserName && fromAddr && fromAddr === myUserName) continue;
    items.push(parsed);
  }

  pagination.mailPage += 1;
  if (rows.length < FEED_MAIL_PAGE_SIZE) pagination.mailExhausted = true;
  return items;
}

function commitFeedRawItems(rawItems) {
  state.feedRawItems = rawItems;
  let unique = buildFeedNotificationList(rawItems);
  const atCap = unique.length >= FEED_MAX_EVENTS;
  if (atCap) unique = unique.slice(0, FEED_MAX_EVENTS);
  if (atCap && state.feedPagination) {
    state.feedPagination.historyExhausted = true;
    state.feedPagination.mailExhausted = true;
  }
  applyFeedNotificationCache(unique);
}

async function loadMoreNotificationFeed() {
  const p = state.feedPagination;
  if (!p || p.loadingMore || !feedCanLoadMore()) return;
  if ((state.feedNotificationsCache || []).length >= FEED_MAX_EVENTS) return;
  p.loadingMore = true;
  updateFeedLoadingUi();
  updateFeedLoadMoreUi();

  const periodFrom = feedWindowStart();
  try {
    let batch = [];
    if (!p.historyExhausted) {
      batch = await fetchFeedHistoryBatch(periodFrom, p);
    } else if (!p.mailExhausted) {
      batch = await fetchFeedMailBatch(periodFrom, p);
    }
    if (batch.length) {
      p.rawItems.push(...batch);
      commitFeedRawItems(p.rawItems);
    } else if (!feedCanLoadMore()) {
      updateFeedLoadMoreUi();
    }
  } finally {
    p.loadingMore = false;
    updateFeedLoadingUi();
    updateFeedLoadMoreUi();
  }
}

function isFeedCacheFresh() {
  return (
    state.feedFetchedAt != null &&
    Date.now() - state.feedFetchedAt < FEED_CACHE_TTL_MS &&
    state.feedNotificationsCache.length > 0 &&
    state.feedPagination != null
  );
}

function buildFeedNotificationList(rawItems) {
  const mergedByEvent = new Map();
  for (const it of rawItems) {
    const mergeKey = `${it.id}-${(it.text || "").slice(0, 60)}-${it.author}`;
    const prev = mergedByEvent.get(mergeKey);
    if (!prev || (prev.source === "history" && it.source === "mail")) {
      mergedByEvent.set(mergeKey, it);
    }
  }

  const seen = new Set();
  const unique = [];
  for (const it of mergedByEvent.values()) {
    const key = feedNotificationKey(it);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isFeedKeyHidden(key)) {
      const entry = state.hiddenFeedEntries.get(key);
      if (entry) {
        entry.snapshot = {
          id: it.id,
          title: it.title,
          text: it.text,
          author: it.author,
          date: it.date,
        };
      }
      continue;
    }
    unique.push({ ...it, key });
  }

  unique.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return unique;
}

function applyFeedNotificationCache(unique) {
  state.feedNotificationsCache = unique;
  state.feedFetchedAt = Date.now();
  const hiddenCountBefore = state.hiddenFeedEntries.size;
  pruneHiddenFeedEntries();
  if (state.hiddenFeedEntries.size < hiddenCountBefore) saveHiddenFeedEntries();
  else updateFeedHiddenToolbarButton();
  renderFeedNotificationList();
}

function decodeHtmlEntities(text) {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

const NOTIFY_TEMPLATE_MARKERS = [
  /subscription settings/i,
  /registered user of the/i,
  /manage your/i,
  /VirtualRootPath/i,
  /\$\{__VirtualRootPath\}/i,
  /\$EntityTitle/i,
  /\$__AuthorName/i,
  /\$AdditionalData/i,
  /\^You receive this email/i,
  /^h1\.\s/i,
  /has added a new event to\s+"[^"]+":/i,
  /New event added to\s+"[^"]+":/i,
];

function isNotifyTemplateSpam(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (t.length > 600) return true;
  return NOTIFY_TEMPLATE_MARKERS.some((re) => re.test(t));
}

/** Plain text for feed tiles — strips HTML, wiki/markdown mail templates, and CRM boilerplate. */
function toPlainDisplayText(raw, maxLen = 220) {
  if (raw == null) return "";
  let s = String(raw);
  if (!s.trim()) return "";

  if (/<[a-z][\s\S]*>/i.test(s)) {
    s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
    s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
    s = s.replace(/<br\s*\/?>/gi, "\n");
    s = s.replace(/<\/p>/gi, "\n");
    s = s.replace(/<\/div>/gi, "\n");
    s = s.replace(/<[^>]+>/g, " ");
  }

  s = decodeHtmlEntities(s);
  s = s.replace(/\r/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/"([^"]+)":/g, "$1 ");
  s = s.replace(/\^([^^]+)\^/g, "$1");
  s = s.replace(/^h[1-6]\.\s*/gim, "");
  s = s.replace(/\${[^}]+}/g, " ");
  s = s.replace(/https?:\/\/\S+/gi, " ");
  s = s.replace(/Products\/CRM\/\S+/gi, " ");
  s = s.replace(/\s+/g, " ").trim();

  const added = s.match(/has added a new event[^:]*:\s*(.+)$/i);
  if (added) {
    const inner = added[1].replace(/\s+/g, " ").trim();
    if (inner && !isNotifyTemplateSpam(inner)) return inner.slice(0, maxLen);
  }

  const crmLine = s.match(/CRM\.\s*New event added to\s+(.+?)(?:\s{2,}|$)/i);
  if (crmLine) {
    const title = crmLine[1].trim();
    if (title && !isNotifyTemplateSpam(title)) return title.slice(0, maxLen);
  }

  return s.slice(0, maxLen);
}

function parseFeedDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function unwrapTalkMessages(data) {
  const raw = data?.response ?? data;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.messages)) return raw.messages;
  if (Array.isArray(raw?.Messages)) return raw.Messages;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function normalizeTalkMessage(msg) {
  let text =
    msg?.text ||
    msg?.Text ||
    msg?.t ||
    msg?.message ||
    msg?.Message ||
    msg?.body ||
    msg?.Body ||
    msg?.content ||
    msg?.Content ||
    "";
  if (typeof text !== "string") text = String(text || "");
  text = toPlainDisplayText(text.replace(/<br\s*\/?>/gi, "\n"));

  const userName =
    msg?.userName ||
    msg?.UserName ||
    msg?.u ||
    msg?.from ||
    msg?.From ||
    msg?.author ||
    msg?.Author ||
    "";

  const dateTime = parseFeedDate(
    msg?.dateTime ?? msg?.DateTime ?? msg?.d ?? msg?.date ?? msg?.Date ?? msg?.time ?? msg?.Time
  );

  return { userName, text, dateTime };
}

function displayNameForUserName(userName) {
  if (!userName) return "Another user";
  const key = String(userName).toLowerCase();
  const found = state.portalUsers.find(
    (u) =>
      String(u.id).toLowerCase() === key ||
      String(u.displayName || "").toLowerCase() === key ||
      String(u.displayName || "")
        .toLowerCase()
        .includes(key)
  );
  if (found?.displayName) return found.displayName;
  return userName;
}

function opportunityIdFromText(text) {
  const t = String(text || "");
  const m =
    t.match(/Deals\.aspx\?id=(\d+)/i) ||
    t.match(/Deals\.aspx\?ID=(\d+)/i) ||
    t.match(/\/Products\/CRM\/Deals\.aspx\?id=(\d+)/i);
  return m ? Number(m[1]) : null;
}

function isCrmRelationshipNotifyText(text, meta = {}) {
  const t = String(text || "");
  const id = opportunityIdFromText(t);
  if (!id) return false;
  if (CRM_NOTIFY_MARKERS.some((re) => re.test(t))) return true;
  if (/^CRM\.\s*New event added to/i.test(meta.subject || "")) return true;
  if (meta.source === "talk") {
    if (CRM_NOTIFY_MARKERS.some((re) => re.test(t))) return true;
    if (/notify/i.test(t) && /Deals\.aspx\?id=/i.test(t)) return true;
    if (/added.*event/i.test(t) && /Deals\.aspx\?id=/i.test(t)) return true;
    const lines = t
      .replace(/<[^>]+>/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const hasUrl = lines.some((l) => /Deals\.aspx\?id=/i.test(l) || /\/Products\/CRM\/Deals/i.test(l));
    const hasBody = lines.some(
      (l) =>
        l.length > 2 &&
        !/Deals\.aspx|Products\/CRM|https?:\/\//i.test(l) &&
        !CRM_NOTIFY_MARKERS.some((re) => re.test(l))
    );
    return hasUrl && (hasBody || /CRM\./i.test(t));
  }
  return false;
}

function extractCrmNotifyFromText(text, meta = {}) {
  if (!isCrmRelationshipNotifyText(text, meta)) return null;
  const plain = String(text)
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r/g, "")
    .trim();
  const id = opportunityIdFromText(plain);
  if (!id) return null;

  let title =
    meta.title ||
    plain.match(/CRM\.\s*New event added to\s+(.+?)(?:\n|$)/i)?.[1]?.trim() ||
    plain.match(/New event added to\s+"([^"]+)"/i)?.[1]?.trim();
  title = (title || `Opportunity #${id}`).replace(/\s*\(.*\)\s*$/, "").trim();

  let eventText = toPlainDisplayText(plain);
  const lines = plain.split("\n").map((l) => toPlainDisplayText(l)).filter(Boolean);
  for (const line of lines) {
    if (/Deals\.aspx\?id=/i.test(line) || /\/Products\/CRM\/Deals/i.test(line)) continue;
    if (CRM_NOTIFY_MARKERS.some((re) => re.test(line))) continue;
    if (isNotifyTemplateSpam(line)) continue;
    if (line.length < 2) continue;
    eventText = line;
    break;
  }
  if (!eventText || isNotifyTemplateSpam(eventText)) {
    eventText = "New opportunity event";
  }

  return {
    id,
    title,
    author: meta.author || "Another user",
    authorId: meta.authorId || null,
    text: eventText.slice(0, 220),
    date: meta.date,
    source: meta.source || "notify",
  };
}

function parseTalkNotifyMessage(msg) {
  const norm = normalizeTalkMessage(msg);
  if (!norm.text?.trim()) return null;
  const author = displayNameForUserName(norm.userName);
  return extractCrmNotifyFromText(norm.text, {
    author,
    date: norm.dateTime,
    source: "talk",
  });
}

function parseMailNotifyMessage(mail) {
  const subject = mail.subject || mail.Subject || "";
  const body =
    mail.textBody ||
    mail.TextBody ||
    mail.plainText ||
    mail.PlainText ||
    mail.preview ||
    mail.Preview ||
    mail.introduction ||
    mail.Introduction ||
    "";
  const combined = `${subject}\n${body}`;
  const from = mail.from || mail.From || mail.fromEmail || mail.FromEmail;
  const author =
    (typeof from === "string" ? from : from?.displayName || from?.title || from?.email) || "Another user";
  const date =
    mail.dateSent?.value ??
    mail.dateSent ??
    mail.DateSent?.value ??
    mail.DateSent ??
    mail.receivedDate?.value ??
    mail.receivedDate;

  if (!/^CRM\.\s*New event added to/i.test(subject) && !isCrmRelationshipNotifyText(combined, { subject })) {
    return null;
  }

  let parsed = extractCrmNotifyFromText(combined, {
    author,
    title: subject.replace(/^CRM\.\s*New event added to\s+/i, "").trim(),
    date,
    source: "mail",
    subject,
  });

  if (!parsed && /^CRM\.\s*New event added to/i.test(subject)) {
    const id = opportunityIdFromText(body) || opportunityIdFromText(mail.htmlBody || mail.HtmlBody || "");
    if (id) {
      const eventText = toPlainDisplayText(body || subject);
      parsed = {
        id,
        title: subject.replace(/^CRM\.\s*New event added to\s+/i, "").trim() || `Opportunity #${id}`,
        author,
        text: eventText && !isNotifyTemplateSpam(eventText) ? eventText : "New opportunity event",
        date,
        source: "mail",
      };
    }
  }
  return parsed;
}

async function loadPortalUsers() {
  try {
    const params = new URLSearchParams({
      startIndex: "0",
      count: "300",
      employeeStatus: "Active",
    });
    const data = await api(`/api/2.0/people/filter?${params}`);
    state.portalUsers = unwrap(data)
      .map((u) => ({
        id: u.id ?? u.ID,
        displayName: u.displayName || u.DisplayName || u.userName || u.UserName || u.id,
      }))
      .filter((u) => u.id);
    state.portalUsers.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  } catch {
    state.portalUsers = [];
  }
}

function renderFeedNotificationItem(it) {
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.feedKey = it.key;

  const row = document.createElement("div");
  row.className = "feed-item-row";

  const body = document.createElement("div");
  body.className = "feed-item-body";
  const a = document.createElement("a");
  a.href = crmOpportunityUrl(it.id);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = it.title;
  const meta = document.createElement("span");
  meta.className = "feed-meta";
  const when = it.date ? new Date(it.date).toLocaleString() : "";
  meta.textContent = `${it.author}${when ? " · " + when : ""} — ${it.text}`;
  body.appendChild(a);
  body.appendChild(meta);

  const hideBtn = document.createElement("button");
  hideBtn.type = "button";
  hideBtn.className = "feed-hide-btn";
  hideBtn.title = "Hide this notification (stays hidden after refresh)";
  hideBtn.setAttribute("aria-label", "Hide notification");
  hideBtn.textContent = "Hide";
  hideBtn.addEventListener("click", () => {
    hideFeedNotification(it);
    state.feedNotificationsCache = state.feedNotificationsCache.filter((n) => n.key !== it.key);
    li.classList.add("feed-item-hiding");
    setTimeout(() => {
      li.remove();
      renderFeedNotificationList();
    }, 200);
  });

  row.appendChild(body);
  row.appendChild(hideBtn);
  li.appendChild(row);
  return li;
}

async function loadNotificationFeed({ force = false } = {}) {
  renderFeedTile();
  if (tileBodyCollapsed("tile-feed")) {
    showTileCollapsedHint("tile-feed", "Minimized — expand to load notifications");
    return;
  }
  const list = $("#notification-feed");
  if (!list) return;

  if (!state.hiddenFeedEntries.size) {
    state.hiddenFeedEntries = loadHiddenFeedEntriesFromStorage();
    pruneHiddenFeedEntries();
  }

  if (!force && isFeedCacheFresh() && state.feedRawItems.length) {
    renderFeedNotificationList();
    return;
  }

  state.feedLoading = true;
  updateFeedLoadingUi();
  list.innerHTML = '<li class="feed-loading">Loading notifications…</li>';
  updatePanelTileCount("tile-feed", 0);

  const periodFrom = feedWindowStart();
  const pagination = newFeedPagination();
  state.feedPagination = pagination;

  try {
    const historyItems = await loadCrmRelationshipNotifyEventsBulk(periodFrom, pagination);
    pagination.rawItems.push(...historyItems);

    const mailItems = await fetchFeedMailInitial(periodFrom, pagination.rawItems);
    pagination.rawItems.push(...mailItems);
    pagination.mailPage = 2;
    if (mailItems.length < FEED_MAIL_PAGE_SIZE) pagination.mailExhausted = true;

    if (!tileBodyCollapsed("tile-feed")) commitFeedRawItems(pagination.rawItems);
  } catch {
    if (!tileBodyCollapsed("tile-feed")) commitFeedRawItems(pagination.rawItems);
  } finally {
    state.feedLoading = false;
    updateFeedLoadingUi();
  }
}

function hideFeedNotification(it) {
  if (!it?.key) return;
  const prev = state.hiddenFeedEntries.get(it.key);
  state.hiddenFeedEntries.set(it.key, {
    hiddenAt: new Date().toISOString(),
    snapshot: {
      id: it.id,
      title: it.title,
      text: it.text,
      author: it.author,
      date: it.date,
    },
  });
  saveHiddenFeedEntries();
}

function unhideFeedNotification(key) {
  if (!key) return;
  state.hiddenFeedEntries.delete(key);
  saveHiddenFeedEntries();
}

const FEED_HIDDEN_ICON_HTML = `<svg class="tile-toolbar-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`;

function updateFeedHiddenToolbarButton() {
  const btn = document.querySelector(".btn-feed-hidden-toggle");
  if (!btn) return;
  pruneHiddenFeedEntries();
}

function ensureFeedHiddenToolbarButton(tileEl) {
  if (!tileEl || tileEl.dataset.tileId !== "tile-feed") return;
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar");
  if (!toolbar || toolbar.querySelector(".btn-feed-hidden-toggle")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tile-btn tile-btn-icon btn-feed-hidden-toggle";
  btn.title = "Show hidden notifications";
  btn.setAttribute("aria-label", "Show hidden notifications");
  btn.innerHTML = FEED_HIDDEN_ICON_HTML;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openFeedHiddenModal();
  });

  const refreshBtn = toolbar.querySelector(".btn-tile-refresh");
  if (refreshBtn) toolbar.insertBefore(btn, refreshBtn);
  else {
    const layoutBtns = toolbar.querySelector(".tile-layout-btns");
    if (layoutBtns) toolbar.insertBefore(btn, layoutBtns);
    else toolbar.appendChild(btn);
  }
  updateFeedHiddenToolbarButton();
}

function openFeedHiddenModal() {
  const modal = $("#feed-hidden-modal");
  if (!modal) return;
  renderFeedHiddenModalList();
  modal.classList.remove("hidden");
}

function closeFeedHiddenModal() {
  $("#feed-hidden-modal")?.classList.add("hidden");
}

function renderFeedHiddenModalList() {
  const list = $("#feed-hidden-list");
  if (!list) return;
  pruneHiddenFeedEntries();
  const entries = [...state.hiddenFeedEntries.entries()].sort((a, b) => {
    const ta = new Date(a[1].hiddenAt).getTime();
    const tb = new Date(b[1].hiddenAt).getTime();
    return tb - ta;
  });

  list.innerHTML = "";
  if (!entries.length) {
    list.innerHTML = `<li class="feed-hidden-empty">No hidden notifications. Hidden items are kept for ${HIDDEN_FEED_RETENTION_DAYS} days.</li>`;
    return;
  }

  for (const [key, entry] of entries) {
    const snap = entry.snapshot || {};
    const li = document.createElement("li");
    li.className = "feed-hidden-item";

    const body = document.createElement("div");
    body.className = "feed-item-body";
    if (snap.id != null) {
      const a = document.createElement("a");
      a.href = crmOpportunityUrl(snap.id);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = snap.title || `Opportunity #${snap.id}`;
      body.appendChild(a);
    } else {
      const span = document.createElement("span");
      span.textContent = snap.title || "Notification";
      body.appendChild(span);
    }
    const meta = document.createElement("span");
    meta.className = "feed-meta";
    const when = snap.date ? new Date(snap.date).toLocaleString() : "";
    const hiddenWhen = entry.hiddenAt ? new Date(entry.hiddenAt).toLocaleDateString() : "";
    meta.textContent = `${snap.author || ""}${when ? " · " + when : ""}${snap.text ? " — " + snap.text : ""}${hiddenWhen ? ` · Hidden ${hiddenWhen}` : ""}`;
    body.appendChild(meta);

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "feed-restore-btn";
    restoreBtn.textContent = "Show";
    restoreBtn.title = "Show this notification in the feed again";
    restoreBtn.addEventListener("click", async () => {
      unhideFeedNotification(key);
      li.remove();
      if (!state.hiddenFeedEntries.size) {
        list.innerHTML = `<li class="feed-hidden-empty">No hidden notifications. Hidden items are kept for ${HIDDEN_FEED_RETENTION_DAYS} days.</li>`;
      }
      renderFeedNotificationList();
    });

    li.appendChild(body);
    li.appendChild(restoreBtn);
    list.appendChild(li);
  }
}

function bindFeedHiddenModal() {
  const modal = $("#feed-hidden-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";
  $("#feed-hidden-close")?.addEventListener("click", closeFeedHiddenModal);
  modal.querySelectorAll("[data-feed-hidden-dismiss]").forEach((el) => {
    el.addEventListener("click", closeFeedHiddenModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeFeedHiddenModal();
  });
}

const TILE_REFRESH_ICON_HTML = `<svg class="tile-refresh-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg>`;

let lastDashboardActivityAt = Date.now();
let panelTileAutoRefreshTimer = null;

function noteDashboardActivity() {
  lastDashboardActivityAt = Date.now();
}

function isDashboardActivityFresh() {
  return Date.now() - lastDashboardActivityAt < DASHBOARD_IDLE_STOP_MS;
}

function isDashboardAppVisible() {
  const app = $("#app");
  return app && !app.classList.contains("hidden");
}

async function refreshAutoRefreshTilesQuietly() {
  if (!isDashboardAppVisible() || !isDashboardActivityFresh()) return;
  await loadExpandedDashboardTiles({ quiet: true });
}

function stopPanelTileAutoRefresh() {
  if (panelTileAutoRefreshTimer != null) {
    clearInterval(panelTileAutoRefreshTimer);
    panelTileAutoRefreshTimer = null;
  }
}

function startPanelTileAutoRefresh() {
  stopPanelTileAutoRefresh();
  panelTileAutoRefreshTimer = setInterval(() => {
    refreshAutoRefreshTilesQuietly().catch((err) => showToast(err.message, true));
  }, PANEL_TILE_AUTO_REFRESH_MS);
}

function bindDashboardActivityTracking() {
  if (bindDashboardActivityTracking._bound) return;
  bindDashboardActivityTracking._bound = true;
  const mark = () => noteDashboardActivity();
  const opts = { capture: true, passive: true };
  document.addEventListener("mousedown", mark, opts);
  document.addEventListener("keydown", mark, opts);
  document.addEventListener("touchstart", mark, opts);
  document.addEventListener("scroll", mark, opts);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) noteDashboardActivity();
  });
}

function ensureTileAutoRefreshButton(tileEl, tileId) {
  if (!isAutoRefreshTileId(tileId)) return;
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar, :scope > .group-tile-bar");
  if (!toolbar || toolbar.querySelector(".btn-tile-refresh")) return;

  let label = "Refresh tile";
  if (tileId === "tile-feed") label = "Refresh notifications";
  else if (tileId === "tile-tasks") label = "Refresh tasks";
  else if (tileId.startsWith("calendar-")) label = "Refresh calendar";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tile-btn tile-btn-icon btn-tile-refresh";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = TILE_REFRESH_ICON_HTML;
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    noteDashboardActivity();
    btn.disabled = true;
    btn.classList.add("is-refreshing");
    try {
      await loadTileCrmData(tileId, { force: true });
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-refreshing");
    }
  });

  const countBadge = toolbar.querySelector(".tile-toolbar-count");
  if (countBadge?.nextSibling) toolbar.insertBefore(btn, countBadge.nextSibling);
  else toolbar.appendChild(btn);
}

function ensureTasksNewTaskButton(tileEl) {
  if (!tileEl || tileEl.dataset.tileId !== "tile-tasks") return;
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar");
  if (!toolbar || toolbar.querySelector(".btn-new-task")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary btn-new-task";
  btn.textContent = "New task";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openNewTaskModal().catch((err) => showToast(err.message, true));
  });
  const layoutBtns = toolbar.querySelector(".tile-layout-btns");
  if (layoutBtns) toolbar.insertBefore(btn, layoutBtns);
  else toolbar.appendChild(btn);
}

function setDealEditError(message) {
  const el = $("#deal-edit-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function closeDealEditModal() {
  const modal = $("#deal-edit-modal");
  if (modal) modal.classList.add("hidden");
  state.dealEdit = null;
  setDealEditError("");
}

function tagIdForTitle(title, catalog = buildTagCatalog()) {
  const key = normalizeTagTitle(title).toLowerCase();
  return catalog.byTitleLower.get(key)?.id ?? null;
}

function renderOpportunityTagChips(mode) {
  const isQuickNote = mode === "quickNote";
  const edit = isQuickNote ? state.quickNote : state.dealEdit;
  const wrap = $(isQuickNote ? "#quick-note-tags" : "#deal-edit-tags");
  const addSel = $(isQuickNote ? "#quick-note-tag-add" : "#deal-edit-tag-add");
  if (!wrap || !edit) return;

  wrap.innerHTML = "";
  const catalog = buildTagCatalog();
  const current = new Set(edit.tags.map((t) => normalizeTagTitle(t)).filter(Boolean));

  for (const title of [...current].sort((a, b) => a.localeCompare(b))) {
    const chip = document.createElement("span");
    chip.className = "deal-edit-tag";
    chip.dataset.tagTitle = title;
    chip.appendChild(document.createTextNode(title));
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "deal-edit-tag-remove";
    rm.setAttribute("aria-label", `Remove tag ${title}`);
    rm.textContent = "×";
    rm.addEventListener("click", () => {
      edit.tags = edit.tags.filter((t) => !tagsEqual(t, title, catalog));
      renderOpportunityTagChips(mode);
    });
    chip.appendChild(rm);
    wrap.appendChild(chip);
  }

  if (addSel) {
    const prev = addSel.value;
    addSel.innerHTML = '<option value="">Add tag…</option>';
    for (const tag of state.allTags) {
      const title = normalizeTagTitle(tag.title ?? tag);
      if (!title || current.has(title)) continue;
      const opt = document.createElement("option");
      opt.value = title;
      opt.textContent = title;
      addSel.appendChild(opt);
    }
    addSel.value = prev && [...addSel.options].some((o) => o.value === prev) ? prev : "";
  }
}

function renderDealEditTagChips() {
  renderOpportunityTagChips("dealEdit");
}

function renderQuickNoteTagChips() {
  renderOpportunityTagChips("quickNote");
}

function populateDealEditStageSelect(opp) {
  const sel = $("#deal-edit-stage");
  if (!sel) return;
  const current = String(resolveOppStageId(opp));
  sel.innerHTML = "";
  for (const stage of state.stages) {
    const opt = document.createElement("option");
    opt.value = String(stage.id ?? stage.ID ?? "");
    opt.textContent = stage.title || stage.Title || opt.value;
    if (String(opt.value) === current) opt.selected = true;
    sel.appendChild(opt);
  }
}

function populateNotifyUserSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const users = new Map();
  for (const u of state.portalUsers) {
    if (u.id != null) users.set(String(u.id), u.displayName || u.id);
  }
  if (state.currentUserId != null) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }
  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    selectEl.appendChild(opt);
  }
}

function populateDealEditNotifySelect() {
  populateNotifyUserSelect($("#deal-edit-notify"));
}

function populateQuickNoteNotifySelect() {
  populateNotifyUserSelect($("#quick-note-notify"));
}

async function loadDealEditTags(opp) {
  let tags = getOppTagsFromRecord(opp);
  const id = opp.id ?? opp.ID;
  if (!tags.length && id != null) {
    try {
      tags = unwrapEntityTags(await api(`/api/2.0/crm/opportunity/tag/${id}`));
      opp.tags = tags;
    } catch {
      /* no tags */
    }
  }
  return tags;
}

async function openDealEditModal(opp, group) {
  const modal = $("#deal-edit-modal");
  const form = $("#deal-edit-form");
  if (!modal || !form) return;

  const id = opp.id ?? opp.ID;
  if (id == null) throw new Error("Opportunity id missing");

  setDealEditError("");
  form.reset();

  if (!state.stages.length) await loadStages();
  if (!state.allTags.length) await loadAllTags();
  if (!state.portalUsers.length) await loadPortalUsers();
  await loadHistoryCategories();
  populateDealEditNoteCategorySelect();

  const tags = await loadDealEditTags(opp);
  state.dealEdit = {
    oppId: Number(id),
    group,
    oppTitle: opp.title || opp.Title || `Opportunity #${id}`,
    initialTags: [...tags],
    tags: [...tags],
    initialStageId: String(resolveOppStageId(opp)),
    initialDue: dueDateToInputValue(opportunityDueDateRaw(opp)),
  };

  const titleEl = $("#deal-edit-modal-title");
  if (titleEl) titleEl.textContent = state.dealEdit.oppTitle;

  const crmLink = $("#deal-edit-crm-link");
  if (crmLink) crmLink.href = crmOpportunityUrl(id);

  const dueInput = $("#deal-edit-due");
  if (dueInput) dueInput.value = state.dealEdit.initialDue;

  populateDealEditStageSelect(opp);
  populateDealEditNotifySelect();
  renderDealEditTagChips();

  modal.classList.remove("hidden");
  $("#deal-edit-due")?.focus();
}

async function createOpportunityHistoryEvent(oppId, { content, categoryId, notifyUserList }) {
  const html = plainTextToNoteHtml(content);
  if (!html) throw new Error("Note text is required");

  const body = {
    entityType: "opportunity",
    entityId: oppId,
    contactId: 0,
    content: html,
    categoryId,
  };

  if (notifyUserList?.length) body.notifyUserList = notifyUserList;

  await api("/api/2.0/crm/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function plainTextToNoteHtml(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join("<br/>");
}

async function applyDealTagChanges(oppId, initialTags, nextTags) {
  if (!dealTagsChanged(initialTags, nextTags)) return;

  const catalog = buildTagCatalog();
  const initialSet = new Set(initialTags.map((t) => tagLookupKey(t, catalog)).filter(Boolean));
  const nextSet = new Set(nextTags.map((t) => tagLookupKey(t, catalog)).filter(Boolean));

  const toAdd = nextTags.filter((t) => {
    const key = tagLookupKey(t, catalog);
    return key && !initialSet.has(key);
  });
  const toRemove = initialTags.filter((t) => {
    const key = tagLookupKey(t, catalog);
    return key && !nextSet.has(key);
  });

  for (const title of toAdd) {
    await addOpportunityTag(oppId, title);
  }

  for (const title of toRemove) {
    await removeOpportunityTag(oppId, title);
  }
}

async function submitDealEditForm(e) {
  e.preventDefault();
  setDealEditError("");
  const ctx = state.dealEdit;
  if (!ctx) return;

  const submitBtn = $("#deal-edit-submit");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const oppId = ctx.oppId;
    const dueVal = $("#deal-edit-due")?.value ?? "";
    const stageId = $("#deal-edit-stage")?.value ?? "";
    const noteBody = $("#deal-edit-note-body")?.value?.trim() ?? "";
    const notifySel = $("#deal-edit-notify");
    const notifyUserList = notifySel
      ? [...notifySel.selectedOptions].map((o) => o.value).filter(Boolean)
      : [];
    const dueChanged = dueVal !== ctx.initialDue;
    const stageChanged = stageId && stageId !== ctx.initialStageId;

    if (dueChanged) {
      try {
        await updateOpportunityDueDate(oppId, dueVal);
      } catch (err) {
        throw dealEditStepError("Due date", err);
      }
    }

    if (stageChanged) {
      try {
        await updateOpportunityStage(oppId, stageId);
      } catch (err) {
        throw dealEditStepError("Stage", err);
      }
    }

    if (dealTagsChanged(ctx.initialTags, ctx.tags)) {
      try {
        await applyDealTagChanges(oppId, ctx.initialTags, ctx.tags);
      } catch (err) {
        throw dealEditStepError("Tags", err);
      }
    }

    if (noteBody) {
      try {
        const categoryId = resolveHistoryCategoryId($("#deal-edit-note-category")?.value);
        await createOpportunityHistoryEvent(oppId, {
          content: noteBody,
          categoryId,
          notifyUserList,
        });
      } catch (err) {
        throw dealEditStepError("Event note", err);
      }
    }

    const group = ctx.group;
    closeDealEditModal();
    showToast("Deal updated");
    if (group) await refreshGroup(group);
    else await refreshAll();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setDealEditError(msg || "Could not save deal");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function bindDealEditModal() {
  const modal = $("#deal-edit-modal");
  const form = $("#deal-edit-form");
  if (!modal || !form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", (e) => {
    submitDealEditForm(e).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setDealEditError(msg || "Could not save deal");
    });
  });

  $("#deal-edit-cancel")?.addEventListener("click", closeDealEditModal);
  modal.querySelectorAll("[data-deal-edit-dismiss]").forEach((el) => {
    el.addEventListener("click", closeDealEditModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeDealEditModal();
  });

  $("#deal-edit-tag-add")?.addEventListener("change", (e) => {
    const title = e.target.value;
    if (!title || !state.dealEdit) return;
    if (!state.dealEdit.tags.some((t) => tagsEqual(t, title))) {
      state.dealEdit.tags.push(title);
      renderDealEditTagChips();
    }
    e.target.value = "";
  });
}

function setQuickNoteError(message) {
  const el = $("#quick-note-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function closeQuickNoteModal() {
  const modal = $("#quick-note-modal");
  if (modal) modal.classList.add("hidden");
  state.quickNote = null;
  setQuickNoteError("");
}

function clearQuickNoteOpportunitySelection() {
  state.quickNote = null;
  const search = $("#quick-note-opportunity-search");
  const selected = $("#quick-note-opportunity-selected");
  const crmLink = $("#quick-note-crm-link");
  if (search) search.value = "";
  if (selected) selected.textContent = "";
  if (crmLink) {
    crmLink.classList.add("hidden");
    crmLink.href = "#";
  }
  const due = $("#quick-note-due");
  if (due) due.value = "";
  const tags = $("#quick-note-tags");
  if (tags) tags.innerHTML = "";
}

function updateQuickNoteOpportunitySelectedUi() {
  const ctx = state.quickNote;
  const selected = $("#quick-note-opportunity-selected");
  const search = $("#quick-note-opportunity-search");
  const crmLink = $("#quick-note-crm-link");
  if (!selected) return;
  if (ctx?.oppId) {
    selected.innerHTML = `${escapeHtml(ctx.oppTitle || `Opportunity #${ctx.oppId}`)} <span class="contact-clear" role="button" tabindex="0">clear</span>`;
    $(".contact-clear", selected)?.addEventListener("click", () => {
      clearQuickNoteOpportunitySelection();
      renderQuickNoteTagChips();
    });
    if (crmLink) {
      crmLink.href = crmOpportunityUrl(ctx.oppId);
      crmLink.classList.remove("hidden");
    }
    if (search) search.value = "";
  } else {
    selected.textContent = "";
    if (crmLink) crmLink.classList.add("hidden");
  }
}

async function applyQuickNoteOpportunity(oppSummary) {
  const id = Number(oppSummary.id ?? oppSummary.ID);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid opportunity");

  const opp = await fetchOpportunityForUpdate(id);
  if (!opp) throw new Error("Could not load opportunity");

  if (!state.allTags.length) await loadAllTags();
  const tags = await loadDealEditTags(opp);
  const oppId = Number(opp.id ?? opp.ID ?? id);

  state.quickNote = {
    oppId,
    oppTitle: opp.title || opp.Title || oppSummary.title || `Opportunity #${oppId}`,
    initialTags: [...tags],
    tags: [...tags],
    initialDue: dueDateToInputValue(opportunityDueDateRaw(opp)),
    group: state.groups.find((g) => (g.opportunities || []).some((o) => Number(o.id ?? o.ID) === oppId)) || null,
  };

  const dueInput = $("#quick-note-due");
  if (dueInput) dueInput.value = state.quickNote.initialDue;

  updateQuickNoteOpportunitySelectedUi();
  renderQuickNoteTagChips();
  $("#quick-note-note-body")?.focus();
}

async function openQuickNoteModal() {
  const modal = $("#quick-note-modal");
  const form = $("#quick-note-form");
  if (!modal || !form) return;

  setQuickNoteError("");
  form.reset();
  clearQuickNoteOpportunitySelection();
  state.quickNote = null;

  await loadHistoryCategories();
  populateQuickNoteCategorySelect();
  if (!state.allTags.length) await loadAllTags();
  if (!state.portalUsers.length) await loadPortalUsers();
  populateQuickNoteNotifySelect();

  const results = $("#quick-note-opportunity-results");
  if (results) results.classList.add("hidden");

  modal.classList.remove("hidden");
  $("#quick-note-opportunity-search")?.focus();
}

async function submitQuickNoteForm(e) {
  e.preventDefault();
  setQuickNoteError("");
  const ctx = state.quickNote;
  if (!ctx?.oppId) {
    setQuickNoteError("Select an opportunity for this note.");
    return;
  }

  const noteBody = $("#quick-note-note-body")?.value?.trim() ?? "";
  if (!noteBody) {
    setQuickNoteError("Event note is required.");
    return;
  }

  const submitBtn = $("#quick-note-submit");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const oppId = ctx.oppId;
    const dueVal = $("#quick-note-due")?.value ?? "";
    const notifySel = $("#quick-note-notify");
    const notifyUserList = notifySel
      ? [...notifySel.selectedOptions].map((o) => o.value).filter(Boolean)
      : [];
    const dueChanged = dueVal !== ctx.initialDue;
    const categoryId = resolveHistoryCategoryId($("#quick-note-note-category")?.value);

    if (dueChanged) {
      try {
        await updateOpportunityDueDate(oppId, dueVal);
      } catch (err) {
        throw dealEditStepError("Due date", err);
      }
    }

    if (dealTagsChanged(ctx.initialTags, ctx.tags)) {
      try {
        await applyDealTagChanges(oppId, ctx.initialTags, ctx.tags);
      } catch (err) {
        throw dealEditStepError("Tags", err);
      }
    }

    try {
      await createOpportunityHistoryEvent(oppId, {
        content: noteBody,
        categoryId,
        notifyUserList,
      });
    } catch (err) {
      throw dealEditStepError("Event note", err);
    }

    const group = ctx.group;
    closeQuickNoteModal();
    showToast("Note saved");
    if (group) await refreshGroup(group);
    else await refreshAll();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setQuickNoteError(msg || "Could not save note");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function bindQuickNoteOpportunityPicker() {
  const input = $("#quick-note-opportunity-search");
  const results = $("#quick-note-opportunity-results");
  if (!input || !results || input.dataset.bound) return;
  input.dataset.bound = "1";
  let debounce;

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 1) {
        results.classList.add("hidden");
        return;
      }
      try {
        const opps = await searchOpportunitiesByTitle(q);
        results.classList.remove("hidden");
        if (!opps.length) {
          results.innerHTML = '<button type="button" disabled>No matches</button>';
          return;
        }
        for (const o of opps) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = o.title;
          btn.addEventListener("click", () => {
            results.classList.add("hidden");
            applyQuickNoteOpportunity(o).catch((err) => setQuickNoteError(err.message));
          });
          results.appendChild(btn);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    }, 300);
  });

  document.addEventListener("click", (e) => {
    const wrap = input.closest(".opportunity-picker-field");
    if (wrap && !wrap.contains(e.target)) results.classList.add("hidden");
  });
}

function bindQuickNoteModal() {
  const modal = $("#quick-note-modal");
  const form = $("#quick-note-form");
  if (!modal || !form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", (e) => {
    submitQuickNoteForm(e).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setQuickNoteError(msg || "Could not save note");
    });
  });

  $("#quick-note-cancel")?.addEventListener("click", closeQuickNoteModal);
  modal.querySelectorAll("[data-quick-note-dismiss]").forEach((el) => {
    el.addEventListener("click", closeQuickNoteModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeQuickNoteModal();
  });

  $("#quick-note-tag-add")?.addEventListener("change", (e) => {
    const title = e.target.value;
    if (!title || !state.quickNote) return;
    if (!state.quickNote.tags.some((t) => tagsEqual(t, title))) {
      state.quickNote.tags.push(title);
      renderQuickNoteTagChips();
    }
    e.target.value = "";
  });

  bindQuickNoteOpportunityPicker();
}

function setCreateOpportunityError(message) {
  const el = $("#create-opportunity-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function closeCreateOpportunityModal() {
  const modal = $("#create-opportunity-modal");
  if (modal) modal.classList.add("hidden");
  setCreateOpportunityError("");
  state.newOpportunityDraft = null;
}

function resetNewOpportunityDraft() {
  state.newOpportunityDraft = {
    contactId: null,
    contactLabel: "",
    tags: [],
  };
}

function createOppCustomFieldInputKind(def) {
  const code = customFieldTypeCode(def);
  if (code === 1) return "textarea";
  if (code === 2) return "select";
  if (code === 3) return "checkbox";
  if (code === 4) return "heading";
  if (code === 5) return "date";
  return "text";
}

function parseCustomFieldSelectOptions(def) {
  if (customFieldTypeCode(def) !== 2) return [];
  const raw = def?.mask ?? def?.Mask ?? def?.valueList ?? def?.ValueList ?? def?.options ?? def?.Options;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((o) => String(o?.title ?? o?.Title ?? o?.value ?? o ?? "").trim()).filter(Boolean);
  }
  const str = String(raw).trim();
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed.map((o) => String(o ?? "").trim()).filter(Boolean);
  } catch {
    /* mask is not a JSON option list */
  }
  return [];
}

function parseCustomFieldTextMaxLength(def) {
  if (customFieldTypeCode(def) !== 0) return null;
  const raw = def?.mask ?? def?.Mask;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "object" ? raw : JSON.parse(String(raw));
    const size = Number(parsed?.size ?? parsed?.Size);
    return Number.isFinite(size) && size > 0 ? size : null;
  } catch {
    return null;
  }
}

function buildCreateOppCustomFieldInput(def, fieldId) {
  const kind = createOppCustomFieldInputKind(def);
  const id = `create-opp-cf-${fieldId}`;

  if (kind === "checkbox") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.dataset.customFieldId = String(fieldId);
    return input;
  }

  if (kind === "select") {
    const input = document.createElement("select");
    input.id = id;
    input.dataset.customFieldId = String(fieldId);
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "—";
    input.appendChild(empty);
    for (const optText of parseCustomFieldSelectOptions(def)) {
      const opt = document.createElement("option");
      opt.value = optText;
      opt.textContent = optText;
      input.appendChild(opt);
    }
    return input;
  }

  if (kind === "textarea") {
    const input = document.createElement("textarea");
    input.id = id;
    input.dataset.customFieldId = String(fieldId);
    input.rows = 3;
    try {
      const mask = JSON.parse(def.mask ?? def.Mask ?? "{}");
      if (mask.rows) input.rows = Number(mask.rows) || 3;
      if (mask.cols) input.style.width = "100%";
    } catch {
      /* default */
    }
    return input;
  }

  if (kind === "date") {
    const input = document.createElement("input");
    input.type = "date";
    input.id = id;
    input.dataset.customFieldId = String(fieldId);
    return input;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.dataset.customFieldId = String(fieldId);
  const maxLen = parseCustomFieldTextMaxLength(def);
  if (maxLen) input.maxLength = maxLen;
  return input;
}

function populateCreateOppStageSelect() {
  const sel = $("#create-opp-stage");
  if (!sel) return;
  sel.innerHTML = "";
  for (const stage of state.stages) {
    const opt = document.createElement("option");
    opt.value = String(stage.id ?? stage.ID ?? "");
    opt.textContent = stage.title || stage.Title || opt.value;
    sel.appendChild(opt);
  }
  if (sel.options.length) sel.selectedIndex = 0;
}

function populateCreateOppResponsibleSelect() {
  const sel = $("#create-opp-responsible");
  if (!sel) return;
  sel.innerHTML = "";
  const users = new Map();
  for (const u of state.portalUsers) {
    if (u.id != null) users.set(String(u.id), u.displayName || u.id);
  }
  if (state.currentUserId != null) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }
  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (state.currentUserId != null) sel.value = String(state.currentUserId);
}

function populateCreateOppAccessSelect() {
  const sel = $("#create-opp-access");
  if (!sel) return;
  sel.innerHTML = "";
  const users = new Map();
  for (const u of state.portalUsers) {
    if (u.id != null) users.set(String(u.id), u.displayName || u.id);
  }
  if (state.currentUserId != null) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }
  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (state.currentUserId != null) {
    for (const opt of sel.options) {
      if (opt.value === String(state.currentUserId)) opt.selected = true;
    }
  }
}

function populateCreateOppTagAddSelect() {
  const sel = $("#create-opp-tag-add");
  if (!sel || !state.newOpportunityDraft) return;
  const current = new Set(state.newOpportunityDraft.tags.map((t) => normalizeTagTitle(t)).filter(Boolean));
  sel.innerHTML = '<option value="">Add tag…</option>';
  for (const tag of state.allTags) {
    const title = normalizeTagTitle(tag.title ?? tag);
    if (!title || current.has(title)) continue;
    const opt = document.createElement("option");
    opt.value = title;
    opt.textContent = title;
    sel.appendChild(opt);
  }
}

function renderCreateOppTagChips() {
  const wrap = $("#create-opp-tags");
  const draft = state.newOpportunityDraft;
  if (!wrap || !draft) return;
  wrap.innerHTML = "";
  const catalog = buildTagCatalog();
  for (const title of draft.tags) {
    const chip = document.createElement("span");
    chip.className = "deal-edit-tag";
    chip.appendChild(document.createTextNode(normalizeTagTitle(title)));
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "deal-edit-tag-remove";
    rm.setAttribute("aria-label", `Remove tag ${title}`);
    rm.textContent = "×";
    rm.addEventListener("click", () => {
      draft.tags = draft.tags.filter((t) => !tagsEqual(t, title, catalog));
      renderCreateOppTagChips();
      populateCreateOppTagAddSelect();
    });
    chip.appendChild(rm);
    wrap.appendChild(chip);
  }
  populateCreateOppTagAddSelect();
}

function updateCreateOppContactSelectedUi() {
  const draft = state.newOpportunityDraft;
  const selected = $("#create-opp-contact-selected");
  const search = $("#create-opp-contact-search");
  if (!draft || !selected) return;
  if (draft.contactId) {
    selected.innerHTML = `${escapeHtml(draft.contactLabel || `Contact #${draft.contactId}`)} <span class="contact-clear" role="button" tabindex="0">clear</span>`;
    $(".contact-clear", selected)?.addEventListener("click", () => {
      draft.contactId = null;
      draft.contactLabel = "";
      if (search) search.value = "";
      updateCreateOppContactSelectedUi();
    });
  } else {
    selected.textContent = "";
  }
}

function renderCreateOppCustomFields() {
  const wrap = $("#create-opp-custom-fields");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (!CREATE_OPP_USER_FIELDS_ENABLED) {
    const hint = document.createElement("p");
    hint.className = "field-hint create-opp-user-fields-unavailable";
    hint.title = "Custom user fields are not available yet";
    hint.textContent = "Custom user fields are not available yet.";
    wrap.appendChild(hint);
    return;
  }

  if (!state.customFieldDefs.length) {
    wrap.innerHTML =
      '<p class="field-hint">No user fields configured for opportunities in CRM (Settings → User Fields → Opportunities).</p>';
    return;
  }

  const legend = document.createElement("p");
  legend.className = "create-opp-legend";
  legend.textContent = "User fields";
  wrap.appendChild(legend);

  for (const def of state.customFieldDefs) {
    const fieldId = customFieldDefinitionId(def);
    if (fieldId == null) continue;
    if (isCreateOppExcludedUserField(def)) continue;

    const label = customFieldLabel(def) || `Field ${fieldId}`;
    const kind = createOppCustomFieldInputKind(def);

    if (kind === "heading") {
      const head = document.createElement("p");
      head.className = "create-opp-field-heading";
      head.textContent = label;
      wrap.appendChild(head);
      continue;
    }

    const field = document.createElement("div");
    field.className = "field";
    field.dataset.customFieldId = String(fieldId);

    const input = buildCreateOppCustomFieldInput(def, fieldId);

    if (kind === "checkbox") {
      const lbl = document.createElement("label");
      lbl.className = "checkbox-filter";
      lbl.appendChild(input);
      lbl.appendChild(document.createTextNode(` ${label}`));
      field.appendChild(lbl);
    } else {
      const lbl = document.createElement("label");
      lbl.setAttribute("for", input.id);
      lbl.textContent = label;
      field.appendChild(lbl);
      field.appendChild(input);
    }
    wrap.appendChild(field);
  }
}

function customFieldDefinitionId(def) {
  const id = def?.id ?? def?.ID ?? def?.fieldId ?? def?.FieldId;
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function formatCustomFieldValueForApi(def, rawValue) {
  const code = customFieldTypeCode(def);
  if (code === 3) {
    const t = String(rawValue ?? "").trim().toLowerCase();
    if (t === "false" || t === "0" || t === "no" || t === "off") return "false";
    return "true";
  }
  if (code === 5) {
    const raw = String(rawValue ?? "").trim();
    if (!raw) return "";
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const y = d.getFullYear();
    return `${m}/${day}/${y}`;
  }
  return String(rawValue ?? "").trim();
}

function collectCreateOppCustomFieldValues() {
  if (!CREATE_OPP_USER_FIELDS_ENABLED) return [];
  const values = [];
  const wrap = $("#create-opp-custom-fields");
  if (!wrap) return values;

  for (const def of state.customFieldDefs) {
    const fieldId = customFieldDefinitionId(def);
    if (fieldId == null) continue;
    if (isCreateOppExcludedUserField(def)) continue;
    if (createOppCustomFieldInputKind(def) === "heading") continue;

    const input = wrap.querySelector(`[data-custom-field-id="${String(fieldId)}"]`);
    if (!input) continue;

    let raw;
    if (input.type === "checkbox") {
      if (!input.checked) continue;
      raw = "true";
    } else {
      raw = String(input.value ?? "").trim();
      if (!raw) continue;
    }
    values.push({ fieldId, value: formatCustomFieldValueForApi(def, raw), def });
  }
  return values;
}

/** OnlyOffice ItemKeyValuePair<int,string> on create/update opportunity bodies. */
function buildCustomFieldListForApi(fieldValues) {
  return fieldValues.map(({ fieldId, value }) => ({
    Key: Number(fieldId),
    Value: String(value ?? ""),
  }));
}

function extractOpportunityCustomFieldList(opp) {
  const lists = [
    opp.customFields,
    opp.CustomFields,
    opp.customFieldList,
    opp.CustomFieldList,
    opp.fieldValues,
    opp.FieldValues,
  ];
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const fieldId = customFieldDefinitionId(item) ?? Number(item.id ?? item.ID ?? item.fieldId);
      if (!Number.isFinite(fieldId)) continue;
      const raw = item.value ?? item.Value ?? item.fieldValue ?? item.FieldValue;
      if (raw == null || raw === "") continue;
      const def = state.customFieldById.get(String(fieldId));
      out.push({ fieldId, value: formatCustomFieldValueForApi(def, raw), def });
    }
  }
  return out;
}

function mergeCustomFieldValues(existing, incoming) {
  const byId = new Map();
  for (const row of existing) {
    if (row?.fieldId != null) byId.set(Number(row.fieldId), row);
  }
  for (const row of incoming) {
    if (row?.fieldId != null) byId.set(Number(row.fieldId), row);
  }
  return [...byId.values()];
}

async function fetchOpportunityCustomFieldValues(oppId) {
  const paths = [
    `/api/2.0/crm/opportunity/${oppId}/customfield`,
    `/api/2.0/crm/opportunity/${oppId}/customfields`,
  ];
  for (const path of paths) {
    try {
      const list = unwrap(await api(path));
      if (list.length) return list;
    } catch {
      /* try next */
    }
  }
  return [];
}

function readSavedCustomFieldValue(item) {
  const raw = item?.fieldValue ?? item?.FieldValue ?? item?.value ?? item?.Value;
  if (raw == null) return "";
  return String(raw).trim();
}

function customFieldValuesMatch(want, got) {
  const a = String(want ?? "").trim();
  const b = String(got ?? "").trim();
  if (!a && !b) return true;
  if (a === b) return true;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  if (a === "true" && (b === "True" || b === "1")) return true;
  if (a === "false" && (b === "False" || b === "0")) return true;
  return false;
}

async function setOpportunityCustomFieldValue(oppId, fieldId, fieldValue) {
  const val = String(fieldValue ?? "");
  const qs = new URLSearchParams({ fieldValue: val }).toString();
  const path = `/api/2.0/crm/opportunity/${oppId}/customfield/${fieldId}`;
  const attempts = [
    () => api(`${path}?${qs}`, { method: "POST" }),
    () =>
      api(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldValue: val }),
      }),
    () =>
      api(path, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ fieldValue: val }).toString(),
      }),
  ];
  let lastErr;
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Could not set custom field");
}

async function updateOpportunityCustomFieldsViaPut(oppId, fieldValues) {
  const opp = await fetchOpportunityForUpdate(oppId);
  const existing = extractOpportunityCustomFieldList(opp);
  const merged = mergeCustomFieldValues(existing, fieldValues);
  const body = buildOpportunityPutBody(opp);
  body.customFieldList = buildCustomFieldListForApi(merged);
  await api(`/api/2.0/crm/opportunity/${oppId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function verifyOpportunityCustomFieldsSaved(oppId, fieldValues) {
  const saved = await fetchOpportunityCustomFieldValues(oppId);
  const missing = [];
  for (const { fieldId, value, def } of fieldValues) {
    const item = saved.find((row) => Number(row.id ?? row.ID) === Number(fieldId));
    const got = readSavedCustomFieldValue(item);
    if (!customFieldValuesMatch(value, got)) {
      const label = customFieldLabel(def) || `field #${fieldId}`;
      missing.push(label);
    }
  }
  if (missing.length) {
    throw new Error(`CRM did not store: ${missing.join(", ")}`);
  }
}

async function applyCreateOpportunityCustomFields(oppId, fieldValues) {
  if (!fieldValues.length) return;

  const failures = [];
  for (const row of fieldValues) {
    try {
      await setOpportunityCustomFieldValue(oppId, row.fieldId, row.value);
    } catch (err) {
      failures.push({
        label: customFieldLabel(row.def) || `field #${row.fieldId}`,
        message: err?.message || String(err),
      });
    }
  }

  let verifyErr;
  try {
    await verifyOpportunityCustomFieldsSaved(oppId, fieldValues);
    return;
  } catch (err) {
    verifyErr = err;
  }

  try {
    await updateOpportunityCustomFieldsViaPut(oppId, fieldValues);
    await verifyOpportunityCustomFieldsSaved(oppId, fieldValues);
    return;
  } catch (putErr) {
    if (failures.length === fieldValues.length) {
      const detail = failures.map((f) => `${f.label}: ${f.message}`).join("; ");
      throw new Error(detail || putErr.message || "Could not save user fields");
    }
    throw new Error(
      `${verifyErr?.message || putErr.message || "User fields not saved"}. ` +
        `Failed fields: ${failures.map((f) => f.label).join(", ") || "unknown"}`
    );
  }
}

function syncCreateOppPrivateFields() {
  const isPrivate = !!$("#create-opp-private")?.checked;
  $("#create-opp-access-field")?.classList.toggle("hidden", !isPrivate);
}

function buildOpportunityCreateBody(form) {
  const title = form.title?.trim();
  if (!title) throw new Error("Title is required");

  const responsibleId = form.responsibleId?.trim();
  if (!responsibleId) throw new Error("Responsible user is required");

  const stageId = Number(form.stageId);
  if (!Number.isFinite(stageId) || stageId <= 0) throw new Error("Stage is required");

  const draft = state.newOpportunityDraft;
  const contactId = draft?.contactId != null ? Number(draft.contactId) : 0;
  const stage = state.stages.find((s) => Number(s.id ?? s.ID) === stageId);
  const successProbability = Number(stage?.successProbability ?? stage?.SuccessProbability ?? 0);

  const body = {
    contactid: Number.isFinite(contactId) ? contactId : 0,
    members: [],
    title,
    description: form.description?.trim() || "",
    responsibleid: String(responsibleId),
    bidType: 0,
    bidValue: 0,
    bidCurrencyAbbr: "USD",
    perPeriodValue: 1,
    stageid: stageId,
    successProbability: Number.isFinite(successProbability) ? successProbability : 0,
    actualCloseDate: null,
    expectedCloseDate: form.expectedCloseDate ? serializeCrmTimestamp(form.expectedCloseDate) : null,
    isPrivate: !!form.isPrivate,
    accessList: [],
    isNotify: !!form.isNotify,
  };

  if (form.isPrivate) {
    const accessSel = $("#create-opp-access");
    body.accessList = accessSel
      ? [...accessSel.selectedOptions].map((o) => o.value).filter(Boolean)
      : [];
    if (!body.accessList.length) body.accessList = [String(responsibleId)];
  } else {
    body.accessList = [];
  }

  const customFields = form.customFields ?? [];
  if (customFields.length) {
    body.customFieldList = buildCustomFieldListForApi(customFields);
  }

  return body;
}

async function createCrmOpportunity(body) {
  return api("/api/2.0/crm/opportunity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function bindCreateOppContactPicker() {
  const input = $("#create-opp-contact-search");
  const results = $("#create-opp-contact-results");
  if (!input || !results || input.dataset.bound) return;
  input.dataset.bound = "1";
  let debounce;

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 2) {
        results.classList.add("hidden");
        return;
      }
      try {
        const contacts = await searchContacts(q);
        results.classList.remove("hidden");
        if (!contacts.length) {
          results.innerHTML = '<button type="button" disabled>No matches</button>';
          return;
        }
        for (const c of contacts) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = c.displayName || c.title || `Contact #${c.id}`;
          btn.addEventListener("click", () => {
            const draft = state.newOpportunityDraft;
            if (!draft) return;
            draft.contactId = Number(c.id ?? c.ID);
            draft.contactLabel = btn.textContent;
            input.value = "";
            results.classList.add("hidden");
            updateCreateOppContactSelectedUi();
          });
          results.appendChild(btn);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    }, 350);
  });

  document.addEventListener("click", (e) => {
    const wrap = $("#create-opp-contact-field");
    if (wrap && !wrap.contains(e.target)) results.classList.add("hidden");
  });
}

async function applyCreateOpportunityTags(oppId, tags) {
  for (const title of tags) {
    try {
      await addOpportunityTag(oppId, title);
    } catch (err) {
      showToast(`Opportunity created; tag failed: ${title}`, true);
    }
  }
}

async function submitCreateOpportunityForm(e) {
  e.preventDefault();
  setCreateOpportunityError("");
  const submitBtn = $("#create-opportunity-submit");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const customFields = collectCreateOppCustomFieldValues();
    const body = buildOpportunityCreateBody({
      title: $("#create-opp-title")?.value,
      description: $("#create-opp-description")?.value,
      responsibleId: $("#create-opp-responsible")?.value,
      stageId: $("#create-opp-stage")?.value,
      expectedCloseDate: $("#create-opp-expected-close")?.value,
      isPrivate: $("#create-opp-private")?.checked,
      isNotify: $("#create-opp-notify")?.checked,
      customFields,
    });

    const data = await createCrmOpportunity(body);
    const created = unwrapCreatedEntity(data);
    const oppId = created?.id ?? created?.ID ?? data?.id ?? data?.ID;
    if (oppId == null) throw new Error("Opportunity created but no id returned");

    if (customFields.length) {
      try {
        await applyCreateOpportunityCustomFields(oppId, customFields);
      } catch (cfErr) {
        showToast(`Opportunity created; user fields not saved: ${cfErr.message}`, true);
      }
    }

    const tags = state.newOpportunityDraft?.tags || [];
    if (tags.length) await applyCreateOpportunityTags(oppId, tags);

    closeCreateOpportunityModal();
    showToast("Opportunity created");
    await refreshAll();
  } catch (err) {
    setCreateOpportunityError(err.message || "Could not create opportunity");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function openCreateOpportunityModal() {
  const modal = $("#create-opportunity-modal");
  const form = $("#create-opportunity-form");
  if (!modal || !form) return;

  setCreateOpportunityError("");
  form.reset();
  resetNewOpportunityDraft();

  if (!state.stages.length) await loadStages();
  if (!state.allTags.length) await loadAllTags();
  if (!state.portalUsers.length) await loadPortalUsers();
  if (CREATE_OPP_USER_FIELDS_ENABLED) await loadOpportunityCustomFieldDefs(true);

  populateCreateOppStageSelect();
  populateCreateOppResponsibleSelect();
  populateCreateOppAccessSelect();
  renderCreateOppCustomFields();
  renderCreateOppTagChips();
  updateCreateOppContactSelectedUi();
  syncCreateOppPrivateFields();

  const notify = $("#create-opp-notify");
  if (notify) notify.checked = true;

  modal.classList.remove("hidden");
  $("#create-opp-title")?.focus();
}

function setAddTileError(message) {
  const el = $("#add-tile-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function showAddTileChooser() {
  $("#add-tile-options")?.classList.remove("hidden");
  $("#add-tile-calendar-form")?.classList.add("hidden");
  $("#add-tile-notes-form")?.classList.add("hidden");
  $("#add-tile-modal-actions")?.classList.remove("hidden");
  setAddTileError("");
}

function showAddTileCalendarForm() {
  $("#add-tile-options")?.classList.add("hidden");
  $("#add-tile-calendar-form")?.classList.remove("hidden");
  $("#add-tile-notes-form")?.classList.add("hidden");
  $("#add-tile-modal-actions")?.classList.add("hidden");
  const nameInput = $("#add-tile-calendar-name");
  const urlInput = $("#add-tile-calendar-url");
  if (nameInput && !nameInput.value) nameInput.value = "My calendar";
  if (urlInput) urlInput.value = "";
  setAddTileError("");
  urlInput?.focus();
}

function populateAddNotesPresetSelect() {
  const sel = $("#add-tile-notes-preset");
  if (!sel || sel.dataset.bound) return;
  sel.dataset.bound = "1";
  sel.innerHTML = "";
  for (const p of NOTES_ADD_PRESETS) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.label;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    const preset = NOTES_ADD_PRESETS.find((p) => p.id === sel.value);
    const nameInput = $("#add-tile-notes-name");
    if (preset && nameInput && (!nameInput.value.trim() || nameInput.value === "Notes")) {
      nameInput.value = preset.name;
    }
  });
}

function showAddTileNotesForm() {
  $("#add-tile-options")?.classList.add("hidden");
  $("#add-tile-calendar-form")?.classList.add("hidden");
  $("#add-tile-notes-form")?.classList.remove("hidden");
  $("#add-tile-modal-actions")?.classList.add("hidden");
  loadOpportunityCustomFieldDefs().catch(() => {});
  populateAddNotesPresetSelect();
  const presetSel = $("#add-tile-notes-preset");
  const nameInput = $("#add-tile-notes-name");
  const previewDefault = $("#add-tile-notes-preview-default");
  if (presetSel) presetSel.value = "blank";
  if (nameInput) nameInput.value = "Notes";
  if (previewDefault) previewDefault.checked = false;
  nameInput?.focus();
}

function addNotesTileFromForm() {
  const preset = NOTES_ADD_PRESETS.find((p) => p.id === $("#add-tile-notes-preset")?.value) || NOTES_ADD_PRESETS[0];
  const name = $("#add-tile-notes-name")?.value?.trim() || preset.name || "Notes";
  const openPreview = $("#add-tile-notes-preview-default")?.checked === true;
  const notes = newNotesTile({
    name,
    content: notesPresetContent(preset),
    viewMode: openPreview ? "preview" : "edit",
    defaultViewMode: openPreview ? "preview" : null,
    updatedAt: new Date().toISOString(),
  });
  state.notesTiles.push(notes);
  scheduleUserProfileSave();
  const tid = notesTileId(notes);
  if (!state.tileLayout.order.includes(tid)) {
    state.tileLayout.order.push(tid);
    saveLayoutToStorage();
  }
  closeAddTileModal();
  renderBoardGroups();
  showToast("Notes tile added");
}

function openAddTileModal() {
  const modal = $("#add-tile-modal");
  if (!modal) return;
  showAddTileChooser();
  modal.classList.remove("hidden");
}

function closeAddTileModal() {
  const modal = $("#add-tile-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  showAddTileChooser();
  setAddTileError("");
}

function addOpportunityGroupTile() {
  state.groups.push(newGroup({ name: `Group ${state.groups.length + 1}` }));
  saveGroupsToStorage();
  closeAddTileModal();
  renderBoardGroups();
  refreshGroup(state.groups[state.groups.length - 1]).catch((err) => showToast(err.message, true));
  showToast("Opportunity group added");
}

async function addCalendarTileFromForm() {
  const name = $("#add-tile-calendar-name")?.value?.trim() || "Calendar";
  const feedUrl = $("#add-tile-calendar-url")?.value?.trim() || "";
  if (!feedUrl) {
    setAddTileError("Calendar URL is required");
    return;
  }
  if (!/^https?:\/\//i.test(feedUrl)) {
    setAddTileError("URL must start with http:// or https://");
    return;
  }
  setAddTileError("");
  const cal = newCalendarTile({ name, feedUrl });
  state.calendarTiles.push(cal);
  saveCalendarsToStorage();
  const tid = calendarTileId(cal);
  if (!state.tileLayout.order.includes(tid)) {
    state.tileLayout.order.push(tid);
    saveLayoutToStorage();
  }
  closeAddTileModal();
  renderBoardGroups();
  showToast("Calendar tile added");
  try {
    await loadCalendarForTile(cal);
  } catch {
    /* toast from loader */
  }
}

function bindAddTileModal() {
  const modal = $("#add-tile-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  $("#add-tile-btn")?.addEventListener("click", openAddTileModal);
  $("#add-tile-cancel")?.addEventListener("click", closeAddTileModal);
  modal.querySelectorAll("[data-add-tile-dismiss]").forEach((el) => {
    el.addEventListener("click", closeAddTileModal);
  });
  $("#add-tile-opportunity-group")?.addEventListener("click", () => {
    addOpportunityGroupTile();
  });
  $("#add-tile-calendar")?.addEventListener("click", showAddTileCalendarForm);
  $("#add-tile-notes")?.addEventListener("click", showAddTileNotesForm);
  $("#add-tile-calendar-back")?.addEventListener("click", showAddTileChooser);
  $("#add-tile-notes-back")?.addEventListener("click", showAddTileChooser);
  $("#add-tile-calendar-create")?.addEventListener("click", () => {
    addCalendarTileFromForm().catch((err) => setAddTileError(err.message));
  });
  $("#add-tile-notes-create")?.addEventListener("click", addNotesTileFromForm);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeAddTileModal();
  });
}

function bindCreateOpportunityModal() {
  const modal = $("#create-opportunity-modal");
  const form = $("#create-opportunity-form");
  if (!modal || !form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", (e) => {
    submitCreateOpportunityForm(e).catch((err) => setCreateOpportunityError(err.message));
  });

  $("#create-opportunity-cancel")?.addEventListener("click", closeCreateOpportunityModal);
  modal.querySelectorAll("[data-create-opp-dismiss]").forEach((el) => {
    el.addEventListener("click", closeCreateOpportunityModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeCreateOpportunityModal();
  });

  $("#create-opp-private")?.addEventListener("change", syncCreateOppPrivateFields);

  $("#create-opp-tag-add")?.addEventListener("change", (ev) => {
    const title = ev.target.value;
    const draft = state.newOpportunityDraft;
    if (!title || !draft) return;
    if (!draft.tags.some((t) => tagsEqual(t, title))) {
      draft.tags.push(title);
      renderCreateOppTagChips();
    }
    ev.target.value = "";
  });

  bindCreateOppContactPicker();
}

function setTaskModalError(message) {
  const el = $("#task-modal-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function closeNewTaskModal() {
  const modal = $("#task-modal");
  if (modal) modal.classList.add("hidden");
  setTaskModalError("");
}

function clearNewTaskOpportunitySelection() {
  state.newTaskOpportunity = { id: null, title: "" };
  const search = $("#new-task-opportunity-search");
  const selected = $("#new-task-opportunity-selected");
  const results = $("#new-task-opportunity-results");
  if (search) search.value = "";
  if (selected) selected.innerHTML = "";
  if (results) {
    results.innerHTML = "";
    results.classList.add("hidden");
  }
}

function setNewTaskOpportunitySelection(id, title) {
  state.newTaskOpportunity = { id: Number(id), title: title || `Opportunity #${id}` };
  const search = $("#new-task-opportunity-search");
  const selected = $("#new-task-opportunity-selected");
  const results = $("#new-task-opportunity-results");
  if (search) search.value = "";
  if (results) {
    results.innerHTML = "";
    results.classList.add("hidden");
  }
  if (selected) {
    selected.innerHTML = `${escapeHtml(state.newTaskOpportunity.title)} <span class="contact-clear" role="button" tabindex="0">clear</span>`;
    $(".contact-clear", selected)?.addEventListener("click", () => clearNewTaskOpportunitySelection());
  }
}

async function loadTaskCategories() {
  try {
    const data = await api("/api/2.0/crm/task/category");
    state.taskCategories = unwrap(data);
  } catch {
    state.taskCategories = [];
  }
}

function populateNewTaskCategorySelect() {
  const sel = $("#new-task-category");
  if (!sel) return;
  sel.innerHTML = "";
  if (!state.taskCategories.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Loading categories…";
    sel.appendChild(opt);
    sel.required = false;
    return;
  }
  sel.required = true;
  for (const cat of state.taskCategories) {
    const opt = document.createElement("option");
    opt.value = String(cat.id ?? cat.ID ?? "");
    opt.textContent = cat.title || cat.Title || `Category ${opt.value}`;
    sel.appendChild(opt);
  }
}

function populateNewTaskResponsibleSelect() {
  const sel = $("#new-task-responsible");
  if (!sel) return;
  sel.innerHTML = "";
  const users = new Map();
  for (const u of state.portalUsers) {
    if (u.id != null) users.set(String(u.id), u.displayName || u.id);
  }
  if (state.currentUserId != null) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }
  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (state.currentUserId != null) sel.value = String(state.currentUserId);
}

async function searchOpportunitiesByTitle(query, { limit = 30 } = {}) {
  const q = String(query || "").trim();
  const local = [];
  const seen = new Set();
  const qLower = q.toLowerCase();

  for (const g of state.groups) {
    for (const o of g.opportunities || []) {
      const id = o.id ?? o.ID;
      if (id == null) continue;
      const title = (o.title || o.Title || `Opportunity #${id}`).trim();
      const key = String(id);
      if (seen.has(key)) continue;
      if (!q || title.toLowerCase().includes(qLower)) {
        seen.add(key);
        local.push({ id: Number(id), title });
      }
    }
  }

  if (q.length >= 2) {
    try {
      const params = new URLSearchParams({ startIndex: "0", count: "40", filterValue: q, stageType: "0" });
      const data = await api(`/api/2.0/crm/opportunity/filter?${params}`);
      for (const o of unwrap(data)) {
        const id = o.id ?? o.ID;
        if (id == null) continue;
        const key = String(id);
        if (seen.has(key)) continue;
        seen.add(key);
        local.push({ id: Number(id), title: (o.title || o.Title || `Opportunity #${id}`).trim() });
        indexOpportunity(o);
      }
    } catch {
      /* use local matches only */
    }
  }

  return local.sort((a, b) => a.title.localeCompare(b.title)).slice(0, limit);
}

async function searchOpportunitiesForTaskPicker(query) {
  return searchOpportunitiesByTitle(query);
}

const ICON_EXTERNAL_LINK = `<svg class="crm-open-external-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

const OPP_PREVIEW_HISTORY_PAGE = 50;
const OPP_PREVIEW_HISTORY_MAX = 500;
const oppPreviewMailCache = new Map();
/** @type {{ oppId: number | null, opp: object | null, group: object | null }} */
let oppPreviewContext = { oppId: null, opp: null, group: null };

function createCrmOpenLink(oppId, { className = "crm-open-external", title = "Open in CRM" } = {}) {
  const a = document.createElement("a");
  a.href = crmOpportunityUrl(oppId);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = className;
  a.title = title;
  a.setAttribute("aria-label", title);
  a.innerHTML = ICON_EXTERNAL_LINK;
  a.addEventListener("click", (e) => e.stopPropagation());
  return a;
}

function historyEventDate(ev) {
  return (
    ev.createdOn?.value ??
    ev.createdOn ??
    ev.CreatedOn?.value ??
    ev.CreatedOn ??
    ev.created?.value ??
    ev.created ??
    ev.Created?.value ??
    ev.Created ??
    ev.createOn?.value ??
    ev.createOn ??
    ev.CreateOn?.value ??
    ev.CreateOn ??
    ev.date?.value ??
    ev.date ??
    ev.Date?.value ??
    ev.Date ??
    null
  );
}

function historyEventCategoryId(ev) {
  const cat = ev.category ?? ev.Category;
  if (cat == null || cat === "") return null;
  if (typeof cat === "number" && Number.isFinite(cat)) return Math.floor(cat);
  if (typeof cat === "string" && /^\d+$/.test(cat.trim())) return Number(cat.trim());
  const id = cat?.id ?? cat?.ID ?? cat?.categoryId ?? cat?.CategoryId;
  return id != null && Number.isFinite(Number(id)) ? Number(id) : null;
}

function historyEventCategoryLabel(ev) {
  const cat = ev.category ?? ev.Category;
  if (typeof cat === "string" && cat.trim()) return cat.trim();
  const direct = String(cat?.title || cat?.Title || "").trim();
  if (direct) return direct;

  const catId = historyEventCategoryId(ev);
  if (catId != null && state.historyCategories?.length) {
    const found = state.historyCategories.find((c) => Number(c.id ?? c.ID) === catId);
    const title = String(found?.title || found?.Title || "").trim();
    if (title) return title;
  }
  return "";
}

const HISTORY_ICON_MAIL = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
const HISTORY_ICON_PHONE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const HISTORY_ICON_SMS = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`;
const HISTORY_ICON_NOTE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>`;
const HISTORY_ICON_MEETING = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;
const HISTORY_ICON_DEFAULT = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

function historyCategoryIconHtml(ev) {
  const cat = historyEventCategoryLabel(ev).toLowerCase();
  if (/\b(mail|email)\b/.test(cat)) return HISTORY_ICON_MAIL;
  if (/\b(phone|call|voicemail)\b/.test(cat)) return HISTORY_ICON_PHONE;
  if (/\b(text|sms)\b/.test(cat) || /\btext message\b/.test(cat)) return HISTORY_ICON_SMS;
  if (/\b(meeting|appointment)\b/.test(cat)) return HISTORY_ICON_MEETING;
  if (/\b(note|comment|event)\b/.test(cat)) return HISTORY_ICON_NOTE;
  return HISTORY_ICON_DEFAULT;
}

function unescapeLooseJsonString(s) {
  return String(s || "")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .trim();
}

function subjectFromPlainMailContent(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const jsonSubj = s.match(/"subject"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (jsonSubj) return unescapeLooseJsonString(jsonSubj[1]);
  const received = s.match(/the email \["([^"]+)"\]/i);
  if (received) return received[1].trim();
  const firstLine = s.split(/\n/).map((l) => l.trim()).find(Boolean) || s;
  const reMatch = firstLine.match(/^re:\s*(.+)$/i);
  if (reMatch) {
    const subj = reMatch[1].trim();
    const dash = subj.match(/^(.+?)\s*[—–-]\s+/);
    return (dash ? dash[1] : subj).trim();
  }
  return "";
}

function subjectFromEmailHtml(raw) {
  const s = String(raw || "").trim();
  if (!s || !historyContentLooksLikeHtml(s)) return "";
  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    const title = doc.querySelector("title")?.textContent?.trim();
    if (title && title.length > 1 && title.length < 500) return title;
  } catch {
    /* ignore */
  }
  return subjectFromPlainMailContent(htmlToPlainText(s));
}

function historyEventMailSubject(ev, mailPayload) {
  if (mailPayload?.subject) return mailPayload.subject;
  const payload = mailPayload ?? parseHistoryMailPayload(ev);
  if (payload?.subject) return payload.subject;
  const raw = historyEventRawContent(ev);
  const fromPlain = subjectFromPlainMailContent(raw);
  if (fromPlain) return fromPlain;
  const fromHtml = subjectFromEmailHtml(raw);
  if (fromHtml) return fromHtml;
  return "";
}

function historyContentLooksLikeMailNote(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  if (/"message_id"\s*:/i.test(s) || /action=mailmessage/i.test(s)) return true;
  if (/the email \["[^"]+"\]\s+has been received/i.test(s)) return true;
  if (/^re:\s/im.test(s) && s.length < 4000) return true;
  return false;
}

function isHistoryMailEvent(ev, mailPayload = null) {
  const payload = mailPayload ?? parseHistoryMailPayload(ev);
  if (payload) return true;
  if (isMailCategoryEvent(ev)) return true;
  if (extractMailMessageIdsFromFields(ev).length) return true;
  if (historyContentLooksLikeMailNote(historyEventRawContent(ev))) return true;
  return false;
}

function crmMailReceivedLine(subject) {
  const subj = String(subject || "").trim();
  if (!subj) return "An email has been received.";
  return `The email ["${subj}"] has been received.`;
}

function historyEventAuthor(ev) {
  const createBy = ev.createBy || ev.CreateBy || ev.createdBy || ev.CreatedBy;
  return String(
    createBy?.displayName ||
      createBy?.DisplayName ||
      createBy?.userName ||
      createBy?.UserName ||
      ""
  ).trim();
}

function historyEventPlainContent(ev) {
  return toPlainDisplayText(ev.content || ev.Content || ev.description || ev.Description || "", 12000);
}

function historyEventRawContent(ev) {
  return String(ev.content ?? ev.Content ?? ev.description ?? ev.Description ?? "");
}

function historyContentLooksLikeHtml(s) {
  return /<[a-z][\s\S]*>/i.test(String(s || ""));
}

function portalAbsoluteUrl(pathOrUrl) {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = state.portalUrl.replace(/\/$/, "");
  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}

function portalFileDownloadUrl(fileId) {
  const id = String(fileId || "").trim();
  if (!id) return "";
  const base = state.portalUrl.replace(/\/$/, "");
  return `${base}/Products/Files/HttpHandlers/filehandler.ashx?action=download&fileid=${encodeURIComponent(id)}`;
}

function portalMailMessageUrl(messageId) {
  const id = String(messageId || "").trim();
  if (!id) return "";
  const base = state.portalUrl.replace(/\/$/, "");
  return `${base}/Products/Mail/#message/${id}`;
}

function sanitizeHistoryHtml(html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  wrap.querySelectorAll("script, style, iframe, object, embed, link, meta, base").forEach((el) => el.remove());
  wrap.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") el.removeAttribute(attr.name);
    }
    if (el.tagName === "A") {
      const href = el.getAttribute("href");
      if (href) {
        el.setAttribute("href", portalAbsoluteUrl(href));
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
  });
  return wrap.innerHTML;
}

function collectNumericIdsFromValue(value, out) {
  if (value == null) return;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    out.add(Math.floor(value));
    return;
  }
  const s = String(value).trim();
  if (!s) return;
  if (/^\d+$/.test(s)) {
    out.add(Number(s));
    return;
  }
  const re =
    /(?:mail\/messages\/|messageId[=:]|message_id[=:]|#message\/|action=mailmessage(?:&amp;|&)?message_id=|idmessage[=:]|mailmessageid[=:])(\d+)/gi;
  let m;
  while ((m = re.exec(s))) out.add(Number(m[1]));
}

function extractJsonObjectSubstring(s) {
  const text = String(s || "");
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseJsonObject(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  let s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      /* try embedded object */
    }
  }
  const embedded = extractJsonObjectSubstring(s);
  if (embedded) {
    try {
      const parsed = JSON.parse(embedded);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseLooseMailMetadataFromText(text) {
  const s = String(text || "");
  if (!s) return null;

  let messageId = null;
  const idPatterns = [
    /"message_id"\s*:\s*"?(\d+)"?/i,
    /"messageId"\s*:\s*"?(\d+)"?/i,
    /"mailMessageId"\s*:\s*"?(\d+)"?/i,
    /message_id\s*[=:]\s*"?(\d+)"?/i,
    /action=mailmessage(?:&amp;|&)?message_id=(\d+)/i,
    /#message\/(\d+)/i,
    /mail\/messages\/(\d+)/i,
  ];
  for (const re of idPatterns) {
    const m = s.match(re);
    if (m) {
      messageId = Number(m[1]);
      break;
    }
  }
  if (!Number.isFinite(messageId) || messageId <= 0) return null;

  let subject = "";
  const subjMatch = s.match(/"subject"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (subjMatch) subject = unescapeLooseJsonString(subjMatch[1]);

  return {
    message_id: messageId,
    subject,
  };
}

function collectMailIdsFromObject(value, out, depth = 0, seen = null) {
  if (depth > 10 || value == null) return;
  const visited = seen || new WeakSet();
  if (typeof value === "object") {
    if (visited.has(value)) return;
    visited.add(value);
  }

  if (typeof value === "string") {
    collectNumericIdsFromValue(value, out);
    const loose = parseLooseMailMetadataFromText(value);
    if (loose?.message_id) out.add(loose.message_id);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectMailIdsFromObject(item, out, depth + 1, visited);
    return;
  }

  if (typeof value !== "object") return;

  for (const v of Object.values(value)) {
    collectMailIdsFromObject(v, out, depth + 1, visited);
  }
}

function mailObjectFromEvent(ev) {
  for (const key of [
    "mailMessage",
    "MailMessage",
    "mail",
    "Mail",
    "email",
    "Email",
    "message",
    "Message",
  ]) {
    const m = ev[key];
    if (m && typeof m === "object" && !Array.isArray(m)) return m;
  }
  return null;
}

function normalizeCrmMailPayload(obj) {
  if (!obj || typeof obj !== "object") return null;
  const midRaw = obj.message_id ?? obj.messageId ?? obj.MessageId ?? obj.mailMessageId ?? obj.id ?? obj.ID;
  const messageId = Number(typeof midRaw === "string" ? midRaw.trim() : midRaw);
  if (!Number.isFinite(messageId) || messageId <= 0) return null;

  const fromRaw = String(obj.from ?? obj.From ?? "").trim();
  const from = fromRaw.replace(/^["']+|["']+$/g, "").trim();
  const messageUrl = portalAbsoluteUrl(obj.message_url ?? obj.messageUrl ?? obj.MessageUrl ?? "");

  return {
    messageId,
    from,
    to: String(obj.to ?? obj.To ?? "").trim(),
    cc: String(obj.cc ?? obj.Cc ?? "").trim(),
    bcc: String(obj.bcc ?? obj.Bcc ?? "").trim(),
    subject: String(obj.subject ?? obj.Subject ?? "").trim(),
    date: String(
      obj.date_created ?? obj.dateCreated ?? obj.DateCreated ?? obj.date_sent ?? obj.dateSent ?? ""
    ).trim(),
    introduction: String(
      obj.introduction ?? obj.Introduction ?? obj.preview ?? obj.Preview ?? obj.textBody ?? ""
    ).trim(),
    messageUrl: messageUrl || portalMailMessageUrl(messageId),
  };
}

function historyMailTextSources(ev) {
  const sources = [];
  const push = (v) => {
    if (v == null || v === "") return;
    if (typeof v === "string") sources.push(v);
    else if (typeof v === "object") {
      try {
        sources.push(JSON.stringify(v));
      } catch {
        /* skip */
      }
    }
  };
  push(historyEventRawContent(ev));
  push(ev.additionalData);
  push(ev.AdditionalData);
  push(ev.text);
  push(ev.Text);
  push(ev.description);
  push(ev.Description);
  const nested = mailObjectFromEvent(ev);
  if (nested) push(nested);
  return sources;
}

function parseHistoryMailPayload(ev) {
  const nested = mailObjectFromEvent(ev);
  if (nested) {
    const fromNested = normalizeCrmMailPayload(nested);
    if (fromNested) return fromNested;
  }

  for (const src of historyMailTextSources(ev)) {
    const payload = normalizeCrmMailPayload(tryParseJsonObject(src));
    if (payload) return payload;
    const loose = parseLooseMailMetadataFromText(src);
    if (loose) {
      const normalized = normalizeCrmMailPayload(loose);
      if (normalized) return normalized;
    }
  }
  return null;
}

function extractMailMessageIdsFromFields(ev) {
  const ids = new Set();
  const payload = parseHistoryMailPayload(ev);
  if (payload?.messageId) ids.add(payload.messageId);

  const fields = [
    ev.messageId,
    ev.MessageId,
    ev.mailMessageId,
    ev.MailMessageId,
    ev.idMessage,
    ev.IdMessage,
  ];
  for (const f of fields) collectNumericIdsFromValue(f, ids);

  let ad = tryParseJsonObject(ev.additionalData ?? ev.AdditionalData) ?? ev.additionalData ?? ev.AdditionalData;
  if (ad && typeof ad === "object") {
    collectNumericIdsFromValue(ad.message_id ?? ad.messageId ?? ad.MessageId ?? ad.mailMessageId, ids);
    collectNumericIdsFromValue(ad.message_url ?? ad.messageUrl ?? ad.MessageUrl, ids);
    collectMailIdsFromObject(ad, ids);
  }

  for (const src of historyMailTextSources(ev)) {
    collectNumericIdsFromValue(src, ids);
    const loose = parseLooseMailMetadataFromText(src);
    if (loose?.message_id) ids.add(loose.message_id);
  }

  const nested = mailObjectFromEvent(ev);
  if (nested) collectMailIdsFromObject(nested, ids);

  return [...ids].filter((id) => Number.isFinite(id) && id > 0);
}

function extractMailMessageIds(ev) {
  const ids = extractMailMessageIdsFromFields(ev);
  if (ids.length) return ids;
  const raw = historyEventRawContent(ev);
  if (isMailCategoryEvent(ev) || shouldCollapseHistoryNoteContent(ev, raw)) {
    const fromContent = new Set();
    collectNumericIdsFromValue(raw, fromContent);
    return [...fromContent];
  }
  return [];
}

function isMailCategoryEvent(ev) {
  const cat = historyEventCategoryLabel(ev).toLowerCase();
  return /\b(mail|email)\b/.test(cat);
}

function historyContentLooksLikeEmailDump(raw) {
  const s = String(raw || "");
  if (!s.trim()) return false;
  if (/<!DOCTYPE|<html[\s>]/i.test(s)) return true;
  if (NOTIFY_TEMPLATE_MARKERS.some((re) => re.test(s))) return true;
  if (/MIME-Version:|Content-Type:\s*text\/html|multipart\/alternative/i.test(s)) return true;
  if (/mso-|MsoNormal|urn:schemas-microsoft|xmlns:v=|xmlns:o=|<o:p>|<v:shape/i.test(s)) return true;
  if (s.length > 900 && /<table[\s>]/i.test(s)) return true;
  if (s.length > 500 && (s.match(/<style[\s>]/gi) || []).length >= 1) return true;
  if (s.length > 400 && (s.match(/style="/gi) || []).length >= 4) return true;
  return false;
}

function shouldCollapseHistoryNoteContent(ev, raw) {
  const content = String(raw || "").trim();
  if (!content) return false;
  if (parseHistoryMailPayload(ev)) return true;
  if (extractMailMessageIdsFromFields(ev).length) return true;
  if (isMailCategoryEvent(ev)) return true;
  if (historyContentLooksLikeEmailDump(content)) return true;
  if (historyContentLooksLikeHtml(content) && content.length > 500) return true;
  return false;
}

function isMailLinkedHistoryEvent(ev) {
  return shouldCollapseHistoryNoteContent(ev, historyEventRawContent(ev));
}

function htmlToPlainText(html) {
  const s = String(html || "").trim();
  if (!s) return "";
  if (!historyContentLooksLikeHtml(s)) return s;
  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    const text = doc.body?.textContent || "";
    return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return toPlainDisplayText(s, 50000);
  }
}

function attachmentDedupeKey(file) {
  return String(file.url || file.id || file.title || "");
}

function extractHistoryAttachments(ev) {
  const seen = new Set();
  const out = [];

  const push = (raw) => {
    if (!raw) return;
    if (typeof raw === "string") {
      const idMatch = raw.match(/fileid=([^&"'\s]+)/i);
      if (idMatch) {
        const id = decodeURIComponent(idMatch[1]);
        const file = { id, title: id, url: portalFileDownloadUrl(id) };
        const key = attachmentDedupeKey(file);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(file);
        }
      }
      return;
    }
    if (typeof raw !== "object") return;

    const id = raw.id ?? raw.ID ?? raw.fileId ?? raw.FileId ?? raw.documentId ?? raw.DocumentId;
    const title =
      raw.title ||
      raw.Title ||
      raw.fileName ||
      raw.FileName ||
      raw.name ||
      raw.Name ||
      raw.displayName ||
      raw.DisplayName ||
      (id ? `File ${id}` : "");
    let url =
      raw.viewUrl ||
      raw.ViewUrl ||
      raw.downloadUrl ||
      raw.DownloadUrl ||
      raw.url ||
      raw.Url ||
      raw.link ||
      raw.Link;
    if (!url && id) url = portalFileDownloadUrl(id);
    if (!url && !title) return;
    const file = {
      id: id != null ? String(id) : "",
      title: String(title || "Attachment").trim(),
      url: url ? portalAbsoluteUrl(url) : "",
    };
    const key = attachmentDedupeKey(file);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  const lists = [
    ev.files,
    ev.Files,
    ev.attachments,
    ev.Attachments,
    ev.documents,
    ev.Documents,
    ev.fileList,
    ev.FileList,
  ];
  for (const list of lists) {
    if (Array.isArray(list)) list.forEach(push);
  }

  for (const key of ["fileIds", "FileIds", "filesId", "FilesId"]) {
    const ids = ev[key];
    if (Array.isArray(ids)) ids.forEach((id) => push({ id, title: `File ${id}` }));
  }

  let ad = ev.additionalData ?? ev.AdditionalData;
  if (typeof ad === "string") {
    try {
      ad = JSON.parse(ad);
    } catch {
      ad = null;
    }
  }
  if (ad && typeof ad === "object") {
    for (const list of [ad.files, ad.Files, ad.attachments, ad.Attachments]) {
      if (Array.isArray(list)) list.forEach(push);
    }
  }

  const html = historyEventRawContent(ev);
  if (historyContentLooksLikeHtml(html)) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    wrap.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/filehandler\.ashx|\/files\//i.test(href) || /fileid=/i.test(href)) {
        const label = (a.textContent || "").trim() || href.split("/").pop() || "Attachment";
        push({ title: label, url: portalAbsoluteUrl(href) });
      }
    });
  }

  return out;
}

function extractEmailBodyHtml(html) {
  let s = String(html || "").trim();
  if (!s) return "";
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  let bodyHtml = s;
  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    const body = doc.body;
    if (body) {
      body.querySelectorAll("script, style, meta, link, title, head").forEach((el) => el.remove());
      body.querySelectorAll("*").forEach((el) => {
        el.removeAttribute("style");
        el.removeAttribute("class");
        el.removeAttribute("id");
        for (const attr of [...el.attributes]) {
          if (attr.name.startsWith("data-") || attr.name.startsWith("on")) el.removeAttribute(attr.name);
        }
      });
      bodyHtml = body.innerHTML;
    }
  } catch {
    /* use raw */
  }

  return sanitizeHistoryHtml(bodyHtml);
}

function renderCrmMailPayloadDetail(parent, payload) {
  const rows = [];
  const push = (label, value) => {
    const v = String(value || "").trim();
    if (v) rows.push({ label, value: v });
  };
  push("From", payload.from);
  push("To", payload.to);
  push("Cc", payload.cc);
  push("Subject", payload.subject);
  push("Date", payload.date);

  if (rows.length) renderPreviewFieldGrid(parent, rows);

  if (payload.introduction) {
    const pre = document.createElement("pre");
    pre.className = "opp-preview-mail-text";
    pre.textContent = payload.introduction;
    parent.appendChild(pre);
  }

  const foot = document.createElement("div");
  foot.className = "opp-preview-mail-foot";
  const open = document.createElement("a");
  open.href = payload.messageUrl;
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.textContent = "Open in Mail";
  foot.appendChild(open);
  parent.appendChild(foot);
}

function pickMailBodyForDisplay(norm, { allowIntroFallback = false, crmPayload = null } = {}) {
  const text = String(norm.textBody || "")
    .replace(/\r\n/g, "\n")
    .trim();
  const html = String(norm.htmlBody || "").trim();

  if (html.length > 40) {
    const cleaned = extractEmailBodyHtml(html);
    if (cleaned.length > 20) return { mode: "html", content: cleaned };
  }

  const plainFromHtml = html ? htmlToPlainText(extractEmailBodyHtml(html) || html) : "";
  const plainFromText = text.includes("<") ? htmlToPlainText(text) : text;

  if (html && plainFromHtml.length > Math.max(plainFromText.length, 80)) {
    return { mode: "html", content: extractEmailBodyHtml(html) };
  }

  const candidates = [plainFromText, plainFromHtml].filter((s) => s && s.length > 2);
  if (allowIntroFallback && crmPayload?.introduction) {
    candidates.push(crmPayload.introduction);
  }

  let best = "";
  for (const c of candidates) {
    if (c.length > best.length && !isNotifyTemplateSpam(c.slice(0, 1200))) best = c;
  }
  if (!best && candidates.length) best = candidates[0];

  if (best.length) return { mode: "text", content: best };
  return { mode: "empty", content: "" };
}

function mailBodyIframeSrcdoc(htmlContent) {
  const body = sanitizeHistoryHtml(htmlContent);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>
body{margin:0.65rem;font:13px/1.45 system-ui,-apple-system,sans-serif;background:#181b24;color:#e8ecf4;line-height:1.45;word-break:break-word;}
a{color:#7eb8ff;}img{max-width:100%;height:auto;}table{max-width:100%;}
p{margin:0 0 0.5rem;}blockquote{margin:0.5rem 0;padding-left:0.75rem;border-left:2px solid #3d4659;color:#b8c0d4;}
</style></head><body>${body}</body></html>`;
}

function historyEventDateIso(ev) {
  const raw = historyEventDate(ev);
  if (raw == null || raw === "") return "";
  return parseFeedDate(crmDateTimeFromApi(raw) || raw) || "";
}

function formatHistoryEventDateTime(ev) {
  const raw = historyEventDate(ev);
  if (raw == null || raw === "") return "";
  const iso = parseFeedDate(crmDateTimeFromApi(raw) || raw);
  if (!iso) return String(raw).trim();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(raw).trim();
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return d.toLocaleString();
  }
}

function renderHistoryEventMeta(metaEl, ev) {
  const cat = historyEventCategoryLabel(ev);
  const author = historyEventAuthor(ev);
  const whenLabel = formatHistoryEventDateTime(ev);
  const iso = historyEventDateIso(ev);

  metaEl.replaceChildren();

  const appendSep = () => {
    const sep = document.createElement("span");
    sep.className = "opp-preview-history-meta-sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "·";
    metaEl.appendChild(sep);
  };

  if (cat) {
    const span = document.createElement("span");
    span.className = "opp-preview-history-meta-part";
    span.textContent = cat;
    metaEl.appendChild(span);
  }

  if (author || whenLabel) {
    if (metaEl.childElementCount) appendSep();
    const line = document.createElement("span");
    line.className = "opp-preview-history-meta-author-line";

    if (author) {
      const authorSpan = document.createElement("span");
      authorSpan.className = "opp-preview-history-meta-author";
      authorSpan.textContent = author;
      line.appendChild(authorSpan);
    }

    if (whenLabel) {
      const timeEl = document.createElement("time");
      timeEl.className = "opp-preview-history-meta-when";
      if (iso) timeEl.dateTime = iso;
      timeEl.textContent = whenLabel;
      line.appendChild(timeEl);
    }

    metaEl.appendChild(line);
  }
}

function renderHistoryMailReceivedSummary(container, ev, mailPayload = null) {
  const payload = mailPayload ?? parseHistoryMailPayload(ev);
  container.classList.add("opp-preview-history-body--mail-received");
  const p = document.createElement("p");
  p.className = "opp-preview-mail-summary";
  p.textContent = crmMailReceivedLine(historyEventMailSubject(ev, payload));
  container.replaceChildren(p);
}

function renderHistoryNoteBody(container, ev) {
  const raw = historyEventRawContent(ev).trim();
  const mailPayload = parseHistoryMailPayload(ev);
  const mailIds = extractMailMessageIds(ev);

  if (isHistoryMailEvent(ev, mailPayload) || (shouldCollapseHistoryNoteContent(ev, raw) && (mailPayload || mailIds.length))) {
    renderHistoryMailReceivedSummary(container, ev, mailPayload);
    return;
  }

  if (!raw) {
    container.textContent = "(No text)";
    return;
  }

  if (shouldCollapseHistoryNoteContent(ev, raw)) {
    renderHistoryMailReceivedSummary(container, ev, mailPayload);
    return;
  }

  if (historyContentLooksLikeHtml(raw)) {
    const plain = htmlToPlainText(raw);
    if (plain.length > 0 && plain.length < raw.length * 0.85) {
      container.classList.add("opp-preview-history-body--plain");
      container.textContent = plain;
      return;
    }
    container.classList.add("opp-preview-history-body--html");
    container.innerHTML = sanitizeHistoryHtml(raw);
    return;
  }
  container.textContent = raw;
}

async function fetchMailMessage(messageId) {
  const id = Number(messageId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid mail message id");
  if (oppPreviewMailCache.has(id)) return oppPreviewMailCache.get(id);

  const paths = [`/api/2.0/mail/messages/${id}`, `/api/2.0/mail/messages/${id}.json`];
  let lastErr;
  for (const path of paths) {
    try {
      const data = await api(path);
      const mail = data?.response ?? data?.result ?? data;
      oppPreviewMailCache.set(id, mail);
      return mail;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Could not load mail message");
}

function normalizeMailMessage(mail) {
  if (!mail || typeof mail !== "object") return null;
  const subject = mail.subject || mail.Subject || "";
  const fromRaw = mail.from || mail.From || mail.fromEmail || mail.FromEmail;
  const from =
    typeof fromRaw === "string"
      ? fromRaw
      : fromRaw?.displayName || fromRaw?.title || fromRaw?.email || fromRaw?.Email || "";
  const htmlBody =
    mail.htmlBody ||
    mail.HtmlBody ||
    mail.bodyHtml ||
    mail.BodyHtml ||
    mail.body?.html ||
    mail.Body?.Html ||
    "";
  const textBody =
    mail.textBody ||
    mail.TextBody ||
    mail.plainText ||
    mail.PlainText ||
    mail.bodyText ||
    mail.BodyText ||
    mail.body?.text ||
    mail.Body?.Text ||
    "";
  const date =
    mail.dateSent?.value ??
    mail.dateSent ??
    mail.DateSent?.value ??
    mail.DateSent ??
    mail.receivedDate?.value ??
    mail.receivedDate;
  const toList = mailAddressesFromMessage(mail).join(", ");
  return { subject, from, toList, htmlBody, textBody, date };
}

function renderMailEmbedPanel(panel, mail, messageId, { crmPayload = null, openUrl = "" } = {}) {
  panel.innerHTML = "";
  const norm = normalizeMailMessage(mail);
  if (!norm) {
    panel.innerHTML = '<p class="opp-preview-mail-error">Could not read mail message.</p>';
    return;
  }

  const head = document.createElement("div");
  head.className = "opp-preview-mail-head";
  const subject = norm.subject || crmPayload?.subject || "";
  const from = norm.from || crmPayload?.from || "";
  const toList = norm.toList || crmPayload?.to || "";
  const date = norm.date || crmPayload?.date || "";
  const lines = [
    subject ? `<strong>${escapeHtml(subject)}</strong>` : "",
    from ? `From: ${escapeHtml(from)}` : "",
    toList ? `To: ${escapeHtml(toList)}` : "",
    date ? escapeHtml(formatPreviewDateTime(date) || date) : "",
  ].filter(Boolean);
  head.innerHTML = lines.map((l) => `<div>${l}</div>`).join("");

  const bodyWrap = document.createElement("div");
  bodyWrap.className = "opp-preview-mail-body";

  const bodyPick = pickMailBodyForDisplay(norm, { allowIntroFallback: false, crmPayload });
  if (bodyPick.mode === "html" && bodyPick.content) {
    const iframe = document.createElement("iframe");
    iframe.className = "opp-preview-mail-iframe";
    iframe.setAttribute("sandbox", "allow-same-origin");
    iframe.setAttribute("title", "Email body");
    iframe.srcdoc = mailBodyIframeSrcdoc(bodyPick.content);
    iframe.addEventListener("load", () => {
      try {
        const doc = iframe.contentDocument;
        const h = doc?.body?.scrollHeight;
        if (h && h > 80) {
          iframe.style.height = `${Math.min(Math.max(h + 20, 240), 1400)}px`;
        }
      } catch {
        /* ignore */
      }
    });
    bodyWrap.appendChild(iframe);
  } else if (bodyPick.mode === "text" && bodyPick.content) {
    const pre = document.createElement("pre");
    pre.className = "opp-preview-mail-text";
    pre.textContent = bodyPick.content;
    bodyWrap.appendChild(pre);
  } else {
    bodyWrap.innerHTML = '<p class="opp-preview-empty">No readable message body. Open in Mail for the full message.</p>';
  }

  const foot = document.createElement("div");
  foot.className = "opp-preview-mail-foot";
  const open = document.createElement("a");
  open.href = openUrl || crmPayload?.messageUrl || portalMailMessageUrl(messageId);
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.textContent = "Open in Mail";
  foot.appendChild(open);

  panel.appendChild(head);
  panel.appendChild(bodyWrap);
  panel.appendChild(foot);
}

function renderHistoryAttachmentsAside(parent, attachments) {
  if (!attachments.length) return;
  const aside = document.createElement("aside");
  aside.className = "opp-preview-history-attachments";
  aside.setAttribute("aria-label", "Attachments");
  for (const file of attachments) {
    const a = document.createElement("a");
    a.className = "opp-preview-attachment-link";
    a.href = file.url || portalFileDownloadUrl(file.id);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = file.title;
    a.textContent = file.title;
    aside.appendChild(a);
  }
  parent.appendChild(aside);
}

function renderHistoryEventItem(ev) {
  const li = document.createElement("li");
  li.className = "opp-preview-history-item";

  const metaRow = document.createElement("div");
  metaRow.className = "opp-preview-history-meta-row";

  const icon = document.createElement("span");
  icon.className = "opp-preview-history-type-icon";
  icon.innerHTML = historyCategoryIconHtml(ev);
  icon.setAttribute("aria-hidden", "true");

  const meta = document.createElement("div");
  meta.className = "opp-preview-history-meta";
  renderHistoryEventMeta(meta, ev);

  metaRow.appendChild(icon);
  metaRow.appendChild(meta);
  li.appendChild(metaRow);

  const row = document.createElement("div");
  row.className = "opp-preview-history-row";

  const main = document.createElement("div");
  main.className = "opp-preview-history-main";

  const note = document.createElement("div");
  note.className = "opp-preview-history-body";
  renderHistoryNoteBody(note, ev);
  main.appendChild(note);

  const mailPayload = parseHistoryMailPayload(ev);
  const mailIds = extractMailMessageIds(ev);
  const messageId = mailIds[0] || mailPayload?.messageId || null;
  let mailToggle = null;
  let mailPanel = null;
  if (messageId) {
    mailToggle = document.createElement("button");
    mailToggle.type = "button";
    mailToggle.className = "opp-preview-mail-toggle";
    mailToggle.textContent = "Show linked email";
    mailPanel = document.createElement("div");
    mailPanel.className = "opp-preview-mail-embed hidden";
    mailPanel.setAttribute("hidden", "");

    mailToggle.addEventListener("click", async () => {
      const open = !mailPanel.hasAttribute("hidden");
      if (open) {
        mailPanel.setAttribute("hidden", "");
        mailPanel.classList.add("hidden");
        mailToggle.textContent = "Show linked email";
        return;
      }
      mailPanel.removeAttribute("hidden");
      mailPanel.classList.remove("hidden");
      mailToggle.textContent = "Hide linked email";

      if (!messageId) {
        mailPanel.innerHTML =
          '<p class="opp-preview-mail-error">No mail message id on this event. Open the deal in CRM to view this email.</p>';
        return;
      }

      if (mailPanel.dataset.loaded === String(messageId)) return;

      mailPanel.innerHTML = '<p class="opp-preview-mail-loading">Loading email…</p>';
      try {
        const mail = await fetchMailMessage(messageId);
        renderMailEmbedPanel(mailPanel, mail, messageId, { crmPayload: mailPayload });
        mailPanel.dataset.loaded = String(messageId);
      } catch (err) {
        mailPanel.innerHTML = `<p class="opp-preview-mail-error">Could not load email (${escapeHtml(err.message)}).</p>`;
        const retry = document.createElement("a");
        retry.href =
          mailPayload?.messageUrl || portalMailMessageUrl(messageId);
        retry.target = "_blank";
        retry.rel = "noopener noreferrer";
        retry.className = "opp-preview-mail-fallback";
        retry.textContent = "Open in Mail";
        mailPanel.appendChild(retry);
      }
    });

    main.appendChild(mailToggle);
    main.appendChild(mailPanel);
  }

  row.appendChild(main);
  renderHistoryAttachmentsAside(row, extractHistoryAttachments(ev));
  li.appendChild(row);
  return li;
}

function formatPreviewDateTime(raw) {
  if (raw == null || raw === "") return "";
  const iso = crmDateTimeFromApi(raw) || raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString();
}

function formatResponsibleLabel(opp) {
  const r = opp.responsible || opp.Responsible;
  if (r && typeof r === "object") {
    return (
      r.displayName || r.DisplayName || r.userName || r.UserName || r.title || r.Title || ""
    ).trim();
  }
  const rid = opp.responsibleId ?? opp.responsibleid ?? opp.responsibleID;
  if (rid != null && state.portalUsers.length) {
    const u = state.portalUsers.find((p) => sameUserId(p.id, rid));
    if (u) return u.displayName || String(rid);
  }
  return rid != null ? String(rid) : "";
}

function formatMembersLabel(opp) {
  const members = Array.isArray(opp.members) ? opp.members : Array.isArray(opp.Members) ? opp.Members : [];
  if (!members.length) return "";
  return members
    .map((m) => {
      if (typeof m === "string") return m;
      return (
        m.displayName ||
        m.DisplayName ||
        m.userName ||
        m.UserName ||
        m.title ||
        m.Title ||
        m.id ||
        m.ID ||
        ""
      );
    })
    .filter(Boolean)
    .join(", ");
}

function formatCustomFieldValueForDisplay(def, rawValue) {
  const code = customFieldTypeCode(def);
  if (code === 3) {
    const t = String(rawValue ?? "").trim().toLowerCase();
    if (t === "false" || t === "0" || t === "no" || t === "off" || t === "") return "No";
    return "Yes";
  }
  if (code === 4) return "";
  return formatCustomFieldValueForApi(def, rawValue) || "—";
}

function resolveStageTitle(opp) {
  const sid = resolveOppStageId(opp);
  const stage = state.stages.find((s) => String(s.id ?? s.ID) === String(sid));
  return (opp.stage?.title || opp.stage?.Title || stage?.title || stage?.Title || sid || "").trim();
}

function buildOpportunityPreviewStandardFields(opp, tags) {
  const rows = [];
  const push = (label, value) => {
    const v = value == null ? "" : String(value).trim();
    if (!v) return;
    rows.push({ label, value: v });
  };

  push("Stage", resolveStageTitle(opp));
  push("Contact", getOpportunityContactLabel(opp));
  push("Responsible", formatResponsibleLabel(opp));
  push("Members", formatMembersLabel(opp));
  push("Value", formatMoney(opp));
  push(
    "Success probability",
    opp.successProbability ?? opp.SuccessProbability ?? opp.stage?.successProbability ?? ""
  );
  push("Expected close", formatPreviewDateTime(opportunityDueDateRaw(opp)));
  push("Actual close", formatPreviewDateTime(opp.actualCloseDate ?? opp.ActualCloseDate));
  push("Created", formatPreviewDateTime(opp.createOn ?? opp.created ?? opp.Created));
  push("Tags", tags.length ? tags.join(", ") : "");
  if (opp.isPrivate ?? opp.IsPrivate) push("Private", "Yes");
  push("Bid type", opp.bidType ?? opp.BidType);
  return rows;
}

function buildOpportunityPreviewUserFields(opp, customFieldValues) {
  const rows = [];
  const valuesByFieldId = new Map();
  for (const item of customFieldValues) {
    const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
    if (fieldId != null) valuesByFieldId.set(String(fieldId), item);
  }

  const defs = state.customFieldDefs.length ? state.customFieldDefs : [];
  const seen = new Set();

  for (const def of defs) {
    const fieldId = customFieldDefinitionId(def);
    if (fieldId == null) continue;
    if (customFieldTypeCode(def) === 4) continue;
    const key = String(fieldId);
    seen.add(key);
    const item = valuesByFieldId.get(key);
    const raw = item ? readSavedCustomFieldValue(item) : getOppCustomFieldValue(opp, customFieldLabel(def));
    const label = customFieldLabel(def) || `Field ${fieldId}`;
    const value = formatCustomFieldValueForDisplay(def, raw);
    if (!value || value === "—") continue;
    rows.push({ label, value });
  }

  for (const item of customFieldValues) {
    const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
    if (fieldId == null) continue;
    const key = String(fieldId);
    if (seen.has(key)) continue;
    const def = state.customFieldById.get(key);
    if (def && customFieldTypeCode(def) === 4) continue;
    const label = customFieldLabel(item) || customFieldLabel(def) || `Field ${fieldId}`;
    const value = formatCustomFieldValueForDisplay(def, readSavedCustomFieldValue(item));
    if (!value || value === "—") continue;
    rows.push({ label, value });
  }

  return rows;
}

async function fetchAllOpportunityHistory(oppId) {
  const all = [];
  let startIndex = 0;
  while (all.length < OPP_PREVIEW_HISTORY_MAX) {
    const params = new URLSearchParams({
      startIndex: String(startIndex),
      count: String(OPP_PREVIEW_HISTORY_PAGE),
      entityType: "opportunity",
      entityId: String(oppId),
    });
    const data = await api(`/api/2.0/crm/history/filter?${params}`);
    const page = unwrapHistoryEvents(data);
    if (!page.length) break;
    all.push(...page);
    if (page.length < OPP_PREVIEW_HISTORY_PAGE) break;
    startIndex += page.length;
  }

  all.sort((a, b) => {
    const ta = new Date(historyEventDate(a) || 0).getTime();
    const tb = new Date(historyEventDate(b) || 0).getTime();
    return tb - ta;
  });
  return all.slice(0, OPP_PREVIEW_HISTORY_MAX);
}

async function fetchOpportunityPreviewData(oppId) {
  const id = Number(oppId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid opportunity id");

  await Promise.all([
    state.stages.length ? Promise.resolve() : loadStages(),
    state.customFieldDefs.length ? Promise.resolve() : loadOpportunityCustomFieldDefs(),
    state.portalUsers.length ? Promise.resolve() : loadPortalUsers(),
    loadHistoryCategories(),
  ]);

  const opp = await fetchOpportunityForUpdate(id);
  const [customFieldValues, history, tags] = await Promise.all([
    fetchOpportunityCustomFieldValues(id),
    fetchAllOpportunityHistory(id),
    loadDealEditTags(opp),
  ]);

  return { opp, customFieldValues, history, tags, oppId: id };
}

function appendPreviewSection(container, title, renderContent) {
  const section = document.createElement("section");
  section.className = "opp-preview-section";
  const h = document.createElement("h3");
  h.className = "opp-preview-section-title";
  h.textContent = title;
  section.appendChild(h);
  renderContent(section);
  container.appendChild(section);
}

function renderPreviewFieldGrid(parent, rows) {
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "opp-preview-empty";
    p.textContent = "None";
    parent.appendChild(p);
    return;
  }
  const dl = document.createElement("dl");
  dl.className = "opp-preview-fields";
  for (const { label, value } of rows) {
    const row = document.createElement("div");
    row.className = "opp-preview-field";
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    row.appendChild(dt);
    row.appendChild(dd);
    dl.appendChild(row);
  }
  parent.appendChild(dl);
}

function renderOpportunityPreviewBody(data) {
  const body = $("#opp-preview-body");
  if (!body) return;
  body.innerHTML = "";

  const { opp, customFieldValues, history, tags } = data;
  const standardRows = buildOpportunityPreviewStandardFields(opp, tags);
  const userRows = buildOpportunityPreviewUserFields(opp, customFieldValues);
  const description = String(opp.description ?? opp.Description ?? "").trim();

  appendPreviewSection(body, "Deal fields", (section) => {
    renderPreviewFieldGrid(section, standardRows);
  });

  appendPreviewSection(body, "Description", (section) => {
    if (!description) {
      const p = document.createElement("p");
      p.className = "opp-preview-empty";
      p.textContent = "No description";
      section.appendChild(p);
      return;
    }
    const p = document.createElement("p");
    p.className = "opp-preview-description";
    p.textContent = description;
    section.appendChild(p);
  });

  appendPreviewSection(body, "User fields", (section) => {
    renderPreviewFieldGrid(section, userRows);
  });

  appendPreviewSection(body, "History & notes", (section) => {
    if (!history.length) {
      const p = document.createElement("p");
      p.className = "opp-preview-empty";
      p.textContent = "No history events";
      section.appendChild(p);
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "opp-preview-history";
    for (const ev of history) {
      ul.appendChild(renderHistoryEventItem(ev));
    }
    section.appendChild(ul);
  });
}

function setOpportunityPreviewCrmLink(oppId) {
  const wrap = $("#opp-preview-open-crm-wrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  const link = createCrmOpenLink(oppId, { className: "opp-preview-open-crm" });
  wrap.appendChild(link);
}

function findGroupForOpportunity(oppId) {
  const id = Number(oppId);
  if (!Number.isFinite(id)) return null;
  for (const g of state.groups) {
    for (const col of groupOpportunities(g)) {
      for (const o of col.items || []) {
        if (Number(o.id ?? o.ID) === id) return g;
      }
    }
  }
  return null;
}

function setOpportunityPreviewContext(oppId, opp = null, group = null) {
  if (oppId == null) {
    oppPreviewContext = { oppId: null, opp: null, group: null };
    return;
  }
  const id = Number(oppId);
  oppPreviewContext = {
    oppId: Number.isFinite(id) ? id : null,
    opp: opp || null,
    group: group || null,
  };
}

async function openDealEditFromOpportunityPreview() {
  const { oppId, opp, group } = oppPreviewContext;
  if (oppId == null) {
    showToast("Opportunity not loaded", true);
    return;
  }
  let deal = opp;
  if (!deal) {
    try {
      deal = await fetchOpportunityForUpdate(oppId);
    } catch (err) {
      showToast(err.message, true);
      return;
    }
  }
  const refreshGroup = group || findGroupForOpportunity(oppId);
  closeOpportunityPreviewModal();
  try {
    await openDealEditModal(deal, refreshGroup);
  } catch (err) {
    showToast(err.message, true);
  }
}

function closeOpportunityPreviewModal() {
  oppPreviewMailCache.clear();
  setOpportunityPreviewContext(null);
  $("#opp-preview-modal")?.classList.add("hidden");
}

async function openOpportunityPreviewModal(oppId, titleHint = "", group = null) {
  const modal = $("#opp-preview-modal");
  const body = $("#opp-preview-body");
  const titleEl = $("#opp-preview-title");
  if (!modal || !body || !titleEl) return;

  const id = Number(oppId);
  oppPreviewMailCache.clear();
  setOpportunityPreviewContext(id, null, group);
  titleEl.textContent = titleHint || "Opportunity";
  body.innerHTML = '<p class="opp-preview-loading">Loading opportunity…</p>';
  setOpportunityPreviewCrmLink(id);
  modal.classList.remove("hidden");

  try {
    const data = await fetchOpportunityPreviewData(id);
    const resolvedGroup = group || findGroupForOpportunity(id);
    setOpportunityPreviewContext(id, data.opp, resolvedGroup);
    titleEl.textContent = data.opp.title || data.opp.Title || titleHint || `Opportunity #${id}`;
    renderOpportunityPreviewBody(data);
  } catch (err) {
    body.innerHTML = `<p class="opp-preview-error">${escapeHtml(err.message)}</p>`;
    showToast(err.message, true);
  }
}

function bindOpportunityPreviewModal() {
  const modal = $("#opp-preview-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";
  $("#opp-preview-close")?.addEventListener("click", closeOpportunityPreviewModal);
  $("#opp-preview-edit")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDealEditFromOpportunityPreview();
  });
  modal.querySelectorAll("[data-opp-preview-dismiss]").forEach((el) => {
    el.addEventListener("click", closeOpportunityPreviewModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeOpportunityPreviewModal();
  });
}

function bindGlobalOpportunitySearch() {
  const wrap = $("#global-opp-search");
  const input = $("#global-opp-search-input");
  const results = $("#global-opp-search-results");
  if (!wrap || !input || !results || input.dataset.bound) return;
  input.dataset.bound = "1";

  let debounce;
  const hideResults = () => results.classList.add("hidden");

  const renderResults = (opps, q) => {
    results.innerHTML = "";
    if (!q.length) {
      hideResults();
      return;
    }
    results.classList.remove("hidden");
    if (q.length < 2 && !opps.length) {
      results.innerHTML = '<span class="search-empty">Type 2+ characters to search CRM</span>';
      return;
    }
    if (!opps.length) {
      results.innerHTML = '<span class="search-empty">No opportunities found</span>';
      return;
    }
    for (const o of opps) {
      const row = document.createElement("div");
      row.className = "global-opp-search-item";
      row.setAttribute("role", "option");

      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "global-opp-search-item-title";
      titleBtn.textContent = o.title;
      titleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        input.value = "";
        hideResults();
        openOpportunityPreviewModal(o.id, o.title).catch((err) => showToast(err.message, true));
      });

      const openLink = createCrmOpenLink(o.id, {
        className: "global-opp-search-open",
        title: "Open in CRM",
      });

      row.appendChild(titleBtn);
      row.appendChild(openLink);
      results.appendChild(row);
    }
  };

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      if (!q.length) {
        hideResults();
        return;
      }
      try {
        const opps = await searchOpportunitiesByTitle(q);
        renderResults(opps, q);
      } catch (err) {
        showToast(err.message, true);
      }
    }, 300);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      hideResults();
      input.blur();
    }
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) hideResults();
  });
}

function bindNewTaskOpportunityPicker() {
  const input = $("#new-task-opportunity-search");
  const results = $("#new-task-opportunity-results");
  if (!input || !results || input.dataset.bound) return;
  input.dataset.bound = "1";
  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 1) {
        results.classList.add("hidden");
        return;
      }
      try {
        const opps = await searchOpportunitiesForTaskPicker(q);
        results.classList.remove("hidden");
        if (!opps.length) {
          results.innerHTML = '<button type="button" disabled>No matches</button>';
          return;
        }
        for (const o of opps) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = o.title;
          btn.addEventListener("click", () => setNewTaskOpportunitySelection(o.id, o.title));
          results.appendChild(btn);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    }, 300);
  });
  document.addEventListener("click", (e) => {
    const wrap = input.closest(".opportunity-picker-field");
    if (wrap && !wrap.contains(e.target)) results.classList.add("hidden");
  });
}

/** CRM create-task uses `deadline` (ISO), not read-model `deadLine`. */
function toApiTaskDeadline(dateInputValue) {
  if (!dateInputValue) return null;
  const d = new Date(`${dateInputValue}T17:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function resolveTaskCategoryId(formCategoryId) {
  const picked = formCategoryId != null && String(formCategoryId).trim() !== "" ? Number(formCategoryId) : NaN;
  if (Number.isFinite(picked) && picked > 0) return picked;
  const first = state.taskCategories[0];
  const fallback = Number(first?.id ?? first?.ID);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}

function buildCreateTaskBody(form) {
  const title = form.title?.trim();
  if (!title) throw new Error("Task title is required");

  const responsibleId = form.responsibleId?.trim();
  if (!responsibleId) throw new Error("Assigned user is required");

  const categoryId = resolveTaskCategoryId(form.categoryId);
  if (categoryId == null) {
    throw new Error("No task category available. Reload the page or check CRM task categories.");
  }

  const body = {
    title,
    description: form.description?.trim() || "",
    responsibleId,
    categoryId,
    isNotify: !!form.isNotify,
  };

  const deadline = toApiTaskDeadline(form.deadLine);
  if (deadline) body.deadline = deadline;

  const oppId = state.newTaskOpportunity.id;
  if (oppId != null && Number.isFinite(oppId)) {
    body.entityType = "opportunity";
    body.entityId = oppId;
  }

  return body;
}

function unwrapCreatedEntity(data) {
  const r = data?.response ?? data?.result ?? data;
  if (r && typeof r === "object") return r;
  return data;
}

async function createCrmTask(body) {
  return api("/api/2.0/crm/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function notifyCrmTaskResponsible(taskId) {
  try {
    await api(`/api/2.0/crm/task/${taskId}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    /* optional */
  }
}

async function submitNewTaskForm(e) {
  e.preventDefault();
  setTaskModalError("");
  const form = e.target;
  const submitBtn = $("#task-modal-submit");
  if (submitBtn) submitBtn.disabled = true;
  try {
    const body = buildCreateTaskBody({
      title: $("#new-task-title")?.value,
      description: $("#new-task-description")?.value,
      deadLine: $("#new-task-deadline")?.value,
      responsibleId: $("#new-task-responsible")?.value,
      categoryId: $("#new-task-category")?.value,
      isNotify: $("#new-task-notify")?.checked,
    });
    const data = await createCrmTask(body);
    const created = unwrapCreatedEntity(data);
    const taskId = created?.id ?? created?.ID ?? data?.id ?? data?.ID;
    if ($("#new-task-notify")?.checked && taskId != null) {
      await notifyCrmTaskResponsible(taskId);
    }
    closeNewTaskModal();
    showToast("Task created");
    await loadTasks();
  } catch (err) {
    setTaskModalError(err.message || "Could not create task");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function openNewTaskModal() {
  const modal = $("#task-modal");
  const form = $("#task-modal-form");
  if (!modal || !form) return;

  setTaskModalError("");
  form.reset();
  clearNewTaskOpportunitySelection();

  await loadTaskCategories();
  populateNewTaskCategorySelect();
  populateNewTaskResponsibleSelect();

  const notify = $("#new-task-notify");
  if (notify) notify.checked = true;

  modal.classList.remove("hidden");
  $("#new-task-title")?.focus();
}

function bindNewTaskModal() {
  const modal = $("#task-modal");
  const form = $("#task-modal-form");
  if (!modal || !form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", (e) => {
    submitNewTaskForm(e).catch((err) => setTaskModalError(err.message));
  });

  $("#task-modal-cancel")?.addEventListener("click", closeNewTaskModal);
  modal.querySelectorAll("[data-task-modal-dismiss]").forEach((el) => {
    el.addEventListener("click", closeNewTaskModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeNewTaskModal();
  });

  bindNewTaskOpportunityPicker();
}

async function loadTasks() {
  if (tileBodyCollapsed("tile-tasks")) {
    showTileCollapsedHint("tile-tasks", "Minimized — expand to load tasks");
    return;
  }
  renderTasksTile();
  const params = new URLSearchParams({ startIndex: "0", count: "200", isClosed: "false" });
  const filterUser = $("#tasks-user-filter")?.value;
  if (filterUser) params.set("responsibleid", filterUser);

  const data = await api(`/api/2.0/crm/task/filter?${params}`);
  state.tasks = unwrap(data).filter((t) => !t.isClosed);
  populateTasksUserFilter();
  renderTasksByUser();
}

function populateTasksUserFilter() {
  const sel = $("#tasks-user-filter");
  if (!sel) return;
  const preferred = sel.value || state.currentUserId || "";
  sel.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All users";
  sel.appendChild(allOpt);

  const users = new Map();
  for (const u of state.portalUsers) {
    users.set(String(u.id), u.displayName || u.id);
  }
  for (const t of state.tasks) {
    const r = t.responsible;
    if (r?.id) users.set(String(r.id), r.displayName || r.userName || r.id);
  }
  if (state.currentUserId && !users.has(String(state.currentUserId))) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }

  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }

  if (preferred && [...sel.options].some((o) => o.value === String(preferred))) {
    sel.value = String(preferred);
  } else if (state.currentUserId) {
    sel.value = String(state.currentUserId);
  }
}

function taskSortMs(task) {
  const due = task.deadLine?.value ?? task.deadLine ?? task.deadline;
  if (due) {
    const t = new Date(due).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const created =
    task.createOn?.value ?? task.createOn ?? task.created?.value ?? task.created ?? task.dateAndTime;
  const c = new Date(created || 0).getTime();
  return Number.isNaN(c) ? 0 : c;
}

function createTaskRow(task) {
  const row = document.createElement("div");
  row.className = "task-row";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.addEventListener("change", async () => {
    if (!cb.checked) return;
    cb.disabled = true;
    try {
      await api(`/api/2.0/crm/task/${task.id}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      row.classList.add("done");
      showToast("Task marked complete");
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      setTimeout(() => {
        row.remove();
        renderTasksByUser();
      }, 400);
    } catch (err) {
      cb.checked = false;
      cb.disabled = false;
      showToast(err.message, true);
    }
  });

  const label = document.createElement("label");
  const titleLink = document.createElement("a");
  titleLink.href = crmTaskUrl(task);
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.textContent = task.title || "(Task)";
  label.appendChild(titleLink);
  if (task.deadLine?.value || task.deadLine) {
    const dl = document.createElement("span");
    dl.className = "feed-meta";
    dl.textContent = `Due ${new Date(task.deadLine?.value || task.deadLine).toLocaleDateString()}`;
    label.appendChild(dl);
  }
  if (task.entity?.entityType === "opportunity" && task.entity.entityTitle) {
    const ent = document.createElement("a");
    ent.className = "feed-meta";
    ent.href = crmOpportunityUrl(task.entity.entityId);
    ent.target = "_blank";
    ent.rel = "noopener noreferrer";
    ent.textContent = task.entity.entityTitle;
    label.appendChild(ent);
  }

  row.appendChild(cb);
  row.appendChild(label);
  return row;
}

function renderTasksByUser() {
  const root = $("#tasks-by-user");
  if (!root) return;
  root.innerHTML = "";
  const tasksTile = document.querySelector('[data-tile-id="tile-tasks"]');
  const fullWidth = tasksTile?.classList.contains("panel-width-full");
  root.className = fullWidth ? "tasks-by-user tasks-by-user-columns" : "tasks-by-user";

  const filterUser = $("#tasks-user-filter")?.value;
  let tasks = state.tasks;
  if (filterUser) {
    tasks = tasks.filter((t) => String(t.responsible?.id) === String(filterUser));
  }

  updatePanelTileCount("tile-tasks", tasks.length);

  if (!tasks.length) {
    root.innerHTML = '<p class="board-loading">No open tasks.</p>';
    return;
  }

  if (fullWidth) {
    const sorted = [...tasks].sort((a, b) => {
      const da = new Date(a.deadline || a.Deadline || 0).getTime() || Infinity;
      const db = new Date(b.deadline || b.Deadline || 0).getTime() || Infinity;
      return da - db;
    });
    const colCount = 3;
    const perCol = Math.ceil(sorted.length / colCount);
    for (let c = 0; c < colCount; c++) {
      const col = document.createElement("div");
      col.className = "tasks-column";
      for (const task of sorted.slice(c * perCol, (c + 1) * perCol)) {
        col.appendChild(createTaskRow(task));
      }
      root.appendChild(col);
    }
    return;
  }

  const byUser = new Map();
  for (const task of tasks) {
    const r = task.responsible;
    const key = r?.id || "_none";
    const name = r?.displayName || "Unassigned";
    if (!byUser.has(key)) byUser.set(key, { name, tasks: [] });
    byUser.get(key).tasks.push(task);
  }

  for (const { name, tasks: userTasks } of byUser.values()) {
    const block = document.createElement("div");
    block.className = "tasks-user-block";
    const h = document.createElement("h3");
    h.textContent = name;
    block.appendChild(h);

    for (const task of userTasks) {
      block.appendChild(createTaskRow(task));
    }
    root.appendChild(block);
  }
}

const groupCardObservers = new Map();
const oppCustomFieldEnrich = {
  queue: [],
  inFlight: new Set(),
  pending: new Set(),
};

function opportunityHasCustomFieldLists(opp) {
  const lists = [
    opp.customFields,
    opp.CustomFields,
    opp.customFieldList,
    opp.CustomFieldList,
    opp.fieldValues,
    opp.FieldValues,
  ];
  return lists.some((l) => Array.isArray(l) && l.length);
}

function findOpportunityInGroup(group, oppId) {
  const id = String(oppId);
  return (group.opportunities || []).find((o) => String(o.id ?? o.ID) === id) || null;
}

async function fetchOpportunityCustomFields(opp) {
  const id = opp.id ?? opp.ID;
  if (id == null) return false;
  const paths = [
    `/api/2.0/crm/opportunity/${id}/customfield`,
    `/api/2.0/crm/opportunity/${id}/customfields`,
    `/api/2.0/crm/opportunity/${id}/customfield/`,
  ];
  for (const path of paths) {
    try {
      const fields = unwrap(await api(path));
      if (fields.length) {
        opp.customFields = fields;
        indexOpportunity(opp);
        return true;
      }
    } catch {
      /* try next */
    }
  }
  return false;
}

function updateOpportunityCardDom(opp, group) {
  const root = group._el;
  if (!root) return;
  const card = root.querySelector(`.card[data-opportunity-id="${opp.id}"]`);
  if (!card) return;
  const showStagePill = group.groupBy !== "stage";
  const next = renderCard(opp, group, showStagePill);
  card.replaceWith(next);
  const board = $(".board", root);
  const entry = groupCardObservers.get(group.id);
  if (board && entry?.observer) entry.observer.observe(next);
}

async function drainOppCustomFieldEnrichQueue() {
  while (
    oppCustomFieldEnrich.queue.length > 0 &&
    oppCustomFieldEnrich.inFlight.size < OPP_CUSTOM_FIELD_ENRICH_CONCURRENCY
  ) {
    const job = oppCustomFieldEnrich.queue.shift();
    if (!job) break;
    const opp = job.opp;
    const group = job.group;
    const id = String(opp.id ?? opp.ID);
    if (!id || opportunityHasCustomFieldLists(opp)) {
      oppCustomFieldEnrich.pending.delete(id);
      continue;
    }
    oppCustomFieldEnrich.inFlight.add(id);
    try {
      await fetchOpportunityCustomFields(opp);
      updateOpportunityCardDom(opp, group);
    } catch {
      /* card keeps base fields */
    } finally {
      oppCustomFieldEnrich.inFlight.delete(id);
      oppCustomFieldEnrich.pending.delete(id);
    }
  }
}

function enqueueOpportunityCustomFieldEnrich(opp, group) {
  const id = String(opp.id ?? opp.ID);
  if (!id || !group) return;
  if (opportunityHasCustomFieldLists(opp)) return;
  if (oppCustomFieldEnrich.pending.has(id) || oppCustomFieldEnrich.inFlight.has(id)) return;
  oppCustomFieldEnrich.pending.add(id);
  oppCustomFieldEnrich.queue.push({ opp, group });
  drainOppCustomFieldEnrichQueue();
}

function disconnectGroupCardObserver(groupId) {
  const entry = groupCardObservers.get(groupId);
  if (!entry) return;
  entry.observer.disconnect();
  groupCardObservers.delete(groupId);
}

function observeOpportunityCardsInGroup(group) {
  disconnectGroupCardObserver(group.id);
  const board = group._el?.querySelector(".board");
  if (!board) return;

  const tileRoot = group._el?.closest(".dashboard-tile") || null;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const card = entry.target;
        const oppId = card.dataset.opportunityId;
        const opp = findOpportunityInGroup(group, oppId);
        if (opp) enqueueOpportunityCustomFieldEnrich(opp, group);
      }
    },
    { root: tileRoot, rootMargin: "160px 0px", threshold: 0.02 }
  );

  for (const card of board.querySelectorAll(".card[data-opportunity-id]")) {
    observer.observe(card);
  }
  groupCardObservers.set(group.id, { observer });
}

/** Legacy batch enrich — prefer visible-card queue; kept for explicit bulk refresh if needed. */
async function enrichOpportunitiesCustomFields(items) {
  if (!items.length || !state.customFieldDefs.length) return items;
  const missing = items.filter((o) => !opportunityHasCustomFieldLists(o));
  await Promise.all(
    missing.slice(0, 40).map((opp) => fetchOpportunityCustomFields(opp))
  );
  return items;
}

async function refreshGroup(group, { force = false } = {}) {
  const tileId = `group-${group.id}`;
  if (!force && tileBodyCollapsed(tileId)) {
    showTileCollapsedHint(tileId, "Minimized — expand to load deals");
    return;
  }
  try {
    let items = await fetchOpportunitiesForGroup(group);
    if (group.dealStatus !== "all" && !group.stageType) {
      items = applyClientDealStatus(items, group.dealStatus);
    }
    group.opportunities = items;
    for (const o of items) indexOpportunity(o);

    const el = groupDomEl(group);
    if (el) {
      updateGroupFilterSummary(group);
      renderGroupBoard(group, $(".board", el));
      $(".board-group-count", el).textContent = `${items.length} deals`;
    }
  } catch (err) {
    const el = groupDomEl(group);
    if (el) {
      $(".board", el).innerHTML = `<p class="board-error">${escapeHtml(err.message)}</p>`;
    }
    throw err;
  }
}

async function refreshAll() {
  noteDashboardActivity();
  $("#status-text").textContent = "Loading…";
  try {
    state.opportunityById = new Map();
    state.tileLayout = loadLayoutFromStorage();
    await loadCurrentUser();
    syncFeedFilterPlaceholder();
    await Promise.all([
      loadPortalUsers(),
      loadUserProfileFromServer(),
      loadStages(),
      loadAllTags(),
      loadOpportunityCustomFieldDefs(),
    ]);
    syncFeedFilterPlaceholder();
    renderBoardGroups();
    refreshDashboardTileLayouts();
    populateTasksUserFilter();
    await loadExpandedDashboardTiles({ quiet: true });
  } catch (err) {
    $("#status-text").textContent = "Error";
    showToast(err.message, true);
  }
}

function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#portal-label").textContent = state.portalUrl;
  noteDashboardActivity();
  startPanelTileAutoRefresh();
}

function showLogin() {
  stopPanelTileAutoRefresh();
  userProfileReady = false;
  $("#app").classList.add("hidden");
  $("#login-screen").classList.remove("hidden");
  $("#portal-url").value = state.portalUrl || DEFAULT_PORTAL;
}

async function checkSession() {
  return (await (await fetch("/api/session", { credentials: "same-origin" })).json()).authenticated;
}

async function init() {
  const config = await (await fetch("/api/config")).json();
  if (config.portalUrl) {
    state.portalUrl = config.portalUrl;
    localStorage.setItem("oo_portal_url", state.portalUrl);
  }

  state.groups = [];
  state.calendarTiles = [];
  state.notesTiles = [];
  state.tileLayout = { order: [], widths: {}, heights: {}, collapsed: {} };
  state.hiddenFeedEntries = new Map();
  state.groupTemplates = [];
  userProfileReady = false;
  bindNewTaskModal();
  bindDealEditModal();
  bindQuickNoteModal();
  bindCreateOpportunityModal();
  bindGlobalOpportunitySearch();
  bindOpportunityPreviewModal();
  bindDashboardActivityTracking();
  bindFeedHiddenModal();
  bindNotesArchiveRestoreModal();

  $("#new-opportunity-btn")?.addEventListener("click", () => {
    openCreateOpportunityModal().catch((err) => showToast(err.message, true));
  });

  $("#quick-note-btn")?.addEventListener("click", () => {
    openQuickNoteModal().catch((err) => showToast(err.message, true));
  });

  bindAddTileModal();
  bindCalendarEventModal();

  $("#refresh-btn").addEventListener("click", refreshAll);
  $("#logout-btn").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    showLogin();
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("#login-error");
    errEl.classList.add("hidden");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          portalUrl: $("#portal-url").value.trim().replace(/\/$/, ""),
          userName: $("#username").value,
          password: $("#password").value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Login failed");
      state.portalUrl = data.portalUrl || $("#portal-url").value.trim();
      localStorage.setItem("oo_portal_url", state.portalUrl);
      showApp();
      await refreshAll();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  });

  if (await checkSession()) {
    showApp();
    await refreshAll();
  } else {
    showLogin();
  }
}

init();