/*
 * CRM Opportunity Kanban — runs inside OnlyOffice Workspace (uses Teamlab + session).
 * API docs: https://api.onlyoffice.com/workspace/api-backend/
 */
(function (window) {
  "use strict";

  if (typeof window.ASC === "undefined") {
    window.ASC = {};
  }
  window.ASC.OpportunityBoard = window.ASC.OpportunityBoard || {};

  var state = { stages: [], opportunities: [], groupBy: "stage" };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function showToast(message, isError) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", !!isError);
    el.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.add("hidden");
    }, 4000);
  }

  function buildFilter() {
    var filter = { startIndex: 0, count: 500 };
    var search = $("#search");
    if (search && search.value.trim()) filter.filterValue = search.value.trim();

    var stageType = $("#stage-type");
    if (stageType && stageType.value !== "") filter.stageType = parseInt(stageType.value, 10);

    var stageId = $("#stage-filter");
    if (stageId && stageId.value) filter.opportunityStagesid = parseInt(stageId.value, 10);

    var tags = $("#tags");
    if (tags && tags.value.trim()) {
      filter.tags = tags.value.split(",").map(function (t) {
        return t.trim();
      }).filter(Boolean);
    }

    var contactId = $("#contact-id");
    if (contactId && contactId.value) filter.contactid = parseInt(contactId.value, 10);

    var from = $("#from-date");
    var to = $("#to-date");
    if (from && from.value) filter.fromDate = new Date(from.value);
    if (to && to.value) filter.toDate = new Date(to.value);

    return filter;
  }

  function loadStages(cb) {
    if (typeof Teamlab === "undefined" || !Teamlab.getCrmDealMilestones) {
      cb(new Error("Teamlab CRM API not available. Open this page from OnlyOffice Workspace."));
      return;
    }
    Teamlab.getCrmDealMilestones({}, function (params, milestones) {
      state.stages = (milestones || []).slice().sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
      var select = $("#stage-filter");
      if (select) {
        var current = select.value;
        select.innerHTML = "";
        var opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = select.getAttribute("data-all-label") || "All stages";
        select.appendChild(opt0);
        state.stages.forEach(function (s) {
          var opt = document.createElement("option");
          opt.value = s.id;
          opt.textContent = s.title;
          select.appendChild(opt);
        });
        if (current) select.value = current;
      }
      cb(null);
    });
  }

  function loadOpportunities(cb) {
    if (typeof Teamlab === "undefined" || !Teamlab.getCrmOpportunities) {
      cb(new Error("Teamlab CRM API not available"));
      return;
    }
    Teamlab.getCrmOpportunities(
      { startIndex: 0 },
      {
        filter: buildFilter(),
        success: function (params, opportunities) {
          state.opportunities = opportunities || [];
          cb(null);
        },
        error: function (err) {
          cb(err || new Error("Failed to load opportunities"));
        },
      },
    );
  }

  function formatMoney(opp) {
    if (!opp.bidValue) return null;
    var cur = (opp.bidCurrency && (opp.bidCurrency.symbol || opp.bidCurrency.abbreviation)) || "";
    return String(opp.bidValue) + (cur ? " " + cur : "");
  }

  function stageTypeKey(opp) {
    var st = opp.stage && opp.stage.stageType;
    if (st === 0 || st === "Open") return "open";
    if (st === 1 || st === "ClosedAndWon") return "won";
    if (st === 2 || st === "ClosedAndLost") return "lost";
    return "other";
  }

  function groupOpportunities() {
    var groupBy = ($("#group-by") || {}).value || "stage";
    state.groupBy = groupBy;
    var groups = [];
    var map = {};

    if (groupBy === "stage") {
      state.stages.forEach(function (s) {
        map[s.id] = { id: s.id, title: s.title, color: s.color || "#4f8cff", items: [], stageId: s.id };
      });
      state.opportunities.forEach(function (opp) {
        var sid = opp.stage && opp.stage.id;
        var key = sid != null ? sid : "_none";
        if (!map[key]) {
          map[key] = {
            id: key,
            title: (opp.stage && opp.stage.title) || "Unassigned",
            color: (opp.stage && opp.stage.color) || "#8b95a8",
            items: [],
            stageId: sid,
          };
        }
        map[key].items.push(opp);
      });
      Object.keys(map).forEach(function (k) {
        if (map[k].items.length || map[k].stageId != null) groups.push(map[k]);
      });
      return groups;
    }

    if (groupBy === "responsible") {
      state.opportunities.forEach(function (opp) {
        var r = opp.responsible;
        var key = (r && r.id) || "_unassigned";
        if (!map[key]) {
          map[key] = {
            id: key,
            title: (r && r.displayName) || "Unassigned",
            color: "#4f8cff",
            items: [],
            stageId: null,
          };
        }
        map[key].items.push(opp);
      });
      return Object.keys(map).map(function (k) {
        return map[k];
      });
    }

    var order = [
      { key: "open", title: "Open", color: "#4f8cff" },
      { key: "won", title: "Closed & won", color: "#3ecf8e" },
      { key: "lost", title: "Closed & lost", color: "#f07178" },
      { key: "other", title: "Other", color: "#8b95a8" },
    ];
    order.forEach(function (o) {
      map[o.key] = { id: o.key, title: o.title, color: o.color, items: [], stageId: null };
    });
    state.opportunities.forEach(function (opp) {
      var k = stageTypeKey(opp);
      (map[k] || map.other).items.push(opp);
    });
    order.forEach(function (o) {
      if (map[o.key].items.length) groups.push(map[o.key]);
    });
    return groups;
  }

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function renderCard(opp, showStagePill) {
    var card = document.createElement("article");
    card.className = "card";
    card.draggable = true;
    card.dataset.opportunityId = opp.id;

    var title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = opp.title || "(Untitled)";
    card.appendChild(title);

    var meta = document.createElement("div");
    meta.className = "card-meta";
    var money = formatMoney(opp);
    if (money) {
      var v = document.createElement("span");
      v.className = "card-value";
      v.textContent = money;
      meta.appendChild(v);
    }
    if (opp.responsible && opp.responsible.displayName) {
      var r = document.createElement("span");
      r.textContent = opp.responsible.displayName;
      meta.appendChild(r);
    }
    if (opp.expectedCloseDateString) {
      var d = document.createElement("span");
      d.textContent = "Close: " + opp.expectedCloseDateString;
      meta.appendChild(d);
    }
    if (opp.successProbability != null) {
      var p = document.createElement("span");
      p.textContent = opp.successProbability + "% probability";
      meta.appendChild(p);
    }
    card.appendChild(meta);

    if (showStagePill && opp.stage && opp.stage.title) {
      var pill = document.createElement("span");
      pill.className = "card-stage-pill";
      pill.textContent = opp.stage.title;
      card.appendChild(pill);
    }

    card.addEventListener("dragstart", function (e) {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", String(opp.id));
    });
    card.addEventListener("dragend", function () {
      card.classList.remove("dragging");
    });

    return card;
  }

  function setupColumnDrop(columnEl, stageId) {
    if (stageId == null || state.groupBy !== "stage") return;
    columnEl.addEventListener("dragover", function (e) {
      e.preventDefault();
      columnEl.classList.add("drag-over");
    });
    columnEl.addEventListener("dragleave", function () {
      columnEl.classList.remove("drag-over");
    });
    columnEl.addEventListener("drop", function (e) {
      e.preventDefault();
      columnEl.classList.remove("drag-over");
      var oppId = e.dataTransfer.getData("text/plain");
      if (!oppId) return;
      var opp = state.opportunities.filter(function (o) {
        return String(o.id) === oppId;
      })[0];
      if (opp && opp.stage && opp.stage.id === stageId) return;

      var status = $("#status-text");
      if (status) status.textContent = "Updating stage…";

      Teamlab.updateCrmOpportunityMilestone({}, parseInt(oppId, 10), stageId, function () {
        showToast("Opportunity moved");
        refresh();
      });
    });
  }

  function renderBoard() {
    var board = $("#board");
    if (!board) return;
    board.innerHTML = "";
    var groups = groupOpportunities();
    var showStagePill = state.groupBy !== "stage";

    if (!groups.length) {
      board.innerHTML = '<p class="board-loading">No opportunities match your filters.</p>';
      return;
    }

    groups.forEach(function (col) {
      var column = document.createElement("section");
      column.className = "column";

      var header = document.createElement("div");
      header.className = "column-header";
      header.innerHTML =
        '<span class="column-dot" style="background:' +
        escapeHtml(col.color) +
        '"></span><span class="column-title">' +
        escapeHtml(col.title) +
        '</span><span class="column-count">' +
        col.items.length +
        "</span>";

      var body = document.createElement("div");
      body.className = "column-body";
      setupColumnDrop(body, col.stageId);

      if (!col.items.length) {
        body.innerHTML = '<p class="empty-column">No deals</p>';
      } else {
        col.items.forEach(function (opp) {
          body.appendChild(renderCard(opp, showStagePill));
        });
      }

      column.appendChild(header);
      column.appendChild(body);
      board.appendChild(column);
    });
  }

  function refresh() {
    var status = $("#status-text");
    if (status) status.textContent = "Loading…";
    loadStages(function (errStages) {
      if (errStages) {
        if (status) status.textContent = errStages.message;
        showToast(errStages.message, true);
        return;
      }
      loadOpportunities(function (errOpps) {
        if (errOpps) {
          if (status) status.textContent = errOpps.message;
          showToast(errOpps.message, true);
          return;
        }
        renderBoard();
        var n = state.opportunities.length;
        if (status) {
          status.textContent = n + " opportunit" + (n === 1 ? "y" : "ies");
        }
      });
    });
  }

  function bindFilters() {
    var debounce;
    var onChange = function () {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, 400);
    };
    ["#search", "#group-by", "#stage-type", "#stage-filter", "#tags", "#contact-id", "#from-date", "#to-date"].forEach(
      function (sel) {
        var el = $(sel);
        if (!el) return;
        el.addEventListener("change", onChange);
        el.addEventListener("input", onChange);
      },
    );
    var btn = $("#refresh-btn");
    if (btn) btn.addEventListener("click", refresh);
  }

  window.ASC.OpportunityBoard.Kanban = {
    init: function () {
      if (!$("#ob-kanban-root")) return;
      bindFilters();
      refresh();
    },
  };

  function domReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  domReady(function () {
    window.ASC.OpportunityBoard.Kanban.init();
  });
})(window);