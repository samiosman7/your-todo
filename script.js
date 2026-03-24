const STORAGE_KEY = "flowplan-state-v1";
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const defaultState = {
  tasks: [],
  recurring: [],
};

const state = loadState();

const taskForm = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const notesInput = document.getElementById("task-notes");
const categoryInput = document.getElementById("task-category");
const targetInput = document.getElementById("task-target");
const weekdayPills = document.getElementById("weekday-pills");
const inboxList = document.getElementById("inbox-list");
const todayList = document.getElementById("today-list");
const inboxCount = document.getElementById("inbox-count");
const todayCount = document.getElementById("today-count");
const weekGrid = document.getElementById("week-grid");
const currentFocusTitle = document.getElementById("current-focus-title");
const currentFocusMeta = document.getElementById("current-focus-meta");
const template = document.getElementById("task-card-template");

let dragTaskId = null;

buildWeekdaySelector();
bindEvents();
seedStarterTasks();
render();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultState();
    }

    const parsed = JSON.parse(raw);
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      recurring: Array.isArray(parsed.recurring) ? parsed.recurring : [],
    };
  } catch {
    return cloneDefaultState();
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedStarterTasks() {
  if (state.tasks.length || state.recurring.length) {
    return;
  }

  state.tasks.push(
    createTask({
      title: "Brain dump everything for this week",
      notes: "Start in the inbox, then drag the most important items into Today.",
      category: "Setup",
      lane: "inbox",
    }),
    createTask({
      title: "Pick the top 3 things to finish today",
      notes: "You can drag this above or below anything in your Today list.",
      category: "Focus",
      lane: "today",
    })
  );

  state.recurring.push({
    id: crypto.randomUUID(),
    title: "Daily review",
    notes: "Check what is done, move unfinished work, and reset tomorrow.",
    category: "Routine",
    days: [1, 2, 3, 4, 5],
  });

  saveState();
}

function buildWeekdaySelector() {
  weekdayLabels.forEach((label, dayIndex) => {
    const wrapper = document.createElement("label");
    wrapper.className = "weekday-pill";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(dayIndex);

    const text = document.createElement("span");
    text.textContent = label;

    wrapper.append(checkbox, text);
    weekdayPills.appendChild(wrapper);
  });
}

function bindEvents() {
  taskForm.addEventListener("submit", handleTaskSubmit);

  todayList.addEventListener("dragover", handleTodayDragOver);
  todayList.addEventListener("drop", handleTodayDrop);

  inboxList.addEventListener("dragover", (event) => event.preventDefault());
  inboxList.addEventListener("drop", handleInboxDrop);
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const notes = notesInput.value.trim();
  const category = categoryInput.value.trim();
  const lane = targetInput.value;
  const selectedDays = getSelectedDays();

  if (!title) {
    return;
  }

  state.tasks.unshift(
    createTask({
      title,
      notes,
      category,
      lane,
    })
  );

  if (selectedDays.length) {
    state.recurring.unshift({
      id: crypto.randomUUID(),
      title,
      notes,
      category,
      days: selectedDays,
    });
  }

  taskForm.reset();
  saveState();
  render();
}

function getSelectedDays() {
  return [...weekdayPills.querySelectorAll("input:checked")].map((input) =>
    Number(input.value)
  );
}

function createTask({ title, notes, category, lane }) {
  return {
    id: crypto.randomUUID(),
    title,
    notes,
    category,
    lane,
    doing: false,
    done: false,
  };
}

function render() {
  renderTasks();
  renderCurrentFocus();
  renderRecurringWeek();
  saveState();
}

function renderTasks() {
  const inboxTasks = state.tasks.filter((task) => task.lane === "inbox");
  const todayTasks = state.tasks.filter((task) => task.lane === "today");

  renderLane(inboxList, inboxTasks, "Drop tasks here to keep them in the inbox.");
  renderLane(todayList, todayTasks, "Your Today lane is empty. Drag a task here.");

  inboxCount.textContent = `${inboxTasks.length} task${inboxTasks.length === 1 ? "" : "s"}`;
  todayCount.textContent = `${todayTasks.length} planned`;
}

function renderLane(container, tasks, emptyMessage) {
  container.innerHTML = "";

  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  tasks.forEach((task) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".task-card");
    const category = fragment.querySelector(".task-category");
    const title = fragment.querySelector(".task-title");
    const notes = fragment.querySelector(".task-notes");
    const doingCheckbox = fragment.querySelector(".doing-checkbox");
    const doneCheckbox = fragment.querySelector(".done-checkbox");
    const moveButton = fragment.querySelector(".move-button");
    const deleteButton = fragment.querySelector(".delete-button");
    const doingLabel = fragment.querySelector(".check-chip");

    card.dataset.taskId = task.id;
    card.classList.toggle("doing", task.doing);
    card.classList.toggle("done", task.done);

    category.textContent = task.category || "General";
    title.textContent = task.title;
    notes.textContent = task.notes || "No extra notes";
    doingCheckbox.checked = task.doing;
    doneCheckbox.checked = task.done;
    doingCheckbox.disabled = task.lane !== "today";
    doingLabel.title = task.lane === "today" ? "Mark as your current focus" : "Move this task to Today before starting it";

    moveButton.textContent =
      task.lane === "today" ? "Send to inbox" : "Send to today";

    card.addEventListener("dragstart", () => {
      dragTaskId = task.id;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      dragTaskId = null;
    });

    doingCheckbox.addEventListener("change", () => setDoingTask(task.id, doingCheckbox.checked));
    doneCheckbox.addEventListener("change", () => toggleDone(task.id, doneCheckbox.checked));
    moveButton.addEventListener("click", () => moveTask(task.id, task.lane === "today" ? "inbox" : "today"));
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    container.appendChild(fragment);
  });
}

function setDoingTask(taskId, isDoing) {
  state.tasks.forEach((task) => {
    task.doing = isDoing ? task.id === taskId : false;
  });

  render();
}

function toggleDone(taskId, isDone) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  task.done = isDone;
  if (isDone) {
    task.doing = false;
  }

  render();
}

function moveTask(taskId, lane) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  task.lane = lane;
  if (lane !== "today") {
    task.doing = false;
  }

  render();
}

function deleteTask(taskId) {
  const index = state.tasks.findIndex((task) => task.id === taskId);
  if (index === -1) {
    return;
  }

  state.tasks.splice(index, 1);
  render();
}

function handleInboxDrop(event) {
  event.preventDefault();
  if (!dragTaskId) {
    return;
  }

  moveTask(dragTaskId, "inbox");
}

function handleTodayDrop(event) {
  event.preventDefault();
  if (!dragTaskId) {
    return;
  }

  const targetCard = event.target.closest(".task-card");
  const draggedTask = state.tasks.find((task) => task.id === dragTaskId);
  if (!draggedTask) {
    return;
  }

  draggedTask.lane = "today";

  const todayTasks = state.tasks.filter((task) => task.lane === "today" && task.id !== dragTaskId);
  const otherTasks = state.tasks.filter((task) => task.lane !== "today");

  if (!targetCard) {
    todayTasks.push(draggedTask);
  } else {
    const targetId = targetCard.dataset.taskId;
    const insertIndex = todayTasks.findIndex((task) => task.id === targetId);
    if (insertIndex === -1) {
      todayTasks.push(draggedTask);
    } else {
      todayTasks.splice(insertIndex, 0, draggedTask);
    }
  }

  state.tasks = [...otherTasks, ...todayTasks];
  render();
}

function handleTodayDragOver(event) {
  event.preventDefault();
}

function renderCurrentFocus() {
  const currentTask = state.tasks.find((task) => task.doing);
  if (!currentTask) {
    currentFocusTitle.textContent = "Nothing checked yet";
    currentFocusMeta.textContent = "Check “Currently doing” on any task in Today to pin it here.";
    return;
  }

  currentFocusTitle.textContent = currentTask.title;
  currentFocusMeta.textContent = currentTask.notes || `${currentTask.category || "General"} task in your Today lane.`;
}

function renderRecurringWeek() {
  weekGrid.innerHTML = "";

  const today = new Date();
  const days = getCurrentWeek(today);

  days.forEach((date) => {
    const dayIndex = date.getDay();
    const items = state.recurring.filter((item) => item.days.includes(dayIndex));
    const column = document.createElement("section");
    column.className = "day-column";
    if (isSameDate(today, date)) {
      column.classList.add("is-today");
    }

    const header = document.createElement("div");
    header.className = "day-header";
    header.innerHTML = `<strong>${weekdayLabels[dayIndex]}</strong><span>${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}</span>`;
    column.appendChild(header);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nothing repeating here yet.";
      column.appendChild(empty);
    } else {
      items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "repeat-chip";
        card.innerHTML = `<strong>${item.title}</strong><p>${item.notes || item.category || "Recurring item"}</p>`;
        column.appendChild(card);
      });
    }

    weekGrid.appendChild(column);
  });
}

function getCurrentWeek(baseDate) {
  const sunday = new Date(baseDate);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(baseDate.getDate() - baseDate.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    return date;
  });
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
