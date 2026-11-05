import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PRIMARY_DB_FILE = path.join(DATA_DIR, 'shared_medical_records.json');
const BACKUP_DB_FILE = path.join(DATA_DIR, 'shared_medical_records.backup.json');

const HOSPITAL_TO_UNIT: Record<string, { code: string; name: string }> = {
  'รพ.สต.บ้านดอยยาว': { code: '05958', name: 'รพ.สต.บ้านดอยยาว' },
  'รพ.สต.บ้านแม่ผาแหน': { code: '05959', name: 'รพ.สต.บ้านแม่ผาแหน' },
  'รพ.สต.บ้านป่าตาล': { code: '05956', name: 'รพ.สต.บ้านป่าตาล' },
  'รพ.สต.บ้านกอสะเรียม': { code: '05957', name: 'รพ.สต.บ้านกอสะเรียม' },
};

export interface ServerMedicalRecord {
  id: string;
  date: string;
  doctorName: string;
  hospital: string;
  workTime: string;
  report: {
    generalPractice: number;
    chronicCare: number;
    homeVisit: number;
    medicalCert: number;
    specialProcedure: number;
  };
  reporter: {
    prefix: string;
    firstName: string;
    lastName: string;
    position: string;
    level?: string;
  };
  notes?: string;
  serviceUnitCode?: string;
  serviceUnitName?: string;
  createdAt: string;
  updatedAt: string;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeRecord(raw: ServerMedicalRecord): ServerMedicalRecord {
  const unit = HOSPITAL_TO_UNIT[raw.hospital] || {
    code: raw.serviceUnitCode || '05958',
    name: raw.serviceUnitName || raw.hospital || 'รพ.สต.บ้านดอยยาว',
  };
  const nowIso = new Date().toISOString();
  return {
    ...raw,
    id: String(raw.id || `log-${Date.now()}`),
    date: String(raw.date || nowIso.slice(0, 10)),
    doctorName: String(raw.doctorName || 'นายแพทย์เกรียงยุทธ วรศีตกาลกุล'),
    hospital: String(raw.hospital || 'รพ.สต.บ้านดอยยาว'),
    workTime: String(raw.workTime || '08.30 – 16.30 น.'),
    report: {
      generalPractice: Number(raw.report?.generalPractice) || 0,
      chronicCare: Number(raw.report?.chronicCare) || 0,
      homeVisit: Number(raw.report?.homeVisit) || 0,
      medicalCert: Number(raw.report?.medicalCert) || 0,
      specialProcedure: Number(raw.report?.specialProcedure) || 0,
    },
    reporter: {
      prefix: String(raw.reporter?.prefix || 'นาย'),
      firstName: String(raw.reporter?.firstName || ''),
      lastName: String(raw.reporter?.lastName || ''),
      position: String(raw.reporter?.position || ''),
      level: String(raw.reporter?.level || 'ไม่มี'),
    },
    notes: raw.notes ? String(raw.notes) : '',
    serviceUnitCode: unit.code,
    serviceUnitName: unit.name,
    createdAt: raw.createdAt || nowIso,
    updatedAt: raw.updatedAt || raw.createdAt || nowIso,
  };
}

function sortRecords(list: ServerMedicalRecord[]): ServerMedicalRecord[] {
  return [...list].sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

function loadRecordsFromDisk(): ServerMedicalRecord[] {
  ensureDataDir();
  try {
    if (fs.existsSync(PRIMARY_DB_FILE)) {
      const content = fs.readFileSync(PRIMARY_DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortRecords(parsed.map(normalizeRecord));
      }
    }
  } catch (err) {
    console.error('Error reading primary DB file, trying backup:', err);
  }

  try {
    if (fs.existsSync(BACKUP_DB_FILE)) {
      const backupContent = fs.readFileSync(BACKUP_DB_FILE, 'utf-8');
      const backupParsed = JSON.parse(backupContent);
      if (Array.isArray(backupParsed) && backupParsed.length > 0) {
        const normalized = sortRecords(backupParsed.map(normalizeRecord));
        fs.writeFileSync(PRIMARY_DB_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
        return normalized;
      }
    }
  } catch (err) {
    console.error('Error reading backup DB file:', err);
  }

  return [];
}

function persistRecordsToDisk(records: ServerMedicalRecord[]): void {
  ensureDataDir();
  try {
    const sorted = sortRecords(records);
    const json = JSON.stringify(sorted, null, 2);
    fs.writeFileSync(PRIMARY_DB_FILE, json, 'utf-8');
    fs.writeFileSync(BACKUP_DB_FILE, json, 'utf-8');
  } catch (err) {
    console.error('Failed to persist records to disk:', err);
  }
}

// Track deleted IDs so that stale client localStorage does not resurrect an explicitly deleted item
const explicitlyDeletedIds = new Set<string>();

// In-memory authoritative store backed by disk
let sharedRecords: ServerMedicalRecord[] = loadRecordsFromDisk();

/**
 * Additively merges incoming records with existing records.
 * Never resets or wipes existing records!
 */
function mergeRecords(incomingList: ServerMedicalRecord[]): {
  records: ServerMedicalRecord[];
  changed: boolean;
} {
  if (!Array.isArray(incomingList) || incomingList.length === 0) {
    return { records: sharedRecords, changed: false };
  }

  const map = new Map<string, ServerMedicalRecord>();
  for (const existing of sharedRecords) {
    map.set(existing.id, existing);
  }

  let changed = false;
  for (const rawItem of incomingList) {
    if (!rawItem || !rawItem.id) continue;
    if (explicitlyDeletedIds.has(rawItem.id)) continue;

    const normalized = normalizeRecord(rawItem);
    const current = map.get(normalized.id);
    if (!current) {
      map.set(normalized.id, normalized);
      changed = true;
    } else if ((normalized.updatedAt || '') > (current.updatedAt || '')) {
      map.set(normalized.id, normalized);
      changed = true;
    }
  }

  if (changed) {
    sharedRecords = sortRecords(Array.from(map.values()));
    persistRecordsToDisk(sharedRecords);
  }

  return { records: sharedRecords, changed };
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '5mb' }));

  // WebSocket Server attached to the same HTTP server on /ws
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcastToAll(payload: Record<string, unknown>) {
    const message = JSON.stringify({
      ...payload,
      connectedClients: wss.clients.size,
      timestamp: new Date().toISOString(),
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  wss.on('connection', (ws) => {
    // Send authoritative combined state immediately upon connection
    ws.send(
      JSON.stringify({
        type: 'records:init',
        records: sharedRecords,
        connectedClients: wss.clients.size,
        timestamp: new Date().toISOString(),
      })
    );

    // Notify all clients of updated active connection count
    broadcastToAll({
      type: 'presence:update',
      connectedClients: wss.clients.size,
    });

    ws.on('message', (rawMsg) => {
      try {
        const msg = JSON.parse(String(rawMsg));
        if (msg.type === 'records:sync' && Array.isArray(msg.records)) {
          const { records, changed } = mergeRecords(msg.records);
          if (changed) {
            broadcastToAll({
              type: 'records:sync',
              records,
            });
          } else {
            ws.send(
              JSON.stringify({
                type: 'records:init',
                records,
                connectedClients: wss.clients.size,
                timestamp: new Date().toISOString(),
              })
            );
          }
        } else if (msg.type === 'record:upsert' && msg.record) {
          explicitlyDeletedIds.delete(msg.record.id);
          const normalized = normalizeRecord(msg.record);
          const idx = sharedRecords.findIndex((r) => r.id === normalized.id);
          if (idx >= 0) {
            sharedRecords[idx] = normalized;
          } else {
            sharedRecords.unshift(normalized);
          }
          sharedRecords = sortRecords(sharedRecords);
          persistRecordsToDisk(sharedRecords);

          broadcastToAll({
            type: 'record:upsert',
            record: normalized,
            records: sharedRecords,
          });
        } else if (msg.type === 'record:delete' && msg.id) {
          const targetId = String(msg.id);
          explicitlyDeletedIds.add(targetId);
          sharedRecords = sharedRecords.filter((r) => r.id !== targetId);
          persistRecordsToDisk(sharedRecords);

          broadcastToAll({
            type: 'record:delete',
            id: targetId,
            records: sharedRecords,
          });
        }
      } catch (err) {
        console.error('WebSocket message handling error:', err);
      }
    });

    ws.on('close', () => {
      broadcastToAll({
        type: 'presence:update',
        connectedClients: wss.clients.size,
      });
    });
  });

  // REST API Routes
  app.get('/api/records', (_req, res) => {
    res.json({
      records: sharedRecords,
      connectedClients: wss.clients.size,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/records/sync', (req, res) => {
    const incomingRecords = Array.isArray(req.body?.records) ? req.body.records : [];
    const { records, changed } = mergeRecords(incomingRecords);
    if (changed) {
      broadcastToAll({
        type: 'records:sync',
        records,
      });
    }
    res.json({
      records,
      changed,
      connectedClients: wss.clients.size,
    });
  });

  app.post('/api/records', (req, res) => {
    const rawRecord = req.body?.record || req.body;
    if (!rawRecord || !rawRecord.id) {
      res.status(400).json({ error: 'Invalid record payload' });
      return;
    }

    explicitlyDeletedIds.delete(String(rawRecord.id));
    const normalized = normalizeRecord(rawRecord);
    const idx = sharedRecords.findIndex((r) => r.id === normalized.id);
    if (idx >= 0) {
      sharedRecords[idx] = normalized;
    } else {
      sharedRecords.unshift(normalized);
    }
    sharedRecords = sortRecords(sharedRecords);
    persistRecordsToDisk(sharedRecords);

    broadcastToAll({
      type: 'record:upsert',
      record: normalized,
      records: sharedRecords,
    });

    res.json({
      record: normalized,
      records: sharedRecords,
    });
  });

  app.delete('/api/records/:id', (req, res) => {
    const targetId = String(req.params.id || '');
    if (!targetId) {
      res.status(400).json({ error: 'Missing record ID' });
      return;
    }

    explicitlyDeletedIds.add(targetId);
    sharedRecords = sharedRecords.filter((r) => r.id !== targetId);
    persistRecordsToDisk(sharedRecords);

    broadcastToAll({
      type: 'record:delete',
      id: targetId,
      records: sharedRecords,
    });

    res.json({
      id: targetId,
      records: sharedRecords,
    });
  });

  // Vite middleware in development, static assets in production
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'));
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
