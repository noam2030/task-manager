import { Router } from 'express';
import { defaultTaskStore } from './taskStore.js';

export function createTaskRouter(store = defaultTaskStore) {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/tasks', (req, res) => {
    res.json(store.getTasks());
  });

  router.post('/tasks', (req, res) => {
    try {
      const { title, priority } = req.body || {};
      const created = store.createTask({ title, priority });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/tasks/:id', (req, res) => {
    try {
      const updated = store.updateTask(req.params.id, req.body || {});
      if (!updated) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/tasks/:id', (req, res) => {
    const deleted = store.deleteTask(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).end();
  });

  return router;
}
