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
  theme: "light"
};

// --- DOM References ---
const DOM = {
  themeToggle: document.getElementById("theme-toggle"),
  overallProgressText: document.getElementById("overall-progress-text"),
  overallProgressBar: document.getElementById("overall-progress-bar"),
  mapNodesGroup: document.getElementById("map-nodes"),
  mapTooltip: document.getElementById("map-tooltip"),
  tooltipTitle: document.getElementById("tooltip-title"),
  tooltipDesc: document.getElementById("tooltip-desc"),
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
  btnAddItem: document.getElementById("btn-add-item")
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
  initEventListeners();
  renderAll();
});

// --- Local Storage Sync ---
function loadStateFromLocalStorage() {
  // Theme
  state.theme = localStorage.getItem("shantou_theme") || "light";
  
  // Completed Schedule Items
  const completed = localStorage.getItem("shantou_completed_schedule");
  state.completedScheduleItems = completed ? JSON.parse(completed) : [];
  
  // Liked Foods
  const liked = localStorage.getItem("shantou_liked_foods");
  state.likedFoods = liked ? JSON.parse(liked) : [];
  
  // Custom Packing Items
  const customItems = localStorage.getItem("shantou_custom_packing");
  state.customPackingItems = customItems ? JSON.parse(customItems) : [];
  
  // Checklist Checked State
  const chkState = localStorage.getItem("shantou_checklist_state");
  state.checklistState = chkState ? JSON.parse(chkState) : {};
  
  // Load packing checklist defaults if checklistState is completely empty
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
  // Theme Toggle
  DOM.themeToggle.addEventListener("click", toggleTheme);
  
  // Day Tab Selectors
  DOM.dayTabBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const dayId = parseInt(e.currentTarget.getAttribute("data-day"));
      setActiveDay(dayId);
    });
  });
  
  // Food Filters
  DOM.filterBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      DOM.filterBtns.forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      const filter = e.currentTarget.getAttribute("data-filter");
      renderFoods(filter);
    });
  });
  
  // Budget Calculator Inputs
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
  
  // Packing Item Adder
  DOM.btnAddItem.addEventListener("click", addCustomPackingItem);
  DOM.customItemName.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addCustomPackingItem();
  });

  // Nav highlight scroll listener
  window.addEventListener("scroll", handleScrollHighlight);
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
  
  // Update tabs active state
  DOM.dayTabBtns.forEach(btn => {
    const d = parseInt(btn.getAttribute("data-day"));
    if (d === state.currentDay) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  // Summary info
  DOM.daySummaryText.textContent = currentDayData.summary;
  
  // Schedule Cards
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
  
  // Update timeline cards visual state
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

// 2. SVG Interactive Map Rendering
function renderMap() {
  DOM.mapNodesGroup.innerHTML = "";
  
  // Gather all points across all days
  const allPoints = [];
  travelData.days.forEach(day => {
    day.mapPoints.forEach(pt => {
      // Avoid duplicate points (e.g. station is used in day 1 and 3)
      if (!allPoints.some(p => p.name === pt.name)) {
        allPoints.push({
          ...pt,
          dayId: day.id
        });
      }
    });
  });
  
  allPoints.forEach(pt => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `map-node node-day-${pt.dayId}`);
    group.setAttribute("data-name", pt.name);
    group.setAttribute("data-desc", pt.desc);
    group.setAttribute("data-day", pt.dayId);
    
    // Add glowing effect background
    const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    glow.setAttribute("cx", pt.x * 4); // scale up coordinate space
    glow.setAttribute("cy", pt.y * 3);
    glow.setAttribute("r", 12);
    glow.setAttribute("fill", "var(--primary-glow)");
    glow.setAttribute("opacity", "0");
    glow.setAttribute("class", "node-glow");
    
    // Add core circle
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", pt.x * 4);
    circle.setAttribute("cy", pt.y * 3);
    circle.setAttribute("r", 7.5);
    circle.setAttribute("filter", "url(#shadow)");
    
    // Add text label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", pt.x * 4);
    text.setAttribute("y", (pt.y * 3) - 13);
    text.setAttribute("text-anchor", "middle");
    text.textContent = pt.name;
    
    group.appendChild(glow);
    group.appendChild(circle);
    group.appendChild(text);
    
    // Interactive Handlers
    group.addEventListener("mouseenter", (e) => {
      showMapTooltip(e, pt.name, pt.desc);
      glow.setAttribute("opacity", "1");
    });
    group.addEventListener("mouseleave", () => {
      hideMapTooltip();
      glow.setAttribute("opacity", "0");
    });
    group.addEventListener("click", () => {
      setActiveDay(pt.dayId);
      // Smooth scroll to itinerary timeline
      document.getElementById("itinerary").scrollIntoView({ behavior: "smooth" });
    });
    
    DOM.mapNodesGroup.appendChild(group);
  });
  
  updateMapHighlight();
}

function updateMapHighlight() {
  const nodes = DOM.mapNodesGroup.querySelectorAll(".map-node");
  nodes.forEach(node => {
    const day = parseInt(node.getAttribute("data-day"));
    if (day === state.currentDay) {
      node.classList.add("active");
    } else {
      node.classList.remove("active");
    }
  });
}

function showMapTooltip(e, title, desc) {
  DOM.tooltipTitle.textContent = title;
  DOM.tooltipDesc.textContent = desc;
  DOM.mapTooltip.style.display = "block";
  
  // Calculate relative coordinate placement
  const mapRect = document.getElementById("interactive-map").getBoundingClientRect();
  const nodeEl = e.currentTarget.querySelector("circle:nth-child(2)");
  const nodeRect = nodeEl.getBoundingClientRect();
  
  // Align tooltip above the node
  const left = (nodeRect.left - mapRect.left) + (nodeRect.width / 2) - 100; // 100 is half width
  const top = (nodeRect.top - mapRect.top) - 80;
  
  DOM.mapTooltip.style.left = `${Math.max(10, Math.min(mapRect.width - 210, left))}px`;
  DOM.mapTooltip.style.top = `${Math.max(10, top)}px`;
}

function hideMapTooltip() {
  DOM.mapTooltip.style.display = "none";
}

// 3. Food Explorer Rendering
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
    
    // Choose local image if available, else placeholder gradient
    let imageSrc = "assets/hotpot.png";
    if (food.name.includes("牛肉火锅")) imageSrc = "assets/hotpot.png";
    else if (food.name.includes("生腌")) imageSrc = "assets/hotpot.png"; // or custom
    else if (food.name.includes("灯塔") || food.name.includes("大桥")) imageSrc = "assets/lighthouse.png";
    else if (food.name.includes("妈屿") || food.name.includes("海观")) imageSrc = "assets/island.png";
    else imageSrc = "assets/island.png"; // default
    
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
  
  // Find button in UI and toggle class
  const btn = e.currentTarget;
  if (btn) {
    btn.classList.toggle("liked");
  }
  
  DOM.foodLikedCount.textContent = state.likedFoods.length;
};

// 4. Budget Calculator
function calculateBudget() {
  const trans = parseInt(DOM.calcTransport.value);
  const cityH = parseInt(DOM.calcHotelCity.value);
  const islandH = parseInt(DOM.calcHotelIsland.value);
  const foodPerDay = parseInt(DOM.calcFood.value);
  const islandTrans = parseInt(DOM.calcIslandTrans.value);
  const misc = parseInt(DOM.calcMisc.value);
  
  // Calculations (3 days, 2 nights total)
  // 1 night city hotel, 1 night island hotel
  const hotelTotal = cityH + islandH;
  const foodTotal = foodPerDay * 3;
  const transTotal = trans + islandTrans;
  
  const grandTotal = transTotal + hotelTotal + foodTotal + misc;
  
  DOM.budgetTotal.textContent = `￥${grandTotal.toLocaleString()}`;
  
  // Update Breakdown Graph widths
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

// 5. Packing Checklist Rendering
function renderChecklist() {
  DOM.checklistCategories.innerHTML = "";
  
  // Group all items (default + custom) by category
  const groups = {};
  
  // Add default groups
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
  
  // Add custom items
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
  
  // Render Categories
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
      <div class="check-items-list">
        <!-- Render Items -->
      </div>
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

// 6. Overall Progress Calculation
function updateProgress() {
  // Calculate total items to complete
  // Total Schedule Items
  let totalSchedule = 0;
  travelData.days.forEach(day => {
    totalSchedule += day.schedule.length;
  });
  
  // Total default packing items
  let totalPacking = 0;
  travelData.packing.forEach(cat => {
    totalPacking += cat.items.length;
  });
  
  // Total custom packing items
  totalPacking += state.customPackingItems.length;
  
  const total = totalSchedule + totalPacking;
  
  // Calculate completed items
  const completedSchedule = state.completedScheduleItems.length;
  
  let completedPacking = 0;
  // Default packing checklist completion count
  travelData.packing.forEach(cat => {
    cat.items.forEach((item, index) => {
      const key = `${cat.category}-${index}`;
      if (state.checklistState[key]) {
        completedPacking++;
      }
    });
  });
  // Custom packing items completion count
  state.customPackingItems.forEach(item => {
    if (item.checked) completedPacking++;
  });
  
  const completed = completedSchedule + completedPacking;
  
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  DOM.overallProgressText.textContent = `${percent}% (已完成 ${completed}/${total})`;
  DOM.overallProgressBar.style.width = `${percent}%`;
}

// --- Navigation scroll helper ---
function handleScrollHighlight() {
  const sections = ["itinerary", "map-section", "food", "budget", "checklist"];
  const navLinks = document.querySelectorAll(".nav-link");
  
  let currentSectionId = "itinerary";
  const scrollPosition = window.scrollY + 100; // offset for header
  
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.offsetTop - 50;
      const bottom = top + el.offsetHeight;
      if (scrollPosition >= top && scrollPosition < bottom) {
        currentSectionId = id;
      }
    }
  });
  
  navLinks.forEach(link => {
    const href = link.getAttribute("href").substring(1);
    if (href === currentSectionId) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}
