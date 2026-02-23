const MUSCLE_GROUPS = [
  "chest", "back", "biceps", "triceps", "shoulders", "forearms", "abs", "quads", "hamstrings", "calves", "misc"
];

const STORAGE_KEY = "gym-log-v1";

const state = {
  monthCursor: new Date(),
  selectedDate: isoDate(new Date()),
  data: loadData()
};

const monthLabel = document.getElementById("monthLabel");
const grid = document.getElementById("calendarGrid");
const dayPanel = document.getElementById("dayPanel");

document.getElementById("prevMonth").addEventListener("click", () => {
  state.monthCursor.setMonth(state.monthCursor.getMonth() - 1);
  render();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  state.monthCursor.setMonth(state.monthCursor.getMonth() + 1);
  render();
});

render();

function loadData() {
  const fallbackCatalog = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, []]));
  try {
    const fromStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      workouts: fromStorage.workouts || {},
      catalog: { ...fallbackCatalog, ...(fromStorage.catalog || {}) }
    };
  } catch {
    return { workouts: {}, catalog: fallbackCatalog };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  renderCalendar();
}

function render() {
  renderCalendar();
  renderDayPanel();
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
    if (state.data.workouts[dateId]) btn.classList.add("has-data");
    if (state.selectedDate === dateId) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      state.selectedDate = dateId;
      state.monthCursor = new Date(current.getFullYear(), current.getMonth(), 1);
      render();
    });

    grid.appendChild(btn);
  }
}

function renderDayPanel() {
  const entry = ensureDay(state.selectedDate);
  const selected = new Date(`${state.selectedDate}T00:00:00`);
  dayPanel.classList.remove("hidden");

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

    const remove = document.createElement("button");
    remove.className = "small-danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      ensureDay(state.selectedDate).muscles[group].splice(exIndex, 1);
      saveData();
      renderDayPanel();
    });
    head.appendChild(remove);
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
  `;

  const [repsInput, weightInput] = row.querySelectorAll("input");

  repsInput.addEventListener("input", (event) => {
    ensureDay(state.selectedDate).muscles[group][exIndex].sets[setIndex].reps = event.target.value;
    saveData();
  });

  weightInput.addEventListener("input", (event) => {
    ensureDay(state.selectedDate).muscles[group][exIndex].sets[setIndex].weight = event.target.value;
    saveData();
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
    saveData();
    renderDayPanel();
    cleanup();
  });

  document.body.appendChild(fragment);
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
