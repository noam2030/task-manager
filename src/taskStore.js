import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PRIORITY_ORDER = {
  High: 1,
  Medium: 2,
  Low: 3,
};

export class TaskStore {
  constructor(filePath = process.env.DATA_FILE_PATH || './data/tasks.json') {
    this.filePath = filePath;
    this.tasks = [];
    this.load();
  }

  load() {
    if (!this.filePath) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.tasks = JSON.parse(raw);
      }
    } catch {
      this.tasks = [];
    }
  }

  save() {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.tasks, null, 2), 'utf-8');
    } catch {
      // In-memory fallback if persistence fails
    }
  }

  getTasks() {
    return [...this.tasks].sort((a, b) => {
      const weightA = PRIORITY_ORDER[a.priority] ?? 99;
      const weightB = PRIORITY_ORDER[b.priority] ?? 99;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  createTask({ title, priority = 'Medium' }) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Task title is required');
    }
    const cleanPriority = priority.trim();
    if (!PRIORITY_ORDER[cleanPriority]) {
      throw new Error('Priority must be High, Medium, or Low');
    }

    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      title: title.trim(),
      priority: cleanPriority,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.push(task);
    this.save();
    return task;
  }

  updateTask(id, updates = {}) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;

    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string' || !updates.title.trim()) {
        throw new Error('Task title cannot be empty');
      }
      task.title = updates.title.trim();
    }

    if (updates.priority !== undefined) {
      const cleanPriority = String(updates.priority).trim();
      if (!PRIORITY_ORDER[cleanPriority]) {
        throw new Error('Priority must be High, Medium, or Low');
      }
      task.priority = cleanPriority;
    }

    if (updates.completed !== undefined) {
      task.completed = Boolean(updates.completed);
    }

    task.updatedAt = new Date().toISOString();
    this.save();
    return task;
  }

  deleteTask(id) {
    const initialLength = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length !== initialLength) {
      this.save();
      return true;
    }
    return false;
  }

  clear() {
    this.tasks = [];
    this.save();
  }
}

export const defaultTaskStore = new TaskStore();
