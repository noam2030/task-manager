import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Firestore } from '@google-cloud/firestore';

const PRIORITY_ORDER = {
  High: 1,
  Medium: 2,
  Low: 3,
};

export class TaskStore {
  constructor(options = {}) {
    const isExplicit = options.useFirestore !== undefined;
    if (isExplicit) {
      this.useFirestore = options.useFirestore;
    } else {
      this.useFirestore = (
        process.env.USE_FIRESTORE === 'true' ||
        Boolean(process.env.K_SERVICE)
      );
    }

    this.filePath = typeof options === 'string' ? options : (options.filePath ?? (process.env.DATA_FILE_PATH || './data/tasks.json'));
    this.tasks = [];

    if (this.useFirestore) {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'ai-learning-499409';
      console.log(`[TaskStore] Using Firestore (project: ${projectId})`);
      this.db = new Firestore({ projectId });
    } else {
      this.load();
    }
  }

  _getUserCollection(userId) {
    const cleanUserId = (userId || 'default-user').toString().trim() || 'default-user';
    return this.db.collection('users').doc(cleanUserId).collection('tasks');
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
      // In-memory fallback
    }
  }

  _sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      const weightA = PRIORITY_ORDER[a.priority] ?? 99;
      const weightB = PRIORITY_ORDER[b.priority] ?? 99;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getTasks(userId = 'default-user') {
    const cleanUserId = (userId || 'default-user').toString().trim() || 'default-user';
    if (this.useFirestore) {
      const snapshot = await this._getUserCollection(cleanUserId).get();
      const items = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        items.push({ id: doc.id, details: '', ...d });
      });
      return this._sortTasks(items);
    }
    const userTasks = this.tasks
      .filter((t) => (t.userId || 'default-user') === cleanUserId)
      .map((t) => ({ details: '', ...t }));
    return this._sortTasks(userTasks);
  }

  async createTask(userOrData, maybeData) {
    const userId = typeof userOrData === 'string' ? userOrData : 'default-user';
    const data = typeof userOrData === 'string' ? (maybeData || {}) : (userOrData || {});

    const { title, priority = 'Medium', details = '' } = data;
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Task title is required');
    }
    const cleanPriority = priority.trim();
    if (!PRIORITY_ORDER[cleanPriority]) {
      throw new Error('Priority must be High, Medium, or Low');
    }

    const cleanUserId = (userId || 'default-user').toString().trim() || 'default-user';
    const now = new Date().toISOString();
    const cleanDetails = typeof details === 'string' ? details.trim() : (details != null ? String(details).trim() : '');
    const task = {
      id: randomUUID(),
      userId: cleanUserId,
      title: title.trim(),
      priority: cleanPriority,
      details: cleanDetails,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    if (this.useFirestore) {
      await this._getUserCollection(cleanUserId).doc(task.id).set(task);
      return task;
    }

    this.tasks.push(task);
    this.save();
    return task;
  }

  async updateTask(userOrId, idOrUpdates, maybeUpdates) {
    let userId = 'default-user';
    let id = userOrId;
    let updates = idOrUpdates || {};

    if (maybeUpdates !== undefined) {
      userId = userOrId;
      id = idOrUpdates;
      updates = maybeUpdates || {};
    }

    const cleanUserId = (userId || 'default-user').toString().trim() || 'default-user';

    if (this.useFirestore) {
      const docRef = this._getUserCollection(cleanUserId).doc(id);
      const snapshot = await docRef.get();
      if (!snapshot.exists) return null;

      const existing = snapshot.data();
      const cleanUpdates = {};

      if (updates.title !== undefined) {
        if (typeof updates.title !== 'string' || !updates.title.trim()) {
          throw new Error('Task title cannot be empty');
        }
        cleanUpdates.title = updates.title.trim();
      }

      if (updates.priority !== undefined) {
        const cleanPriority = String(updates.priority).trim();
        if (!PRIORITY_ORDER[cleanPriority]) {
          throw new Error('Priority must be High, Medium, or Low');
        }
        cleanUpdates.priority = cleanPriority;
      }

      if (updates.completed !== undefined) {
        cleanUpdates.completed = Boolean(updates.completed);
      }

      if (updates.details !== undefined) {
        cleanUpdates.details = typeof updates.details === 'string' ? updates.details.trim() : (updates.details != null ? String(updates.details).trim() : '');
      }

      cleanUpdates.updatedAt = new Date().toISOString();
      await docRef.update(cleanUpdates);
      return { id, userId: cleanUserId, ...existing, ...cleanUpdates };
    }

    const task = this.tasks.find((t) => t.id === id && (t.userId || 'default-user') === cleanUserId);
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

    if (updates.details !== undefined) {
      task.details = typeof updates.details === 'string' ? updates.details.trim() : (updates.details != null ? String(updates.details).trim() : '');
    }

    task.updatedAt = new Date().toISOString();
    this.save();
    return task;
  }

  async deleteTask(userOrId, maybeId) {
    const userId = maybeId !== undefined ? userOrId : 'default-user';
    const id = maybeId !== undefined ? maybeId : userOrId;
    const cleanUserId = (userId || 'default-user').toString().trim() || 'default-user';

    if (this.useFirestore) {
      const docRef = this._getUserCollection(cleanUserId).doc(id);
      const snapshot = await docRef.get();
      if (!snapshot.exists) return false;
      await docRef.delete();
      return true;
    }

    const initialLength = this.tasks.length;
    this.tasks = this.tasks.filter((t) => !(t.id === id && (t.userId || 'default-user') === cleanUserId));
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
