const taskForm = document.getElementById('taskForm');
const taskTitleInput = document.getElementById('taskTitle');
const taskPrioritySelect = document.getElementById('taskPriority');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const pendingCount = document.getElementById('pendingCount');
const completedCount = document.getElementById('completedCount');

async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks');
    if (!res.ok) throw new Error('Failed to fetch tasks');
    const tasks = await res.json();
    renderTasks(tasks);
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
}

function renderTasks(tasks) {
  updateStats(tasks);
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  tasks.forEach((task) => {
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
          aria-label="Mark task '${escapeHtml(task.title)}' as completed"
        />
        <span class="task-title">${escapeHtml(task.title)}</span>
      </div>
      <div class="task-right">
        <span class="priority-badge ${priorityClass}">${escapeHtml(task.priority)}</span>
        <button
          type="button"
          class="delete-btn"
          aria-label="Delete task '${escapeHtml(task.title)}'"
          title="Delete task"
        >✕</button>
      </div>
    `;

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
      headers: { 'Content-Type': 'application/json' },
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

async function toggleTask(id, completed) {
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    });
    if (!res.ok) throw new Error('Failed to delete task');
    await fetchTasks();
  } catch (err) {
    console.error(err);
    await fetchTasks();
  }
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
fetchTasks();
