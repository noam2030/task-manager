const taskForm = document.getElementById('taskForm');
const taskTitleInput = document.getElementById('taskTitle');
const taskPrioritySelect = document.getElementById('taskPriority');
const taskDetailsInput = document.getElementById('taskDetails');
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

function getApiUrl(path) {
  const hostname = window.location.hostname;
  const isVercelPreview = hostname.includes('vercel.app') &&
    !hostname.includes('task-manager-ui-gamma-blond') &&
    !hostname.startsWith('task-manager-ui.');
  const base = isVercelPreview
    ? 'https://task-manager-staging-608477010863.us-central1.run.app'
    : '';

  const separator = path.includes('?') ? '&' : '?';
  return `${base}${path}${separator}userId=${encodeURIComponent(currentUserId)}`;
}

function getRequestOptions(options = {}) {
  const headers = {
    'X-User-Id': currentUserId,
    ...(options.headers || {}),
  };
  return {
    cache: 'no-store',
    ...options,
    headers,
  };
}

async function fetchTasks() {
  try {
    const url = getApiUrl('/api/tasks');
    const res = await fetch(url, getRequestOptions());
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
    const taskDetails = (task.details || '').trim();
    const hasDetails = Boolean(taskDetails);

    li.innerHTML = `
      <div class="task-main">
        <div class="task-left">
          <input
            type="checkbox"
            class="task-checkbox"
            ${task.completed ? 'checked' : ''}
            aria-label="Mark task '${escapeHtml(task.title)}' as ${task.completed ? 'incomplete' : 'done'}"
            title="${task.completed ? 'Mark as incomplete' : 'Mark as done'}"
          />
          <div class="task-content">
            <span class="task-title">${escapeHtml(task.title)}</span>
            <div class="task-details-view">
              ${hasDetails ? `<div class="task-details-text">${escapeHtml(taskDetails)}</div>` : ''}
              <button
                type="button"
                class="btn-details-action"
                aria-label="${hasDetails ? 'Edit details for' : 'Add details to'} task '${escapeHtml(task.title)}'"
              >
                ${hasDetails ? '✎ Edit details' : '＋ Add details'}
              </button>
            </div>
            <div class="task-details-editor" hidden>
              <textarea
                class="details-edit-textarea"
                rows="2"
                placeholder="Add details, notes, or ongoing progress context..."
                aria-label="Edit details for task '${escapeHtml(task.title)}'"
              >${escapeHtml(taskDetails)}</textarea>
              <div class="details-edit-actions">
                <button type="button" class="btn-details-save">Save</button>
                <button type="button" class="btn-details-cancel">Cancel</button>
              </div>
            </div>
          </div>
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
      </div>
    `;

    // Inline details editor listeners
    const detailsView = li.querySelector('.task-details-view');
    const detailsEditor = li.querySelector('.task-details-editor');
    const detailsActionBtn = li.querySelector('.btn-details-action');
    const detailsTextarea = li.querySelector('.details-edit-textarea');
    const saveBtn = li.querySelector('.btn-details-save');
    const cancelBtn = li.querySelector('.btn-details-cancel');

    if (detailsActionBtn && detailsEditor && detailsView) {
      detailsActionBtn.addEventListener('click', () => {
        detailsView.hidden = true;
        detailsEditor.hidden = false;
        detailsTextarea.focus();
      });

      cancelBtn.addEventListener('click', () => {
        detailsTextarea.value = taskDetails;
        detailsEditor.hidden = true;
        detailsView.hidden = false;
      });

      saveBtn.addEventListener('click', async () => {
        const newDetails = detailsTextarea.value.trim();
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
          await updateTaskDetails(task.id, newDetails);
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
        }
      });
    }

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

async function createTask(title, priority, details = '') {
  try {
    const url = getApiUrl('/api/tasks');
    const res = await fetch(url, getRequestOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, priority, details }),
    }));
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create task');
    }
    await fetchTasks();
  } catch (err) {
    alert(err.message);
  }
}

async function updateTaskDetails(id, details) {
  try {
    const url = getApiUrl(`/api/tasks/${id}`);
    const res = await fetch(url, getRequestOptions({
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ details }),
    }));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update task details');
    }
    await fetchTasks();
  } catch (err) {
    console.error('Error updating task details:', err);
    alert(err.message);
    await fetchTasks();
  }
}

async function updateTaskPriority(id, priority) {
  try {
    const url = getApiUrl(`/api/tasks/${id}`);
    const res = await fetch(url, getRequestOptions({
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priority }),
    }));
    if (!res.ok) throw new Error('Failed to update task priority');
    await fetchTasks();
  } catch (err) {
    console.error('Error updating task priority:', err);
    await fetchTasks();
  }
}

async function toggleTask(id, completed) {
  try {
    const url = getApiUrl(`/api/tasks/${id}`);
    const res = await fetch(url, getRequestOptions({
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completed }),
    }));
    if (!res.ok) throw new Error('Failed to update task');
    await fetchTasks();
  } catch (err) {
    console.error(err);
    await fetchTasks();
  }
}

async function deleteTask(id) {
  try {
    const url = getApiUrl(`/api/tasks/${id}`);
    const res = await fetch(url, getRequestOptions({
      method: 'DELETE',
    }));
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
  const details = taskDetailsInput ? taskDetailsInput.value.trim() : '';
  if (!title) return;

  await createTask(title, priority, details);
  taskTitleInput.value = '';
  if (taskDetailsInput) {
    taskDetailsInput.value = '';
  }
  taskTitleInput.focus();
});

// Initialize on page load
updateUserBadge();
fetchTasks();
