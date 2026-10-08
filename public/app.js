const taskForm = document.getElementById('taskForm');
const taskTitleInput = document.getElementById('taskTitle');
const taskPrioritySelect = document.getElementById('taskPriority');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const pendingCount = document.getElementById('pendingCount');
const completedCount = document.getElementById('completedCount');
const toggleCompletedBtn = document.getElementById('toggleCompletedBtn');
const hiddenDoneCount = document.getElementById('hiddenDoneCount');

const USER_STORAGE_KEY = 'taskManagerUser';

function getCurrentUserId() {
  const saved = localStorage.getItem(USER_STORAGE_KEY);
  if (saved && saved.trim()) {
    return saved.trim();
  }
  const defaultUser = 'noam';
  localStorage.setItem(USER_STORAGE_KEY, defaultUser);
  return defaultUser;
}

let currentUserId = getCurrentUserId();
let allTasks = [];
let showCompleted = false; // Default: hide done tasks

function updateUserBadge() {
  const currentUserNameEl = document.getElementById('currentUserName');
  if (currentUserNameEl) {
    currentUserNameEl.textContent = currentUserId;
  }
}

function switchUser() {
  const input = window.prompt('Enter username or identifier:', currentUserId);
  if (input !== null && input.trim() && input.trim() !== currentUserId) {
    currentUserId = input.trim();
    localStorage.setItem(USER_STORAGE_KEY, currentUserId);
    updateUserBadge();
    fetchTasks();
  }
}

async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks', {
      headers: { 'X-User-Id': currentUserId },
    });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    allTasks = await res.json();
    renderTasks(allTasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
  }
}

function updateStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;

  totalCount.textContent = total;
  pendingCount.textContent = pending;
  completedCount.textContent = completed;

  if (toggleCompletedBtn) {
    if (showCompleted) {
      toggleCompletedBtn.textContent = 'Hide done';
      toggleCompletedBtn.classList.add('active');
      toggleCompletedBtn.setAttribute('aria-pressed', 'true');
    } else {
      toggleCompletedBtn.innerHTML = `Show done (${completed})`;
      toggleCompletedBtn.classList.remove('active');
      toggleCompletedBtn.setAttribute('aria-pressed', 'false');
    }
  }
}

function renderTasks(tasks) {
  allTasks = tasks;
  updateStats(tasks);
  taskList.innerHTML = '';

  const completed = tasks.filter((t) => t.completed).length;
  const visibleTasks = showCompleted ? tasks : tasks.filter((t) => !t.completed);

  if (visibleTasks.length === 0) {
    emptyState.hidden = false;
    const titleEl = emptyState.querySelector('.empty-title');
    const subEl = emptyState.querySelector('.empty-sub');
    if (tasks.length === 0) {
      if (titleEl) titleEl.textContent = 'All tasks done!';
      if (subEl) subEl.textContent = 'Add a new task above with its priority to get started.';
    } else {
      if (titleEl) titleEl.textContent = 'No pending tasks!';
      if (subEl) subEl.textContent = `${completed} completed task${completed === 1 ? '' : 's'} hidden. Click 'Show done' to view them.`;
    }
    return;
  }

  emptyState.hidden = true;

  visibleTasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.dataset.id = task.id;

    const priorityClass = `badge-${task.priority.toLowerCase()}`;

    li.innerHTML = `
      <div class="task-left">
        <input
          type="checkbox"
          class="task-checkbox"
          ${task.completed ? 'checked' : ''}
          aria-label="Mark task '${escapeHtml(task.title)}' as ${task.completed ? 'incomplete' : 'done'}"
          title="${task.completed ? 'Mark as incomplete' : 'Mark as done'}"
        />
        <span class="task-title">${escapeHtml(task.title)}</span>
      </div>
      <div class="task-right">
        <select
          class="priority-select ${priorityClass}"
          aria-label="Change priority for task '${escapeHtml(task.title)}'"
          title="Change priority"
        >
          <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
          <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
          <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
        </select>
        <button
          type="button"
          class="delete-btn"
          aria-label="Delete task '${escapeHtml(task.title)}'"
          title="Delete task"
        >✕</button>
      </div>
    `;

    // Priority change listener
    const prioritySelect = li.querySelector('.priority-select');
    prioritySelect.addEventListener('change', async () => {
      await updateTaskPriority(task.id, prioritySelect.value);
    });

    // Toggle complete listener
    const checkbox = li.querySelector('.task-checkbox');
    checkbox.addEventListener('change', async () => {
      await toggleTask(task.id, checkbox.checked);
    });

    // Delete listener
    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
      await deleteTask(task.id);
    });

    taskList.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function createTask(title, priority) {
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId,
      },
      body: JSON.stringify({ title, priority }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create task');
    }
    await fetchTasks();
  } catch (err) {
    alert(err.message);
  }
}

async function updateTaskPriority(id, priority) {
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId,
      },
      body: JSON.stringify({ priority }),
    });
    if (!res.ok) throw new Error('Failed to update task priority');
    await fetchTasks();
  } catch (err) {
    console.error('Error updating task priority:', err);
    await fetchTasks();
  }
}

async function toggleTask(id, completed) {
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId,
      },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new Error('Failed to update task');
    await fetchTasks();
  } catch (err) {
    console.error(err);
    await fetchTasks();
  }
}

async function deleteTask(id) {
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: {
        'X-User-Id': currentUserId,
      },
    });
    if (!res.ok) throw new Error('Failed to delete task');
    await fetchTasks();
  } catch (err) {
    console.error(err);
    await fetchTasks();
  }
}

const switchUserBtn = document.getElementById('switchUserBtn');
if (switchUserBtn) {
  switchUserBtn.addEventListener('click', switchUser);
}

if (toggleCompletedBtn) {
  toggleCompletedBtn.addEventListener('click', () => {
    showCompleted = !showCompleted;
    renderTasks(allTasks);
  });
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = taskTitleInput.value.trim();
  const priority = taskPrioritySelect.value;
  if (!title) return;

  await createTask(title, priority);
  taskTitleInput.value = '';
  taskTitleInput.focus();
});

// Initialize on page load
updateUserBadge();
fetchTasks();
