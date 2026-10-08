import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskStore } from '../src/taskStore.js';

test('TaskStore - priority-based ordering', async () => {
  const store = new TaskStore({ filePath: '', useFirestore: false });

  await store.createTask({ title: 'Low priority task', priority: 'Low' });
  await store.createTask({ title: 'High priority task', priority: 'High' });
  await store.createTask({ title: 'Medium priority task', priority: 'Medium' });

  const tasks = await store.getTasks();
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].priority, 'High');
  assert.equal(tasks[0].title, 'High priority task');
  assert.equal(tasks[1].priority, 'Medium');
  assert.equal(tasks[1].title, 'Medium priority task');
  assert.equal(tasks[2].priority, 'Low');
  assert.equal(tasks[2].title, 'Low priority task');
});

test('TaskStore - same priority orders by newest first', async () => {
  const store = new TaskStore({ filePath: '', useFirestore: false });

  const first = await store.createTask({ title: 'First High', priority: 'High' });
  await new Promise((r) => setTimeout(r, 10));
  const second = await store.createTask({ title: 'Second High', priority: 'High' });

  const tasks = await store.getTasks();
  assert.equal(tasks[0].id, second.id);
  assert.equal(tasks[1].id, first.id);
});

test('TaskStore - validation', async () => {
  const store = new TaskStore({ filePath: '', useFirestore: false });

  await assert.rejects(async () => store.createTask({ title: '', priority: 'High' }), /title is required/);
  await assert.rejects(async () => store.createTask({ title: 'Valid', priority: 'Urgent' }), /Priority must be High, Medium, or Low/);
});

test('TaskStore - update and delete', async () => {
  const store = new TaskStore({ filePath: '', useFirestore: false });

  const task = await store.createTask({ title: 'Initial title', priority: 'Low' });
  assert.equal(task.completed, false);

  const updated = await store.updateTask(task.id, { completed: true, priority: 'High' });
  assert.equal(updated.completed, true);
  assert.equal(updated.priority, 'High');

  const deleted = await store.deleteTask(task.id);
  assert.equal(deleted, true);
  const tasks = await store.getTasks();
  assert.equal(tasks.length, 0);
});

test('TaskStore - modifying priority re-sorts tasks', async () => {
  const store = new TaskStore({ filePath: '', useFirestore: false });

  const lowTask = await store.createTask({ title: 'Originally Low', priority: 'Low' });
  const medTask = await store.createTask({ title: 'Medium Task', priority: 'Medium' });

  let tasks = await store.getTasks();
  assert.equal(tasks[0].id, medTask.id);
  assert.equal(tasks[1].id, lowTask.id);

  // Upgrade Low to High
  await store.updateTask(lowTask.id, { priority: 'High' });

  tasks = await store.getTasks();
  assert.equal(tasks[0].id, lowTask.id);
  assert.equal(tasks[0].priority, 'High');
  assert.equal(tasks[1].id, medTask.id);
});

