const MUSCLE_GROUPS = [
  "chest", "back", "biceps", "triceps", "shoulders", "forearms", "abs", "quads", "hamstrings", "calves", "misc"
];

const STORAGE_KEY = "gym-log-v2";
const DEFAULT_ACCENT = "#3adb7a";

const state = {
  activeView: "calendar",
  monthCursor: new Date(),
  selectedDate: isoDate(new Date()),
  openGroups: new Set(),
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
  });

  weightInput.addEventListener("input", (event) => {
    ensureDay(state.selectedDate).muscles[group][exIndex].sets[setIndex].weight = event.target.value;
    saveData();
    renderPRs();
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
  const summary = document.getElementById("progressSummary");
  const monthly = new Map();

  Object.entries(state.data.workouts).forEach(([date]) => {
    if (!hasLoggedExercise(date)) return;
    const d = new Date(`${date}T00:00:00`);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly.set(key, (monthly.get(key) || 0) + 1);
  });

  const entries = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])).reverse();
  if (entries.length === 0) {
    summary.innerHTML = '<p class="section-subtle">No workout data yet.</p>';
    return;
  }

  summary.innerHTML = "";
  entries.forEach(([month, count]) => {
    const row = document.createElement("div");
    row.className = "progress-item";
    row.innerHTML = `
      <strong>${formatMonth(month)}</strong>
      <div>${count} workout day${count === 1 ? "" : "s"}</div>
      <div class="progress-meta">Logged days with at least one exercise</div>
      <div class="progress-meta">${Math.min(100, count * 5)}% consistency score</div>
    `;
    summary.appendChild(row);
  });
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

function formatMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
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
