import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskStore } from '../src/taskStore.js';

test('TaskStore - priority-based ordering', () => {
  // Use in-memory store by passing empty path
  const store = new TaskStore('');

  store.createTask({ title: 'Low priority task', priority: 'Low' });
  store.createTask({ title: 'High priority task', priority: 'High' });
  store.createTask({ title: 'Medium priority task', priority: 'Medium' });

  const tasks = store.getTasks();
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].priority, 'High');
  assert.equal(tasks[0].title, 'High priority task');
  assert.equal(tasks[1].priority, 'Medium');
  assert.equal(tasks[1].title, 'Medium priority task');
  assert.equal(tasks[2].priority, 'Low');
  assert.equal(tasks[2].title, 'Low priority task');
});

test('TaskStore - same priority orders by newest first', async () => {
  const store = new TaskStore('');

  const first = store.createTask({ title: 'First High', priority: 'High' });
  // Add small delay to guarantee different timestamp if needed
  await new Promise((r) => setTimeout(r, 10));
  const second = store.createTask({ title: 'Second High', priority: 'High' });

  const tasks = store.getTasks();
  assert.equal(tasks[0].id, second.id);
  assert.equal(tasks[1].id, first.id);
});

test('TaskStore - validation', () => {
  const store = new TaskStore('');

  assert.throws(() => store.createTask({ title: '', priority: 'High' }), /title is required/);
  assert.throws(() => store.createTask({ title: 'Valid', priority: 'Urgent' }), /Priority must be High, Medium, or Low/);
});

test('TaskStore - update and delete', () => {
  const store = new TaskStore('');

  const task = store.createTask({ title: 'Initial title', priority: 'Low' });
  assert.equal(task.completed, false);

  const updated = store.updateTask(task.id, { completed: true, priority: 'High' });
  assert.equal(updated.completed, true);
  assert.equal(updated.priority, 'High');

  const deleted = store.deleteTask(task.id);
  assert.equal(deleted, true);
  assert.equal(store.getTasks().length, 0);
});
