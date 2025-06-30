// ===== static/js/app.js =====

// Cache common DOM elements
const navButtons     = document.querySelectorAll(".nav-btn");
const sections       = document.querySelectorAll(".main-section");
const suggestedBox   = document.getElementById("suggested");
const saveFeedbackEl = document.getElementById("save-feedback");
const foodCardsEl    = document.getElementById("foodCards");
const manualFormEl   = document.getElementById("manualForm");
const customFormEl   = document.getElementById("customForm");
const statsListDiv   = document.getElementById("statsList");
const entryListUl    = document.getElementById("entryListUl");
const chartCanvas    = document.getElementById("nutriChart");

// Predefined common foods
const foods = [
  { name: "Chicken Breast", img: "assets/chicken.png", protein: 31, carbs: 0,   fats: 3.6, cal: 165 },
  { name: "White Rice",    img: "assets/rice.png",    protein: 2.7, carbs: 28,  fats: 0.3, cal: 130 },
  { name: "Egg",           img: "assets/egg.png",     protein: 13,  carbs: 1.1, fats: 11,  cal: 155 },
  { name: "Banana",        img: "assets/banana.png",  protein: 1.3, carbs: 27,  fats: 0.3, cal: 105 },
  { name: "Peanut Butter", img: "assets/peanut.png",  protein: 25,  carbs: 20,  fats: 50,  cal: 588 },
  { name: "Sweet Potato",  img: "assets/sweetpotato.png", protein: 1.6, carbs: 20, fats: 0.1, cal: 86 }
];

// User data state
let entries = [];
let targets = {};

// Load user data from server
async function loadUserData() {
  try {
    const resp = await fetch("/get_user_data");
    if (!resp.ok) throw new Error("无法加载用户数据");
    const data = await resp.json();
    entries = data.entries || [];
    targets = data.targets || {};
    if (targets.calories) {
      document.getElementById("target-cal").value   = targets.calories;
      document.getElementById("target-prot").value  = targets.protein;
      document.getElementById("target-carbs").value = targets.carbs;
      document.getElementById("target-fat").value   = targets.fat;
    }
  } catch (err) {
    console.error(err);
  }
}

// Save user data to server
async function saveUserData() {
  try {
    await fetch("/save_user_data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries, targets })
    });
  } catch (err) {
    console.error("保存用户数据失败", err);
  }
}

// Refresh stats page
function refreshIfStatsActive() {
  if (document.getElementById("stats").classList.contains("active")) {
    renderStats();
  }
}

// Navigation toggle
navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b => b.classList.remove("active"));
    sections.forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.section).classList.add("active");
    if (btn.dataset.section === "stats") renderStats();
  });
});

// —— Calculate Targets ——
document.getElementById("calc-btn").addEventListener("click", () => {
  const w = parseFloat(document.getElementById("input-weight").value);
  const g = document.getElementById("input-goal").value;
  suggestedBox.innerHTML = "";
  suggestedBox.classList.remove("hidden");
  if (!w || w <= 0) {
    suggestedBox.innerText = "Please enter a valid body weight.";
    return;
  }
  let prot  = w * 1.8;
  let carbs = w * (g === "gain" ? 4.0 : 2.0);
  let fats  = w * (g === "gain" ? 1.0 : 0.8);
  let cal   = prot * 4 + carbs * 4 + fats * 9;
  [prot, carbs, fats, cal] = [prot, carbs, fats, cal].map(x => Math.round(x));
  suggestedBox.innerHTML = `
    <strong>Based on ${w} kg and <u>${g==="gain"?"Gain Muscle":"Lose Fat"}</u>:</strong><br/>
    • Calories: <strong>${cal} kcal</strong><br/>
    • Protein: <strong>${prot} g</strong><br/>
    • Carbs:   <strong>${carbs} g</strong><br/>
    • Fat:     <strong>${fats} g</strong>
  `;
});

// —— Save Targets ——
document.getElementById("save-btn").addEventListener("click", async () => {
  const c = parseInt(document.getElementById("target-cal").value);
  const p = parseInt(document.getElementById("target-prot").value);
  const b = parseInt(document.getElementById("target-carbs").value);
  const f = parseInt(document.getElementById("target-fat").value);
  saveFeedbackEl.classList.remove("hidden");
  saveFeedbackEl.innerText = "";
  if (isNaN(c)||c<=0||isNaN(p)||p<0||isNaN(b)||b<0||isNaN(f)||f<0) {
    saveFeedbackEl.style.color = "#f44336";
    saveFeedbackEl.innerText = "Please enter valid numeric values for all targets.";
    return;
  }
  targets = { calories: c, protein: p, carbs: b, fat: f };
  await saveUserData();
  saveFeedbackEl.style.color = "#2e7d32";
  saveFeedbackEl.innerText = "Targets saved successfully!";
  refreshIfStatsActive();
});

// Quick Add cards
function renderCards() {
  if (!foodCardsEl) return;
  foodCardsEl.innerHTML = "";
  foods.forEach(f => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<img src="/static/${f.img}" alt="${f.name}"/><span>${f.name}</span>`;
    card.addEventListener("click", () => addEntry(f, 100));
    foodCardsEl.appendChild(card);
  });
}
renderCards();

// Add intake entry
async function addEntry(foodObj, grams) {
  const factor = grams / 100;
  entries.push({
    name:    foodObj.name,
    protein: foodObj.protein * factor,
    carbs:   foodObj.carbs   * factor,
    fats:    foodObj.fats    * factor,
    cal:     foodObj.cal     * factor
  });
  await saveUserData();
  alert(`Added ${grams}g ${foodObj.name}`);
  refreshIfStatsActive();
}

// —— Manual Add ——
if (manualFormEl) {
  manualFormEl.addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("m-name").value.trim();
    const g    = parseFloat(document.getElementById("m-grams").value);
    const pr   = parseFloat(document.getElementById("m-protein").value);
    const cb   = parseFloat(document.getElementById("m-carbs").value);
    const ft   = parseFloat(document.getElementById("m-fats").value);
    const cl   = parseFloat(document.getElementById("m-cal").value);
    const fb   = document.getElementById("manual-feedback");
    fb.classList.remove("hidden"); fb.innerText = "";
    if (!name||isNaN(g)||isNaN(pr)||isNaN(cb)||isNaN(ft)||isNaN(cl)) {
      fb.style.color = "#f44336";
      fb.innerText = "Please fill in all fields correctly.";
      return;
    }
    await addEntry({ name, protein: pr, carbs: cb, fats: ft, cal: cl }, g);
    manualFormEl.reset();
    fb.style.color = "#2e7d32";
    fb.innerText = `Added ${g}g ${name} manually.`;
  });
}

// —— Custom Foods ——
if (customFormEl) {
  customFormEl.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("c-name").value.trim();
    const pr   = parseFloat(document.getElementById("c-protein").value);
    const cb   = parseFloat(document.getElementById("c-carbs").value);
    const ft   = parseFloat(document.getElementById("c-fats").value);
    const cl   = parseFloat(document.getElementById("c-cal").value);
    const fb   = document.getElementById("custom-feedback");
    fb.classList.remove("hidden"); fb.innerText = "";
    if (!name||isNaN(pr)||isNaN(cb)||isNaN(ft)||isNaN(cl)) {
      fb.style.color = "#f44336";
      fb.innerText = "Please fill in all fields correctly.";
      return;
    }
    foods.push({ name, protein: pr, carbs: cb, fats: ft, cal: cl, img: "assets/food.png" });
    renderCards();
    customFormEl.reset();
    fb.style.color = "#2e7d32";
    fb.innerText = `${name} saved to Custom Foods.`;
  });
}

// Draw chart & list
function drawChart(consumedCal, remainingCal) {
  const ctx = chartCanvas.getContext("2d");
  if (window._nutriChartInstance) window._nutriChartInstance.destroy();
  window._nutriChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Consumed", "Remaining"],
      datasets: [{ 
        data: [consumedCal, remainingCal],
        backgroundColor: ["#4caf50", "#ddd"],
        borderWidth: 1
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "Calories Intake vs Target" } } }
  });
}

function drawStatsList(consumed, remaining) {
  let html = "<ul>";
  html += `<li>Calories: ${consumed.cal} / ${targets.calories} kcal ${consumed.cal > targets.calories ? "<span class='unhealthy'>(Over)</span>" : ""}</li>`;
  html += `<li>Protein: ${consumed.protein} / ${targets.protein} g ${consumed.protein < targets.protein ? "<span class='unhealthy'>(Low)</span>" : ""}</li>`;
  html += `<li>Carbs: ${consumed.carbs} / ${targets.carbs} g ${consumed.carbs < targets.carbs ? "<span class='unhealthy'>(Low)</span>" : ""}</li>`;
  html += `<li>Fat: ${consumed.fats} / ${targets.fat} g ${consumed.fats > targets.fat ? "<span class='unhealthy'>(Over)</span>" : ""}</li>`;
  html += "</ul>";
  statsListDiv.innerHTML = html;
}

// Render nutrition stats
function renderStats() {
  statsListDiv.innerHTML = "";
  if (!targets.calories) {
    statsListDiv.style.color = "#f44336";
    statsListDiv.innerText = "Please go to Home and set your daily targets first.";
    return;
  }
  // 1) Calculate totals
  const sum = entries.reduce((acc, e) => {
    acc.protein += e.protein;
    acc.carbs   += e.carbs;
    acc.fats    += e.fats;
    acc.cal     += e.cal;
    return acc;
  }, { protein:0, carbs:0, fats:0, cal:0 });
  const consumed = {
    protein: Math.round(sum.protein),
    carbs:   Math.round(sum.carbs),
    fats:    Math.round(sum.fats),
    cal:     Math.round(sum.cal)
  };
  const remaining = {
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs:   Math.max(0, targets.carbs   - consumed.carbs),
    fats:    Math.max(0, targets.fat     - consumed.fats),
    cal:     Math.max(0, targets.calories- consumed.cal)
  };
  // 2) Chart & list
  drawChart(consumed.cal, remaining.cal);
  drawStatsList(consumed, remaining);
  // 3) Render entries + delete buttons
  entryListUl.innerHTML = "";
  entries.forEach((e, i) => {
    const li = document.createElement("li");
    li.dataset.index = i;
    li.innerHTML = `
      <span>${e.name} (${Math.round(e.protein)}g P, ${Math.round(e.carbs)}g C, ${Math.round(e.fats)}g F, ${Math.round(e.cal)} kcal)</span>
      <button class="delete-entry-btn"><i class="fas fa-trash-alt"></i></button>
    `;
    entryListUl.appendChild(li);
  });
}

// Event delegation: delete entry
entryListUl.addEventListener("click", async e => {
  const btn = e.target.closest(".delete-entry-btn");
  if (!btn) return;
  const idx = Number(btn.closest("li").dataset.index);
  if (!isNaN(idx)) {
    entries.splice(idx, 1);
    await saveUserData();
    renderStats();
  }
});

// Load user data on startup
window.addEventListener("DOMContentLoaded", async () => {
  await loadUserData();
});