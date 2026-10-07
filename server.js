import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTaskRouter } from './src/routes.js';
import { defaultTaskStore } from './src/taskStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(store = defaultTaskStore) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/api', createTaskRouter(store));

  // Fallback to index.html for root navigation
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

export const app = createApp();

const PORT = process.env.PORT || 8080;

if (process.argv[1] === __filename) {
  app.listen(PORT, () => {
    console.log(`Task Manager server running on port ${PORT}`);
  });
}
