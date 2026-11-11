import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createInitialSeedDatabase } from './src/data/seedData';
import type { StoreDatabase } from './src/types/pos';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const BACKUP_FILE = path.join(DATA_DIR, 'store.backup.json');

function ensureDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStoreFromDisk(): StoreDatabase {
  ensureDataDirectory();
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as StoreDatabase;
      if (parsed && Array.isArray(parsed.products) && parsed.settings) {
        return parsed;
      }
    } catch (err) {
      console.error('Failed reading store.json, checking backup:', err);
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          const backupRaw = fs.readFileSync(BACKUP_FILE, 'utf-8');
          const backupParsed = JSON.parse(backupRaw) as StoreDatabase;
          if (backupParsed && Array.isArray(backupParsed.products)) {
            return backupParsed;
          }
        } catch {
          // Fall through to seed
        }
      }
    }
  }
  const initial = createInitialSeedDatabase();
  writeStoreToDisk(initial);
  return initial;
}

function writeStoreToDisk(data: StoreDatabase): StoreDatabase {
  ensureDataDirectory();
  const payload: StoreDatabase = {
    ...data,
    lastSavedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload, null, 2);
  const tempFile = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tempFile, serialized, 'utf-8');
  if (fs.existsSync(STORE_FILE)) {
    try {
      fs.copyFileSync(STORE_FILE, BACKUP_FILE);
    } catch {
      // Ignore backup copy failure
    }
  }
  fs.renameSync(tempFile, STORE_FILE);
  return payload;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/store', (_req, res) => {
    try {
      const store = readStoreFromDisk();
      res.json(store);
    } catch (err) {
      console.error('GET /api/store error:', err);
      res.status(500).json({ error: 'Failed to load store database' });
    }
  });

  app.put('/api/store', (req, res) => {
    try {
      const body = req.body as StoreDatabase;
      if (!body || !Array.isArray(body.products) || !body.settings) {
        res.status(400).json({ error: 'Invalid store payload' });
        return;
      }
      const saved = writeStoreToDisk(body);
      res.json({ ok: true, lastSavedAt: saved.lastSavedAt });
    } catch (err) {
      console.error('PUT /api/store error:', err);
      res.status(500).json({ error: 'Failed to persist store database' });
    }
  });

  app.get('/api/backup', (_req, res) => {
    try {
      const store = readStoreFromDisk();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="asan-kiryana-backup-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(store, null, 2));
    } catch (err) {
      console.error('GET /api/backup error:', err);
      res.status(500).json({ error: 'Failed to export backup' });
    }
  });

  app.post('/api/restore', (req, res) => {
    try {
      const incoming = req.body as StoreDatabase;
      if (!incoming || !Array.isArray(incoming.products) || !incoming.settings) {
        res.status(400).json({ error: 'Invalid backup file structure' });
        return;
      }
      const saved = writeStoreToDisk(incoming);
      res.json(saved);
    } catch (err) {
      console.error('POST /api/restore error:', err);
      res.status(500).json({ error: 'Failed to restore backup' });
    }
  });

  app.post('/api/reset-seed', (_req, res) => {
    try {
      const initial = createInitialSeedDatabase();
      const saved = writeStoreToDisk(initial);
      res.json(saved);
    } catch (err) {
      console.error('POST /api/reset-seed error:', err);
      res.status(500).json({ error: 'Failed to reset store data' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Counter Billing – Asan Kiryana running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
