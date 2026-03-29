const stageLabels = {
  normal: "正常",
  parallel: "平行叠加",
  extreme: "极限模式",
};

const stageTypeForFloor = (floor) => {
  if (floor <= 5) return "normal";
  if (floor <= 10) return "parallel";
  return "extreme";
};

const state = {
  egoItems: [],
  packs: [],
  selectedIds: new Set(),
  searchTerm: "",
  routeCards: [],
  keywordList: [],
};

const egoGrid = document.querySelector("#ego-grid");
const keywordChips = document.querySelector("#keyword-chips");
const selectedSummary = document.querySelector("#selected-summary");
const routeBoard = document.querySelector("#route-board");
const routeSummary = document.querySelector("#route-summary");
const requiredPackCount = document.querySelector("#required-pack-count");
const coveredEgoCount = document.querySelector("#covered-ego-count");
const searchInput = document.querySelector("#ego-search");
const clearSelectionButton = document.querySelector("#clear-selection");
const recalculateButton = document.querySelector("#recalculate");

const egoCardTemplate = document.querySelector("#ego-card-template");
const routeCardTemplate = document.querySelector("#route-card-template");

function init() {
  state.egoItems = Array.isArray(window.EGO_ITEMS) ? window.EGO_ITEMS : [];
  state.packs = Array.isArray(window.PACKS) ? window.PACKS : [];

  if (!state.egoItems.length || !state.packs.length) {
    throw new Error("未找到 EGO 或卡包数据文件。");
  }

  state.keywordList = Array.from(
    new Set(state.egoItems.flatMap((item) => item.keywords))
  ).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

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

  clearSelectionButton.addEventListener("click", () => {
    state.selectedIds.clear();
    renderEgoGrid();
    updateSelectedSummary();
    calculateRoute();
  });

  recalculateButton.addEventListener("click", () => {
    calculateRoute();
  });
}

function renderKeywordChips() {
  keywordChips.innerHTML = "";

  state.keywordList.forEach((keyword) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = keyword;

    chip.addEventListener("click", () => {
      const relatedItems = state.egoItems.filter((item) =>
        item.keywords.includes(keyword)
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
      item.keywords.includes(keyword)
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

  const filteredItems = state.egoItems.filter((item) => {
    if (!state.searchTerm) return true;
    const searchable = [
      item.name,
      item.description,
      item.level,
      item.acquisition,
      ...item.keywords,
      ...item.packOptions,
      item.packDisplay,
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(state.searchTerm);
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
      ...item.keywords.map((keyword) => `关键词：${keyword}`),
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
  const selectedItems = state.egoItems.filter((item) => state.selectedIds.has(item.id));
  const packMap = new Map(state.packs.map((pack) => [pack.id, pack]));

  if (!selectedItems.length) {
    state.routeCards = createPlaceholderRoute();
    renderRouteBoard();
    routeSummary.textContent = "请选择左侧 EGO 饰品开始计算。";
    requiredPackCount.textContent = "0";
    coveredEgoCount.textContent = "0";
    return;
  }

  const limitedItems = selectedItems.filter((item) => !item.allPacks);
  const flexibleItems = selectedItems.filter((item) => item.allPacks);
  const floorAssignments = new Map();
  const coveredIds = new Set();
  const requiredPacks = new Set();

  limitedItems.forEach((item) => {
    const candidatePacks = item.packOptions
      .map((packId) => packMap.get(packId))
      .filter(Boolean)
      .sort((a, b) => a.floors[0] - b.floors[0]);

    const chosenPack = candidatePacks[0];
    if (!chosenPack) return;

    const chosenFloor =
      Array.from(floorAssignments.values()).find(
        (bucket) => bucket.pack.id === chosenPack.id
      )?.floor ??
      chosenPack.floors.find((floor) => !floorAssignments.has(floor)) ??
      chosenPack.floors[0];

    const bucket = floorAssignments.get(chosenFloor) ?? {
      floor: chosenFloor,
      pack: chosenPack,
      items: [],
      reason: [],
      required: true,
    };

    bucket.items.push(item);
    bucket.reason.push(`限定饰品 ${item.name}`);
    floorAssignments.set(chosenFloor, bucket);
    coveredIds.add(item.id);
    requiredPacks.add(chosenPack.id);
  });

  flexibleItems.forEach((item) => {
    const existingBucket = Array.from(floorAssignments.values())[0];
    if (existingBucket) {
      existingBucket.items.push(item);
      existingBucket.reason.push(`通用饰品 ${item.name}`);
      coveredIds.add(item.id);
      return;
    }

    const earliestPack = [...state.packs].sort((a, b) => a.floors[0] - b.floors[0])[0];
    const floor = earliestPack?.floors[0] ?? 1;
    const bucket = floorAssignments.get(floor) ?? {
      floor,
      pack: earliestPack ?? {
        id: "any-pack",
        name: "任意卡包",
        icon: "./assets/packs/any-pack.svg",
        floors: [1],
      },
      items: [],
      reason: [],
      required: false,
    };
    bucket.items.push(item);
    bucket.reason.push(`通用饰品 ${item.name}`);
    floorAssignments.set(floor, bucket);
    coveredIds.add(item.id);
  });

  const routeMap = new Map();

  for (let floor = 1; floor <= 15; floor += 1) {
    const assigned = floorAssignments.get(floor);
    if (assigned) {
      routeMap.set(floor, {
        floor,
        mode: stageTypeForFloor(floor),
        title: assigned.pack.name,
        icon: assigned.pack.icon,
        items: assigned.items.map((item) => item.name),
        reason: dedupeList(assigned.reason).join("、"),
        required: assigned.required,
      });
      continue;
    }

    const packsForFloor = state.packs.filter((pack) => pack.floors.includes(floor));
    const bestPack = chooseBestOptionalPack(packsForFloor, selectedItems);

    routeMap.set(floor, {
      floor,
      mode: stageTypeForFloor(floor),
      title: bestPack?.name ?? "暂无匹配卡包",
      icon: bestPack?.icon ?? "./assets/packs/any-pack.svg",
      items: bestPack ? suggestOptionalItems(bestPack, selectedItems) : ["可按实际情况自由选择"],
      reason: bestPack
        ? bestPack.note
        : "当前没有已录入的楼层卡包数据，可在数据文件中继续补充。",
      required: false,
    });
  }

  state.routeCards = Array.from(routeMap.values());
  renderRouteBoard();

  const limitedNames = limitedItems.map((item) => item.name);
  const flexibleNames = flexibleItems.map((item) => item.name);
  const summaryParts = [];

  if (limitedNames.length) {
    summaryParts.push(`限定卡包需求：${limitedNames.join("、")}`);
  }
  if (flexibleNames.length) {
    summaryParts.push(`通用饰品可并入已有路线：${flexibleNames.join("、")}`);
  }

  routeSummary.textContent = summaryParts.join("。");
  requiredPackCount.textContent = String(requiredPacks.size);
  coveredEgoCount.textContent = String(coveredIds.size);
}

function chooseBestOptionalPack(packsForFloor, selectedItems) {
  if (!packsForFloor.length) return null;
  const selectedKeywords = new Set(selectedItems.flatMap((item) => item.keywords));

  return [...packsForFloor].sort((a, b) => {
    const aScore = countKeywordOverlap(a.keywords, selectedKeywords);
    const bScore = countKeywordOverlap(b.keywords, selectedKeywords);
    return bScore - aScore;
  })[0];
}

function countKeywordOverlap(packKeywords = [], selectedKeywords) {
  return packKeywords.reduce(
    (count, keyword) => count + (selectedKeywords.has(keyword) ? 1 : 0),
    0
  );
}

function suggestOptionalItems(pack, selectedItems) {
  const matched = selectedItems.filter((item) => {
    if (item.allPacks) return true;
    return item.packOptions.includes(pack.id);
  });

  if (!matched.length) {
    return ["可补强其它路线需求"];
  }

  return matched.map((item) => item.name);
}

function createPlaceholderRoute() {
  return Array.from({ length: 15 }, (_, index) => {
    const floor = index + 1;
    return {
      floor,
      mode: stageTypeForFloor(floor),
      title: "等待选择目标饰品",
      icon: "./assets/packs/any-pack.svg",
      items: ["拖拽排序在计算后启用"],
      reason: "选中左侧 EGO 饰品后，这里会展示推荐卡包路线。",
      required: false,
      placeholder: true,
    };
  });
}

function dedupeList(list) {
  return Array.from(new Set(list));
}

function renderRouteBoard() {
  routeBoard.innerHTML = "";

  state.routeCards.forEach((card) => {
    const node = routeCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.floor = String(card.floor);
    node.classList.add(`stage-${card.mode}`);
    if (card.placeholder) node.classList.add("is-placeholder");

    const stage = node.querySelector(".route-card__stage");
    const icon = node.querySelector(".route-card__icon");
    const title = node.querySelector("h3");
    const mode = node.querySelector(".route-card__mode");
    const reason = node.querySelector(".route-card__reason");
    const items = node.querySelector(".route-card__items");

    stage.innerHTML = `第 ${card.floor} 层<br>${card.required ? "优先拿取" : "可选补强"}`;
    icon.src = card.icon;
    icon.alt = card.title;
    title.textContent = card.title;
    mode.textContent = stageLabels[card.mode];
    reason.textContent = card.reason;

    card.items.forEach((item) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item;
      items.appendChild(tag);
    });

    attachDragEvents(node);
    routeBoard.appendChild(node);
  });
}

function attachDragEvents(node) {
  node.addEventListener("dragstart", () => {
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
