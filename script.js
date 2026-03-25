import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY_PREFIX = "flowplan-calendar-v5";
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthShortFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const monthLongFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
});

const today = startOfDay(new Date());
const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

const authShell = document.getElementById("auth-shell");
const appShell = document.getElementById("app-shell");
const configError = document.getElementById("config-error");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authMessage = document.getElementById("auth-message");
const userEmail = document.getElementById("user-email");
const signOutButton = document.getElementById("sign-out-button");
const mainHeading = document.getElementById("main-heading");
const rangeLabel = document.getElementById("range-label");
const viewTitle = document.getElementById("view-title");
const viewSwitcher = document.getElementById("view-switcher");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const todayButton = document.getElementById("today-button");
const jumpToDayButton = document.getElementById("jump-to-day-button");
const currentFocusTitle = document.getElementById("current-focus-title");
const currentFocusMeta = document.getElementById("current-focus-meta");
const singleAddForm = document.getElementById("single-add-form");
const singleTitle = document.getElementById("single-title");
const singleNotes = document.getElementById("single-notes");
const singleDate = document.getElementById("single-date");
const singleHour = document.getElementById("single-hour");
const singleDuration = document.getElementById("single-duration");
const bulkAddForm = document.getElementById("bulk-add-form");
const bulkTitle = document.getElementById("bulk-title");
const bulkNotes = document.getElementById("bulk-notes");
const bulkHour = document.getElementById("bulk-hour");
const bulkDuration = document.getElementById("bulk-duration");
const bulkDayPills = document.getElementById("bulk-day-pills");
const bulkAddPanel = document.getElementById("bulk-add-panel");
const quickAddPanel = document.getElementById("quick-add-panel");
const editorForm = document.getElementById("editor-form");
const editorEmpty = document.getElementById("editor-empty");
const editorTitle = document.getElementById("editor-title");
const editorNotes = document.getElementById("editor-notes");
const editorHour = document.getElementById("editor-hour");
const editorDuration = document.getElementById("editor-duration");
const editorDoing = document.getElementById("editor-doing");
const editorDone = document.getElementById("editor-done");
const deleteEventButton = document.getElementById("delete-event-button");
const dayView = document.getElementById("day-view");
const weekView = document.getElementById("week-view");
const monthView = document.getElementById("month-view");
const eventChipTemplate = document.getElementById("event-chip-template");

let supabase = null;
let state = createDefaultState();
let activeUserId = null;

buildHourSelect(singleHour);
buildHourSelect(bulkHour);
buildHourSelect(editorHour);
buildDurationSelect(singleDuration);
buildDurationSelect(bulkDuration);
buildDurationSelect(editorDuration);
bindEvents();
initializeAuth();

window.addEventListener("error", (event) => {
  showFatalError(event.error?.message || "The app hit an unexpected error while loading.");
});

window.addEventListener("unhandledrejection", (event) => {
  const message =
    event.reason?.message || "The app hit an unexpected async error while loading.";
  showFatalError(message);
});

async function initializeAuth() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      showFatalError(
        "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then reload."
      );
      return;
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    handleSession(session);

    supabase.auth.onAuthStateChange((_event, sessionData) => {
      handleSession(sessionData);
    });
  } catch (error) {
    showFatalError(error?.message || "Supabase failed to initialize.");
  }
}

function showFatalError(message) {
  authShell.classList.remove("hidden");
  appShell.classList.add("hidden");
  configError.classList.remove("hidden");
  configError.textContent = message;
}

function handleSession(session) {
  const user = session?.user || null;

  if (!user) {
    activeUserId = null;
    state = createDefaultState();
    appShell.classList.add("hidden");
    authShell.classList.remove("hidden");
    userEmail.textContent = "";
    authMessage.classList.add("hidden");
    return;
  }

  if (activeUserId !== user.id) {
    activeUserId = user.id;
    state = loadStateForUser(user.id);
    seedStarterEvents();
  }

  userEmail.textContent = user.email || "";
  authShell.classList.add("hidden");
  appShell.classList.remove("hidden");
  render();
}

function createDefaultState() {
  return {
    view: "day",
    currentDate: formatDateKey(today),
    events: [],
    selectedEventId: null,
  };
}

function getStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function loadStateForUser(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw);
    return {
      view: ["day", "week", "month"].includes(parsed.view) ? parsed.view : "day",
      currentDate: parsed.currentDate || formatDateKey(today),
      events: Array.isArray(parsed.events) ? parsed.events : [],
      selectedEventId: parsed.selectedEventId || null,
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  if (!activeUserId) {
    return;
  }

  localStorage.setItem(getStorageKey(activeUserId), JSON.stringify(state));
}

function bindEvents() {
  authForm.addEventListener("submit", handleAuthSubmit);
  signOutButton.addEventListener("click", handleSignOut);

  viewSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) {
      return;
    }

    state.view = button.dataset.view;
    state.selectedEventId = null;
    render();
  });

  prevButton.addEventListener("click", () => shiftRange(-1));
  nextButton.addEventListener("click", () => shiftRange(1));
  todayButton.addEventListener("click", () => {
    state.currentDate = formatDateKey(today);
    render();
  });
  jumpToDayButton.addEventListener("click", () => {
    state.view = "day";
    render();
  });
  singleAddForm.addEventListener("submit", handleSingleAdd);
  bulkAddForm.addEventListener("submit", handleBulkAdd);
  editorForm.addEventListener("submit", handleEditorSave);
  deleteEventButton.addEventListener("click", handleEditorDelete);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authMessage.classList.add("hidden");

  const email = authEmail.value.trim();
  if (!email || !supabase) {
    return;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: siteUrl,
    },
  });

  if (error) {
    authMessage.textContent = error.message;
  } else {
    authMessage.textContent = "Check your email for the sign-in link.";
    authForm.reset();
  }

  authMessage.classList.remove("hidden");
}

async function handleSignOut() {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}

function buildHourSelect(select) {
  select.innerHTML = "";
  for (let hour = 0; hour < 24; hour += 1) {
    const option = document.createElement("option");
    option.value = String(hour);
    option.textContent = formatHour(hour);
    if (hour === new Date().getHours()) {
      option.selected = true;
    }
    select.appendChild(option);
  }
}

function buildDurationSelect(select) {
  select.innerHTML = "";
  for (let duration = 1; duration <= 6; duration += 1) {
    const option = document.createElement("option");
    option.value = String(duration);
    option.textContent = `${duration} hour${duration === 1 ? "" : "s"}`;
    select.appendChild(option);
  }
}

function seedStarterEvents() {
  if (state.events.length > 0) {
    return;
  }

  const todayKey = formatDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  state.events.push(
    createEvent({
      title: "Plan the day",
      notes: "Pick the top things first.",
      dateKey: todayKey,
      startHour: 9,
      duration: 1,
    }),
    createEvent({
      title: "Focused work",
      notes: "Use this block for deep work.",
      dateKey: todayKey,
      startHour: 13,
      duration: 2,
    }),
    createEvent({
      title: "Reset for tomorrow",
      notes: "Review and prep.",
      dateKey: formatDateKey(tomorrow),
      startHour: 20,
      duration: 1,
    })
  );
}

function createEvent({ title, notes, dateKey, startHour, duration }) {
  return {
    id: crypto.randomUUID(),
    title,
    notes,
    dateKey,
    startHour,
    duration,
    doing: false,
    done: false,
  };
}

function handleSingleAdd(event) {
  event.preventDefault();

  const title = singleTitle.value.trim();
  if (!title) {
    return;
  }

  state.events.push(
    createEvent({
      title,
      notes: singleNotes.value.trim(),
      dateKey: singleDate.value,
      startHour: Number(singleHour.value),
      duration: Number(singleDuration.value),
    })
  );

  singleAddForm.reset();
  singleHour.value = String(new Date().getHours());
  singleDuration.value = "1";
  render();
}

function handleBulkAdd(event) {
  event.preventDefault();

  const title = bulkTitle.value.trim();
  const dayKeys = [...bulkDayPills.querySelectorAll("input:checked")].map((input) => input.value);
  if (!title || dayKeys.length === 0) {
    return;
  }

  dayKeys.forEach((dateKey) => {
    state.events.push(
      createEvent({
        title,
        notes: bulkNotes.value.trim(),
        dateKey,
        startHour: Number(bulkHour.value),
        duration: Number(bulkDuration.value),
      })
    );
  });

  bulkAddForm.reset();
  bulkHour.value = String(new Date().getHours());
  bulkDuration.value = "1";
  render();
}

function handleEditorSave(event) {
  event.preventDefault();

  const selected = getSelectedEvent();
  if (!selected) {
    return;
  }

  selected.title = editorTitle.value.trim();
  selected.notes = editorNotes.value.trim();
  selected.startHour = Number(editorHour.value);
  selected.duration = Number(editorDuration.value);
  selected.done = editorDone.checked;

  state.events.forEach((item) => {
    item.doing = editorDoing.checked ? item.id === selected.id : false;
  });

  if (!selected.title) {
    deleteSelectedEvent();
  }

  render();
}

function handleEditorDelete() {
  deleteSelectedEvent();
  render();
}

function deleteSelectedEvent() {
  const id = state.selectedEventId;
  state.events = state.events.filter((event) => event.id !== id);
  state.selectedEventId = null;
}

function shiftRange(step) {
  const current = parseDateKey(state.currentDate);

  if (state.view === "day") {
    current.setDate(current.getDate() + step);
  } else if (state.view === "week") {
    current.setDate(current.getDate() + step * 7);
  } else {
    current.setMonth(current.getMonth() + step, 1);
  }

  state.currentDate = formatDateKey(current);
  render();
}

function render() {
  const activeDate = parseDateKey(state.currentDate);
  renderHeaderLabels(activeDate);
  renderViewSwitcher();
  renderDateOptions();
  renderBulkDayPills();
  renderFocus();
  renderPanels();
  renderDayView(activeDate);
  renderWeekView(activeDate);
  renderMonthView(activeDate);
  renderEditor();
  saveState();
}

function renderHeaderLabels(activeDate) {
  const weekDates = getWeekDates(activeDate);

  if (state.view === "day") {
    mainHeading.textContent = "Today";
    viewTitle.textContent = `${weekdayLabels[activeDate.getDay()]} view`;
    rangeLabel.textContent = `${weekdayLabels[activeDate.getDay()]} ${monthLongFormatter.format(activeDate)}`;
  } else if (state.view === "week") {
    mainHeading.textContent = "Week";
    viewTitle.textContent = "Week view";
    rangeLabel.textContent = `${monthShortFormatter.format(weekDates[0])} - ${monthShortFormatter.format(
      weekDates[6]
    )}`;
  } else {
    mainHeading.textContent = "Month";
    viewTitle.textContent = "Month view";
    rangeLabel.textContent = activeDate.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
}

function renderViewSwitcher() {
  [...viewSwitcher.querySelectorAll("[data-view]")].forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });
}

function renderDateOptions() {
  const activeDate = parseDateKey(state.currentDate);
  const weekDates = getWeekDates(activeDate);
  singleDate.innerHTML = "";

  weekDates.forEach((date) => {
    const option = document.createElement("option");
    option.value = formatDateKey(date);
    option.textContent = `${weekdayLabels[date.getDay()]} ${monthShortFormatter.format(date)}`;
    if (isSameDate(date, activeDate)) {
      option.selected = true;
    }
    singleDate.appendChild(option);
  });
}

function renderBulkDayPills() {
  const activeDate = parseDateKey(state.currentDate);
  const weekDates = getWeekDates(activeDate);
  bulkDayPills.innerHTML = "";

  weekDates.forEach((date) => {
    const label = document.createElement("label");
    label.className = "pill-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = formatDateKey(date);
    if (isSameDate(date, activeDate)) {
      input.checked = true;
    }

    const text = document.createElement("span");
    text.textContent = weekdayLabels[date.getDay()];

    label.append(input, text);
    bulkDayPills.appendChild(label);
  });
}

function renderFocus() {
  const current = state.events.find((event) => event.doing);
  if (!current) {
    currentFocusTitle.textContent = "Nothing checked yet";
    currentFocusMeta.textContent = "Mark an event as your current focus and it will show up here.";
    return;
  }

  const date = parseDateKey(current.dateKey);
  currentFocusTitle.textContent = current.title || "Untitled event";
  currentFocusMeta.textContent = `${weekdayLabels[date.getDay()]} ${monthShortFormatter.format(date)} at ${formatHour(
    current.startHour
  )}${current.notes ? ` • ${current.notes}` : ""}`;
}

function renderPanels() {
  const weekMode = state.view === "week";
  bulkAddPanel.classList.toggle("hidden", !weekMode);
  jumpToDayButton.classList.toggle("hidden", !weekMode);
  quickAddPanel.classList.toggle("hidden", false);
  dayView.classList.toggle("hidden", state.view !== "day");
  weekView.classList.toggle("hidden", state.view !== "week");
  monthView.classList.toggle("hidden", state.view !== "month");
}

function renderDayView(activeDate) {
  dayView.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "day-layout";

  for (let hour = 0; hour < 24; hour += 1) {
    const row = document.createElement("div");
    row.className = "hour-row";
    if (isSameDate(activeDate, today) && hour === new Date().getHours()) {
      row.classList.add("is-now");
    }

    const time = document.createElement("div");
    time.className = "hour-label";
    time.textContent = formatHour(hour);

    const lane = document.createElement("div");
    lane.className = "hour-lane";
    lane.addEventListener("click", () => createAtSlot(formatDateKey(activeDate), hour));

    getEventsForDate(formatDateKey(activeDate))
      .filter((event) => event.startHour === hour)
      .sort(sortEvents)
      .forEach((event) => lane.appendChild(createEventChip(event)));

    row.append(time, lane);
    wrapper.appendChild(row);
  }

  dayView.appendChild(wrapper);
}

function renderWeekView(activeDate) {
  weekView.innerHTML = "";
  const weekDates = getWeekDates(activeDate);

  const header = document.createElement("div");
  header.className = "week-header";
  header.appendChild(document.createElement("div"));

  weekDates.forEach((date) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "week-day-button";
    if (isSameDate(date, activeDate)) {
      button.classList.add("is-selected");
    }
    if (isSameDate(date, today)) {
      button.classList.add("is-today");
    }
    button.innerHTML = `<span>${weekdayLabels[date.getDay()]}</span><strong>${date.getDate()}</strong>`;
    button.addEventListener("click", () => {
      state.currentDate = formatDateKey(date);
      render();
    });
    header.appendChild(button);
  });

  const grid = document.createElement("div");
  grid.className = "week-layout";

  for (let hour = 0; hour < 24; hour += 1) {
    const time = document.createElement("div");
    time.className = "week-time";
    time.textContent = formatHour(hour);
    grid.appendChild(time);

    weekDates.forEach((date) => {
      const cell = document.createElement("div");
      cell.className = "week-cell";
      if (isSameDate(date, today) && hour === new Date().getHours()) {
        cell.classList.add("is-now");
      }
      cell.addEventListener("click", () => createAtSlot(formatDateKey(date), hour));

      getEventsForDate(formatDateKey(date))
        .filter((event) => event.startHour === hour)
        .sort(sortEvents)
        .forEach((event) => cell.appendChild(createEventChip(event)));

      grid.appendChild(cell);
    });
  }

  weekView.append(header, grid);
}

function renderMonthView(activeDate) {
  monthView.innerHTML = "";
  const dates = getMonthGridDates(activeDate);

  const weekdays = document.createElement("div");
  weekdays.className = "month-weekdays";
  weekdayLabels.forEach((label) => {
    const cell = document.createElement("div");
    cell.className = "month-weekday";
    cell.textContent = label;
    weekdays.appendChild(cell);
  });

  const grid = document.createElement("div");
  grid.className = "month-grid";

  dates.forEach((date) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "month-cell";
    if (date.getMonth() !== activeDate.getMonth()) {
      cell.classList.add("is-muted");
    }
    if (isSameDate(date, today)) {
      cell.classList.add("is-today");
    }
    if (isSameDate(date, activeDate)) {
      cell.classList.add("is-selected");
    }

    const dateKey = formatDateKey(date);
    const dayEvents = getEventsForDate(dateKey).sort(sortEvents);
    const dateBadge = document.createElement("span");
    dateBadge.className = "month-date";
    dateBadge.textContent = String(date.getDate());
    cell.appendChild(dateBadge);

    dayEvents.slice(0, 3).forEach((event) => {
      const badge = document.createElement("div");
      badge.className = "month-event";
      badge.textContent = `${formatHour(event.startHour)} ${event.title}`;
      cell.appendChild(badge);
    });

    if (dayEvents.length > 3) {
      const more = document.createElement("div");
      more.className = "month-more";
      more.textContent = `+${dayEvents.length - 3} more`;
      cell.appendChild(more);
    }

    cell.addEventListener("click", () => {
      state.currentDate = dateKey;
      state.view = "day";
      render();
    });

    grid.appendChild(cell);
  });

  monthView.append(weekdays, grid);
}

function createAtSlot(dateKey, hour) {
  const event = createEvent({
    title: "New event",
    notes: "",
    dateKey,
    startHour: hour,
    duration: 1,
  });

  state.events.push(event);
  state.selectedEventId = event.id;
  render();
}

function createEventChip(event) {
  const fragment = eventChipTemplate.content.cloneNode(true);
  const chip = fragment.querySelector(".event-chip");
  const time = fragment.querySelector(".event-chip-time");
  const title = fragment.querySelector(".event-chip-title");
  const notes = fragment.querySelector(".event-chip-notes");

  time.textContent = `${formatHour(event.startHour)} • ${event.duration}h`;
  title.textContent = event.title || "Untitled";
  notes.textContent = event.notes || "";

  chip.classList.toggle("is-doing", event.doing);
  chip.classList.toggle("is-done", event.done);
  chip.classList.toggle("is-selected", state.selectedEventId === event.id);
  chip.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
    state.selectedEventId = event.id;
    render();
  });

  return fragment;
}

function renderEditor() {
  const selected = getSelectedEvent();
  const hasSelected = Boolean(selected);

  editorForm.classList.toggle("hidden", !hasSelected);
  editorEmpty.classList.toggle("hidden", hasSelected);

  if (!selected) {
    return;
  }

  editorTitle.value = selected.title;
  editorNotes.value = selected.notes;
  editorHour.value = String(selected.startHour);
  editorDuration.value = String(selected.duration);
  editorDoing.checked = selected.doing;
  editorDone.checked = selected.done;
}

function getSelectedEvent() {
  return state.events.find((event) => event.id === state.selectedEventId) || null;
}

function getEventsForDate(dateKey) {
  return state.events.filter((event) => event.dateKey === dateKey);
}

function sortEvents(a, b) {
  return a.startHour - b.startHour || a.title.localeCompare(b.title);
}

function getWeekDates(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function getMonthGridDates(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function formatHour(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${suffix}`;
}

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) {
    return rawUrl;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
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
