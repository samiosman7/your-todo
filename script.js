import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY_PREFIX = "flowplan-calendar-v7";
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthShortFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthLongFormatter = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" });

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
const googleSignInButton = document.getElementById("google-sign-in-button");
const userEmail = document.getElementById("user-email");
const signOutButton = document.getElementById("sign-out-button");
const mainHeading = document.getElementById("main-heading");
const rangeLabel = document.getElementById("range-label");
const viewTitle = document.getElementById("view-title");
const viewSwitcher = document.getElementById("view-switcher");
const themeSelect = document.getElementById("theme-select");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const todayButton = document.getElementById("today-button");
const jumpToDayButton = document.getElementById("jump-to-day-button");
const currentFocusTitle = document.getElementById("current-focus-title");
const currentFocusMeta = document.getElementById("current-focus-meta");
const blockTemplates = [...document.querySelectorAll(".block-template")];
const singleAddForm = document.getElementById("single-add-form");
const singleTitle = document.getElementById("single-title");
const singleNotes = document.getElementById("single-notes");
const singleDate = document.getElementById("single-date");
const singleTime = document.getElementById("single-time");
const singleEndTime = document.getElementById("single-end-time");
const singleStartAfterButton = document.getElementById("single-start-after");
const bulkAddForm = document.getElementById("bulk-add-form");
const bulkTitle = document.getElementById("bulk-title");
const bulkNotes = document.getElementById("bulk-notes");
const bulkTime = document.getElementById("bulk-time");
const bulkEndTime = document.getElementById("bulk-end-time");
const bulkDayPills = document.getElementById("bulk-day-pills");
const bulkAddPanel = document.getElementById("bulk-add-panel");
const bulkStartAfterButton = document.getElementById("bulk-start-after");
const editorForm = document.getElementById("editor-form");
const editorEmpty = document.getElementById("editor-empty");
const editorTitle = document.getElementById("editor-title");
const editorNotes = document.getElementById("editor-notes");
const editorTime = document.getElementById("editor-time");
const editorEndTime = document.getElementById("editor-end-time");
const editorDoing = document.getElementById("editor-doing");
const editorDone = document.getElementById("editor-done");
const duplicateEventButton = document.getElementById("duplicate-event-button");
const deleteEventButton = document.getElementById("delete-event-button");
const nowView = document.getElementById("now-view");
const nowEditToggle = document.getElementById("now-edit-toggle");
const nowSummaryTitle = document.getElementById("now-summary-title");
const nowSummaryTime = document.getElementById("now-summary-time");
const nowSummaryNotes = document.getElementById("now-summary-notes");
const nowSummaryEmpty = document.getElementById("now-summary-empty");
const nowInlineEditor = document.getElementById("now-inline-editor");
const nowEditTitle = document.getElementById("now-edit-title");
const nowEditNotes = document.getElementById("now-edit-notes");
const nowEditTime = document.getElementById("now-edit-time");
const nowEditEndTime = document.getElementById("now-edit-end-time");
const nowEditDoing = document.getElementById("now-edit-doing");
const nowEditDone = document.getElementById("now-edit-done");
const nowEditSave = document.getElementById("now-edit-save");
const nowSchedulePanel = document.getElementById("now-schedule-panel");
const nowScheduleList = document.getElementById("now-schedule-list");
const dayView = document.getElementById("day-view");
const weekView = document.getElementById("week-view");
const monthView = document.getElementById("month-view");
const eventChipTemplate = document.getElementById("event-chip-template");

let supabase = null;
let state = createDefaultState();
let activeUserId = null;
let draggedItem = null;

[singleTime, singleEndTime, bulkTime, bulkEndTime, editorTime, editorEndTime, nowEditTime, nowEditEndTime].forEach(buildTimeSelect);
bindEvents();
initializeAuth();

window.addEventListener("error", (event) => showFatalError(event.error?.message || "The app hit an unexpected error while loading."));
window.addEventListener("unhandledrejection", (event) => showFatalError(event.reason?.message || "The app hit an unexpected async error while loading."));

async function initializeAuth() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      showFatalError("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then reload.");
      return;
    }
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { session } } = await supabase.auth.getSession();
    handleSession(session);
    supabase.auth.onAuthStateChange((_event, sessionData) => handleSession(sessionData));
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

function createDefaultState() {
  return {
    view: "day",
    theme: "classic",
    currentDate: formatDateKey(today),
    nowEditing: false,
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
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return {
      view: ["now", "day", "week", "month"].includes(parsed.view) ? parsed.view : "day",
      theme: ["classic", "midnight", "obsidian", "paper"].includes(parsed.theme) ? parsed.theme : "classic",
      currentDate: parsed.currentDate || formatDateKey(today),
      nowEditing: Boolean(parsed.nowEditing),
      events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent) : [],
      selectedEventId: parsed.selectedEventId || null,
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  if (activeUserId) localStorage.setItem(getStorageKey(activeUserId), JSON.stringify(state));
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

function bindEvents() {
  authForm.addEventListener("submit", handleAuthSubmit);
  googleSignInButton.addEventListener("click", handleGoogleSignIn);
  signOutButton.addEventListener("click", handleSignOut);
  themeSelect.addEventListener("change", () => {
    state.theme = themeSelect.value;
    applyTheme();
    saveState();
  });
  viewSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
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
  singleTime.addEventListener("change", syncSingleEndMinimum);
  bulkTime.addEventListener("change", syncBulkEndMinimum);
  editorTime.addEventListener("change", syncEditorEndMinimum);
  nowEditTime.addEventListener("change", syncNowEndMinimum);
  singleStartAfterButton.addEventListener("click", () => {
    const start = findNextStartMinute(singleDate.value);
    singleTime.value = String(start);
    singleEndTime.value = String(defaultEndMinute(start));
  });
  bulkStartAfterButton.addEventListener("click", () => {
    const dayKeys = [...bulkDayPills.querySelectorAll("input:checked")].map((input) => input.value);
    if (!dayKeys.length) return;
    const start = Math.max(...dayKeys.map(findNextStartMinute));
    bulkTime.value = String(start);
    bulkEndTime.value = String(defaultEndMinute(start));
  });
  blockTemplates.forEach((template) => {
    template.addEventListener("dragstart", () => {
      draggedItem = {
        type: "block",
        duration: Number(template.dataset.blockDuration),
        title: template.dataset.blockTitle || "New block",
      };
      template.classList.add("is-dragging");
    });
    template.addEventListener("dragend", () => {
      draggedItem = null;
      template.classList.remove("is-dragging");
      document.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    });
  });
  editorForm.addEventListener("submit", handleEditorSave);
  duplicateEventButton.addEventListener("click", handleDuplicateEvent);
  deleteEventButton.addEventListener("click", () => {
    deleteSelectedEvent();
    render();
  });
  nowEditToggle.addEventListener("click", () => {
    state.nowEditing = !state.nowEditing;
    render();
  });
  nowEditSave.addEventListener("click", handleNowSave);
}
async function handleAuthSubmit(event) {
  event.preventDefault();
  authMessage.classList.add("hidden");
  const email = authEmail.value.trim();
  if (!email || !supabase) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: siteUrl } });
  authMessage.textContent = error ? error.message : "Check your email for the sign-in link.";
  if (!error) authForm.reset();
  authMessage.classList.remove("hidden");
}

async function handleGoogleSignIn() {
  if (!supabase) return;
  authMessage.classList.add("hidden");
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: siteUrl } });
  if (error) {
    authMessage.textContent = error.message;
    authMessage.classList.remove("hidden");
  }
}

async function handleSignOut() {
  if (supabase) await supabase.auth.signOut();
}

function buildTimeSelect(select) {
  if (!select) return;
  select.innerHTML = "";
  for (let minute = 0; minute < 1440; minute += 5) {
    const option = document.createElement("option");
    option.value = String(minute);
    option.textContent = formatMinuteOfDay(minute);
    if (minute === roundToStep(currentMinuteOfDay(), 5)) option.selected = true;
    select.appendChild(option);
  }
}

function normalizeEvent(event) {
  const startMinute = typeof event.startMinute === "number" ? event.startMinute : (event.startHour || 9) * 60;
  const endMinute = typeof event.endMinute === "number"
    ? event.endMinute
    : typeof event.durationMinutes === "number"
      ? startMinute + event.durationMinutes
      : startMinute + (event.duration || 1) * 60;
  return {
    id: event.id || crypto.randomUUID(),
    title: event.title || "",
    notes: event.notes || "",
    dateKey: event.dateKey || formatDateKey(today),
    startMinute,
    endMinute: normalizeEndMinute(startMinute, endMinute),
    doing: Boolean(event.doing),
    done: Boolean(event.done),
  };
}

function seedStarterEvents() {
  if (state.events.length) return;
  const todayKey = formatDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  state.events.push(
    createEvent({ title: "Plan the day", notes: "Pick the top things first.", dateKey: todayKey, startMinute: 540, endMinute: 585 }),
    createEvent({ title: "Focused work", notes: "Use this block for deep work.", dateKey: todayKey, startMinute: 795, endMinute: 885 }),
    createEvent({ title: "Reset for tomorrow", notes: "Review and prep.", dateKey: formatDateKey(tomorrow), startMinute: 1200, endMinute: 1230 })
  );
}

function createEvent({ title, notes, dateKey, startMinute, endMinute }) {
  return { id: crypto.randomUUID(), title, notes, dateKey, startMinute, endMinute: normalizeEndMinute(startMinute, endMinute), doing: false, done: false };
}

function handleSingleAdd(event) {
  event.preventDefault();
  const title = singleTitle.value.trim();
  if (!title) return;
  const startMinute = Number(singleTime.value);
  const endMinute = normalizeEndMinute(startMinute, Number(singleEndTime.value));
  state.events.push(createEvent({ title, notes: singleNotes.value.trim(), dateKey: singleDate.value, startMinute, endMinute }));
  singleAddForm.reset();
  resetSingleForm();
  render();
}

function handleBulkAdd(event) {
  event.preventDefault();
  const title = bulkTitle.value.trim();
  const dayKeys = [...bulkDayPills.querySelectorAll("input:checked")].map((input) => input.value);
  if (!title || !dayKeys.length) return;
  const startMinute = Number(bulkTime.value);
  const endMinute = normalizeEndMinute(startMinute, Number(bulkEndTime.value));
  dayKeys.forEach((dateKey) => {
    state.events.push(createEvent({ title, notes: bulkNotes.value.trim(), dateKey, startMinute, endMinute }));
  });
  bulkAddForm.reset();
  render();
}

function handleEditorSave(event) {
  event.preventDefault();
  const selected = getSelectedEvent();
  if (!selected) return;
  selected.title = editorTitle.value.trim();
  selected.notes = editorNotes.value.trim();
  selected.startMinute = Number(editorTime.value);
  selected.endMinute = normalizeEndMinute(selected.startMinute, Number(editorEndTime.value));
  selected.done = editorDone.checked;
  state.events.forEach((item) => { item.doing = editorDoing.checked ? item.id === selected.id : false; });
  if (!selected.title) deleteSelectedEvent();
  render();
}

function handleDuplicateEvent() {
  const selected = getSelectedEvent();
  if (!selected) return;
  const offset = 5;
  const copyStart = Math.min(selected.startMinute + offset, 1435);
  const copyEnd = normalizeEndMinute(copyStart, Math.min(selected.endMinute + offset, 1435));
  const copy = { ...selected, id: crypto.randomUUID(), title: `${selected.title} copy`, startMinute: copyStart, endMinute: copyEnd, doing: false, done: false };
  state.events.push(copy);
  state.selectedEventId = copy.id;
  render();
}

function handleNowSave() {
  const activeDate = parseDateKey(state.currentDate);
  const editable = getCurrentTask(activeDate) || getSelectedEvent() || getNextTask(activeDate);
  if (!editable) return;
  editable.title = nowEditTitle.value.trim();
  editable.notes = nowEditNotes.value.trim();
  editable.startMinute = Number(nowEditTime.value);
  editable.endMinute = normalizeEndMinute(editable.startMinute, Number(nowEditEndTime.value));
  editable.done = nowEditDone.checked;
  state.events.forEach((entry) => { entry.doing = nowEditDoing.checked ? entry.id === editable.id : false; });
  render();
}

function deleteSelectedEvent() {
  state.events = state.events.filter((entry) => entry.id !== state.selectedEventId);
  state.selectedEventId = null;
}

function shiftRange(step) {
  const current = parseDateKey(state.currentDate);
  if (state.view === "day" || state.view === "now") current.setDate(current.getDate() + step);
  else if (state.view === "week") current.setDate(current.getDate() + step * 7);
  else current.setMonth(current.getMonth() + step, 1);
  state.currentDate = formatDateKey(current);
  render();
}

function render() {
  const activeDate = parseDateKey(state.currentDate);
  applyTheme();
  renderHeaderLabels(activeDate);
  renderViewSwitcher();
  renderDateOptions();
  renderBulkDayPills();
  renderFocus();
  renderPanels();
  renderDayView(activeDate);
  renderWeekView(activeDate);
  renderMonthView(activeDate);
  renderNowView(activeDate);
  renderEditor();
  saveState();
}
function applyTheme() {
  document.body.dataset.theme = state.theme || "classic";
  themeSelect.value = state.theme || "classic";
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
    rangeLabel.textContent = `${monthShortFormatter.format(weekDates[0])} - ${monthShortFormatter.format(weekDates[6])}`;
  } else if (state.view === "month") {
    mainHeading.textContent = "Month";
    viewTitle.textContent = "Month view";
    rangeLabel.textContent = activeDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } else {
    mainHeading.textContent = "Now";
    viewTitle.textContent = "Current task";
    rangeLabel.textContent = `${weekdayLabels[activeDate.getDay()]} ${monthLongFormatter.format(activeDate)}`;
  }
}

function renderViewSwitcher() {
  [...viewSwitcher.querySelectorAll("[data-view]")].forEach((button) => button.classList.toggle("is-active", button.dataset.view === state.view));
}

function renderDateOptions() {
  const activeDate = parseDateKey(state.currentDate);
  const weekDates = getWeekDates(activeDate);
  singleDate.innerHTML = "";
  weekDates.forEach((date) => {
    const option = document.createElement("option");
    option.value = formatDateKey(date);
    option.textContent = `${weekdayLabels[date.getDay()]} ${monthShortFormatter.format(date)}`;
    option.selected = isSameDate(date, activeDate);
    singleDate.appendChild(option);
  });
  resetSingleForm();
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
    input.checked = isSameDate(date, activeDate);
    const text = document.createElement("span");
    text.textContent = weekdayLabels[date.getDay()];
    label.append(input, text);
    bulkDayPills.appendChild(label);
  });
  const start = roundToStep(currentMinuteOfDay(), 5);
  bulkTime.value = String(start);
  bulkEndTime.value = String(defaultEndMinute(start));
}

function renderFocus() {
  const current = state.events.find((entry) => entry.doing);
  if (!current) {
    currentFocusTitle.textContent = "Nothing checked yet";
    currentFocusMeta.textContent = "Mark an event as your current focus and it will show up here.";
    return;
  }
  const date = parseDateKey(current.dateKey);
  currentFocusTitle.textContent = current.title || "Untitled event";
  currentFocusMeta.textContent = `${weekdayLabels[date.getDay()]} ${monthShortFormatter.format(date)} at ${formatMinuteOfDay(current.startMinute)}-${formatMinuteOfDay(current.endMinute)}${current.notes ? ` • ${current.notes}` : ""}`;
}

function renderPanels() {
  bulkAddPanel.classList.toggle("hidden", state.view !== "week");
  jumpToDayButton.classList.toggle("hidden", state.view !== "week");
  dayView.classList.toggle("hidden", state.view !== "day");
  weekView.classList.toggle("hidden", state.view !== "week");
  monthView.classList.toggle("hidden", state.view !== "month");
  nowView.classList.toggle("hidden", state.view !== "now");
}

function renderDayView(activeDate) {
  dayView.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "day-layout";
  const dateKey = formatDateKey(activeDate);
  for (let hour = 0; hour < 24; hour += 1) {
    const row = document.createElement("div");
    row.className = "hour-row";
    if (isSameDate(activeDate, today) && hour === new Date().getHours()) row.classList.add("is-now");
    const time = document.createElement("div");
    time.className = "hour-label";
    time.textContent = formatHour(hour);
    const lane = document.createElement("div");
    lane.className = "hour-lane";
    lane.addEventListener("dragover", (event) => handleSlotDragOver(event, lane));
    lane.addEventListener("dragleave", () => lane.classList.remove("is-drop-target"));
    lane.addEventListener("drop", (event) => handleSlotDrop(event, dateKey, hour * 60, lane));
    getEventsForDate(dateKey).filter((entry) => Math.floor(entry.startMinute / 60) === hour).sort(sortEvents).forEach((entry) => lane.appendChild(createEventChip(entry)));
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
    if (isSameDate(date, activeDate)) button.classList.add("is-selected");
    if (isSameDate(date, today)) button.classList.add("is-today");
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
      const dateKey = formatDateKey(date);
      const cell = document.createElement("div");
      cell.className = "week-cell";
      if (isSameDate(date, today) && hour === new Date().getHours()) cell.classList.add("is-now");
      cell.addEventListener("dragover", (event) => handleSlotDragOver(event, cell));
      cell.addEventListener("dragleave", () => cell.classList.remove("is-drop-target"));
      cell.addEventListener("drop", (event) => handleSlotDrop(event, dateKey, hour * 60, cell));
      getEventsForDate(dateKey).filter((entry) => Math.floor(entry.startMinute / 60) === hour).sort(sortEvents).forEach((entry) => cell.appendChild(createEventChip(entry)));
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
    if (date.getMonth() !== activeDate.getMonth()) cell.classList.add("is-muted");
    if (isSameDate(date, today)) cell.classList.add("is-today");
    if (isSameDate(date, activeDate)) cell.classList.add("is-selected");
    const dateKey = formatDateKey(date);
    const badge = document.createElement("span");
    badge.className = "month-date";
    badge.textContent = String(date.getDate());
    cell.appendChild(badge);
    getEventsForDate(dateKey).sort(sortEvents).slice(0, 3).forEach((entry) => {
      const item = document.createElement("div");
      item.className = "month-event";
      item.textContent = `${formatMinuteOfDay(entry.startMinute)} ${entry.title}`;
      cell.appendChild(item);
    });
    const overflow = getEventsForDate(dateKey).length - 3;
    if (overflow > 0) {
      const more = document.createElement("div");
      more.className = "month-more";
      more.textContent = `+${overflow} more`;
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

function renderNowView(activeDate) {
  const current = getCurrentTask(activeDate);
  const selected = getSelectedEvent();
  const editable = current || selected || getNextTask(activeDate) || null;
  nowEditToggle.textContent = state.nowEditing ? "Close editing mode" : "Edit schedule";
  nowInlineEditor.classList.toggle("hidden", !state.nowEditing || !editable);
  nowSchedulePanel.classList.toggle("hidden", !state.nowEditing);
  if (!current) {
    nowSummaryTitle.textContent = "Nothing scheduled right now";
    nowSummaryTime.textContent = `${weekdayLabels[activeDate.getDay()]} ${monthLongFormatter.format(activeDate)}`;
    const next = getNextTask(activeDate);
    nowSummaryNotes.textContent = next ? `Next up: ${next.title} at ${formatMinuteOfDay(next.startMinute)}` : "Your schedule will adapt here as soon as you add tasks.";
    nowSummaryEmpty.classList.remove("hidden");
  } else {
    nowSummaryTitle.textContent = current.title || "Untitled event";
    nowSummaryTime.textContent = `${formatMinuteOfDay(current.startMinute)} - ${formatMinuteOfDay(current.endMinute)}`;
    nowSummaryNotes.textContent = current.notes || "No extra notes for this task.";
    nowSummaryEmpty.classList.add("hidden");
  }
  if (editable) {
    nowEditTitle.value = editable.title;
    nowEditNotes.value = editable.notes;
    nowEditTime.value = String(editable.startMinute);
    nowEditEndTime.value = String(editable.endMinute);
    nowEditDoing.checked = editable.doing;
    nowEditDone.checked = editable.done;
    syncNowEndMinimum();
  }
  renderNowSchedule(activeDate, current, selected);
}

function renderNowSchedule(activeDate, current, selected) {
  nowScheduleList.innerHTML = "";
  const dateKey = formatDateKey(activeDate);
  const entries = getEventsForDate(dateKey).sort(sortEvents);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "subtle";
    empty.textContent = "No tasks scheduled for this day yet.";
    nowScheduleList.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "now-schedule-item";
    if (current?.id === entry.id) button.classList.add("is-current");
    if (selected?.id === entry.id) button.classList.add("is-selected");
    button.innerHTML = `<strong>${entry.title || "Untitled event"}</strong><span>${formatMinuteOfDay(entry.startMinute)} - ${formatMinuteOfDay(entry.endMinute)}</span>`;
    button.addEventListener("click", () => {
      state.selectedEventId = entry.id;
      render();
    });
    nowScheduleList.appendChild(button);
  });
}

function getCurrentTask(activeDate = today) {
  const dateKey = formatDateKey(activeDate);
  const minute = currentMinuteOfDay();
  return getEventsForDate(dateKey).sort(sortEvents).find((entry) => minute >= entry.startMinute && minute < entry.endMinute) || null;
}

function getNextTask(activeDate = today) {
  const dateKey = formatDateKey(activeDate);
  const minute = currentMinuteOfDay();
  return getEventsForDate(dateKey).sort(sortEvents).find((entry) => entry.startMinute > minute) || null;
}

function createAtSlot(dateKey, startMinute) {
  const entry = createEvent({ title: "New event", notes: "", dateKey, startMinute, endMinute: defaultEndMinute(startMinute) });
  state.events.push(entry);
  state.selectedEventId = entry.id;
  render();
}

function createBlockAtSlot(dateKey, startMinute, duration, title) {
  const entry = createEvent({
    title: title || "New block",
    notes: "",
    dateKey,
    startMinute,
    endMinute: normalizeEndMinute(startMinute, startMinute + duration),
  });
  state.events.push(entry);
  state.selectedEventId = entry.id;
  render();
}

function createEventChip(entry) {
  const fragment = eventChipTemplate.content.cloneNode(true);
  const chip = fragment.querySelector(".event-chip");
  fragment.querySelector(".event-chip-time").textContent = `${formatMinuteOfDay(entry.startMinute)} - ${formatMinuteOfDay(entry.endMinute)}`;
  fragment.querySelector(".event-chip-title").textContent = entry.title || "Untitled";
  fragment.querySelector(".event-chip-notes").textContent = entry.notes || "";
  chip.classList.toggle("is-doing", entry.doing);
  chip.classList.toggle("is-done", entry.done);
  chip.classList.toggle("is-selected", state.selectedEventId === entry.id);
  chip.draggable = true;
  chip.addEventListener("dragstart", () => {
    draggedItem = { type: "event", id: entry.id };
    chip.classList.add("is-dragging");
  });
  chip.addEventListener("dragend", () => {
    draggedItem = null;
    chip.classList.remove("is-dragging");
    document.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
  });
  chip.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
    state.selectedEventId = entry.id;
    render();
  });
  return fragment;
}

function renderEditor() {
  const selected = getSelectedEvent();
  editorForm.classList.toggle("hidden", !selected);
  editorEmpty.classList.toggle("hidden", Boolean(selected));
  if (!selected) return;
  editorTitle.value = selected.title;
  editorNotes.value = selected.notes;
  editorTime.value = String(selected.startMinute);
  editorEndTime.value = String(selected.endMinute);
  editorDoing.checked = selected.doing;
  editorDone.checked = selected.done;
  syncEditorEndMinimum();
}
function getSelectedEvent() {
  return state.events.find((entry) => entry.id === state.selectedEventId) || null;
}

function getEventsForDate(dateKey) {
  return state.events.filter((entry) => entry.dateKey === dateKey);
}

function sortEvents(a, b) {
  return a.startMinute - b.startMinute || a.title.localeCompare(b.title);
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

function handleSlotDragOver(event, element) {
  if (!draggedItem) return;
  event.preventDefault();
  element.classList.add("is-drop-target");
}

function handleSlotDrop(event, dateKey, startMinute, element) {
  if (!draggedItem) return;
  event.preventDefault();
  element.classList.remove("is-drop-target");
  if (draggedItem.type === "block") {
    createBlockAtSlot(dateKey, startMinute, draggedItem.duration, draggedItem.title);
    return;
  }
  const dragged = state.events.find((item) => item.id === draggedItem.id);
  if (!dragged) return;
  const length = dragged.endMinute - dragged.startMinute;
  dragged.dateKey = dateKey;
  dragged.startMinute = startMinute;
  dragged.endMinute = normalizeEndMinute(startMinute, startMinute + length);
  state.selectedEventId = dragged.id;
  render();
}

function findNextStartMinute(dateKey) {
  const entries = getEventsForDate(dateKey);
  if (!entries.length) return roundToStep(currentMinuteOfDay(), 5);
  const latest = Math.max(...entries.map((entry) => entry.endMinute));
  return Math.min(roundToStep(latest, 5), 1435);
}

function syncSingleEndMinimum() {
  singleEndTime.value = String(normalizeEndMinute(Number(singleTime.value), Number(singleEndTime.value || defaultEndMinute(Number(singleTime.value)))));
}

function syncBulkEndMinimum() {
  bulkEndTime.value = String(normalizeEndMinute(Number(bulkTime.value), Number(bulkEndTime.value || defaultEndMinute(Number(bulkTime.value)))));
}

function syncEditorEndMinimum() {
  editorEndTime.value = String(normalizeEndMinute(Number(editorTime.value), Number(editorEndTime.value || defaultEndMinute(Number(editorTime.value)))));
}

function syncNowEndMinimum() {
  nowEditEndTime.value = String(normalizeEndMinute(Number(nowEditTime.value), Number(nowEditEndTime.value || defaultEndMinute(Number(nowEditTime.value)))));
}

function defaultEndMinute(startMinute) {
  return normalizeEndMinute(startMinute, startMinute + 60);
}

function normalizeEndMinute(startMinute, endMinute) {
  const safeStart = clampMinute(startMinute);
  const safeEnd = clampMinute(endMinute);
  return safeEnd <= safeStart ? Math.min(safeStart + 5, 1435) : safeEnd;
}

function clampMinute(value) {
  return Math.max(0, Math.min(1435, Number.isFinite(value) ? value : 0));
}

function resetSingleForm() {
  const start = roundToStep(currentMinuteOfDay(), 5);
  if (singleTime) singleTime.value = String(start);
  if (singleEndTime) singleEndTime.value = String(defaultEndMinute(start));
}

function formatHour(hour) {
  return formatMinuteOfDay(hour * 60);
}

function formatMinuteOfDay(totalMinutes) {
  const safe = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function currentMinuteOfDay() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
