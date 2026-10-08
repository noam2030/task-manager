import { Router } from 'express';
import { defaultTaskStore } from './taskStore.js';

function getUserId(req) {
  const header = req.headers['x-user-id'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  if (typeof req.query.userId === 'string' && req.query.userId.trim()) {
    return req.query.userId.trim();
  }
  return 'default-user';
}

export function createTaskRouter(store = defaultTaskStore) {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/tasks', async (req, res) => {
    try {
      const userId = getUserId(req);
      const tasks = await store.getTasks(userId);
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { title, priority } = req.body || {};
      const created = await store.createTask(userId, { title, priority });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/tasks/:id', async (req, res) => {
    try {
      const userId = getUserId(req);
      const updated = await store.updateTask(userId, req.params.id, req.body || {});
      if (!updated) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/tasks/:id', async (req, res) => {
    try {
      const userId = getUserId(req);
      const deleted = await store.deleteTask(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
