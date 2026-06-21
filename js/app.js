/**
 * Shantou Travel Plan SPA - Interactive Controller
 */
import { travelData } from './data.js';

// --- State Management ---
let state = {
  currentDay: 1,
  completedScheduleItems: [], // format: ["day1-0", "day2-1"]
  likedFoods: [], // format: ["潮汕牛肉火锅"]
  customPackingItems: [], // format: [{category: "xxx", name: "xxx", checked: false}]
  checklistState: {}, // format: {"必备证件-0": true}
  theme: "light",
  activeView: "itinerary" // "itinerary", "map", "food", "budget", "checklist"
};

// --- Map State ---
let map = null;
let markers = [];
let polyline = null;
let activeRouteEndpoint = null; // format: { coords: [lng, lat], name: "xxx" }
let selectedRouteMode = "transfer"; // "transfer", "riding", "walking", "driving"
let searchMarker = null;

// --- DOM References ---
const DOM = {
  themeToggle: document.getElementById("theme-toggle"),
  overallProgressText: document.getElementById("overall-progress-text"),
  overallProgressBar: document.getElementById("overall-progress-bar"),
  calcTransport: document.getElementById("calc-transport"),
  calcHotelCity: document.getElementById("calc-hotel-city"),
  calcHotelIsland: document.getElementById("calc-hotel-island"),
  calcFood: document.getElementById("calc-food"),
  calcFoodValue: document.getElementById("calc-food-value"),
  calcIslandTrans: document.getElementById("calc-island-trans"),
  calcMisc: document.getElementById("calc-misc"),
  calcMiscValue: document.getElementById("calc-misc-value"),
  budgetTotal: document.getElementById("budget-total"),
  breakdownTrans: document.getElementById("breakdown-trans"),
  breakdownHotel: document.getElementById("breakdown-hotel"),
  breakdownFood: document.getElementById("breakdown-food"),
  breakdownMisc: document.getElementById("breakdown-misc"),
  dayIntroBox: document.getElementById("day-intro-box"),
  daySummaryText: document.getElementById("day-summary-text"),
  timelineList: document.getElementById("timeline-list"),
  dayTabBtns: document.querySelectorAll(".day-tab-btn"),
  foodGrid: document.querySelector(".food-grid"),
  filterBtns: document.querySelectorAll(".filter-btn"),
  foodLikedCount: document.getElementById("food-liked-count"),
  checklistCategories: document.getElementById("checklist-categories"),
  customItemName: document.getElementById("custom-item-name"),
  customItemCategory: document.getElementById("custom-item-category"),
  btnAddItem: document.getElementById("btn-add-item"),
  
  // Amap Specific DOM elements
  mapSearchInput: document.getElementById("map-search-input"),
  searchResultsPanel: document.getElementById("search-results-panel"),
  routeStartText: document.getElementById("route-start-text"),
  routeEndText: document.getElementById("route-end-text"),
  routeResultInfo: document.getElementById("route-result-info"),
  modeBtns: document.querySelectorAll(".mode-btn"),
  
  // Navigation Links
  navLinks: document.querySelectorAll(".desktop-nav .nav-link")
};

// Type to Icon mapper
const itemIcons = {
  transport: "🚉",
  sightseeing: "📷",
  food: "🍽️",
  shopping: "🛍️"
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  loadStateFromLocalStorage();
  initTheme();
  initAmap();
  initRouter();
  initEventListeners();
  renderAll();
});

// --- Local Storage Sync ---
function loadStateFromLocalStorage() {
  state.theme = localStorage.getItem("shantou_theme") || "light";
  
  const completed = localStorage.getItem("shantou_completed_schedule");
  state.completedScheduleItems = completed ? JSON.parse(completed) : [];
  
  const liked = localStorage.getItem("shantou_liked_foods");
  state.likedFoods = liked ? JSON.parse(liked) : [];
  
  const customItems = localStorage.getItem("shantou_custom_packing");
  state.customPackingItems = customItems ? JSON.parse(customItems) : [];
  
  const chkState = localStorage.getItem("shantou_checklist_state");
  state.checklistState = chkState ? JSON.parse(chkState) : {};
  
  if (Object.keys(state.checklistState).length === 0) {
    travelData.packing.forEach(cat => {
      cat.items.forEach((item, index) => {
        const key = `${cat.category}-${index}`;
        state.checklistState[key] = item.checked;
      });
    });
  }
}

function saveState() {
  localStorage.setItem("shantou_completed_schedule", JSON.stringify(state.completedScheduleItems));
  localStorage.setItem("shantou_liked_foods", JSON.stringify(state.likedFoods));
  localStorage.setItem("shantou_custom_packing", JSON.stringify(state.customPackingItems));
  localStorage.setItem("shantou_checklist_state", JSON.stringify(state.checklistState));
}

// --- Theme Management ---
function initTheme() {
  document.body.className = `theme-${state.theme}`;
  updateThemeToggleUI();
  if (map) {
    map.setTheme(state.theme === "dark" ? "dark" : "normal");
  }
}

// --- Router (Multi-view controller) ---
function initRouter() {
  window.addEventListener("hashchange", handleRouting);
  handleRouting(); // run router once on load
}

function handleRouting() {
  const hash = window.location.hash || "#/itinerary";
  const viewName = hash.replace("#/", "");
  
  // Set state
  state.activeView = viewName;
  
  // Update view visibility
  document.querySelectorAll(".page-view").forEach(view => {
    const viewId = view.getAttribute("id");
    if (viewId === `view-${viewName}`) {
      view.classList.add("active");
    } else {
      view.classList.remove("active");
    }
  });
  
  // Update nav links styling
  DOM.navLinks.forEach(link => {
    const linkId = link.getAttribute("id");
    if (linkId === `nav-${viewName}`) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
  
  // Scroll to top of the hero section for a clean switch
  window.scrollTo({ top: 0, behavior: "smooth" });
  
  // Amap container resize fix:
  // If we switch to the map page, high-precision map must recalculate container dimensions since it was hidden
  if (viewName === "map" && map) {
    setTimeout(() => {
      map.resize();
      
      // Trigger fitView to ensure markers layout fits perfectly
      const activeCoords = markers
        .filter(m => m.dayId === state.currentDay)
        .map(m => m.coords);
        
      if (activeCoords.length > 0 && polyline) {
        map.setFitView([polyline], false, [60, 60, 60, 60], 13);
      }
    }, 100);
  }
}

function updateThemeToggleUI() {
  const sunIcon = DOM.themeToggle.querySelector(".sun-icon");
  const moonIcon = DOM.themeToggle.querySelector(".moon-icon");
  
  if (state.theme === "dark") {
    sunIcon.style.display = "none";
    moonIcon.style.display = "block";
  } else {
    sunIcon.style.display = "block";
    moonIcon.style.display = "none";
  }
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  localStorage.setItem("shantou_theme", state.theme);
  initTheme();
}

// --- Event Listeners ---
function initEventListeners() {
  DOM.themeToggle.addEventListener("click", toggleTheme);
  
  DOM.dayTabBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const dayId = parseInt(e.currentTarget.getAttribute("data-day"));
      setActiveDay(dayId);
    });
  });
  
  DOM.filterBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      DOM.filterBtns.forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      const filter = e.currentTarget.getAttribute("data-filter");
      renderFoods(filter);
    });
  });
  
  [DOM.calcTransport, DOM.calcHotelCity, DOM.calcHotelIsland, DOM.calcIslandTrans].forEach(el => {
    el.addEventListener("change", calculateBudget);
  });
  
  DOM.calcFood.addEventListener("input", (e) => {
    DOM.calcFoodValue.textContent = `￥${e.target.value}`;
    calculateBudget();
  });
  
  DOM.calcMisc.addEventListener("input", (e) => {
    DOM.calcMiscValue.textContent = `￥${e.target.value}`;
    calculateBudget();
  });
  
  DOM.btnAddItem.addEventListener("click", addCustomPackingItem);
  DOM.customItemName.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addCustomPackingItem();
  });

  // Routing Mode buttons
  DOM.modeBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      DOM.modeBtns.forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      selectedRouteMode = e.currentTarget.getAttribute("data-mode");
      if (activeRouteEndpoint) {
        calculateRoute();
      }
    });
  });

  // Amap Search Autocomplete
  let auto = null;
  if (typeof AMap !== 'undefined') {
    AMap.plugin('AMap.AutoComplete', () => {
      auto = new AMap.AutoComplete({
        city: '汕头'
      });
    });
  }

  DOM.mapSearchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (!val) {
      DOM.searchResultsPanel.style.display = "none";
      return;
    }
    if (auto) {
      auto.search(val, (status, result) => {
        if (status === 'complete' && result.tips) {
          renderSearchResults(result.tips);
        } else {
          DOM.searchResultsPanel.style.display = "none";
        }
      });
    }
  });

  // Hide search results panel when clicking outside
  document.addEventListener("click", (e) => {
    if (!DOM.mapSearchInput.contains(e.target) && !DOM.searchResultsPanel.contains(e.target)) {
      DOM.searchResultsPanel.style.display = "none";
    }
  });
}

// --- Dynamic Render Operations ---
function renderAll() {
  renderDayTimeline();
  renderFoods();
  renderMap();
  calculateBudget();
  renderChecklist();
  populateCategoryDropdown();
  updateProgress();
}

// 1. Timeline Rendering
function renderDayTimeline() {
  const currentDayData = travelData.days.find(d => d.id === state.currentDay);
  if (!currentDayData) return;
  
  DOM.dayTabBtns.forEach(btn => {
    const d = parseInt(btn.getAttribute("data-day"));
    if (d === state.currentDay) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  DOM.daySummaryText.textContent = currentDayData.summary;
  
  DOM.timelineList.innerHTML = "";
  currentDayData.schedule.forEach((item, index) => {
    const itemKey = `day${state.currentDay}-${index}`;
    const isCompleted = state.completedScheduleItems.includes(itemKey);
    
    const card = document.createElement("div");
    card.className = `timeline-card type-${item.type} ${isCompleted ? 'completed' : ''}`;
    card.setAttribute("data-key", itemKey);
    
    card.innerHTML = `
      <div class="card-header">
        <span class="card-time-badge">
          <span class="card-type-icon">${itemIcons[item.type] || "📍"}</span>
          ${item.time}
        </span>
        <div class="card-actions">
          <button class="check-btn" title="标记此段行程已完成" onclick="toggleScheduleItem('${itemKey}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>
      </div>
      <h4 class="card-title">${item.title}</h4>
      <p class="card-desc">${item.desc}</p>
      <div class="card-tip-box">${item.highlight}</div>
    `;
    
    DOM.timelineList.appendChild(card);
  });
}

function setActiveDay(dayId) {
  state.currentDay = dayId;
  renderDayTimeline();
  updateMapHighlight();
}

window.toggleScheduleItem = function(itemKey) {
  const idx = state.completedScheduleItems.indexOf(itemKey);
  if (idx > -1) {
    state.completedScheduleItems.splice(idx, 1);
  } else {
    state.completedScheduleItems.push(itemKey);
  }
  saveState();
  
  const card = document.querySelector(`.timeline-card[data-key="${itemKey}"]`);
  if (card) {
    if (state.completedScheduleItems.includes(itemKey)) {
      card.classList.add("completed");
    } else {
      card.classList.remove("completed");
    }
  }
  
  updateProgress();
};

// 2. Amap Initialization & Marker Rendering
function initAmap() {
  if (typeof AMap === 'undefined') {
    console.error("Amap SDK not loaded!");
    return;
  }
  
  map = new AMap.Map("amap-container", {
    zoom: 11,
    center: [116.8, 23.4],
    viewMode: "2D",
    theme: state.theme === "dark" ? "dark" : "normal"
  });

  map.on("complete", () => {
    updateMapHighlight();
  });
}

function renderMap() {
  if (!map) return;
  
  markers.forEach(m => m.instance.setMap(null));
  markers = [];
  
  travelData.days.forEach(day => {
    day.mapPoints.forEach((pt, idx) => {
      const markerEl = document.createElement("div");
      markerEl.className = `custom-map-marker node-day-${day.id}`;
      markerEl.id = `marker-${pt.name.replace(/\s+/g, '')}`;
      
      markerEl.innerHTML = `
        <div class="marker-pin">
          <span class="marker-inner">${idx + 1}</span>
        </div>
        <span class="marker-label">${pt.name}</span>
      `;
      
      const marker = new AMap.Marker({
        position: pt.coords,
        content: markerEl,
        offset: new AMap.Pixel(-12, -36),
        title: pt.name
      });
      
      const infoContent = document.createElement("div");
      infoContent.className = "custom-info-card";
      infoContent.innerHTML = `
        <h4>${pt.name}</h4>
        <p>${pt.desc}</p>
        <button class="info-btn">设为终点</button>
      `;
      
      infoContent.querySelector(".info-btn").addEventListener("click", () => {
        selectRouteDestination(pt.coords, pt.name);
        infoWindow.close();
      });
      
      const infoWindow = new AMap.InfoWindow({
        content: infoContent,
        isCustom: true,
        offset: new AMap.Pixel(0, -32)
      });
      
      marker.on("click", () => {
        map.clearInfoWindow();
        infoWindow.open(map, pt.coords);
        
        if (day.id === state.currentDay) {
          highlightTimelineCard(pt.name);
        }
      });
      
      marker.setMap(map);
      markers.push({
        instance: marker,
        dayId: day.id,
        name: pt.name,
        coords: pt.coords,
        element: markerEl
      });
    });
  });
}

function updateMapHighlight() {
  if (!map || markers.length === 0) return;
  
  clearRoute();
  if (searchMarker) {
    searchMarker.setMap(null);
    searchMarker = null;
  }
  DOM.mapSearchInput.value = "";
  
  const activeCoords = [];
  markers.forEach(m => {
    if (m.dayId === state.currentDay) {
      m.instance.show();
      m.element.classList.add("active");
      activeCoords.push(m.coords);
    } else {
      m.instance.hide();
      m.element.classList.remove("active");
    }
  });
  
  if (polyline) {
    polyline.setMap(null);
  }
  
  if (activeCoords.length > 0) {
    polyline = new AMap.Polyline({
      path: activeCoords,
      strokeColor: "#0284c7",
      strokeWeight: 5,
      strokeOpacity: 0.8,
      strokeStyle: "dashed",
      strokeDasharray: [10, 5],
      lineJoin: "round",
      lineCap: "round"
    });
    polyline.setMap(map);
    
    // Zoom & Pan to fit day's destinations (only resize map if activeView is map)
    if (state.activeView === "map") {
      map.setFitView([polyline], false, [60, 60, 60, 60], 13);
    }
    
    const firstPt = markers.find(m => m.dayId === state.currentDay);
    if (firstPt) {
      DOM.routeStartText.textContent = `起点: ${firstPt.name}`;
      DOM.routeEndText.textContent = "点击地图标记选择终点";
    }
  }
}

function highlightTimelineCard(name) {
  // If clicked inside map window, trigger routing tab switch or highlight timeline
  // Open scheduling tab to show highlighted timeline card
  window.location.hash = "#/itinerary";
  
  setTimeout(() => {
    const cards = DOM.timelineList.querySelectorAll(".timeline-card");
    cards.forEach(card => {
      const title = card.querySelector(".card-title").textContent;
      const desc = card.querySelector(".card-desc").textContent;
      const tip = card.querySelector(".card-tip-box").textContent;
      
      if (title.includes(name) || desc.includes(name) || tip.includes(name)) {
        card.style.borderColor = "var(--accent)";
        card.style.boxShadow = "0 0 15px var(--accent-light)";
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        
        setTimeout(() => {
          card.style.borderColor = "";
          card.style.boxShadow = "";
        }, 3000);
      }
    });
  }, 200);
}

// 3. Search POI Autocomplete panel
function renderSearchResults(tips) {
  DOM.searchResultsPanel.innerHTML = "";
  DOM.searchResultsPanel.style.display = "block";
  
  tips.forEach(tip => {
    if (!tip.location) return;
    
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.innerHTML = `
      <h5>${tip.name}</h5>
      <p>${tip.district || ""} ${tip.address || ""}</p>
    `;
    
    item.addEventListener("click", () => {
      selectSearchLocation(tip);
    });
    
    DOM.searchResultsPanel.appendChild(item);
  });
}

function selectSearchLocation(tip) {
  DOM.mapSearchInput.value = tip.name;
  DOM.searchResultsPanel.style.display = "none";
  
  const coords = [tip.location.lng, tip.location.lat];
  
  if (searchMarker) {
    searchMarker.setMap(null);
  }
  
  searchMarker = new AMap.Marker({
    position: coords,
    map: map,
    animation: "AMAP_ANIMATION_DROP"
  });
  
  map.setZoomAndCenter(15, coords);
  
  const infoContent = document.createElement("div");
  infoContent.className = "custom-info-card";
  infoContent.innerHTML = `
    <h4>${tip.name}</h4>
    <p>${tip.district || ""} ${tip.address || ""}</p>
    <button class="info-btn">设为终点</button>
  `;
  
  infoContent.querySelector(".info-btn").addEventListener("click", () => {
    selectRouteDestination(coords, tip.name);
    infoWindow.close();
  });
  
  const infoWindow = new AMap.InfoWindow({
    content: infoContent,
    isCustom: true,
    offset: new AMap.Pixel(0, -32)
  });
  
  infoWindow.open(map, coords);
  
  searchMarker.on("click", () => {
    infoWindow.open(map, coords);
  });
}

// 4. Intelligent Route Planner logic
window.selectRouteDestination = function(coords, name) {
  activeRouteEndpoint = { coords, name };
  DOM.routeEndText.textContent = `终点: ${name}`;
  calculateRoute();
};

function calculateRoute() {
  if (!map || !activeRouteEndpoint) return;
  
  const activeDayMarkers = markers.filter(m => m.dayId === state.currentDay);
  if (activeDayMarkers.length === 0) return;
  const startCoords = activeDayMarkers[0].coords;
  const endCoords = activeRouteEndpoint.coords;
  
  clearRoute();
  
  DOM.routeResultInfo.style.display = "block";
  DOM.routeResultInfo.innerHTML = "⌛ 正在规划路线中...";
  
  if (polyline) {
    polyline.setMap(null);
  }
  
  if (selectedRouteMode === "transfer") {
    AMap.plugin("AMap.Transfer", () => {
      const transfer = new AMap.Transfer({
        map: map,
        city: "汕头市",
        panel: "route-result-info",
        policy: AMap.TransferPolicy.LEAST_TIME
      });
      window.amapRoutePlugin = transfer;
      transfer.search(startCoords, endCoords, (status, result) => {
        if (status !== "complete") {
          DOM.routeResultInfo.innerHTML = "❌ 未找到合适的跨海/城市公交路线方案，推荐使用驾车或骑行。";
        }
      });
    });
  } else if (selectedRouteMode === "riding") {
    AMap.plugin("AMap.Riding", () => {
      const riding = new AMap.Riding({
        map: map,
        panel: "route-result-info"
      });
      window.amapRoutePlugin = riding;
      riding.search(startCoords, endCoords, (status, result) => {
        if (status !== "complete") {
          DOM.routeResultInfo.innerHTML = "❌ 骑行规划失败，距离可能过远或无适合非机动车道路。";
        }
      });
    });
  } else if (selectedRouteMode === "walking") {
    AMap.plugin("AMap.Walking", () => {
      const walking = new AMap.Walking({
        map: map,
        panel: "route-result-info"
      });
      window.amapRoutePlugin = walking;
      walking.search(startCoords, endCoords, (status, result) => {
        if (status !== "complete") {
          DOM.routeResultInfo.innerHTML = "❌ 步行规划失败，距离太远。";
        }
      });
    });
  } else if (selectedRouteMode === "driving") {
    AMap.plugin("AMap.Driving", () => {
      const driving = new AMap.Driving({
        map: map,
        panel: "route-result-info",
        policy: AMap.DrivingPolicy.LEAST_TIME
      });
      window.amapRoutePlugin = driving;
      driving.search(startCoords, endCoords, (status, result) => {
        if (status !== "complete") {
          DOM.routeResultInfo.innerHTML = "❌ 驾车路径规划失败。";
        }
      });
    });
  }
}

function clearRoute() {
  if (window.amapRoutePlugin) {
    window.amapRoutePlugin.clear();
    window.amapRoutePlugin = null;
  }
  DOM.routeResultInfo.style.display = "none";
  DOM.routeResultInfo.innerHTML = "";
}

// 5. Food Explorer Rendering
function renderFoods(filter = "all") {
  DOM.foodGrid.innerHTML = "";
  
  let filtered = travelData.foods;
  if (filter === "cooked") {
    filtered = travelData.foods.filter(f => !f.isRaw);
  } else if (filter === "raw") {
    filtered = travelData.foods.filter(f => f.isRaw);
  }
  
  filtered.forEach(food => {
    const isLiked = state.likedFoods.includes(food.name);
    const card = document.createElement("div");
    card.className = "food-card";
    
    let imageSrc = "/assets/hotpot.png";
    if (food.name.includes("牛肉火锅")) imageSrc = "/assets/hotpot.png";
    else if (food.name.includes("生腌")) imageSrc = "/assets/hotpot.png"; 
    else if (food.name.includes("灯塔") || food.name.includes("大桥")) imageSrc = "/assets/lighthouse.png";
    else if (food.name.includes("妈屿") || food.name.includes("海观")) imageSrc = "/assets/island.png";
    else imageSrc = "/assets/island.png"; // default
    
    card.innerHTML = `
      <div class="food-img-wrapper">
        <img class="food-img" src="${imageSrc}" alt="${food.name}">
        <div class="food-img-overlay"></div>
        <span class="food-badge ${food.isRaw ? 'danger' : ''}">${food.tag}</span>
        <button class="btn-like ${isLiked ? 'liked' : ''}" onclick="toggleLikeFood(event, '${food.name}')" title="加入必吃清单">
          <svg viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      </div>
      <div class="food-card-body">
        <h4 class="food-title">${food.name}</h4>
        <p class="food-desc">${food.desc}</p>
        <div class="food-tip">${food.tip}</div>
      </div>
    `;
    DOM.foodGrid.appendChild(card);
  });
  
  DOM.foodLikedCount.textContent = state.likedFoods.length;
}

window.toggleLikeFood = function(e, foodName) {
  e.stopPropagation();
  const idx = state.likedFoods.indexOf(foodName);
  if (idx > -1) {
    state.likedFoods.splice(idx, 1);
  } else {
    state.likedFoods.push(foodName);
  }
  saveState();
  
  const btn = e.currentTarget;
  if (btn) {
    btn.classList.toggle("liked");
  }
  
  DOM.foodLikedCount.textContent = state.likedFoods.length;
};

// 6. Budget Calculator
function calculateBudget() {
  const trans = parseInt(DOM.calcTransport.value);
  const cityH = parseInt(DOM.calcHotelCity.value);
  const islandH = parseInt(DOM.calcHotelIsland.value);
  const foodPerDay = parseInt(DOM.calcFood.value);
  const islandTrans = parseInt(DOM.calcIslandTrans.value);
  const misc = parseInt(DOM.calcMisc.value);
  
  const hotelTotal = cityH + islandH;
  const foodTotal = foodPerDay * 3;
  const transTotal = trans + islandTrans;
  
  const grandTotal = transTotal + hotelTotal + foodTotal + misc;
  
  DOM.budgetTotal.textContent = `￥${grandTotal.toLocaleString()}`;
  
  const tPercent = Math.max(5, (transTotal / grandTotal) * 100);
  const hPercent = Math.max(5, (hotelTotal / grandTotal) * 100);
  const fPercent = Math.max(5, (foodTotal / grandTotal) * 100);
  const mPercent = Math.max(5, (misc / grandTotal) * 100);
  
  DOM.breakdownTrans.style.width = `${tPercent}%`;
  DOM.breakdownHotel.style.width = `${hPercent}%`;
  DOM.breakdownFood.style.width = `${fPercent}%`;
  DOM.breakdownMisc.style.width = `${mPercent}%`;
  
  DOM.breakdownTrans.setAttribute("title", `大交通及岛内公交: ￥${transTotal}`);
  DOM.breakdownHotel.setAttribute("title", `住宿开销: ￥${hotelTotal}`);
  DOM.breakdownFood.setAttribute("title", `餐饮消费: ￥${foodTotal}`);
  DOM.breakdownMisc.setAttribute("title", `特产及其他: ￥${misc}`);
}

// 7. Packing Checklist Rendering
function renderChecklist() {
  DOM.checklistCategories.innerHTML = "";
  
  const groups = {};
  
  travelData.packing.forEach(cat => {
    groups[cat.category] = [];
    cat.items.forEach((item, index) => {
      const key = `${cat.category}-${index}`;
      groups[cat.category].push({
        key: key,
        name: item.name,
        checked: state.checklistState[key] || false,
        custom: false
      });
    });
  });
  
  state.customPackingItems.forEach((item, index) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    const key = `custom-${index}`;
    groups[item.category].push({
      key: key,
      name: item.name,
      checked: item.checked,
      custom: true,
      index: index
    });
  });
  
  Object.keys(groups).forEach(catName => {
    const items = groups[catName];
    if (items.length === 0) return;
    
    const checkedCount = items.filter(i => i.checked).length;
    const totalCount = items.length;
    
    const card = document.createElement("div");
    card.className = "check-category-card";
    
    card.innerHTML = `
      <div class="category-title">
        <span>${catName}</span>
        <span class="category-progress-badge">${checkedCount}/${totalCount}</span>
      </div>
      <div class="check-items-list"></div>
    `;
    
    const itemsList = card.querySelector(".check-items-list");
    items.forEach(item => {
      const itemEl = document.createElement("div");
      itemEl.className = `check-item ${item.checked ? 'checked' : ''}`;
      
      itemEl.innerHTML = `
        <div class="checkbox-custom">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span>${item.name}</span>
        ${item.custom ? `<button class="btn-delete-item" onclick="deleteCustomItem(event, ${item.index})" style="margin-left:auto; background:transparent; border:none; color:var(--danger); cursor:pointer; font-size:0.75rem;">删除</button>` : ""}
      `;
      
      itemEl.addEventListener("click", () => {
        toggleChecklistItem(item);
      });
      
      itemsList.appendChild(itemEl);
    });
    
    DOM.checklistCategories.appendChild(card);
  });
}

function toggleChecklistItem(item) {
  if (item.custom) {
    state.customPackingItems[item.index].checked = !state.customPackingItems[item.index].checked;
  } else {
    state.checklistState[item.key] = !state.checklistState[item.key];
  }
  saveState();
  renderChecklist();
  updateProgress();
}

window.deleteCustomItem = function(e, index) {
  e.stopPropagation();
  state.customPackingItems.splice(index, 1);
  saveState();
  renderChecklist();
  updateProgress();
};

function populateCategoryDropdown() {
  DOM.customItemCategory.innerHTML = "";
  travelData.packing.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.category;
    opt.textContent = cat.category;
    DOM.customItemCategory.appendChild(opt);
  });
}

function addCustomPackingItem() {
  const name = DOM.customItemName.value.trim();
  const category = DOM.customItemCategory.value;
  
  if (!name) return;
  
  state.customPackingItems.push({
    category: category,
    name: name,
    checked: false
  });
  
  saveState();
  DOM.customItemName.value = "";
  renderChecklist();
  updateProgress();
}

// 8. Overall Progress Calculation
function updateProgress() {
  let totalSchedule = 0;
  travelData.days.forEach(day => {
    totalSchedule += day.schedule.length;
  });
  
  let totalPacking = 0;
  travelData.packing.forEach(cat => {
    totalPacking += cat.items.length;
  });
  
  totalPacking += state.customPackingItems.length;
  
  const total = totalSchedule + totalPacking;
  
  const completedSchedule = state.completedScheduleItems.length;
  
  let completedPacking = 0;
  travelData.packing.forEach(cat => {
    cat.items.forEach((item, index) => {
      const key = `${cat.category}-${index}`;
      if (state.checklistState[key]) {
        completedPacking++;
      }
    });
  });
  state.customPackingItems.forEach(item => {
    if (item.checked) completedPacking++;
  });
  
  const completed = completedSchedule + completedPacking;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  DOM.overallProgressText.textContent = `${percent}% (已完成 ${completed}/${total})`;
  DOM.overallProgressBar.style.width = `${percent}%`;
}
