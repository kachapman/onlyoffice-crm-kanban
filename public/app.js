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
const FEED_DAYS = 30;
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
  hiddenFeedKeys: new Set(),
  feedKeywordFilter: "",
  feedNotificationsCache: [],
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

function loadHiddenFeedKeys() {
  try {
    const raw = localStorage.getItem(HIDDEN_FEED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveHiddenFeedKeys() {
  localStorage.setItem(HIDDEN_FEED_STORAGE_KEY, JSON.stringify([...state.hiddenFeedKeys]));
  scheduleUserProfileSave();
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
    ...state.notesTiles.map((n) => notesTileId(n)),
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
  return state.tileLayout.widths[tileId] === "half" ? "half" : "full";
}

function tileHeight(tileId) {
  return state.tileLayout.heights[tileId] === "double" ? "double" : "normal";
}

function setTileWidth(tileId, width) {
  state.tileLayout.widths[tileId] = width === "half" ? "half" : "full";
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

const PINNED_TILE_IDS = ["tile-feed", "tile-tasks"];
const PANEL_TILE_IDS = new Set(PINNED_TILE_IDS);

function loadFeedKeywordFromStorage() {
  try {
    state.feedKeywordFilter = localStorage.getItem(FEED_KEYWORD_STORAGE_KEY) || "";
  } catch {
    state.feedKeywordFilter = "";
  }
}

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
    tileEl.classList.remove("tile-half", "tile-double");
  } else {
    applyTileLayoutClasses(tileEl, tileId);
  }
}

function applyTileLayoutClasses(tileEl, tileId) {
  if (!tileEl || !tileId) return;
  if (tileBodyCollapsed(tileId)) {
    tileEl.classList.remove("tile-half", "tile-double", "tasks-tile-full");
    return;
  }
  if (PANEL_TILE_IDS.has(tileId)) {
    if (state.tileLayout.heights?.[tileId]) {
      delete state.tileLayout.heights[tileId];
      saveLayoutToStorage();
    }
    tileEl.classList.add("panel-tile");
    tileEl.classList.remove("tile-double", "tile-half", "tasks-tile-full");
    const w = tileWidth(tileId);
    tileEl.classList.toggle("panel-width-half", w !== "full");
    tileEl.classList.toggle("panel-width-full", w === "full");
    tileEl.classList.toggle("tasks-tile-full", tileId === "tile-tasks" && w === "full");
    syncPanelRowLayout();
    return;
  }
  const w = tileWidth(tileId);
  const h = tileHeight(tileId);
  tileEl.classList.toggle("tile-half", w === "half");
  tileEl.classList.toggle("tile-double", h === "double");
}

function createCollapseTileButton(tileEl, tileId) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-ghost btn-collapse-tile";
  const sync = () => {
    const collapsed = tileBodyCollapsed(tileId);
    btn.textContent = collapsed ? "Expand" : "Collapse";
    btn.setAttribute("aria-expanded", String(!collapsed));
    applyTileBodyCollapsed(tileEl, tileId);
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setTileBodyCollapsed(tileId, !tileBodyCollapsed(tileId));
    sync();
  });
  sync();
  return btn;
}

function attachTileCollapseButton(tileEl, tileId) {
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar, :scope > .group-tile-bar");
  if (!toolbar || toolbar.querySelector(".btn-collapse-tile")) return;
  const layoutBtns = toolbar.querySelector(".tile-layout-btns");
  const collapseBtn = createCollapseTileButton(tileEl, tileId);
  if (layoutBtns) toolbar.insertBefore(collapseBtn, layoutBtns);
  else toolbar.appendChild(collapseBtn);
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

function setTileLayoutIconButton(btn, iconHtml, title) {
  btn.classList.add("tile-btn", "tile-btn-icon");
  btn.innerHTML = iconHtml;
  btn.title = title;
  btn.setAttribute("aria-label", title);
}

function createLayoutButtons({ showDoubleHeight = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "tile-layout-btns";

  const halfBtn = document.createElement("button");
  halfBtn.type = "button";
  setTileLayoutIconButton(halfBtn, TILE_ICON_WINDOW_RESTORE, "Contract tile (half width)");

  const fullBtn = document.createElement("button");
  fullBtn.type = "button";
  setTileLayoutIconButton(fullBtn, TILE_ICON_WINDOW_MAXIMIZE, "Expand tile (full width)");

  wrap.appendChild(halfBtn);
  wrap.appendChild(fullBtn);

  let tallBtn = null;
  if (showDoubleHeight) {
    tallBtn = document.createElement("button");
    tallBtn.type = "button";
    setTileLayoutIconButton(tallBtn, TILE_ICON_HEIGHT_EXPAND, "Double tile height (two grid rows)");
    wrap.appendChild(tallBtn);
  }
  return { wrap, halfBtn, fullBtn, tallBtn };
}

function bindTileLayoutButtons(tileEl, tileId, halfBtn, fullBtn, tallBtn) {
  const syncTileLayout = () => {
    const w = tileWidth(tileId);
    const h = tileHeight(tileId);
    halfBtn.classList.toggle("tile-btn-active", w === "half");
    fullBtn.classList.toggle("tile-btn-active", w === "full");
    if (tallBtn) tallBtn.classList.toggle("tile-btn-active", h === "double");
    applyTileLayoutClasses(tileEl, tileId);
    if (tileId === "tile-tasks") renderTasksByUser();
    if (PANEL_TILE_IDS.has(tileId)) syncPanelRowLayout();
  };
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

  const saveTplBtn = document.createElement("button");
  saveTplBtn.type = "button";
  saveTplBtn.className = "btn btn-ghost btn-save-template";
  saveTplBtn.textContent = "Save template";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-danger btn-remove-group";
  removeBtn.textContent = "Remove";

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
        <span class="panel-sub feed-range-hint">Last ${FEED_DAYS} days</span>
      </div>
      <ul id="notification-feed" class="feed-list" aria-live="polite"></ul>
    `;
    $("#dashboard-panel-row")?.appendChild(tile);
    bindTileChrome(tile, tileId);
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

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-danger btn-remove-calendar";
  removeBtn.textContent = "Remove";

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
    if (state.calendarCache[tid]) {
      renderCalendarMonthBody(section, cal);
    } else {
      loadCalendarForTile(cal, { quiet: true }).catch(() => {});
    }
  }
}

function stripNotesRuntimeFields(notes) {
  const { _el, _saveTimer, ...rest } = notes;
  return rest;
}

function newNotesTile(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: "Notes",
    content: "",
    viewMode: "edit",
    updatedAt: null,
    ...overrides,
  };
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
  if (!footer || !label) return;
  const text = formatNotesUpdatedLabel(notes.updatedAt);
  label.textContent = text ? `Last updated ${text}` : "Not saved yet";
  footer.title = text ? `Last saved to server: ${text}` : "Saves automatically to the server";
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
    hiddenFeedKeys: [...state.hiddenFeedKeys],
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
  state.hiddenFeedKeys = new Set(
    Array.isArray(profile.hiddenFeedKeys) ? profile.hiddenFeedKeys.map(String) : []
  );
  state.feedKeywordFilter = String(profile.feedKeywordFilter || "");
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
    hiddenFeedKeys: [...loadHiddenFeedKeys()],
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
    userProfileReady = true;
    return;
  }

  if (
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
    userProfileReady = true;
    return;
  }

  applyUserProfile({
    groups: [
      newGroup({ name: "Open pipeline", dealStatus: "open", groupBy: "stage" }),
      newGroup({ name: "Tagged deals", dealStatus: "all", groupBy: "tag", tagTitles: [] }),
    ],
    tileLayout: { order: [], widths: {}, heights: {}, collapsed: {} },
    calendarTiles: [],
    notesTiles: [],
    groupTemplates: [],
    hiddenFeedKeys: [],
    feedKeywordFilter: "",
  });
  persistProfileToLocalStorage();
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

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const inlineFormat = (raw) => {
    let s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
      const href = escapeHtml(url.trim());
      if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) return escapeHtml(label);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    });
    return s;
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed.trim()) {
      closeLists();
      continue;
    }
    const hm = trimmed.match(/^(#{1,3})\s+(.+)$/);
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
    const ulm = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulm) {
      if (!inUl) {
        closeLists();
        out.push("<ul class=\"notes-md-list\">");
        inUl = true;
      }
      out.push(`<li>${inlineFormat(ulm[1])}</li>`);
      continue;
    }
    const olm = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olm) {
      if (!inOl) {
        closeLists();
        out.push("<ol class=\"notes-md-list\">");
        inOl = true;
      }
      out.push(`<li>${inlineFormat(olm[1])}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${inlineFormat(trimmed)}</p>`);
  }
  closeLists();
  return out.join("") || '<p class="notes-md-empty">Nothing to preview yet.</p>';
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

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn btn-ghost btn-notes-copy";
  copyBtn.textContent = "Copy all";
  copyBtn.title = "Copy all text to clipboard";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn-ghost btn-notes-mode";
  editBtn.dataset.mode = "edit";
  editBtn.textContent = "Edit";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "btn btn-ghost btn-notes-mode";
  previewBtn.dataset.mode = "preview";
  previewBtn.textContent = "Preview";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-danger btn-remove-notes";
  removeBtn.textContent = "Remove";

  const { wrap, halfBtn, fullBtn, tallBtn } = createLayoutButtons();

  toolbar.appendChild(hint);
  toolbar.appendChild(nameInput);
  toolbar.appendChild(copyBtn);
  toolbar.appendChild(editBtn);
  toolbar.appendChild(previewBtn);
  toolbar.appendChild(removeBtn);
  toolbar.appendChild(wrap);

  section.prepend(toolbar);
  bindTileLayoutButtons(section, tileId, halfBtn, fullBtn, tallBtn);
  bindTileDragDrop(section, tileId, toolbar);
  attachTileCollapseButton(section, tileId);

  const syncModeButtons = () => {
    const isPreview = notes.viewMode === "preview";
    editBtn.classList.toggle("tile-btn-active", !isPreview);
    previewBtn.classList.toggle("tile-btn-active", isPreview);
    syncNotesTileBody(section, notes);
  };

  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const text = notes.content || "";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      showToast("Could not copy to clipboard", true);
    }
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

  removeBtn.addEventListener("click", async () => {
    const label = notes.name?.trim() || "this notes tile";
    const ok = await confirmDialog({
      title: "Remove notes tile?",
      message: `Remove “${label}” from the dashboard?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    const tid = notesTileId(notes);
    state.notesTiles = state.notesTiles.filter((n) => n.id !== notes.id);
    state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
    delete state.tileLayout.widths[tid];
    delete state.tileLayout.heights[tid];
    saveLayoutToStorage();
    scheduleUserProfileSave();
    renderBoardGroups();
  });

  syncModeButtons();
}

function renderNotesTiles(dash) {
  for (const notes of state.notesTiles) {
    const tileId = notesTileId(notes);
    const section = document.createElement("section");
    section.className = "dashboard-tile board-group board-group-tile notes-tile";
    section.dataset.tileId = tileId;
    section.dataset.tileLabel = notes.name || "Notes";
    section.dataset.notesId = notes.id;
    section.innerHTML = `
      <div class="notes-tile-body">
        <textarea class="notes-editor" placeholder="Write notes or to-dos… Markdown: **bold**, *italic*, \`code\`, # headings, - lists, [links](url)" spellcheck="true"></textarea>
        <div class="notes-preview hidden" aria-live="polite"></div>
        <div class="notes-tile-footer" aria-live="polite"><span class="notes-updated-label"></span></div>
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

function populateDealEditNoteCategorySelect() {
  const sel = $("#deal-edit-note-category");
  const field = $("#deal-edit-note-category-field");
  if (!sel) return;

  sel.innerHTML = "";
  const cats = state.historyCategories;
  if (!cats.length) {
    if (field) field.classList.add("hidden");
    return;
  }

  if (field) field.classList.toggle("hidden", cats.length <= 1);

  for (const cat of cats) {
    const opt = document.createElement("option");
    opt.value = String(cat.id ?? cat.ID ?? "");
    opt.textContent = cat.title || cat.Title || opt.value;
    sel.appendChild(opt);
  }

  const preferred = cats.findIndex((c) => /note|event|comment/i.test(String(c.title || c.Title || "")));
  sel.selectedIndex = preferred >= 0 ? preferred : 0;
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
const CHECKLIST_FIELD_NAMES = ["Measurement Report", "Insurance Documents", "Inspection Photos"];

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
  return CHECKLIST_FIELD_NAMES.some((name) => !isCustomFieldChecked(opp, name));
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

function renderCard(opp, group, showStagePill) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.opportunityId = opp.id;

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
  card.appendChild(editBtn);

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

  const crmJobId = getOppCustomFieldValue(opp, "crm job/id", "crm job", "job/id");
  if (crmJobId) appendCardDetailLine(details, "CRM Job/ID", crmJobId);

  const insuranceCarrier = getOppCustomFieldValue(opp, "insurance carrier");
  if (insuranceCarrier) appendCardDetailLine(details, "Insurance Carrier", insuranceCarrier);

  const supplementRequest = getOppCustomFieldValue(opp, "supplement request");
  if (!supplementRequest) {
    appendCardDetailLine(details, null, "No Supp Request");
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

  if (needsMissingChecklistWarning(opp)) {
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
    renderGroupBoard(group, $(".board", section));
    $(".board-group-count", section).textContent = `${group.opportunities.length} deals`;
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

function renderFeedNotificationList() {
  const list = $("#notification-feed");
  if (!list) return;

  let items = applyFeedKeywordFilter(state.feedNotificationsCache || []);
  updatePanelTileCount("tile-feed", items.length);

  list.innerHTML = "";
  if (!items.length) {
    const hiddenNote = state.hiddenFeedKeys.size ? " Some are hidden." : "";
    const kwNote = state.feedKeywordFilter?.trim() ? " Try clearing the keyword filter." : "";
    list.innerHTML = `<li>No new CRM events in the last ${FEED_DAYS} days.${hiddenNote}${kwNote}</li>`;
    return;
  }

  for (const it of items) {
    list.appendChild(renderFeedNotificationItem(it));
  }
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

async function loadNotifyEventsForOpportunityIds(periodFrom, items, seen) {
  const oppIds = new Set();
  for (const g of state.groups) {
    for (const o of g.opportunities || []) {
      const id = o.id ?? o.ID;
      if (id != null) oppIds.add(Number(id));
    }
  }
  if (!oppIds.size) {
    try {
      const qs = new URLSearchParams({ startIndex: "0", count: "200", stageType: "0" });
      const data = await api(`/api/2.0/crm/opportunity/filter?${qs}`);
      for (const o of unwrap(data)) {
        const id = o.id ?? o.ID;
        if (id != null) {
          oppIds.add(Number(id));
          indexOpportunity(o);
        }
      }
    } catch {
      /* optional */
    }
  }

  const ids = [...oppIds].filter((id) => Number.isFinite(id) && id > 0).slice(0, 120);
  const concurrency = 10;
  for (let i = 0; i < ids.length; i += concurrency) {
    await Promise.all(
      ids.slice(i, i + concurrency).map(async (oppId) => {
        try {
          const params = new URLSearchParams({
            startIndex: "0",
            count: "40",
            entityType: "opportunity",
            entityId: String(oppId),
          });
          const data = await api(`/api/2.0/crm/history/filter?${params}`);
          for (const ev of unwrapHistoryEvents(data)) {
            tryAddRelationshipNotifyEvent(items, seen, ev, periodFrom);
          }
        } catch {
          /* per-deal optional */
        }
      })
    );
  }
}

async function loadCrmRelationshipNotifyEvents(periodFrom) {
  const items = [];
  const seen = new Set();

  const queries = [
    new URLSearchParams({ startIndex: "0", count: "500", entityType: "opportunity" }),
    new URLSearchParams({ startIndex: "0", count: "500" }),
  ];

  for (const params of queries) {
    try {
      const data = await api(`/api/2.0/crm/history/filter?${params}`);
      for (const ev of unwrapHistoryEvents(data)) {
        tryAddRelationshipNotifyEvent(items, seen, ev, periodFrom);
      }
    } catch {
      /* try next */
    }
  }

  await loadNotifyEventsForOpportunityIds(periodFrom, items, seen);
  return items;
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
function toPlainDisplayText(raw) {
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
    if (inner && !isNotifyTemplateSpam(inner)) return inner.slice(0, 220);
  }

  const crmLine = s.match(/CRM\.\s*New event added to\s+(.+?)(?:\s{2,}|$)/i);
  if (crmLine) {
    const title = crmLine[1].trim();
    if (title && !isNotifyTemplateSpam(title)) return title.slice(0, 220);
  }

  return s.slice(0, 220);
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
    state.hiddenFeedKeys.add(it.key);
    saveHiddenFeedKeys();
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

async function loadNotificationFeed() {
  renderFeedTile();
  const list = $("#notification-feed");
  if (!list) return;
  list.innerHTML = '<li class="feed-loading">Loading…</li>';
  updatePanelTileCount("tile-feed", 0);
  if (!state.hiddenFeedKeys.size) state.hiddenFeedKeys = loadHiddenFeedKeys();

  const myUserName = (state.currentUser?.userName || state.currentUser?.UserName || "").toLowerCase();
  const periodFrom = feedWindowStart();
  const items = [];

  try {
    items.push(...(await loadCrmRelationshipNotifyEvents(periodFrom)));
  } catch {
    /* history module optional */
  }

  const mailSearches = ["CRM. New event added to", "CRM New event added to"];
  const mailQueries = [];
  for (const search of mailSearches) {
    mailQueries.push(
      new URLSearchParams({
        search,
        page_size: "60",
        sortorder: "descending",
        page: "1",
        period_from: new Date(periodFrom).toISOString(),
      }),
      new URLSearchParams({
        search,
        page_size: "60",
        sortorder: "descending",
        page: "1",
      })
    );
  }

  for (const q of mailQueries) {
    try {
      const mailData = await api(`/api/2.0/mail/messages?${q}`);
      for (const mail of unwrap(mailData)) {
        const parsed = parseMailNotifyMessage(mail);
        if (!parsed) continue;
        if (!isWithinFeedWindow(parsed.date)) continue;
        const fromAddr = String(
          (typeof mail.from === "string" ? mail.from : mail.from?.email || mail.from?.Email) || ""
        ).toLowerCase();
        if (myUserName && fromAddr && fromAddr === myUserName) continue;
        items.push(parsed);
      }
    } catch {
      /* try next query shape */
    }
  }

  const mergedByEvent = new Map();
  for (const it of items) {
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
    if (state.hiddenFeedKeys.has(key)) continue;
    unique.push({ ...it, key });
  }

  unique.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  state.feedNotificationsCache = unique;
  renderFeedNotificationList();
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
  const jobs = [loadNotificationFeed(), loadTasks()];
  for (const cal of state.calendarTiles) {
    jobs.push(loadCalendarForTile(cal, { quiet: true }));
  }
  await Promise.all(jobs);
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
      if (tileId === "tile-feed") await loadNotificationFeed();
      else if (tileId === "tile-tasks") await loadTasks();
      else {
        const cal = getCalendarByTileId(tileId);
        if (cal) await loadCalendarForTile(cal);
      }
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

function renderDealEditTagChips() {
  const wrap = $("#deal-edit-tags");
  const addSel = $("#deal-edit-tag-add");
  if (!wrap || !state.dealEdit) return;

  wrap.innerHTML = "";
  const catalog = buildTagCatalog();
  const current = new Set(state.dealEdit.tags.map((t) => normalizeTagTitle(t)).filter(Boolean));

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
      state.dealEdit.tags = state.dealEdit.tags.filter((t) => !tagsEqual(t, title, catalog));
      renderDealEditTagChips();
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

function populateDealEditNotifySelect() {
  const sel = $("#deal-edit-notify");
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

function showAddTileNotesForm() {
  $("#add-tile-options")?.classList.add("hidden");
  $("#add-tile-calendar-form")?.classList.add("hidden");
  $("#add-tile-notes-form")?.classList.remove("hidden");
  $("#add-tile-modal-actions")?.classList.add("hidden");
  const nameInput = $("#add-tile-notes-name");
  if (nameInput && !nameInput.value) nameInput.value = "Notes";
  nameInput?.focus();
}

function addNotesTileFromForm() {
  const name = $("#add-tile-notes-name")?.value?.trim() || "Notes";
  const notes = newNotesTile({ name, content: "", updatedAt: new Date().toISOString() });
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
      const a = document.createElement("a");
      a.href = crmOpportunityUrl(o.id);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = o.title;
      a.setAttribute("role", "option");
      a.addEventListener("click", () => {
        input.value = "";
        hideResults();
      });
      results.appendChild(a);
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

async function enrichOpportunitiesCustomFields(items) {
  if (!items.length || !state.customFieldDefs.length) return items;
  const missing = items.filter((o) => {
    const lists = [o.customFields, o.CustomFields, o.customFieldList, o.CustomFieldList];
    return !lists.some((l) => Array.isArray(l) && l.length);
  });
  await Promise.all(
    missing.slice(0, 40).map(async (opp) => {
      const id = opp.id ?? opp.ID;
      if (id == null) return;
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
            return;
          }
        } catch {
          /* try next */
        }
      }
    })
  );
  return items;
}

async function refreshGroup(group) {
  try {
    let items = await fetchOpportunitiesForGroup(group);
    if (group.dealStatus !== "all" && !group.stageType) {
      items = applyClientDealStatus(items, group.dealStatus);
    }
    items = await enrichOpportunitiesCustomFields(items);
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
    loadFeedKeywordFromStorage();
    state.opportunityById = new Map();
    state.tileLayout = loadLayoutFromStorage();
    await loadCurrentUser();
    syncFeedFilterPlaceholder();
    await loadPortalUsers();
    await Promise.all([loadStages(), loadAllTags(), loadOpportunityCustomFieldDefs()]);
    await loadUserProfileFromServer();
    syncFeedFilterPlaceholder();
    renderBoardGroups();
    refreshDashboardTileLayouts();
    populateTasksUserFilter();
    await Promise.all(state.groups.map((g) => refreshGroup(g)));
    await Promise.all([
      loadNotificationFeed(),
      loadTasks(),
      ...state.calendarTiles.map((cal) => loadCalendarForTile(cal, { quiet: true })),
    ]);
    const openOpps = countOpenOpportunities();
    const openTasks = state.tasks.length;
    $("#status-text").textContent = `${openOpps} open opportunities · ${openTasks} open tasks`;
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
  state.hiddenFeedKeys = new Set();
  state.groupTemplates = [];
  userProfileReady = false;
  bindNewTaskModal();
  bindDealEditModal();
  bindCreateOpportunityModal();
  bindGlobalOpportunitySearch();
  bindDashboardActivityTracking();

  $("#new-opportunity-btn")?.addEventListener("click", () => {
    openCreateOpportunityModal().catch((err) => showToast(err.message, true));
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