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

test('API - CORS headers are present', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.match(res.headers.get('access-control-allow-methods'), /GET/);
    assert.match(res.headers.get('access-control-allow-headers'), /X-User-Id/);
  } finally {
    await close();
  }
});

test('API - per-user data isolation', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    // Alice creates a task
    const aliceCreateRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'alice',
      },
      body: JSON.stringify({ title: 'Alice secret task', priority: 'High' }),
    });
    assert.equal(aliceCreateRes.status, 201);
    const aliceTask = await aliceCreateRes.json();
    assert.equal(aliceTask.userId, 'alice');

    // Bob creates a task
    const bobCreateRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'bob',
      },
      body: JSON.stringify({ title: 'Bob secret task', priority: 'Low' }),
    });
    assert.equal(bobCreateRes.status, 201);
    const bobTask = await bobCreateRes.json();
    assert.equal(bobTask.userId, 'bob');

    // Alice fetches tasks -> only sees Alice's task
    const aliceGetRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { 'X-User-Id': 'alice' },
    });
    assert.equal(aliceGetRes.status, 200);
    const aliceTasks = await aliceGetRes.json();
    assert.equal(aliceTasks.length, 1);
    assert.equal(aliceTasks[0].id, aliceTask.id);

    // Bob fetches tasks -> only sees Bob's task
    const bobGetRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { 'X-User-Id': 'bob' },
    });
    assert.equal(bobGetRes.status, 200);
    const bobTasks = await bobGetRes.json();
    assert.equal(bobTasks.length, 1);
    assert.equal(bobTasks[0].id, bobTask.id);

    // Alice attempts to update Bob's task -> 404
    const crossPatchRes = await fetch(`${baseUrl}/api/tasks/${bobTask.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'alice',
      },
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(crossPatchRes.status, 404);

    // Alice attempts to delete Bob's task -> 404
    const crossDeleteRes = await fetch(`${baseUrl}/api/tasks/${bobTask.id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': 'alice' },
    });
    assert.equal(crossDeleteRes.status, 404);

    // Bob successfully deletes Bob's task -> 204
    const bobDeleteRes = await fetch(`${baseUrl}/api/tasks/${bobTask.id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': 'bob' },
    });
    assert.equal(bobDeleteRes.status, 204);

    // Bob's list is now empty, Alice's task remains untouched
    const bobListAfter = await (await fetch(`${baseUrl}/api/tasks`, { headers: { 'X-User-Id': 'bob' } })).json();
    assert.equal(bobListAfter.length, 0);

    const aliceListAfter = await (await fetch(`${baseUrl}/api/tasks`, { headers: { 'X-User-Id': 'alice' } })).json();
    assert.equal(aliceListAfter.length, 1);
  } finally {
    await close();
  }
});

test('API - Cache-Control and Vary headers are present on /api routes', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control'), /no-store/);
    assert.match(res.headers.get('cache-control'), /no-cache/);
    assert.match(res.headers.get('vary'), /X-User-Id/);
  } finally {
    await close();
  }
});

test('API - userId query parameter fallback supports isolation', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    // Create via query param
    const resCreate = await fetch(`${baseUrl}/api/tasks?userId=query-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task via query', priority: 'High' }),
    });
    assert.equal(resCreate.status, 201);
    const task = await resCreate.json();
    assert.equal(task.userId, 'query-user');

    // Get via query param
    const resGet = await fetch(`${baseUrl}/api/tasks?userId=query-user`);
    assert.equal(resGet.status, 200);
    const tasks = await resGet.json();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, task.id);

    // Another user gets empty
    const resOther = await fetch(`${baseUrl}/api/tasks?userId=different-user`);
    assert.equal(resOther.status, 200);
    const otherTasks = await resOther.json();
    assert.equal(otherTasks.length, 0);
  } finally {
    await close();
  }
});



