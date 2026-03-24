const STORAGE_KEY = "flowplan-hourly-calendar-v2";
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const longFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
});
const shortFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const state = loadState();
const today = startOfDay(new Date());

const plannerForm = document.getElementById("planner-form");
const entryTitle = document.getElementById("entry-title");
const entryNotes = document.getElementById("entry-notes");
const entryDay = document.getElementById("entry-day");
const entryHour = document.getElementById("entry-hour");
const weekdayPills = document.getElementById("weekday-pills");
const weekLabel = document.getElementById("week-label");
const sidebarRange = document.getElementById("sidebar-range");
const currentFocusTitle = document.getElementById("current-focus-title");
const currentFocusMeta = document.getElementById("current-focus-meta");
const calendarHeader = document.getElementById("calendar-header");
const timeColumn = document.getElementById("time-column");
const weekGrid = document.getElementById("week-grid");
const prevWeekButton = document.getElementById("prev-week");
const todayWeekButton = document.getElementById("today-week");
const nextWeekButton = document.getElementById("next-week");
const eventCardTemplate = document.getElementById("event-card-template");

let didAutoScroll = false;

buildHourOptions();
bindEvents();
seedStarterEntries();
render();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { weekOffset: 0, entries: {} };
    }

    const parsed = JSON.parse(raw);
    return {
      weekOffset: Number.isInteger(parsed.weekOffset) ? parsed.weekOffset : 0,
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
    };
  } catch {
    return { weekOffset: 0, entries: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  plannerForm.addEventListener("submit", handlePlannerSubmit);
  prevWeekButton.addEventListener("click", () => shiftWeek(-1));
  nextWeekButton.addEventListener("click", () => shiftWeek(1));
  todayWeekButton.addEventListener("click", () => {
    state.weekOffset = 0;
    didAutoScroll = false;
    render();
  });
}

function buildHourOptions() {
  entryHour.innerHTML = "";
  for (let hour = 0; hour < 24; hour += 1) {
    const option = document.createElement("option");
    option.value = String(hour);
    option.textContent = formatHour(hour);
    if (hour === new Date().getHours()) {
      option.selected = true;
    }
    entryHour.appendChild(option);
  }
}

function seedStarterEntries() {
  if (Object.keys(state.entries).length > 0) {
    return;
  }

  const todayKey = formatDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = formatDateKey(tomorrow);

  setEntry(todayKey, 9, {
    title: "Plan the day",
    notes: "Set the 2 or 3 things that matter most.",
    doing: false,
    done: false,
  });

  setEntry(todayKey, 13, {
    title: "Focused work",
    notes: "Keep this block protected.",
    doing: false,
    done: false,
  });

  setEntry(tomorrowKey, 19, {
    title: "Reset for tomorrow",
    notes: "Review and prep the next day.",
    doing: false,
    done: false,
  });

  saveState();
}

function render() {
  const weekDates = getVisibleWeekDates();
  buildWeekdayControls(weekDates);
  renderWeekLabels(weekDates);
  renderHeader(weekDates);
  renderTimeColumn();
  renderGrid(weekDates);
  renderCurrentFocus();
  saveState();
  autoScrollToCurrentHour();
}

function buildWeekdayControls(weekDates) {
  entryDay.innerHTML = "";
  weekdayPills.innerHTML = "";

  weekDates.forEach((date) => {
    const dateKey = formatDateKey(date);

    const option = document.createElement("option");
    option.value = dateKey;
    option.textContent = `${weekdayLabels[date.getDay()]} ${shortFormatter.format(date)}`;
    if (isSameDate(date, today)) {
      option.selected = true;
    }
    entryDay.appendChild(option);

    const label = document.createElement("label");
    label.className = "weekday-pill";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = dateKey;
    if (isSameDate(date, today)) {
      input.checked = true;
    }

    const text = document.createElement("span");
    text.textContent = weekdayLabels[date.getDay()];

    label.append(input, text);
    weekdayPills.appendChild(label);
  });
}

function renderWeekLabels(weekDates) {
  const label = `${longFormatter.format(weekDates[0])} - ${longFormatter.format(weekDates[6])}`;
  weekLabel.textContent = label;
  sidebarRange.textContent = label;
}

function renderHeader(weekDates) {
  calendarHeader.innerHTML = '<div class="time-header"></div>';

  weekDates.forEach((date) => {
    const item = document.createElement("div");
    item.className = "day-header-cell";
    if (isSameDate(date, today)) {
      item.classList.add("is-today");
    }

    item.innerHTML = `<span>${weekdayLabels[date.getDay()]}</span><strong>${date.getDate()}</strong>`;
    calendarHeader.appendChild(item);
  });
}

function renderTimeColumn() {
  timeColumn.innerHTML = "";
  for (let hour = 0; hour < 24; hour += 1) {
    const label = document.createElement("div");
    label.className = "time-slot";
    label.textContent = formatHour(hour);
    timeColumn.appendChild(label);
  }
}

function renderGrid(weekDates) {
  weekGrid.innerHTML = "";

  weekDates.forEach((date) => {
    const column = document.createElement("div");
    column.className = "day-column";
    if (isSameDate(date, today)) {
      column.classList.add("is-today");
    }

    const dateKey = formatDateKey(date);

    for (let hour = 0; hour < 24; hour += 1) {
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      if (isCurrentHour(date, hour)) {
        cell.classList.add("is-now");
      }

      const entry = getEntry(dateKey, hour);
      const fragment = eventCardTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".event-card");
      const hourText = fragment.querySelector(".event-hour");
      const titleInput = fragment.querySelector(".event-title");
      const notesInput = fragment.querySelector(".event-notes");
      const doingToggle = fragment.querySelector(".doing-toggle");
      const doneToggle = fragment.querySelector(".done-toggle");
      const clearButton = fragment.querySelector(".clear-button");

      hourText.textContent = formatHour(hour);
      titleInput.value = entry?.title || "";
      notesInput.value = entry?.notes || "";
      doingToggle.checked = Boolean(entry?.doing);
      doneToggle.checked = Boolean(entry?.done);

      card.classList.toggle("filled", Boolean(entry?.title || entry?.notes));
      card.classList.toggle("doing", Boolean(entry?.doing));
      card.classList.toggle("done", Boolean(entry?.done));

      titleInput.addEventListener("change", () => {
        upsertEntry(dateKey, hour, {
          title: titleInput.value.trim(),
          notes: notesInput.value.trim(),
        });
      });

      notesInput.addEventListener("change", () => {
        upsertEntry(dateKey, hour, {
          title: titleInput.value.trim(),
          notes: notesInput.value.trim(),
        });
      });

      doingToggle.addEventListener("change", () => {
        setDoingEntry(dateKey, hour, doingToggle.checked);
      });

      doneToggle.addEventListener("change", () => {
        toggleDoneEntry(dateKey, hour, doneToggle.checked);
      });

      clearButton.addEventListener("click", () => {
        clearEntry(dateKey, hour);
      });

      cell.appendChild(fragment);
      column.appendChild(cell);
    }

    weekGrid.appendChild(column);
  });
}

function renderCurrentFocus() {
  const current = findDoingEntry();
  if (!current) {
    currentFocusTitle.textContent = "Nothing checked yet";
    currentFocusMeta.textContent = "Mark any calendar block as your current focus.";
    return;
  }

  const day = parseDateKey(current.dateKey);
  currentFocusTitle.textContent = current.entry.title || "Untitled block";
  currentFocusMeta.textContent = `${weekdayLabels[day.getDay()]} ${shortFormatter.format(day)} at ${formatHour(
    current.hour
  )}${current.entry.notes ? ` • ${current.entry.notes}` : ""}`;
}

function handlePlannerSubmit(event) {
  event.preventDefault();

  const title = entryTitle.value.trim();
  const notes = entryNotes.value.trim();
  const hour = Number(entryHour.value);
  const selectedDays = [...weekdayPills.querySelectorAll("input:checked")].map((input) => input.value);
  const targetDays = selectedDays.length ? selectedDays : [entryDay.value];

  if (!title || Number.isNaN(hour)) {
    return;
  }

  targetDays.forEach((dateKey) => {
    const existing = getEntry(dateKey, hour);
    setEntry(dateKey, hour, {
      title,
      notes,
      doing: existing?.doing || false,
      done: existing?.done || false,
    });
  });

  plannerForm.reset();
  entryHour.value = String(new Date().getHours());
  render();
}

function shiftWeek(delta) {
  state.weekOffset += delta;
  didAutoScroll = false;
  render();
}

function upsertEntry(dateKey, hour, partial) {
  const existing = getEntry(dateKey, hour) || {
    title: "",
    notes: "",
    doing: false,
    done: false,
  };

  const next = { ...existing, ...partial };

  if (!next.title && !next.notes && !next.doing && !next.done) {
    deleteEntry(dateKey, hour);
  } else {
    setEntry(dateKey, hour, next);
  }

  render();
}

function setDoingEntry(dateKey, hour, isDoing) {
  Object.keys(state.entries).forEach((storedDateKey) => {
    Object.keys(state.entries[storedDateKey]).forEach((storedHour) => {
      state.entries[storedDateKey][storedHour].doing =
        isDoing && storedDateKey === dateKey && Number(storedHour) === hour;
    });
  });

  if (isDoing && !getEntry(dateKey, hour)) {
    setEntry(dateKey, hour, {
      title: "",
      notes: "",
      doing: true,
      done: false,
    });
  }

  render();
}

function toggleDoneEntry(dateKey, hour, isDone) {
  const existing = getEntry(dateKey, hour) || {
    title: "",
    notes: "",
    doing: false,
    done: false,
  };

  setEntry(dateKey, hour, {
    ...existing,
    done: isDone,
    doing: isDone ? false : existing.doing,
  });

  render();
}

function clearEntry(dateKey, hour) {
  deleteEntry(dateKey, hour);
  render();
}

function getVisibleWeekDates() {
  const base = startOfWeek(today);
  const start = new Date(base);
  start.setDate(base.getDate() + state.weekOffset * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function findDoingEntry() {
  for (const [dateKey, hours] of Object.entries(state.entries)) {
    for (const [hourKey, entry] of Object.entries(hours)) {
      if (entry.doing) {
        return { dateKey, hour: Number(hourKey), entry };
      }
    }
  }
  return null;
}

function autoScrollToCurrentHour() {
  if (didAutoScroll || state.weekOffset !== 0) {
    return;
  }

  const currentCell = weekGrid.querySelector(".calendar-cell.is-now");
  if (currentCell) {
    currentCell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    didAutoScroll = true;
  }
}

function formatHour(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${suffix}`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(date) {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isCurrentHour(date, hour) {
  const now = new Date();
  return isSameDate(date, now) && hour === now.getHours();
}

function getEntry(dateKey, hour) {
  return state.entries[dateKey]?.[hour] || null;
}

function setEntry(dateKey, hour, entry) {
  if (!state.entries[dateKey]) {
    state.entries[dateKey] = {};
  }
  state.entries[dateKey][hour] = entry;
}

function deleteEntry(dateKey, hour) {
  if (!state.entries[dateKey]) {
    return;
  }

  delete state.entries[dateKey][hour];
  if (Object.keys(state.entries[dateKey]).length === 0) {
    delete state.entries[dateKey];
  }
}
