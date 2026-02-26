const MUSCLE_GROUPS = [
  "chest", "back", "biceps", "triceps", "shoulders", "forearms", "abs", "quads", "hamstrings", "calves", "misc"
];

const STORAGE_KEY = "gym-log-v2";
const DEFAULT_ACCENT = "#3adb7a";
const REP_COLOR = "#32e875";
const WEIGHT_COLOR = "#f8be35";

const state = {
  activeView: "calendar",
  monthCursor: new Date(),
  selectedDate: isoDate(new Date()),
  openGroups: new Set(),
  progressOpenGroups: new Set(),
  progress: {
    selectedGroup: null,
    selectedExercise: null,
    range: "month",
    mode: "all",
    customStart: "",
    customEnd: "",
    selectedPointKey: ""
  },
  data: loadData()
};

const monthLabel = document.getElementById("monthLabel");
const grid = document.getElementById("calendarGrid");
const dayPanel = document.getElementById("dayPanel");
const highlightColorInput = document.getElementById("highlightColor");

const viewNodes = {
  calendar: document.getElementById("viewCalendar"),
  settings: document.getElementById("viewSettings"),
  prs: document.getElementById("viewPRs"),
  progress: document.getElementById("viewProgress")
};

document.getElementById("menuButton").addEventListener("click", openMenu);
document.getElementById("prevMonth").addEventListener("click", () => {
  state.monthCursor.setMonth(state.monthCursor.getMonth() - 1);
  renderCalendar();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  state.monthCursor.setMonth(state.monthCursor.getMonth() + 1);
  renderCalendar();
});

highlightColorInput.value = state.data.settings.highlightColor;
highlightColorInput.addEventListener("input", (event) => {
  state.data.settings.highlightColor = event.target.value;
  applyTheme();
  saveData();
});

applyTheme();
render();

function loadData() {
  const fallbackCatalog = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, []]));
  try {
    const fromStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      workouts: fromStorage.workouts || {},
      catalog: { ...fallbackCatalog, ...(fromStorage.catalog || {}) },
      settings: {
        highlightColor: fromStorage.settings?.highlightColor || DEFAULT_ACCENT
      }
    };
  } catch {
    return {
      workouts: {},
      catalog: fallbackCatalog,
      settings: { highlightColor: DEFAULT_ACCENT }
    };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  renderCalendar();
}

function applyTheme() {
  const accent = state.data.settings.highlightColor || DEFAULT_ACCENT;
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-soft", darkenHex(accent, 0.45));
}

function render() {
  setView(state.activeView);
  renderCalendar();
  renderDayPanel();
  renderPRs();
  renderProgress();
}

function setView(viewName) {
  state.activeView = viewName;
  Object.entries(viewNodes).forEach(([name, node]) => {
    node.classList.toggle("hidden", name !== viewName);
  });
}

function openMenu() {
  const fragment = document.getElementById("menuTemplate").content.cloneNode(true);
  const overlay = fragment.querySelector("#menuOverlay");
  const closeMenu = () => overlay.remove();

  fragment.querySelector("#closeMenu").addEventListener("click", closeMenu);
  fragment.querySelectorAll("button[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
      if (state.activeView === "calendar") {
        renderCalendar();
        renderDayPanel();
      } else if (state.activeView === "prs") {
        renderPRs();
      } else if (state.activeView === "progress") {
        renderProgress();
      }
      closeMenu();
    });
  });

  document.body.appendChild(fragment);
}

function renderCalendar() {
  const view = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth(), 1);
  monthLabel.textContent = view.toLocaleString(undefined, { month: "long", year: "numeric" });

  const firstDisplayDay = new Date(view);
  firstDisplayDay.setDate(1 - firstDisplayDay.getDay());

  grid.innerHTML = "";
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(firstDisplayDay);
    current.setDate(firstDisplayDay.getDate() + i);
    const dateId = isoDate(current);

    const btn = document.createElement("button");
    btn.className = "day-btn";
    btn.textContent = String(current.getDate());
    if (current.getMonth() !== view.getMonth()) btn.classList.add("outside");
    if (hasLoggedExercise(dateId)) btn.classList.add("has-data");
    if (state.selectedDate === dateId) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      state.selectedDate = dateId;
      state.monthCursor = new Date(current.getFullYear(), current.getMonth(), 1);
      setView("calendar");
      renderCalendar();
      renderDayPanel();
    });

    grid.appendChild(btn);
  }
}

function renderDayPanel() {
  const entry = ensureDay(state.selectedDate);
  const selected = new Date(`${state.selectedDate}T00:00:00`);

  dayPanel.innerHTML = `
    <h2 class="day-title">${selected.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</h2>
    <textarea class="note-box" id="dayNotes" placeholder="Notes about your workout...">${escapeHtml(entry.notes)}</textarea>
    <section id="muscleContainer"></section>
  `;

  dayPanel.querySelector("#dayNotes").addEventListener("input", (event) => {
    ensureDay(state.selectedDate).notes = event.target.value;
    saveData();
  });

  const container = dayPanel.querySelector("#muscleContainer");

  MUSCLE_GROUPS.forEach((group) => {
    const section = document.createElement("article");
    section.className = "muscle-group";
    const isOpen = state.openGroups.has(group);

    section.innerHTML = `
      <button class="muscle-header" type="button">
        <span>${group}</span>
        <span>${isOpen ? "▴" : "▾"}</span>
      </button>
      <div class="muscle-content ${isOpen ? "" : "hidden-content"}"></div>
    `;

    const header = section.querySelector(".muscle-header");
    const caret = header.querySelector("span:last-child");
    const content = section.querySelector(".muscle-content");

    header.addEventListener("click", () => {
      if (state.openGroups.has(group)) {
        state.openGroups.delete(group);
        caret.textContent = "▾";
        content.classList.add("hidden-content");
      } else {
        state.openGroups.add(group);
        caret.textContent = "▴";
        content.classList.remove("hidden-content");
      }
    });

    content.appendChild(renderMuscleContent(group, entry.muscles[group]));
    container.appendChild(section);
  });
}

function renderMuscleContent(group, exercises) {
  const wrapper = document.createElement("div");
  const addRow = document.createElement("div");
  addRow.className = "add-row";
  const addButton = document.createElement("button");
  addButton.className = "plus";
  addButton.textContent = "+ Add exercise";
  addButton.addEventListener("click", () => openExerciseModal(group));
  addRow.appendChild(addButton);
  wrapper.appendChild(addRow);

  exercises.forEach((exercise, exIndex) => {
    const card = document.createElement("article");
    card.className = "exercise-card";

    const head = document.createElement("div");
    head.className = "exercise-head";
    head.innerHTML = `<strong>${escapeHtml(exercise.name)}</strong>`;

    const removeExercise = document.createElement("button");
    removeExercise.className = "small-danger";
    removeExercise.textContent = "Remove";
    removeExercise.addEventListener("click", () => {
      ensureDay(state.selectedDate).muscles[group].splice(exIndex, 1);
      saveData();
      renderDayPanel();
      renderPRs();
      renderProgress();
    });
    head.appendChild(removeExercise);
    card.appendChild(head);

    exercise.sets.forEach((set, setIndex) => {
      card.appendChild(renderSetRow(group, exIndex, set, setIndex));
    });

    const plusSet = document.createElement("button");
    plusSet.textContent = "+ Set";
    plusSet.className = "plus";
    plusSet.addEventListener("click", () => {
      ensureDay(state.selectedDate).muscles[group][exIndex].sets.push({ reps: "", weight: "" });
      saveData();
      renderDayPanel();
      renderPRs();
      renderProgress();
    });
    card.appendChild(plusSet);

    wrapper.appendChild(card);
  });

  return wrapper;
}

function renderSetRow(group, exIndex, set, setIndex) {
  const row = document.createElement("div");
  row.className = "set-row";
  row.innerHTML = `
    <span>#${setIndex + 1}</span>
    <label>Reps <input type="number" min="0" inputmode="numeric" value="${escapeAttribute(set.reps)}"></label>
    <label>Weight <input type="number" min="0" step="0.5" inputmode="decimal" value="${escapeAttribute(set.weight)}"></label>
    <button class="mini-danger" aria-label="Remove set">−</button>
  `;

  const [repsInput, weightInput] = row.querySelectorAll("input");
  const removeSetButton = row.querySelector("button");

  repsInput.addEventListener("input", (event) => {
    ensureDay(state.selectedDate).muscles[group][exIndex].sets[setIndex].reps = event.target.value;
    saveData();
    renderPRs();
    renderProgress();
  });

  weightInput.addEventListener("input", (event) => {
    ensureDay(state.selectedDate).muscles[group][exIndex].sets[setIndex].weight = event.target.value;
    saveData();
    renderPRs();
    renderProgress();
  });

  removeSetButton.addEventListener("click", () => {
    ensureDay(state.selectedDate).muscles[group][exIndex].sets.splice(setIndex, 1);
    saveData();
    renderDayPanel();
    renderPRs();
    renderProgress();
  });

  return row;
}

function openExerciseModal(group) {
  const fragment = document.getElementById("addExerciseTemplate").content.cloneNode(true);
  const overlay = fragment.querySelector(".overlay");
  const select = fragment.querySelector("#existingExercise");
  const newNameInput = fragment.querySelector("#newExerciseName");

  const options = state.data.catalog[group];
  select.innerHTML = `<option value="">Select existing...</option>${options
    .map((item) => `<option value="${escapeAttribute(item)}">${escapeHtml(item)}</option>`)
    .join("")}`;

  const cleanup = () => overlay.remove();

  fragment.querySelector("#cancelAdd").addEventListener("click", cleanup);
  fragment.querySelector("#confirmAdd").addEventListener("click", () => {
    const picked = newNameInput.value.trim() || select.value.trim();
    if (!picked) return;

    if (!state.data.catalog[group].some((name) => name.toLowerCase() === picked.toLowerCase())) {
      state.data.catalog[group].push(picked);
    }

    ensureDay(state.selectedDate).muscles[group].push({ name: picked, sets: [] });
    state.openGroups.add(group);
    saveData();
    renderDayPanel();
    renderPRs();
    renderProgress();
    cleanup();
  });

  document.body.appendChild(fragment);
}

function renderPRs() {
  const container = document.getElementById("prContainer");
  container.innerHTML = "";
  const records = buildPRRecords();

  MUSCLE_GROUPS.forEach((group) => {
    const section = document.createElement("article");
    section.className = "muscle-group";
    section.innerHTML = `
      <button class="muscle-header" type="button">
        <span>${group}</span>
        <span>▾</span>
      </button>
      <div class="muscle-content hidden-content"></div>
    `;

    const header = section.querySelector(".muscle-header");
    const content = section.querySelector(".muscle-content");

    header.addEventListener("click", () => {
      content.classList.toggle("hidden-content");
      header.querySelector("span:last-child").textContent = content.classList.contains("hidden-content") ? "▾" : "▴";
    });

    const groupRecords = records[group];
    if (groupRecords.length === 0) {
      content.innerHTML = '<p class="section-subtle">No records yet.</p>';
    } else {
      groupRecords
        .sort((a, b) => a.exercise.localeCompare(b.exercise))
        .forEach((item) => {
          const card = document.createElement("div");
          card.className = "pr-item";
          card.innerHTML = `
            <strong>${escapeHtml(item.exercise)}</strong>
            <div>${item.weight} lb × ${item.reps} rep${Number(item.reps) === 1 ? "" : "s"}</div>
            <div class="pr-meta">${formatDate(item.date)}</div>
            <div class="pr-meta">Best set</div>
          `;
          content.appendChild(card);
        });
    }

    container.appendChild(section);
  });
}

function buildPRRecords() {
  const grouped = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, []]));
  const index = new Map();

  Object.entries(state.data.workouts).forEach(([date, day]) => {
    MUSCLE_GROUPS.forEach((group) => {
      (day.muscles[group] || []).forEach((exercise) => {
        exercise.sets.forEach((set) => {
          const weight = Number(set.weight);
          const reps = Number(set.reps);
          if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) return;

          const key = `${group}::${exercise.name.toLowerCase()}`;
          const existing = index.get(key);
          if (!existing || weight > existing.weight || (weight === existing.weight && reps > existing.reps)) {
            index.set(key, { group, exercise: exercise.name, weight, reps, date });
          }
        });
      });
    });
  });

  index.forEach((value) => grouped[value.group].push(value));
  return grouped;
}

function renderProgress() {
  const root = document.getElementById("progressRoot");
  if (!state.progress.selectedGroup || !state.progress.selectedExercise) {
    renderProgressExercisePicker(root);
    return;
  }
  renderProgressExerciseDetail(root);
}

function renderProgressExercisePicker(root) {
  root.innerHTML = "";
  const byGroup = getExerciseIndexByGroup();

  MUSCLE_GROUPS.forEach((group) => {
    const exercises = byGroup[group];
    if (exercises.length === 0) return;

    const section = document.createElement("article");
    section.className = "muscle-group";
    const isOpen = state.progressOpenGroups.has(group);

    section.innerHTML = `
      <button class="muscle-header" type="button">
        <span>${group}</span>
        <span>${isOpen ? "▴" : "▾"}</span>
      </button>
      <div class="muscle-content ${isOpen ? "" : "hidden-content"}"></div>
    `;

    const header = section.querySelector(".muscle-header");
    const caret = header.querySelector("span:last-child");
    const content = section.querySelector(".muscle-content");

    header.addEventListener("click", () => {
      const open = state.progressOpenGroups.has(group);
      if (open) {
        state.progressOpenGroups.delete(group);
        caret.textContent = "▾";
        content.classList.add("hidden-content");
      } else {
        state.progressOpenGroups.add(group);
        caret.textContent = "▴";
        content.classList.remove("hidden-content");
      }
    });

    exercises.sort((a, b) => a.localeCompare(b)).forEach((exerciseName) => {
      const button = document.createElement("button");
      button.className = "progress-exercise-item";
      button.textContent = exerciseName;
      button.addEventListener("click", () => {
        state.progress.selectedGroup = group;
        state.progress.selectedExercise = exerciseName;
        renderProgress();
      });
      content.appendChild(button);
    });

    root.appendChild(section);
  });

  if (!root.innerHTML.trim()) {
    root.innerHTML = '<p class="section-subtle">No exercise sets logged yet.</p>';
  }
}

function renderProgressExerciseDetail(root) {
  const points = getExercisePoints(state.progress.selectedGroup, state.progress.selectedExercise);
  const filtered = filterPointsByCurrentProgressOptions(points);

  if (!state.progress.selectedPointKey && filtered.length > 0) {
    state.progress.selectedPointKey = pointKey(filtered[filtered.length - 1]);
  }
  if (filtered.length > 0 && !filtered.some((point) => pointKey(point) === state.progress.selectedPointKey)) {
    state.progress.selectedPointKey = pointKey(filtered[filtered.length - 1]);
  }

  root.innerHTML = `
    <div class="progress-head-row">
      <button id="progressBack" class="ghost">← Back</button>
      <div>
        <strong>${escapeHtml(state.progress.selectedExercise)}</strong>
        <div class="progress-meta">${state.progress.selectedGroup}</div>
      </div>
    </div>
    <div class="chip-row" id="rangeChips"></div>
    <div id="customRangeRow" class="custom-range-row ${state.progress.range === "custom" ? "" : "hidden"}">
      <label>From <input type="date" id="customStart" value="${state.progress.customStart}"></label>
      <label>To <input type="date" id="customEnd" value="${state.progress.customEnd}"></label>
    </div>
    <div class="chip-row" id="modeChips"></div>
    <div class="chart-legend">
      <span><i class="dot rep"></i>Reps</span>
      <span><i class="dot weight"></i>Weight (lb)</span>
    </div>
    <div id="chartHost"></div>
  `;

  root.querySelector("#progressBack").addEventListener("click", () => {
    state.progress.selectedGroup = null;
    state.progress.selectedExercise = null;
    state.progress.selectedPointKey = "";
    renderProgress();
  });

  renderChipRow(root.querySelector("#rangeChips"), ["week", "month", "year", "custom"], state.progress.range, (value) => {
    state.progress.range = value;
    renderProgress();
  });

  renderChipRow(root.querySelector("#modeChips"), ["all", "heaviest"], state.progress.mode, (value) => {
    state.progress.mode = value;
    renderProgress();
  });

  const customStart = root.querySelector("#customStart");
  const customEnd = root.querySelector("#customEnd");
  if (customStart && customEnd) {
    customStart.addEventListener("change", (event) => {
      state.progress.customStart = event.target.value;
      renderProgress();
    });
    customEnd.addEventListener("change", (event) => {
      state.progress.customEnd = event.target.value;
      renderProgress();
    });
  }

  const host = root.querySelector("#chartHost");
  if (filtered.length === 0) {
    host.innerHTML = '<p class="section-subtle">No sets available for this range.</p>';
    return;
  }

  const selectedPoint = filtered.find((point) => pointKey(point) === state.progress.selectedPointKey) || filtered[filtered.length - 1];
  host.insertAdjacentHTML("beforeend", `<p id="progressPointSummary" class="section-subtle">${formatPointSummary(selectedPoint)}</p>`);
  host.appendChild(buildTrendChart(filtered, state.progress.selectedPointKey, (point) => {
    state.progress.selectedPointKey = pointKey(point);
    const summary = root.querySelector("#progressPointSummary");
    if (summary) summary.textContent = formatPointSummary(point);
  }));
}

function renderChipRow(container, values, active, onClick) {
  values.forEach((value) => {
    const button = document.createElement("button");
    button.className = `chip ${value === active ? "active" : ""}`;
    button.textContent = value[0].toUpperCase() + value.slice(1);
    button.addEventListener("click", () => onClick(value));
    container.appendChild(button);
  });
}

function getExerciseIndexByGroup() {
  const grouped = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, new Set()]));
  Object.values(state.data.workouts).forEach((day) => {
    MUSCLE_GROUPS.forEach((group) => {
      (day.muscles[group] || []).forEach((exercise) => {
        if (exercise.sets.some((set) => Number(set.weight) > 0 || Number(set.reps) > 0)) {
          grouped[group].add(exercise.name);
        }
      });
    });
  });
  return Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, [...grouped[group]] ]));
}

function getExercisePoints(group, exerciseName) {
  const points = [];
  Object.entries(state.data.workouts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([date, day]) => {
      (day.muscles[group] || []).forEach((exercise) => {
        if (exercise.name.toLowerCase() !== exerciseName.toLowerCase()) return;
        exercise.sets.forEach((set, index) => {
          const weight = Number(set.weight);
          const reps = Number(set.reps);
          if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) return;
          points.push({ date, setIndex: index + 1, reps, weight });
        });
      });
    });
  return points;
}

function filterPointsByCurrentProgressOptions(points) {
  const rangeFiltered = points.filter((point) => inCurrentRange(point.date));
  if (state.progress.mode === "all") return rangeFiltered;

  const byDate = new Map();
  rangeFiltered.forEach((point) => {
    const existing = byDate.get(point.date);
    if (!existing || point.weight > existing.weight || (point.weight === existing.weight && point.reps > existing.reps)) {
      byDate.set(point.date, point);
    }
  });

  return [...byDate.values()].sort((a, b) => {
    if (a.date === b.date) return a.setIndex - b.setIndex;
    return a.date.localeCompare(b.date);
  });
}

function inCurrentRange(dateId) {
  const d = new Date(`${dateId}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (state.progress.range === "custom") {
    if (!state.progress.customStart || !state.progress.customEnd) return true;
    const start = new Date(`${state.progress.customStart}T00:00:00`);
    const end = new Date(`${state.progress.customEnd}T00:00:00`);
    return d >= start && d <= end;
  }

  const start = new Date(today);
  if (state.progress.range === "week") {
    start.setDate(today.getDate() - 7);
  } else if (state.progress.range === "month") {
    start.setMonth(today.getMonth() - 1);
  } else {
    start.setFullYear(today.getFullYear() - 1);
  }
  return d >= start && d <= today;
}

function buildTrendChart(points, selectedKey, onPointSelect) {
  const width = 360;
  const height = 260;
  const pad = 24;

  const maxRep = Math.max(...points.map((p) => p.reps));
  const minRep = Math.min(...points.map((p) => p.reps));
  const maxWeight = Math.max(...points.map((p) => p.weight));
  const minWeight = Math.min(...points.map((p) => p.weight));

  const xAt = (i) => (points.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (points.length - 1));
  const yRep = (value) => mapRange(value, minRep, maxRep, height / 2 - 10, pad);
  const yWeight = (value) => mapRange(value, minWeight, maxWeight, height - pad, height / 2 + 14);

  let grid = "";
  for (let i = 0; i < points.length; i += 1) {
    const x = xAt(i);
    grid += `<line x1="${x}" y1="${pad}" x2="${x}" y2="${height - pad}" class="chart-grid"/>`;
  }

  const repPath = points.map((p, i) => `${xAt(i)},${yRep(p.reps)}`).join(" ");
  const weightPath = points.map((p, i) => `${xAt(i)},${yWeight(p.weight)}`).join(" ");

  const dots = points.map((p, i) => {
    const active = pointKey(p) === selectedKey;
    return `
      <circle data-series="rep" data-index="${i}" cx="${xAt(i)}" cy="${yRep(p.reps)}" r="${active ? 4.5 : 3}" class="chart-dot ${active ? "active" : ""}" fill="${REP_COLOR}"></circle>
      <circle data-series="weight" data-index="${i}" cx="${xAt(i)}" cy="${yWeight(p.weight)}" r="${active ? 4.5 : 3}" class="chart-dot ${active ? "active" : ""}" fill="${WEIGHT_COLOR}"></circle>
    `;
  }).join("");

  const labels = points.map((p, i) => `<text x="${xAt(i)}" y="${height - 5}" class="chart-label">${shortDate(p.date)} · S${p.setIndex}</text>`).join("");

  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  wrap.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="Reps and weight trend chart">
      ${grid}
      <line x1="${pad}" y1="${height / 2}" x2="${width - pad}" y2="${height / 2}" class="chart-mid"/>
      <polyline points="${repPath}" fill="none" stroke="${REP_COLOR}" stroke-width="2"></polyline>
      <polyline points="${weightPath}" fill="none" stroke="${WEIGHT_COLOR}" stroke-width="2"></polyline>
      ${dots}
      ${labels}
      <text x="8" y="16" class="chart-axis">Reps</text>
      <text x="8" y="${height / 2 + 16}" class="chart-axis">Weight</text>
    </svg>
  `;

  wrap.querySelectorAll('.chart-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const point = points[Number(dot.dataset.index)];
      onPointSelect(point);
      wrap.querySelectorAll('.chart-dot').forEach((node) => {
        node.classList.remove('active');
        node.setAttribute('r', '3');
      });
      const pointIndex = dot.dataset.index;
      wrap.querySelectorAll(`.chart-dot[data-index="${pointIndex}"]`).forEach((node) => {
        node.classList.add('active');
        node.setAttribute('r', '4.5');
      });
    });
  });

  return wrap;
}

function mapRange(value, min, max, start, end) {
  if (min === max) return (start + end) / 2;
  const ratio = (value - min) / (max - min);
  return start + ratio * (end - start);
}


function pointKey(point) {
  return `${point.date}|${point.setIndex}|${point.reps}|${point.weight}`;
}

function formatPointSummary(point) {
  return `Selected: ${point.reps} reps · ${point.weight} lb · ${formatDate(point.date)} (Set ${point.setIndex})`;
}

function shortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function hasLoggedExercise(dateId) {
  const day = state.data.workouts[dateId];
  if (!day) return false;
  return MUSCLE_GROUPS.some((group) => (day.muscles[group] || []).some((exercise) => exercise.sets.length > 0));
}

function ensureDay(dateId) {
  if (!state.data.workouts[dateId]) {
    state.data.workouts[dateId] = {
      notes: "",
      muscles: Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, []]))
    };
  }
  return state.data.workouts[dateId];
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString();
}

function darkenHex(hex, amount) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#1e7a45";
  const r = Math.max(0, Math.floor(parseInt(clean.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(clean.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(clean.slice(4, 6), 16) * (1 - amount)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value ?? "");
}
