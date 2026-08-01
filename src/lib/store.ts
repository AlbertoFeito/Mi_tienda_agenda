import { Capacitor } from '@capacitor/core';

/**
 * Storage backend for the app.
 *
 * The app ships as a native Android APK. On the device, data is persisted in a
 * real, local SQLite database file via `@capacitor-community/sqlite` — no
 * network, single user, fully offline.
 *
 * When the exact same code runs in a normal browser (development preview,
 * automated tests) there is no native SQLite plugin available, so we fall back
 * to a `localStorage`-backed store with an identical interface. The device
 * build never uses this fallback.
 *
 * Both backends use the same simple "document store" model: each table is
 * `(id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT)` where `data` is the JSON
 * encoding of the record. This keeps the two backends byte-for-byte compatible
 * and avoids brittle column migrations as the data model evolves.
 */

export const TABLE_NAMES = [
  'products',
  'sales',
  'customers',
  'owners',
  'installments',
  'installmentPayments',
  'ownerPayments',
  'stockMovements',
  'stockLots',
  'settings',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

export interface StoredRow {
  id: number;
  data: Record<string, unknown>;
}

export interface StorageBackend {
  init(): Promise<void>;
  selectAll(table: TableName): Promise<StoredRow[]>;
  selectOne(table: TableName, id: number): Promise<StoredRow | undefined>;
  insert(table: TableName, data: Record<string, unknown>): Promise<number>;
  insertWithId(table: TableName, id: number, data: Record<string, unknown>): Promise<void>;
  updateById(table: TableName, id: number, data: Record<string, unknown>): Promise<void>;
  deleteById(table: TableName, id: number): Promise<void>;
  clearTable(table: TableName): Promise<void>;
}

const DB_NAME = 'mitienda';

/* -------------------------------------------------------------------------- */
/*  Native SQLite backend (@capacitor-community/sqlite)                       */
/* -------------------------------------------------------------------------- */

class SqliteBackend implements StorageBackend {
  // Typed loosely to avoid importing plugin types at module load time.
  private conn: any = null;

  async init(): Promise<void> {
    if (this.conn) return;
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const sqlite = new SQLiteConnection(CapacitorSQLite);

    const retCC = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    if (retCC.result && isConn) {
      this.conn = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      this.conn = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }
    await this.conn.open();

    const schema = TABLE_NAMES.map(
      (t) => `CREATE TABLE IF NOT EXISTS ${t} (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL);`,
    ).join('\n');
    await this.conn.execute(schema);
  }

  async selectAll(table: TableName): Promise<StoredRow[]> {
    const res = await this.conn.query(`SELECT id, data FROM ${table} ORDER BY id;`);
    return (res.values ?? []).map((v: { id: number; data: string }) => ({
      id: v.id,
      data: JSON.parse(v.data),
    }));
  }

  async selectOne(table: TableName, id: number): Promise<StoredRow | undefined> {
    const res = await this.conn.query(`SELECT id, data FROM ${table} WHERE id = ?;`, [id]);
    const row = (res.values ?? [])[0];
    return row ? { id: row.id, data: JSON.parse(row.data) } : undefined;
  }

  async insert(table: TableName, data: Record<string, unknown>): Promise<number> {
    const res = await this.conn.run(`INSERT INTO ${table} (data) VALUES (?);`, [JSON.stringify(data)]);
    return res.changes?.lastId ?? 0;
  }

  async insertWithId(table: TableName, id: number, data: Record<string, unknown>): Promise<void> {
    await this.conn.run(`INSERT INTO ${table} (id, data) VALUES (?, ?);`, [id, JSON.stringify(data)]);
  }

  async updateById(table: TableName, id: number, data: Record<string, unknown>): Promise<void> {
    await this.conn.run(`UPDATE ${table} SET data = ? WHERE id = ?;`, [JSON.stringify(data), id]);
  }

  async deleteById(table: TableName, id: number): Promise<void> {
    await this.conn.run(`DELETE FROM ${table} WHERE id = ?;`, [id]);
  }

  async clearTable(table: TableName): Promise<void> {
    await this.conn.execute(`DELETE FROM ${table};`);
  }
}

/* -------------------------------------------------------------------------- */
/*  localStorage fallback backend (browser dev / tests only)                  */
/* -------------------------------------------------------------------------- */

interface MemTable {
  rows: StoredRow[];
  seq: number;
}

class LocalStorageBackend implements StorageBackend {
  private mem: Record<TableName, MemTable> | null = null;
  private readonly key = `${DB_NAME}_db`;

  async init(): Promise<void> {
    if (this.mem) return;
    const empty = () =>
      Object.fromEntries(TABLE_NAMES.map((t) => [t, { rows: [], seq: 0 }])) as unknown as Record<
        TableName,
        MemTable
      >;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.key) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        const base = empty();
        for (const t of TABLE_NAMES) {
          if (parsed[t]) base[t] = parsed[t];
        }
        this.mem = base;
      } else {
        this.mem = empty();
      }
    } catch {
      this.mem = empty();
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.key, JSON.stringify(this.mem));
      }
    } catch {
      /* ignore quota/serialization errors */
    }
  }

  private table(name: TableName): MemTable {
    if (!this.mem) throw new Error('LocalStorageBackend not initialized');
    return this.mem[name];
  }

  // Deep-clone via JSON so callers can't mutate stored rows, and so date
  // objects are serialized to ISO strings (mirroring the SQLite backend).
  private clone(data: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(data));
  }

  async selectAll(table: TableName): Promise<StoredRow[]> {
    return this.table(table).rows.map((r) => ({ id: r.id, data: this.clone(r.data) }));
  }

  async selectOne(table: TableName, id: number): Promise<StoredRow | undefined> {
    const row = this.table(table).rows.find((r) => r.id === id);
    return row ? { id: row.id, data: this.clone(row.data) } : undefined;
  }

  async insert(table: TableName, data: Record<string, unknown>): Promise<number> {
    const t = this.table(table);
    const id = ++t.seq;
    t.rows.push({ id, data: this.clone(data) });
    this.persist();
    return id;
  }

  async insertWithId(table: TableName, id: number, data: Record<string, unknown>): Promise<void> {
    const t = this.table(table);
    t.rows = t.rows.filter((r) => r.id !== id);
    t.rows.push({ id, data: this.clone(data) });
    if (id > t.seq) t.seq = id;
    this.persist();
  }

  async updateById(table: TableName, id: number, data: Record<string, unknown>): Promise<void> {
    const t = this.table(table);
    const row = t.rows.find((r) => r.id === id);
    if (row) {
      row.data = this.clone(data);
      this.persist();
    }
  }

  async deleteById(table: TableName, id: number): Promise<void> {
    const t = this.table(table);
    t.rows = t.rows.filter((r) => r.id !== id);
    this.persist();
  }

  async clearTable(table: TableName): Promise<void> {
    const t = this.table(table);
    t.rows = [];
    t.seq = 0;
    this.persist();
  }
}

/* -------------------------------------------------------------------------- */

export const isNativeSqlite = Capacitor.isNativePlatform();

export const backend: StorageBackend = isNativeSqlite
  ? new SqliteBackend()
  : new LocalStorageBackend();

let readyPromise: Promise<void> | null = null;

/** Ensure the backend is initialized exactly once. */
export function ensureReady(): Promise<void> {
  if (!readyPromise) readyPromise = backend.init();
  return readyPromise;
}
