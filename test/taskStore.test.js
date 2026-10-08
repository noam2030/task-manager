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

test('TaskStore - per-user isolation', async () => {
  const store = new TaskStore({ filePath: '', useFirestore: false });

  // Create tasks for user-alpha and user-beta
  const alphaTask = await store.createTask('user-alpha', { title: 'Alpha task', priority: 'High' });
  const betaTask = await store.createTask('user-beta', { title: 'Beta task', priority: 'Low' });

  assert.equal(alphaTask.userId, 'user-alpha');
  assert.equal(betaTask.userId, 'user-beta');

  // getTasks returns only user's own tasks
  const alphaTasks = await store.getTasks('user-alpha');
  assert.equal(alphaTasks.length, 1);
  assert.equal(alphaTasks[0].id, alphaTask.id);

  const betaTasks = await store.getTasks('user-beta');
  assert.equal(betaTasks.length, 1);
  assert.equal(betaTasks[0].id, betaTask.id);

  // Cross-user update must fail
  const failedUpdate = await store.updateTask('user-alpha', betaTask.id, { completed: true });
  assert.equal(failedUpdate, null);

  // Cross-user delete must fail
  const failedDelete = await store.deleteTask('user-alpha', betaTask.id);
  assert.equal(failedDelete, false);

  // Ensure betaTask is untouched
  const betaTasksAfter = await store.getTasks('user-beta');
  assert.equal(betaTasksAfter.length, 1);
  assert.equal(betaTasksAfter[0].completed, false);

  // User-beta can update and delete their own task
  const successfulUpdate = await store.updateTask('user-beta', betaTask.id, { completed: true });
  assert.equal(successfulUpdate.completed, true);

  const successfulDelete = await store.deleteTask('user-beta', betaTask.id);
  assert.equal(successfulDelete, true);
  assert.equal((await store.getTasks('user-beta')).length, 0);
});

test('TaskStore - task details creation and update', async () => {
  const store = new TaskStore({ filePath: '', useFirestore: false });

  // Creation with details
  const taskWithDetails = await store.createTask('user-details', {
    title: 'Deploy microservice',
    priority: 'High',
    details: 'Verify environment variables and IAM role permissions first',
  });
  assert.equal(taskWithDetails.details, 'Verify environment variables and IAM role permissions first');

  // Creation without details defaults to empty string
  const taskWithoutDetails = await store.createTask('user-details', {
    title: 'Review pull request',
    priority: 'Medium',
  });
  assert.equal(taskWithoutDetails.details, '');

  // Update details later (ongoing information)
  const updatedTask = await store.updateTask('user-details', taskWithDetails.id, {
    details: 'Step 1 complete. Now verifying staging URL and SSL certificate.',
  });
  assert.equal(updatedTask.details, 'Step 1 complete. Now verifying staging URL and SSL certificate.');

  // Fetch tasks and ensure details are persisted
  const tasks = await store.getTasks('user-details');
  const found = tasks.find((t) => t.id === taskWithDetails.id);
  assert.equal(found.details, 'Step 1 complete. Now verifying staging URL and SSL certificate.');
});


