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

// Full-Screen Details Modal elements
const detailsModal = document.getElementById('detailsModal');
const modalPriorityBadge = document.getElementById('modalPriorityBadge');
const modalStatusBadge = document.getElementById('modalStatusBadge');
const modalTaskTitle = document.getElementById('modalTaskTitle');
const modalDetailsText = document.getElementById('modalDetailsText');
const detailsViewMode = document.getElementById('detailsViewMode');
const detailsEditMode = document.getElementById('detailsEditMode');
const modalDetailsTextarea = document.getElementById('modalDetailsTextarea');
const editDetailsBtn = document.getElementById('editDetailsBtn');
const saveModalDetailsBtn = document.getElementById('saveModalDetailsBtn');
const cancelModalDetailsBtn = document.getElementById('cancelModalDetailsBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
let activeModalTaskId = null;

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

const PROD_API_BASE = 'https://task-manager-289332143182.us-central1.run.app';
const STAGING_API_BASE = 'https://task-manager-staging-289332143182.us-central1.run.app';

function isStagingEnvironment() {
  const hostname = window.location.hostname;
  if (hostname.includes('staging')) {
    return true;
  }
  if (hostname.includes('vercel.app')) {
    const isProductionVercel = hostname === 'task-manager-ui-gamma-blond.vercel.app' ||
      hostname === 'task-manager-ui.vercel.app';
    return !isProductionVercel;
  }
  return false;
}

function getBackendBaseUrl() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return window.location.origin;
  }
  if (isStagingEnvironment()) {
    return STAGING_API_BASE;
  }
  return PROD_API_BASE;
}

function getApiUrl(path) {
  const base = getBackendBaseUrl();
  const separator = path.includes('?') ? '&' : '?';
  return `${base}${path}${separator}userId=${encodeURIComponent(currentUserId)}`;
}

function updateApiLink() {
  const apiLink = document.getElementById('apiLink');
  const apiLinkLabel = document.getElementById('apiLinkLabel');
  if (!apiLink) return;

  const baseUrl = getBackendBaseUrl();
  apiLink.href = `${baseUrl}/api/tasks?userId=${encodeURIComponent(currentUserId)}`;

  if (apiLinkLabel) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      apiLinkLabel.textContent = 'API (Local)';
    } else if (isStagingEnvironment()) {
      apiLinkLabel.textContent = 'API (Staging)';
    } else {
      apiLinkLabel.textContent = 'API (Prod)';
    }
  }
  apiLink.title = `Backend API: ${baseUrl}/api/tasks`;
}

function switchUser() {
  const input = window.prompt('Enter username or identifier:', currentUserId);
  if (input !== null && input.trim() && input.trim() !== currentUserId) {
    currentUserId = input.trim();
    localStorage.setItem(USER_STORAGE_KEY, currentUserId);
    updateUserBadge();
    updateApiLink();
    fetchTasks();
  }
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
    if (activeModalTaskId) {
      const activeTask = allTasks.find((t) => t.id === activeModalTaskId);
      if (activeTask) {
        renderModalContent(activeTask);
      }
    }
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
        <button
          type="button"
          class="btn-view-details ${hasDetails ? 'has-details' : ''}"
          aria-label="View details for task '${escapeHtml(task.title)}'"
          title="${hasDetails ? 'View details (notes attached)' : 'View details'}"
        >
          📄 Details${hasDetails ? ' •' : ''}
        </button>
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

    // View Details button listener
    const viewDetailsBtn = li.querySelector('.btn-view-details');
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener('click', () => {
        openDetailsModal(task);
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

function openDetailsModal(task) {
  activeModalTaskId = task.id;
  renderModalContent(task);
  detailsModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function renderModalContent(task) {
  modalTaskTitle.textContent = task.title;

  // Priority badge
  modalPriorityBadge.textContent = task.priority;
  modalPriorityBadge.className = `details-modal-badge badge-${task.priority.toLowerCase()}`;

  // Status badge
  modalStatusBadge.textContent = task.completed ? 'Completed' : 'Pending';
  modalStatusBadge.className = `details-modal-status ${task.completed ? 'status-completed' : 'status-pending'}`;

  // Details text
  const text = (task.details || '').trim();
  if (text) {
    modalDetailsText.textContent = text;
    modalDetailsText.classList.remove('empty-details');
  } else {
    modalDetailsText.textContent = 'No details or notes added for this task yet. Click "✎ Edit Details" to add information.';
    modalDetailsText.classList.add('empty-details');
  }

  modalDetailsTextarea.value = task.details || '';

  // Reset to view mode
  detailsViewMode.hidden = false;
  detailsEditMode.hidden = true;
}

function closeDetailsModal() {
  detailsModal.hidden = true;
  document.body.style.overflow = '';
  activeModalTaskId = null;
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
    const updated = await res.json();
    await fetchTasks();
    if (activeModalTaskId === id) {
      const activeTask = allTasks.find((t) => t.id === id) || updated;
      renderModalContent(activeTask);
    }
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
    if (activeModalTaskId === id) {
      closeDetailsModal();
    }
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

// Modal event listeners
if (editDetailsBtn) {
  editDetailsBtn.addEventListener('click', () => {
    detailsViewMode.hidden = true;
    detailsEditMode.hidden = false;
    modalDetailsTextarea.focus();
  });
}

if (cancelModalDetailsBtn) {
  cancelModalDetailsBtn.addEventListener('click', () => {
    const task = allTasks.find((t) => t.id === activeModalTaskId);
    modalDetailsTextarea.value = task ? (task.details || '') : '';
    detailsEditMode.hidden = true;
    detailsViewMode.hidden = false;
  });
}

if (saveModalDetailsBtn) {
  saveModalDetailsBtn.addEventListener('click', async () => {
    if (!activeModalTaskId) return;
    const newDetails = modalDetailsTextarea.value.trim();
    saveModalDetailsBtn.disabled = true;
    saveModalDetailsBtn.textContent = 'Saving...';
    try {
      await updateTaskDetails(activeModalTaskId, newDetails);
      detailsEditMode.hidden = true;
      detailsViewMode.hidden = false;
    } finally {
      saveModalDetailsBtn.disabled = false;
      saveModalDetailsBtn.textContent = 'Save Details';
    }
  });
}

if (closeModalBtn) {
  closeModalBtn.addEventListener('click', closeDetailsModal);
}

if (detailsModal) {
  detailsModal.addEventListener('click', (e) => {
    if (e.target === detailsModal) {
      closeDetailsModal();
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && detailsModal && !detailsModal.hidden) {
    closeDetailsModal();
  }
});

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
updateApiLink();
fetchTasks();
