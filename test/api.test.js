import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { TaskStore } from '../src/taskStore.js';

function startTestServer() {
  const store = new TaskStore({ filePath: '', useFirestore: false });
  const app = createApp(store);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const baseUrl = `http://localhost:${port}`;
      resolve({
        server,
        baseUrl,
        store,
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

test('API - health check endpoint', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, { status: 'ok' });
  } finally {
    await close();
  }
});

test('API - create and retrieve tasks ordered by priority', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    // Create Low priority
    const res1 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task 1', priority: 'Low' }),
    });
    assert.equal(res1.status, 201);

    // Create High priority
    const res2 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task 2', priority: 'High' }),
    });
    assert.equal(res2.status, 201);

    // Fetch list
    const resGet = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(resGet.status, 200);
    const tasks = await resGet.json();

    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].priority, 'High');
    assert.equal(tasks[0].title, 'Task 2');
    assert.equal(tasks[1].priority, 'Low');
    assert.equal(tasks[1].title, 'Task 1');
  } finally {
    await close();
  }
});

test('API - validation returns 400', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', priority: 'High' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /title is required/);
  } finally {
    await close();
  }
});

test('API - update and delete task', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task to update', priority: 'Medium' }),
    });
    const task = await createRes.json();

    // Patch completion
    const patchRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.completed, true);

    // Delete
    const deleteRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 204);

    // Verify gone
    const checkRes = await fetch(`${baseUrl}/api/tasks`);
    const tasks = await checkRes.json();
    assert.equal(tasks.length, 0);
  } finally {
    await close();
  }
});

test('API - patch priority re-sorts tasks', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res1 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task Low', priority: 'Low' }),
    });
    const taskLow = await res1.json();

    const res2 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task Med', priority: 'Medium' }),
    });
    const taskMed = await res2.json();

    // Change Task Low to High
    const patchRes = await fetch(`${baseUrl}/api/tasks/${taskLow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: 'High' }),
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.priority, 'High');

    // Verify ordering
    const getRes = await fetch(`${baseUrl}/api/tasks`);
    const tasks = await getRes.json();
    assert.equal(tasks[0].id, taskLow.id);
    assert.equal(tasks[0].priority, 'High');
    assert.equal(tasks[1].id, taskMed.id);
  } finally {
    await close();
  }
});
