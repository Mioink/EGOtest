const stageLabels = {
  normal: "正常",
  parallel: "平行叠加",
  extreme: "极限模式",
};

// 页面主要状态集中维护，避免筛选、路线和方案码逻辑各自持有副本。
const state = {
  egoItems: [],
  packs: [],
  selectedIds: new Set(),
  manualPackByFloor: {},
  searchTerm: "",
  keywordFilter: "",
  levelFilter: "",
  packTypeFilter: "",
  selectedFilter: "",
  routeCards: [],
  keywordList: [],
  levelList: [],
};

const egoGrid = document.querySelector("#ego-grid");
const keywordChips = document.querySelector("#keyword-chips");
const selectedSummary = document.querySelector("#selected-summary");
const routeBoard = document.querySelector("#route-board");
const routeSummary = document.querySelector("#route-summary");
const requiredPackCount = document.querySelector("#required-pack-count");
const coveredEgoCount = document.querySelector("#covered-ego-count");
const missingEgoCount = document.querySelector("#missing-ego-count");
const missingEgoList = document.querySelector("#missing-ego-list");
const searchInput = document.querySelector("#ego-search");
const keywordFilterSelect = document.querySelector("#ego-keyword-filter");
const levelFilterSelect = document.querySelector("#ego-level-filter");
const packTypeFilterSelect = document.querySelector("#ego-pack-type-filter");
const selectedFilterSelect = document.querySelector("#ego-selected-filter");
const copyPlanButton = document.querySelector("#copy-plan");
const copyPlanShareButton = document.querySelector("#copy-plan-share");
const planStatus = document.querySelector("#plan-status");
const planCodeInput = document.querySelector("#plan-code-input");
const applyPlanCodeButton = document.querySelector("#apply-plan-code");
const clearSelectionButton = document.querySelector("#clear-selection");
const recalculateButton = document.querySelector("#recalculate");

const egoCardTemplate = document.querySelector("#ego-card-template");
const routeCardTemplate = document.querySelector("#route-card-template");

function stageTypeForFloor(floor) {
  if (floor <= 5) return "normal";
  if (floor <= 10) return "parallel";
  return "extreme";
}

function init() {
  state.egoItems = Array.isArray(window.EGO_ITEMS) ? window.EGO_ITEMS : [];
  state.packs = Array.isArray(window.PACKS) ? window.PACKS : [];

  if (!state.egoItems.length || !state.packs.length) {
    throw new Error("未找到 EGO 或卡包数据文件。");
  }

  state.keywordList = Array.from(
    new Set(
      state.egoItems
        .flatMap((item) => item.keywords || [])
        .filter((keyword) => String(keyword || "").trim())
    )
  ).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  state.levelList = Array.from(
    new Set(state.egoItems.map((item) => item.level).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  renderFilterOptions();
  renderKeywordChips();
  renderEgoGrid();
  calculateRoute();
  bindEvents();
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderEgoGrid();
  });

  keywordFilterSelect.addEventListener("change", (event) => {
    state.keywordFilter = event.target.value;
    renderEgoGrid();
  });

  levelFilterSelect.addEventListener("change", (event) => {
    state.levelFilter = event.target.value;
    renderEgoGrid();
  });

  packTypeFilterSelect.addEventListener("change", (event) => {
    state.packTypeFilter = event.target.value;
    renderEgoGrid();
  });

  selectedFilterSelect.addEventListener("change", (event) => {
    state.selectedFilter = event.target.value;
    renderEgoGrid();
  });

  copyPlanButton.addEventListener("click", async () => {
    await copyPlanToClipboard();
  });

  copyPlanShareButton.addEventListener("click", async () => {
    await copyPlanShareText();
  });

  applyPlanCodeButton.addEventListener("click", async () => {
    await applyPlanCodeFromInput();
  });

  clearSelectionButton.addEventListener("click", () => {
    state.selectedIds.clear();
    state.searchTerm = "";
    state.keywordFilter = "";
    state.levelFilter = "";
    state.packTypeFilter = "";
    state.selectedFilter = "";
    searchInput.value = "";
    keywordFilterSelect.value = "";
    levelFilterSelect.value = "";
    packTypeFilterSelect.value = "";
    selectedFilterSelect.value = "";
    updatePlanStatus("已清空选择与筛选条件。");
    renderEgoGrid();
    updateSelectedSummary();
    calculateRoute();
  });

  recalculateButton.addEventListener("click", () => {
    calculateRoute();
  });
}

function renderFilterOptions() {
  keywordFilterSelect.innerHTML = '<option value="">全部关键词</option>';
  levelFilterSelect.innerHTML = '<option value="">全部等级</option>';

  state.keywordList.forEach((keyword) => {
    const option = document.createElement("option");
    option.value = keyword;
    option.textContent = keyword;
    keywordFilterSelect.appendChild(option);
  });

  state.levelList.forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = level;
    levelFilterSelect.appendChild(option);
  });
}

// 方案码只保存恢复当前界面所需的最小信息，方便分享与版本兼容。
function buildPlanPayload() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    selectedIds: Array.from(state.selectedIds),
    manualPackByFloor: state.manualPackByFloor,
    filters: {
      searchTerm: state.searchTerm,
      keywordFilter: state.keywordFilter,
      levelFilter: state.levelFilter,
      packTypeFilter: state.packTypeFilter,
      selectedFilter: state.selectedFilter,
    },
  };
}

async function copyPlanToClipboard() {
  const planCode = await encodePlanCode(buildPlanPayload());
  planCodeInput.value = planCode;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(planCode);
    } else {
      copyTextWithTextarea(planCode);
    }
    updatePlanStatus(`方案码已复制到剪贴板，长度 ${planCode.length}。`);
  } catch (error) {
    try {
      copyTextWithTextarea(planCode);
      updatePlanStatus(`方案码已复制到剪贴板，长度 ${planCode.length}。`);
    } catch (fallbackError) {
      updatePlanStatus(`复制失败：${fallbackError.message || error.message}`);
    }
  }
}

async function copyPlanShareText() {
  const planCode = planCodeInput.value.trim() || await encodePlanCode(buildPlanPayload());
  planCodeInput.value = planCode;
  const selectedCount = state.selectedIds.size;
  const manualCount = Object.keys(state.manualPackByFloor).length;
  const shareText = `边狱巴士路线方案码\n方案码：${planCode}\n已选EGO：${selectedCount}件\n手动锁定楼层：${manualCount}层`;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
    } else {
      copyTextWithTextarea(shareText);
    }
    updatePlanStatus("带标题的分享文本已复制到剪贴板。");
  } catch (error) {
    try {
      copyTextWithTextarea(shareText);
      updatePlanStatus("带标题的分享文本已复制到剪贴板。");
    } catch (fallbackError) {
      updatePlanStatus(`复制失败：${fallbackError.message || error.message}`);
    }
  }
}

async function applyPlanCodeFromInput() {
  const rawInput = planCodeInput.value.trim();
  if (!rawInput) {
    updatePlanStatus("请先输入方案码。");
    return;
  }

  try {
    const planCode = extractPlanCode(rawInput);
    const plan = await decodePlanCode(planCode);
    planCodeInput.value = planCode;
    applyImportedPlan(plan);
    updatePlanStatus(`方案码应用成功：已恢复 ${state.selectedIds.size} 件 EGO 与 ${Object.keys(state.manualPackByFloor).length} 层手动卡包。`);
  } catch (error) {
    updatePlanStatus(`方案码无效：${error.message}`);
  }
}

function extractPlanCode(input) {
  // 允许用户粘贴纯方案码，或从整段分享文本里自动抽取方案码。
  const direct = input.trim();
  if (direct.startsWith("EGO1.")) {
    return direct;
  }

  const matched = input.match(/EGO1\.[A-Za-z0-9\-_]+/);
  if (matched) {
    return matched[0];
  }

  throw new Error("未识别到有效方案码。");
}

async function encodePlanCode(plan) {
  // 分享前先把字段压缩成短键，再走压缩与 base64url，尽量缩短方案码长度。
  const compactPlan = {
    v: 1,
    s: Array.from(plan.selectedIds || []),
    m: plan.manualPackByFloor || {},
    f: [
      plan.filters?.searchTerm || "",
      plan.filters?.keywordFilter || "",
      plan.filters?.levelFilter || "",
      plan.filters?.packTypeFilter || "",
      plan.filters?.selectedFilter || "",
    ],
  };

  const json = JSON.stringify(compactPlan);
  const encoded = await compressText(json);
  return `EGO1.${encoded}`;
}

async function decodePlanCode(code) {
  const trimmed = code.trim();
  if (!trimmed.startsWith("EGO1.")) {
    throw new Error("缺少有效前缀。");
  }

  const body = trimmed.slice(5);
  const json = await decompressText(body);
  const compactPlan = JSON.parse(json);

  return {
    version: compactPlan.v || 1,
    selectedIds: Array.isArray(compactPlan.s) ? compactPlan.s : [],
    manualPackByFloor: compactPlan.m && typeof compactPlan.m === "object" ? compactPlan.m : {},
    filters: {
      searchTerm: compactPlan.f?.[0] || "",
      keywordFilter: compactPlan.f?.[1] || "",
      levelFilter: compactPlan.f?.[2] || "",
      packTypeFilter: compactPlan.f?.[3] || "",
      selectedFilter: compactPlan.f?.[4] || "",
    },
  };
}

async function compressText(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== "undefined") {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    const compressed = await new Response(stream).arrayBuffer();
    return base64UrlEncode(new Uint8Array(compressed));
  }
  return base64UrlEncode(bytes);
}

async function decompressText(payload) {
  const bytes = base64UrlDecode(payload);
  if (typeof DecompressionStream !== "undefined") {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).text();
    } catch (error) {
      return new TextDecoder().decode(bytes);
    }
  }
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function copyTextWithTextarea(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("浏览器未允许复制到剪贴板。");
  }
}

function applyImportedPlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new Error("方案文件格式不正确。");
  }

  const validIds = new Set(state.egoItems.map((item) => item.id));
  const validPackIds = new Set(state.packs.map((pack) => pack.id));

  state.selectedIds = new Set(
    (Array.isArray(plan.selectedIds) ? plan.selectedIds : []).filter((id) =>
      validIds.has(id)
    )
  );

  const nextManualPackByFloor = {};
  const sourceManualPacks = plan.manualPackByFloor || {};
  Object.entries(sourceManualPacks).forEach(([floor, packId]) => {
    if (!validPackIds.has(packId)) return;
    nextManualPackByFloor[floor] = packId;
  });
  state.manualPackByFloor = nextManualPackByFloor;

  // 导入时只恢复当前版本仍然存在的筛选值，避免旧方案污染新界面。
  const filters = plan.filters || {};
  state.searchTerm = String(filters.searchTerm || "").toLowerCase();
  state.keywordFilter = state.keywordList.includes(filters.keywordFilter)
    ? filters.keywordFilter
    : "";
  state.levelFilter = state.levelList.includes(filters.levelFilter)
    ? filters.levelFilter
    : "";
  state.packTypeFilter = ["", "limited", "all-packs"].includes(filters.packTypeFilter)
    ? filters.packTypeFilter
    : "";
  state.selectedFilter = ["", "selected", "unselected"].includes(filters.selectedFilter)
    ? filters.selectedFilter
    : "";

  syncFilterInputs();
  renderEgoGrid();
  updateSelectedSummary();
  calculateRoute();
}

function syncFilterInputs() {
  searchInput.value = state.searchTerm;
  keywordFilterSelect.value = state.keywordFilter;
  levelFilterSelect.value = state.levelFilter;
  packTypeFilterSelect.value = state.packTypeFilter;
  selectedFilterSelect.value = state.selectedFilter;
}

function updatePlanStatus(message) {
  planStatus.textContent = message;
}

function renderKeywordChips() {
  keywordChips.innerHTML = "";

  if (!state.keywordList.length) {
    const empty = document.createElement("span");
    empty.className = "tag";
    empty.textContent = "当前 EGO 数据里还没有可用关键词";
    keywordChips.appendChild(empty);
    return;
  }

  state.keywordList.forEach((keyword) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = keyword;

    chip.addEventListener("click", () => {
      const relatedItems = state.egoItems.filter((item) =>
        (item.keywords || []).includes(keyword)
      );
      const isEverySelected = relatedItems.every((item) =>
        state.selectedIds.has(item.id)
      );

      relatedItems.forEach((item) => {
        if (isEverySelected) {
          state.selectedIds.delete(item.id);
        } else {
          state.selectedIds.add(item.id);
        }
      });

      renderKeywordChips();
      renderEgoGrid();
      updateSelectedSummary();
      calculateRoute();
    });

    const relatedItems = state.egoItems.filter((item) =>
      (item.keywords || []).includes(keyword)
    );
    if (
      relatedItems.length &&
      relatedItems.every((item) => state.selectedIds.has(item.id))
    ) {
      chip.classList.add("active");
    }

    keywordChips.appendChild(chip);
  });
}

function renderEgoGrid() {
  egoGrid.innerHTML = "";

  // 所有筛选条件统一在这里串联，后续扩展筛选时直接继续追加判断即可。
  const filteredItems = state.egoItems.filter((item) => {
    const searchable = [
      item.name,
      item.description,
      item.level,
      item.acquisition,
      item.packDisplay,
      ...(item.keywords || []),
      ...getItemPackOptionIds(item),
    ]
      .join(" ")
      .toLowerCase();

    if (state.searchTerm && !searchable.includes(state.searchTerm)) {
      return false;
    }

    if (state.keywordFilter && !(item.keywords || []).includes(state.keywordFilter)) {
      return false;
    }

    if (state.levelFilter && item.level !== state.levelFilter) {
      return false;
    }

    if (state.packTypeFilter === "limited" && item.allPacks) {
      return false;
    }

    if (state.packTypeFilter === "all-packs" && !item.allPacks) {
      return false;
    }

    if (state.selectedFilter === "selected" && !state.selectedIds.has(item.id)) {
      return false;
    }

    if (state.selectedFilter === "unselected" && state.selectedIds.has(item.id)) {
      return false;
    }

    return true;
  });

  filteredItems.forEach((item) => {
    const node = egoCardTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector('input[type="checkbox"]');
    const icon = node.querySelector(".ego-card__icon");
    const title = node.querySelector("h3");
    const level = node.querySelector(".ego-card__level");
    const desc = node.querySelector(".ego-card__desc");
    const meta = node.querySelector(".ego-card__meta");

    checkbox.checked = state.selectedIds.has(item.id);
    node.classList.toggle("selected", checkbox.checked);
    icon.src = item.icon;
    icon.alt = item.name;
    title.textContent = item.name;
    level.textContent = item.level;
    desc.textContent = item.description;

    [
      ...(item.keywords || []).filter(Boolean).map((keyword) => `关键词：${keyword}`),
      `所属卡包：${item.packDisplay}`,
      `获得方式：${item.acquisition}`,
    ].forEach((text) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = text;
      meta.appendChild(tag);
    });

    node.addEventListener("click", () => {
      toggleSelection(item.id);
    });

    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    egoGrid.appendChild(node);
  });

  updateSelectedSummary(filteredItems.length);
}

function updateSelectedSummary(filteredCount = null) {
  const selectedCount = state.selectedIds.size;
  const countText =
    filteredCount === null
      ? `已选择 ${selectedCount} 件 EGO 饰品`
      : `已选择 ${selectedCount} 件 EGO 饰品，当前筛选显示 ${filteredCount} 件`;
  selectedSummary.textContent = countText;
  renderKeywordChips();
}

function toggleSelection(id) {
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
  } else {
    state.selectedIds.add(id);
  }

  renderEgoGrid();
  updateSelectedSummary();
  calculateRoute();
}

function calculateRoute() {
  // 路线按楼层顺序逐层分配，保证前面已占用的卡包不会在后面重复出现。
  const selectedItems = state.egoItems.filter((item) => state.selectedIds.has(item.id));
  const selectedKeywords = new Set(
    selectedItems.flatMap((item) => (item.keywords || []).filter(Boolean))
  );
  const limitedItems = selectedItems.filter((item) => !item.allPacks);
  const coveredLimitedPackIds = new Set();
  const usedPackIds = new Set();
  const routeCards = [];
  const lockedPackByFloor = buildLockedPackByFloor();

  for (let floor = 1; floor <= 15; floor += 1) {
    const floorPacks = state.packs.filter(
      (pack) => Array.isArray(pack.floors) && pack.floors.includes(floor)
    );
    const manualPack = lockedPackByFloor.get(floor) ?? null;
    const reservedForOtherLocks = getReservedLockedPackIdsAfterFloor(lockedPackByFloor, floor);
    const availablePacks = floorPacks.filter(
      (pack) =>
        !usedPackIds.has(pack.id) &&
        !reservedForOtherLocks.has(pack.id)
    );

    const chosenPack =
      manualPack ??
      chooseBestPackForFloor(
        availablePacks,
        limitedItems,
        coveredLimitedPackIds,
        selectedKeywords
      );

    if (chosenPack) {
      usedPackIds.add(chosenPack.id);
      if (
        limitedItems.some(
          (item) => itemHasPackOption(item, chosenPack.id)
        )
      ) {
        coveredLimitedPackIds.add(chosenPack.id);
      }
    }

    routeCards.push({
      floor,
      mode: stageTypeForFloor(floor),
      isManual: Boolean(manualPack),
      availableOptions: buildFloorOptions(
        floorPacks,
        usedPackIds,
        chosenPack,
        manualPack
      ),
      ...buildRouteDetails(chosenPack, limitedItems, manualPack),
    });
  }

  state.routeCards = routeCards;
  renderRouteBoard();
  updateRouteSummary(selectedItems, routeCards);
  renderMissingEgoList(selectedItems, routeCards);
}

function buildLockedPackByFloor() {
  const lockedPackByFloor = new Map();

  Object.entries(state.manualPackByFloor).forEach(([floorKey, packId]) => {
    const floor = Number(floorKey);
    const pack = state.packs.find((item) => item.id === packId);
    if (!pack) return;
    if (!Array.isArray(pack.floors) || !pack.floors.includes(floor)) return;
    lockedPackByFloor.set(floor, pack);
  });

  return lockedPackByFloor;
}

function getReservedLockedPackIdsAfterFloor(lockedPackByFloor, currentFloor) {
  const reserved = new Set();

  lockedPackByFloor.forEach((pack, floor) => {
    if (floor > currentFloor) {
      reserved.add(pack.id);
    }
  });

  return reserved;
}

function chooseBestPackForFloor(
  availablePacks,
  limitedItems,
  coveredLimitedPackIds,
  selectedKeywords
) {
  if (!availablePacks.length) return null;

  // 自动推荐只在“当前楼层仍可选的卡包”之间比较，不做跨楼层回溯。
  return [...availablePacks].sort((a, b) => {
    return (
      scorePack(b, limitedItems, coveredLimitedPackIds, selectedKeywords) -
      scorePack(a, limitedItems, coveredLimitedPackIds, selectedKeywords)
    );
  })[0];
}

function scorePack(pack, limitedItems, coveredLimitedPackIds, selectedKeywords) {
  // 权重顺序：未满足的限定需求 > 关键词契合度 > 备注惩罚。
  const unmetLimitedMatches = limitedItems.filter(
    (item) => !coveredLimitedPackIds.has(pack.id) && itemHasPackOption(item, pack.id)
  ).length;
  const keywordOverlap = (pack.keywords || []).filter(
    (keyword) => keyword && selectedKeywords.has(keyword)
  ).length;
  const notePenalty = String(pack.note || "").includes("别去") ? -50 : 0;
  const cursePenalty = String(pack.note || "").includes("诅咒") ? -3 : 0;
  return unmetLimitedMatches * 100 + keywordOverlap * 10 + notePenalty + cursePenalty;
}

function buildFloorOptions(floorPacks, usedPackIds, chosenPack, manualPack = null) {
  return floorPacks
    .filter(
      (pack) =>
        !usedPackIds.has(pack.id) ||
        pack.id === chosenPack?.id ||
        pack.id === manualPack?.id
    )
    .map((pack) => ({
      id: pack.id,
      name: pack.name,
    }));
}

function buildRouteDetails(chosenPack, limitedItems, manualPack = null) {
  if (!chosenPack) {
    return {
      title: "本层已无可选卡包",
      packId: null,
      icon: "./assets/packs/any-pack.svg",
      items: [],
      limitedCount: 0,
      reason: manualPack
        ? "当前楼层手动锁定了卡包，但该卡包暂时无法用于路线计算。"
        : "由于你前面已经选走了候选卡包，这一层不再重复出现相同卡包。",
      required: false,
    };
  }

  const coveredNames = limitedItems
    .filter((item) => doesPackCoverItem(chosenPack, item))
    .map((item) => item.name);

  const required = limitedItems.some(
    (item) => itemHasPackOption(item, chosenPack.id)
  );

  const reasonParts = [];
  if (manualPack && chosenPack.id === manualPack.id) {
    reasonParts.push("当前楼层已按手动锁定优先保留该卡包。");
  }
  if (required) {
    reasonParts.push("包含所选限定 EGO 所需卡包。");
  }
  if (chosenPack.note) {
    reasonParts.push(chosenPack.note);
  }
  if (!reasonParts.length) {
    reasonParts.push("根据当前楼层和已选路线自动推荐。");
  }

  return {
    title: chosenPack.name,
    packId: chosenPack.id,
    icon: chosenPack.icon,
    items: coveredNames,
    limitedCount: coveredNames.length,
    reason: reasonParts.join(" "),
    required,
  };
}

function doesPackCoverItem(pack, item) {
  if (item.allPacks) return Boolean(pack);
  return itemHasPackOption(item, pack.id);
}

function updateRouteSummary(selectedItems, routeCards) {
  const chosenPackIds = new Set(routeCards.map((card) => card.packId).filter(Boolean));
  const limitedSelectedItems = selectedItems.filter((item) => !item.allPacks);
  const coveredIds = new Set(
    selectedItems
      .filter((item) => {
        if (item.allPacks) return chosenPackIds.size > 0;
        return getItemPackOptionIds(item).some((packId) => chosenPackIds.has(packId));
      })
      .map((item) => item.id)
  );

  const requiredPackIds = new Set(
    limitedSelectedItems
      .flatMap((item) => getItemPackOptionIds(item).filter((packId) => chosenPackIds.has(packId)))
  );

  const manualCount = Object.keys(state.manualPackByFloor).length;

  if (!selectedItems.length) {
    routeSummary.textContent = manualCount
      ? `已手动锁定 ${manualCount} 层卡包。未选择 EGO 时，系统会按楼层可选卡包自动补齐剩余路线。`
      : "未选择 EGO 时，系统会先按楼层自动排一条不重复的基础路线；你也可以直接在右侧手动改卡包。";
  } else {
    routeSummary.textContent = `已覆盖 ${coveredIds.size} / ${selectedItems.length} 件目标 EGO，其中卡包限定 ${requiredPackIds.size} 个需求已进入路线。楼层区域现在只展示各卡包可获得的限定 EGO，手动锁定 ${manualCount} 层。`;
  }

  requiredPackCount.textContent = String(requiredPackIds.size);
  coveredEgoCount.textContent = String(coveredIds.size);
}

function renderMissingEgoList(selectedItems, routeCards) {
  const chosenPackIds = new Set(routeCards.map((card) => card.packId).filter(Boolean));
  const missingItems = selectedItems.filter((item) => !isItemCoveredByRoute(item, chosenPackIds));

  missingEgoCount.textContent = String(missingItems.length);
  missingEgoList.innerHTML = "";

  if (!missingItems.length) {
    const empty = document.createElement("div");
    empty.className = "miss-empty";
    empty.textContent = selectedItems.length
      ? "当前路线已经覆盖所有已选 EGO。"
      : "选择目标 EGO 后，这里会提示当前路线无法拿到的饰品。";
    missingEgoList.appendChild(empty);
    return;
  }

  const packMap = new Map(state.packs.map((pack) => [pack.id, pack]));

  missingItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "miss-item";

    const title = document.createElement("div");
    title.className = "miss-item__title";
    title.textContent = item.name;

    const meta = document.createElement("div");
    meta.className = "miss-item__meta";
    meta.textContent = item.level ? `${item.level} | ${item.packDisplay}` : item.packDisplay;

    const detail = document.createElement("div");
    detail.className = "miss-item__detail";
    detail.textContent = formatMissingAccess(item, packMap);

    row.appendChild(title);
    row.appendChild(meta);
    row.appendChild(detail);
    missingEgoList.appendChild(row);
  });
}

function isItemCoveredByRoute(item, chosenPackIds) {
  if (item.allPacks) {
    return chosenPackIds.size > 0;
  }
  return getItemPackOptionIds(item).some((packId) => chosenPackIds.has(packId));
}

function formatMissingAccess(item, packMap) {
  if (item.allPacks) {
    return "通用饰品：理论上可由任意已出现卡包获得。";
  }

  const accessList = getItemPackOptionIds(item)
    .map((packId) => packMap.get(packId))
    .filter(Boolean)
    .map((pack) => `第 ${pack.floors.join(" / ")} 层：${pack.name}`);

  if (!accessList.length) {
    return "未在卡包数据库中找到该饰品对应的卡包信息。";
  }

  return `可获取位置：${accessList.join("；")}`;
}

function getItemPackOptionIds(item) {
  return (item.packOptions || []).map((packId) => String(packId));
}

function itemHasPackOption(item, packId) {
  return getItemPackOptionIds(item).includes(String(packId));
}

function renderRouteBoard() {
  routeBoard.innerHTML = "";

  // 路线区完全依赖 state.routeCards 渲染，修改楼层 UI 时优先改这里和模板。
  state.routeCards.forEach((card) => {
    const node = routeCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.floor = String(card.floor);
    node.classList.add(`stage-${card.mode}`);
    if (card.isManual) node.classList.add("is-manual");

    const stage = node.querySelector(".route-card__stage");
    const icon = node.querySelector(".route-card__icon");
    const title = node.querySelector("h3");
    const mode = node.querySelector(".route-card__mode");
    const reason = node.querySelector(".route-card__reason");
    const items = node.querySelector(".route-card__items");
    const select = node.querySelector("select");
    const resetButton = node.querySelector(".route-card__reset");

    stage.innerHTML = `第 ${card.floor} 层<br>${card.required ? "优先拿取" : card.isManual ? "手动锁定" : "自动推荐"}`;
    icon.src = card.icon;
    icon.alt = card.title;
    title.textContent = card.title;
    mode.textContent = stageLabels[card.mode];
    reason.textContent = card.limitedCount
      ? `${card.reason} 本层可获得 ${card.limitedCount} 件已选限定 EGO。`
      : `${card.reason} 本层没有已选卡包限定 EGO。`;

    const autoOption = document.createElement("option");
    autoOption.value = "";
    autoOption.textContent = "自动选择";
    select.appendChild(autoOption);

    card.availableOptions.forEach((option) => {
      const selectOption = document.createElement("option");
      selectOption.value = option.id;
      selectOption.textContent = option.name;
      select.appendChild(selectOption);
    });

    select.value = state.manualPackByFloor[card.floor] ?? "";

    select.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    select.addEventListener("change", (event) => {
      const nextValue = event.target.value;
      if (nextValue) {
        state.manualPackByFloor[card.floor] = nextValue;
      } else {
        delete state.manualPackByFloor[card.floor];
      }
      calculateRoute();
    });

    resetButton.addEventListener("click", (event) => {
      event.stopPropagation();
      delete state.manualPackByFloor[card.floor];
      calculateRoute();
    });

    if (!card.availableOptions.length) {
      select.disabled = true;
      resetButton.disabled = true;
    }

    if (card.items.length) {
      card.items.forEach((item) => {
        const tag = document.createElement("span");
        tag.className = "tag tag--limited";
        tag.textContent = item;
        items.appendChild(tag);
      });
    } else {
      const empty = document.createElement("span");
      empty.className = "tag tag--empty";
      empty.textContent = "无已选限定 EGO";
      items.appendChild(empty);
    }

    attachDragEvents(node);
    routeBoard.appendChild(node);
  });
}

function attachDragEvents(node) {
  node.addEventListener("dragstart", (event) => {
    if (["SELECT", "BUTTON", "OPTION"].includes(event.target.tagName)) {
      event.preventDefault();
      return;
    }
    node.classList.add("dragging");
  });

  node.addEventListener("dragend", () => {
    node.classList.remove("dragging");
    syncRouteOrder();
  });

  node.addEventListener("dragover", (event) => {
    event.preventDefault();
    const dragging = routeBoard.querySelector(".dragging");
    if (!dragging || dragging === node) return;

    const rect = node.getBoundingClientRect();
    const shouldInsertBefore = event.clientY < rect.top + rect.height / 2;
    routeBoard.insertBefore(dragging, shouldInsertBefore ? node : node.nextSibling);
  });
}

function syncRouteOrder() {
  // 拖拽只调整展示顺序，不反推楼层分配计算。
  const orderedFloors = Array.from(routeBoard.children).map((child) =>
    Number(child.dataset.floor)
  );
  state.routeCards.sort(
    (a, b) => orderedFloors.indexOf(a.floor) - orderedFloors.indexOf(b.floor)
  );
}

try {
  init();
} catch (error) {
  routeSummary.textContent = `数据加载失败：${error.message}`;
}
