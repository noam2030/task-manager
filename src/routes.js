import { Router } from 'express';
import { defaultTaskStore } from './taskStore.js';

export function createTaskRouter(store = defaultTaskStore) {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/tasks', async (req, res) => {
    try {
      const tasks = await store.getTasks();
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks', async (req, res) => {
    try {
      const { title, priority } = req.body || {};
      const created = await store.createTask({ title, priority });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/tasks/:id', async (req, res) => {
    try {
      const updated = await store.updateTask(req.params.id, req.body || {});
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
      const deleted = await store.deleteTask(req.params.id);
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
