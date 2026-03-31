const stageLabels = {
  normal: "正常",
  parallel: "平行叠加",
  extreme: "极限模式",
};

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
const searchInput = document.querySelector("#ego-search");
const keywordFilterSelect = document.querySelector("#ego-keyword-filter");
const levelFilterSelect = document.querySelector("#ego-level-filter");
const packTypeFilterSelect = document.querySelector("#ego-pack-type-filter");
const selectedFilterSelect = document.querySelector("#ego-selected-filter");
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

  const filteredItems = state.egoItems.filter((item) => {
    const searchable = [
      item.name,
      item.description,
      item.level,
      item.acquisition,
      item.packDisplay,
      ...(item.keywords || []),
      ...(item.packOptions || []),
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
  const selectedItems = state.egoItems.filter((item) => state.selectedIds.has(item.id));
  const selectedKeywords = new Set(
    selectedItems.flatMap((item) => (item.keywords || []).filter(Boolean))
  );
  const limitedItems = selectedItems.filter((item) => !item.allPacks);
  const coveredLimitedPackIds = new Set();
  const usedPackIds = new Set();
  const routeCards = [];

  for (let floor = 1; floor <= 15; floor += 1) {
    const floorPacks = state.packs.filter(
      (pack) => Array.isArray(pack.floors) && pack.floors.includes(floor)
    );
    const availablePacks = floorPacks.filter((pack) => !usedPackIds.has(pack.id));
    const manualPackId = state.manualPackByFloor[floor];
    const manualPack = availablePacks.find((pack) => pack.id === manualPackId) ?? null;

    if (manualPackId && !manualPack) {
      delete state.manualPackByFloor[floor];
    }

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
          (item) =>
            Array.isArray(item.packOptions) && item.packOptions.includes(chosenPack.id)
        )
      ) {
        coveredLimitedPackIds.add(chosenPack.id);
      }
    }

    routeCards.push({
      floor,
      mode: stageTypeForFloor(floor),
      isManual: Boolean(manualPack),
      availableOptions: buildFloorOptions(floorPacks, usedPackIds, chosenPack),
      ...buildRouteDetails(chosenPack, limitedItems),
    });
  }

  state.routeCards = routeCards;
  renderRouteBoard();
  updateRouteSummary(selectedItems, routeCards);
}

function chooseBestPackForFloor(
  availablePacks,
  limitedItems,
  coveredLimitedPackIds,
  selectedKeywords
) {
  if (!availablePacks.length) return null;

  return [...availablePacks].sort((a, b) => {
    return (
      scorePack(b, limitedItems, coveredLimitedPackIds, selectedKeywords) -
      scorePack(a, limitedItems, coveredLimitedPackIds, selectedKeywords)
    );
  })[0];
}

function scorePack(pack, limitedItems, coveredLimitedPackIds, selectedKeywords) {
  const unmetLimitedMatches = limitedItems.filter(
    (item) =>
      !coveredLimitedPackIds.has(pack.id) &&
      Array.isArray(item.packOptions) &&
      item.packOptions.includes(pack.id)
  ).length;
  const keywordOverlap = (pack.keywords || []).filter(
    (keyword) => keyword && selectedKeywords.has(keyword)
  ).length;
  const notePenalty = String(pack.note || "").includes("别去") ? -50 : 0;
  const cursePenalty = String(pack.note || "").includes("诅咒") ? -3 : 0;
  return unmetLimitedMatches * 100 + keywordOverlap * 10 + notePenalty + cursePenalty;
}

function buildFloorOptions(floorPacks, usedPackIds, chosenPack) {
  return floorPacks
    .filter((pack) => !usedPackIds.has(pack.id) || pack.id === chosenPack?.id)
    .map((pack) => ({
      id: pack.id,
      name: pack.name,
    }));
}

function buildRouteDetails(chosenPack, limitedItems) {
  if (!chosenPack) {
    return {
      title: "本层已无可选卡包",
      packId: null,
      icon: "./assets/packs/any-pack.svg",
      items: [],
      limitedCount: 0,
      reason: "由于你前面已经选走了候选卡包，这一层不再重复出现相同卡包。",
      required: false,
    };
  }

  const coveredNames = limitedItems
    .filter((item) => doesPackCoverItem(chosenPack, item))
    .map((item) => item.name);

  const required = limitedItems.some(
    (item) =>
      Array.isArray(item.packOptions) &&
      item.packOptions.includes(chosenPack.id)
  );

  const reasonParts = [];
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
  return Array.isArray(item.packOptions) && item.packOptions.includes(pack.id);
}

function updateRouteSummary(selectedItems, routeCards) {
  const chosenPackIds = new Set(routeCards.map((card) => card.packId).filter(Boolean));
  const limitedSelectedItems = selectedItems.filter((item) => !item.allPacks);
  const coveredIds = new Set(
    selectedItems
      .filter((item) => {
        if (item.allPacks) return chosenPackIds.size > 0;
        return (item.packOptions || []).some((packId) => chosenPackIds.has(packId));
      })
      .map((item) => item.id)
  );

  const requiredPackIds = new Set(
    limitedSelectedItems
      .flatMap((item) =>
        (item.packOptions || []).filter((packId) => chosenPackIds.has(packId))
      )
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

function renderRouteBoard() {
  routeBoard.innerHTML = "";

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
