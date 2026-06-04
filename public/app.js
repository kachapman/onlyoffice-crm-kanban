/**
 * Vanguard CRM — multi-group opportunity board (local test portal)
 */

const DEFAULT_PORTAL = "https://office.vanguardadj.com";
const GROUPS_STORAGE_KEY = "oo_board_groups_v2";
const LAYOUT_STORAGE_KEY = "oo_board_layout_v2";
const HIDDEN_FEED_STORAGE_KEY = "oo_board_hidden_feed_v1";
const GROUP_TEMPLATES_STORAGE_KEY = "oo_board_group_templates_v1";
const FEED_DAYS = 30;

const state = {
  portalUrl: localStorage.getItem("oo_portal_url") || DEFAULT_PORTAL,
  stages: [],
  allTags: [],
  groups: [],
  currentUserId: null,
  currentUserName: "",
  portalUsers: [],
  tasks: [],
  tileLayout: { order: [], widths: {}, heights: {} },
  hiddenFeedKeys: new Set(),
  groupTemplates: [],
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
    if (st) parts.push(`Stage: ${st.title}`);
  }
  if (group.dealStatus && group.dealStatus !== "all") {
    parts.push(group.dealStatus === "open" ? "Open deals" : "Closed deals");
  }
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
}

function feedWindowStart() {
  return Date.now() - FEED_DAYS * 24 * 60 * 60 * 1000;
}

function isWithinFeedWindow(date) {
  if (!date) return true;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return true;
  return t >= feedWindowStart();
}

function feedNotificationKey(it) {
  return `${it.source || "notify"}-${it.id}-${(it.text || "").slice(0, 120)}-${it.author || ""}`;
}

function saveLayoutToStorage() {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.tileLayout));
}

function defaultTileOrder() {
  return ["tile-feed", "tile-tasks", ...state.groups.map((g) => `group-${g.id}`)];
}

function ensureTileLayout() {
  const order = state.tileLayout.order?.length ? [...state.tileLayout.order] : defaultTileOrder();
  const known = new Set(defaultTileOrder());
  const filtered = order.filter((id) => known.has(id));
  for (const id of known) {
    if (!filtered.includes(id)) filtered.push(id);
  }
  state.tileLayout.order = filtered;
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
    tileEl.classList.remove("tile-half", "tile-double");
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

function createLayoutButtons() {
  const wrap = document.createElement("div");
  wrap.className = "tile-layout-btns";

  const halfBtn = document.createElement("button");
  halfBtn.type = "button";
  halfBtn.className = "tile-btn";
  halfBtn.textContent = "Half width";
  halfBtn.title = "Show two tiles side by side";

  const fullBtn = document.createElement("button");
  fullBtn.type = "button";
  fullBtn.className = "tile-btn";
  fullBtn.textContent = "Full width";

  const tallBtn = document.createElement("button");
  tallBtn.type = "button";
  tallBtn.className = "tile-btn";
  tallBtn.textContent = "Double height";
  tallBtn.title = "Use two grid rows — pushes tiles below";

  wrap.appendChild(halfBtn);
  wrap.appendChild(fullBtn);
  wrap.appendChild(tallBtn);
  return { wrap, halfBtn, fullBtn, tallBtn };
}

function bindTileLayoutButtons(tileEl, tileId, halfBtn, fullBtn, tallBtn) {
  const syncTileLayout = () => {
    const w = tileWidth(tileId);
    const h = tileHeight(tileId);
    halfBtn.classList.toggle("tile-btn-active", w === "half");
    fullBtn.classList.toggle("tile-btn-active", w === "full");
    tallBtn.classList.toggle("tile-btn-active", h === "double");
    applyTileLayoutClasses(tileEl, tileId);
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
  tallBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setTileHeight(tileId, tileHeight(tileId) === "double" ? "normal" : "double");
    syncTileLayout();
  });
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

  const name = document.createElement("span");
  name.className = "tile-drag-hint";
  name.style.letterSpacing = "0";
  name.style.fontSize = "0.75rem";
  name.textContent = label;

  const spacer = document.createElement("span");
  spacer.className = "tile-toolbar-spacer";

  const { wrap, halfBtn, fullBtn, tallBtn } = createLayoutButtons();

  toolbar.appendChild(hint);
  toolbar.appendChild(name);
  toolbar.appendChild(spacer);
  toolbar.appendChild(wrap);

  return { toolbar, halfBtn, fullBtn, tallBtn };
}

function bindTileChrome(tileEl, tileId) {
  if (!tileEl.querySelector(":scope > .tile-toolbar")) {
    const { toolbar, halfBtn, fullBtn, tallBtn } = createTileChrome(tileId, tileEl.dataset.tileLabel || "Section");
    bindTileLayoutButtons(tileEl, tileId, halfBtn, fullBtn, tallBtn);
    tileEl.prepend(toolbar);
    bindTileDragDrop(tileEl, tileId, toolbar);
  }
  attachTileCollapseButton(tileEl, tileId);
  applyTileBodyCollapsed(tileEl, tileId);
}

function bindTileDragDrop(tileEl, tileId, toolbar) {
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

function mountDashboardTiles() {
  const root = $("#dashboard-tiles");
  if (!root) return;
  ensureTileLayout();
  const nodes = new Map();
  for (const child of [...root.children]) {
    if (child.dataset.tileId) nodes.set(child.dataset.tileId, child);
  }
  root.innerHTML = "";
  for (const tileId of state.tileLayout.order) {
    const node = nodes.get(tileId);
    if (node) {
      root.appendChild(node);
      applyTileLayoutClasses(node, tileId);
    }
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
      <div class="panel-header">
        <h2>CRM notifications</h2>
        <span class="panel-sub" id="feed-user-sub">Opportunity updates for you</span>
        <span class="panel-sub feed-range-hint">Last ${FEED_DAYS} days</span>
      </div>
      <ul id="notification-feed" class="feed-list" aria-live="polite"></ul>
    `;
    $("#dashboard-tiles")?.appendChild(tile);
    bindTileChrome(tile, tileId);
  }
  applyTileLayoutClasses(tile, tileId);
  const sub = $("#feed-user-sub", tile);
  if (sub) {
    sub.textContent = state.currentUserName
      ? `“Notify me” alerts for ${state.currentUserName}`
      : "Only when another user checks to notify you on an opportunity event";
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
      <div class="panel-header">
        <h2>Tasks</h2>
        <label class="tasks-filter-label">
          User
          <select id="tasks-user-filter"></select>
        </label>
      </div>
      <div id="tasks-by-user" class="tasks-by-user"></div>
    `;
    $("#dashboard-tiles")?.appendChild(tile);
    bindTileChrome(tile, tileId);
  }
  applyTileLayoutClasses(tile, tileId);
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
  if (body?.message) return body.message;
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
    opportunities: [],
    ...overrides,
  };
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

function getOppTags(opp) {
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

  if (Array.isArray(opp._matchedBoardTags)) {
    for (const t of opp._matchedBoardTags) add(t);
  }

  for (const [key, val] of Object.entries(opp)) {
    if (!/tag/i.test(key) || sources.includes(val)) continue;
    if (Array.isArray(val)) {
      for (const t of val) add(t);
    } else if (typeof val === "string" && val.includes(",")) {
      val.split(",").forEach(add);
    }
  }

  return [...titles];
}

function stampMatchedBoardTag(opp, tagTitle) {
  const title = normalizeTagTitle(tagTitle);
  if (!title) return;
  if (!Array.isArray(opp._matchedBoardTags)) opp._matchedBoardTags = [];
  if (!opp._matchedBoardTags.some((t) => tagsEqual(t, title))) {
    opp._matchedBoardTags.push(title);
  }
}

function oppMatchesSelectedTags(opp, selectedTags, catalog = buildTagCatalog()) {
  if (!selectedTags?.length) return true;
  const oppTags = getOppTags(opp);
  return selectedTags.some((sel) => oppTags.some((t) => tagsEqual(t, sel, catalog)));
}

function apiTagParamValues(tagTitle, catalog) {
  const title = normalizeTagTitle(tagTitle);
  const values = new Set();
  if (title) values.add(title);
  const entry = catalog.byTitleLower.get(title.toLowerCase());
  if (entry?.id != null) values.add(String(entry.id));
  return [...values];
}

async function fetchOpportunitiesForGroup(group) {
  const baseQs = buildFilterQuery(group);
  const catalog = buildTagCatalog();

  if (!group.tagTitles?.length) {
    const data = await api(`/api/2.0/crm/opportunity/filter?${baseQs}`);
    return unwrap(data);
  }

  const merged = new Map();
  for (const tagTitle of group.tagTitles) {
    const paramValues = apiTagParamValues(tagTitle, catalog);
    const tryValues = paramValues.length ? paramValues : [normalizeTagTitle(tagTitle)];
    for (const tagParam of tryValues) {
      if (!tagParam) continue;
      for (const tagKey of ["tags", "tag"]) {
        const params = new URLSearchParams(baseQs);
        params.append(tagKey, tagParam);
        try {
          const data = await api(`/api/2.0/crm/opportunity/filter?${params}`);
          for (const opp of unwrap(data)) {
            stampMatchedBoardTag(opp, tagTitle);
            merged.set(opp.id ?? opp.ID, opp);
          }
        } catch {
          /* try next param shape */
        }
      }
    }
  }

  if (merged.size > 0) return [...merged.values()];

  const data = await api(`/api/2.0/crm/opportunity/filter?${baseQs}`);
  return unwrap(data).filter((o) => oppMatchesSelectedTags(o, group.tagTitles, catalog));
}

function oppDueDateMs(opp) {
  const d = opp.expectedCloseDate?.value ?? opp.expectedCloseDate ?? opp.ExpectedCloseDate?.value;
  return new Date(d || 0).getTime();
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

function applyClientDealStatus(opportunities, dealStatus) {
  if (dealStatus === "all") return opportunities;
  return opportunities.filter((opp) => {
    const st = opp.stage?.status ?? opp.stage?.stageType;
    const isOpen = st === 0 || st === "Open";
    if (dealStatus === "open") return isOpen;
    if (dealStatus === "closed") {
      return st === 1 || st === 2 || st === "ClosedAndWon" || st === "ClosedAndLost";
    }
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
    const columns = state.stages.map((s) => ({
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
      for (const tag of selected) {
        columns.push({ id: tag, title: columnTitle(tag), color: "#4f8cff", items: [], stageId: null });
      }
      const byTag = new Map(columns.map((c) => [normalizeTagTitle(c.id).toLowerCase(), c]));
      for (const opp of sorted) {
        for (const sel of selected) {
          const oppTags = getOppTags(opp);
          if (oppTags.some((t) => tagsEqual(t, sel))) {
            const col = byTag.get(normalizeTagTitle(sel).toLowerCase());
            if (col) col.items.push(opp);
          }
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

function renderCard(opp, group, showStagePill) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.opportunityId = opp.id;

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
  const contact = opp.contact?.displayName || opp.contact?.title;
  if (contact) {
    const c = document.createElement("span");
    c.textContent = contact;
    meta.appendChild(c);
  }
  if (opp.responsible?.displayName) {
    const r = document.createElement("span");
    r.textContent = opp.responsible.displayName;
    meta.appendChild(r);
  }
  const tags = getOppTags(opp);
  if (tags.length) {
    const t = document.createElement("span");
    t.textContent = tags.join(", ");
    meta.appendChild(t);
  }
  card.appendChild(title);
  card.appendChild(meta);

  if (showStagePill && opp.stage?.title) {
    const pill = document.createElement("span");
    pill.className = "card-stage-pill";
    pill.textContent = opp.stage.title;
    card.appendChild(pill);
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
      saveGroupsToStorage();
      updateGroupFilterSummary(group);
      renderGroupBoard(group, $(".board", section));
    });

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
    const me = data.response || data;
    state.currentUser = me;
    state.currentUserId = me.id ?? me.ID;
    state.currentUserName = me.displayName || me.DisplayName || me.userName || me.UserName || "";
    return me;
  } catch {
    state.currentUser = null;
    state.currentUserId = null;
    state.currentUserName = "";
    return null;
  }
}

/** OnlyOffice sends "notify me" on CRM history via Talk + email (AddRelationshipEvent). */
const CRM_NOTIFY_MARKERS = [
  /CRM\.\s*New event added to/i,
  /has added a new event to/i,
  /New event added to/i,
];

function decodeHtmlEntities(text) {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
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
  text = decodeHtmlEntities(text.replace(/<br\s*\/?>/gi, "\n"));

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

  let eventText = "";
  const lines = plain.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/Deals\.aspx\?id=/i.test(line) || /\/Products\/CRM\/Deals/i.test(line)) continue;
    if (CRM_NOTIFY_MARKERS.some((re) => re.test(line))) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (line.length < 3 || /^[-─]{3,}$/.test(line)) continue;
    eventText = line;
    break;
  }
  if (!eventText) {
    const added = plain.match(/has added a new event[^:]*:\s*([\s\S]+?)(?:\n\s*https?:|\n\s*Products\/CRM\/|$)/i);
    if (added) eventText = added[1].replace(/\s+/g, " ").trim().slice(0, 200);
  }

  return {
    id,
    title,
    author: meta.author || "Another user",
    authorId: meta.authorId || null,
    text: eventText || "Notified you about a new opportunity event",
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
    mail.introduction ||
    mail.Introduction ||
    mail.preview ||
    mail.Preview ||
    mail.textBody ||
    mail.TextBody ||
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
      parsed = {
        id,
        title: subject.replace(/^CRM\.\s*New event added to\s+/i, "").trim() || `Opportunity #${id}`,
        author,
        text: (body || subject).replace(/<[^>]+>/g, " ").trim().slice(0, 200),
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
    li.classList.add("feed-item-hiding");
    setTimeout(() => li.remove(), 200);
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
  if (!state.hiddenFeedKeys.size) state.hiddenFeedKeys = loadHiddenFeedKeys();

  const myUserName = (state.currentUser?.userName || state.currentUser?.UserName || "").toLowerCase();
  const periodFrom = feedWindowStart();
  const items = [];

  try {
    const talk = await api("/api/2.0/portal/talk/recentMessages?calleeUserName=&id=2147483647");
    for (const msg of unwrapTalkMessages(talk)) {
      const parsed = parseTalkNotifyMessage(msg);
      if (!parsed) continue;
      if (!isWithinFeedWindow(parsed.date)) continue;
      const norm = normalizeTalkMessage(msg);
      const fromUser = String(norm.userName || "").toLowerCase();
      if (myUserName && fromUser && fromUser === myUserName) continue;
      items.push(parsed);
    }
  } catch {
    /* Talk/Jabber may be disabled on the portal */
  }

  const mailQueries = [
    new URLSearchParams({
      search: "CRM. New event added to",
      page_size: "60",
      sortorder: "descending",
      page: "1",
      period_from: new Date(periodFrom).toISOString(),
    }),
    new URLSearchParams({
      search: "CRM. New event added to",
      page_size: "60",
      sortorder: "descending",
      page: "1",
      period_from: String(periodFrom),
    }),
    new URLSearchParams({
      search: "CRM. New event added to",
      page_size: "60",
      sortorder: "descending",
      page: "1",
    }),
  ];

  for (const q of mailQueries) {
    try {
      const mailData = await api(`/api/2.0/mail/messages?${q}`);
      for (const mail of unwrap(mailData)) {
        const parsed = parseMailNotifyMessage(mail);
        if (!parsed) continue;
        if (!isWithinFeedWindow(parsed.date)) continue;
        items.push(parsed);
      }
      if (items.length) break;
    } catch {
      /* try next query shape */
    }
  }

  const seen = new Set();
  const unique = [];
  for (const it of items) {
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

  list.innerHTML = "";
  if (!unique.length) {
    list.innerHTML = `<li>No “notify me” alerts in the last ${FEED_DAYS} days (or all are hidden). Alerts appear when another user adds a deal history event and selects you in the notify list.</li>`;
    return;
  }

  for (const it of unique) {
    list.appendChild(renderFeedNotificationItem(it));
  }
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

function renderTasksByUser() {
  const root = $("#tasks-by-user");
  root.innerHTML = "";

  const filterUser = $("#tasks-user-filter")?.value;
  let tasks = state.tasks;
  if (filterUser) {
    tasks = tasks.filter((t) => t.responsible?.id === filterUser);
  }

  const byUser = new Map();
  for (const task of tasks) {
    const r = task.responsible;
    const key = r?.id || "_none";
    const name = r?.displayName || "Unassigned";
    if (!byUser.has(key)) byUser.set(key, { name, tasks: [] });
    byUser.get(key).tasks.push(task);
  }

  if (!byUser.size) {
    root.innerHTML = '<p class="board-loading">No open tasks.</p>';
    return;
  }

  for (const { name, tasks: userTasks } of byUser.values()) {
    const block = document.createElement("div");
    block.className = "tasks-user-block";
    const h = document.createElement("h3");
    h.textContent = name;
    block.appendChild(h);

    for (const task of userTasks) {
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
          setTimeout(() => row.remove(), 400);
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
      block.appendChild(row);
    }
    root.appendChild(block);
  }
}

async function refreshGroup(group) {
  try {
    let items = await fetchOpportunitiesForGroup(group);
    if (group.dealStatus !== "all" && !group.stageType) {
      items = applyClientDealStatus(items, group.dealStatus);
    }
    group.opportunities = items;

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
  $("#status-text").textContent = "Loading…";
  try {
    state.tileLayout = loadLayoutFromStorage();
    await loadCurrentUser();
    await loadPortalUsers();
    await Promise.all([loadStages(), loadAllTags()]);
    renderBoardGroups();
    refreshDashboardTileLayouts();
    populateTasksUserFilter();
    await Promise.all([loadNotificationFeed(), loadTasks()]);
    await Promise.all(state.groups.map((g) => refreshGroup(g)));
    const total = state.groups.reduce((n, g) => n + g.opportunities.length, 0);
    $("#status-text").textContent = `${total} opportunities · ${state.tasks.length} open tasks`;
  } catch (err) {
    $("#status-text").textContent = "Error";
    showToast(err.message, true);
  }
}

function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#portal-label").textContent = state.portalUrl;
}

function showLogin() {
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

  state.groups = loadGroupsFromStorage().map((g) => ({
    ...newGroup(),
    ...stripGroupRuntimeFields(g),
    opportunities: [],
  }));
  saveGroupsToStorage();
  state.tileLayout = loadLayoutFromStorage();
  state.hiddenFeedKeys = loadHiddenFeedKeys();
  state.groupTemplates = loadGroupTemplates();

  $("#add-group-btn").addEventListener("click", () => {
    state.groups.push(newGroup({ name: `Group ${state.groups.length + 1}` }));
    saveGroupsToStorage();
    renderBoardGroups();
    refreshGroup(state.groups[state.groups.length - 1]);
  });

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