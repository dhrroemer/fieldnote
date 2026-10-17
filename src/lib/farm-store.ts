import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

export type Plot = {
  id: string;
  name: string;
  area: number;
  soil: string;
  state: "active" | "resting";
};

export type Planting = {
  id: string;
  plotId: string;
  crop: string;
  variety: string;
  plantedOn: string;
  expectedHarvest: string;
  status: "growing" | "ready" | "harvested";
};

export type Harvest = {
  id: string;
  plantingId: string;
  crop: string;
  quantity: number;
  unit: string;
  harvestedOn: string;
  notes: string;
};

export type FarmData = {
  plots: Plot[];
  plantings: Planting[];
  harvests: Harvest[];
};

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "farm-data.json");
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
let databaseInitialized = false;

function ensurePersistenceConfigured() {
  if (process.env.NODE_ENV === "production" && !sql) {
    throw new Error("DATABASE_URL is required for production farm storage.");
  }
}

async function initializeDatabase() {
  if (!sql || databaseInitialized) return;
  await sql`CREATE TABLE IF NOT EXISTS fieldnote_farm (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  databaseInitialized = true;
}

export function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialData(): FarmData {
  const plots: Plot[] = [
    { id: "plot-1", name: "North bed", area: 42, soil: "Loam", state: "active" },
    { id: "plot-2", name: "Orchard edge", area: 36, soil: "Sandy loam", state: "active" },
    { id: "plot-3", name: "Kitchen beds", area: 28, soil: "Rich loam", state: "active" },
    { id: "plot-4", name: "Lower field", area: 54, soil: "Clay loam", state: "active" },
    { id: "plot-5", name: "West patch", area: 32, soil: "Sandy loam", state: "resting" },
    { id: "plot-6", name: "Greenhouse", area: 18, soil: "Compost mix", state: "active" },
    { id: "plot-7", name: "Herb garden", area: 16, soil: "Rich loam", state: "active" },
    { id: "plot-8", name: "South bed", area: 40, soil: "Loam", state: "resting" },
  ];

  const plantings: Planting[] = [
    { id: "plant-1", plotId: "plot-1", crop: "Spinach", variety: "Giant Winter", plantedOn: dateOffset(-32), expectedHarvest: dateOffset(2), status: "ready" },
    { id: "plant-2", plotId: "plot-2", crop: "Carrots", variety: "Nantes 2", plantedOn: dateOffset(-67), expectedHarvest: dateOffset(12), status: "growing" },
    { id: "plant-3", plotId: "plot-3", crop: "Kale", variety: "Nero di Toscana", plantedOn: dateOffset(-54), expectedHarvest: dateOffset(5), status: "growing" },
    { id: "plant-4", plotId: "plot-4", crop: "Beets", variety: "Detroit Dark Red", plantedOn: dateOffset(-48), expectedHarvest: dateOffset(9), status: "growing" },
    { id: "plant-5", plotId: "plot-6", crop: "Lettuce", variety: "Winter Density", plantedOn: dateOffset(-28), expectedHarvest: dateOffset(1), status: "ready" },
    { id: "plant-6", plotId: "plot-7", crop: "Parsley", variety: "Moss Curled", plantedOn: dateOffset(-38), expectedHarvest: dateOffset(18), status: "growing" },
  ];

  const harvests: Harvest[] = [
    { id: "harvest-1", plantingId: "plant-5", crop: "Lettuce", quantity: 3.2, unit: "kg", harvestedOn: dateOffset(-2), notes: "First greenhouse cut" },
    { id: "harvest-2", plantingId: "plant-3", crop: "Kale", quantity: 1.8, unit: "kg", harvestedOn: dateOffset(-5), notes: "Outer leaves" },
    { id: "harvest-3", plantingId: "plant-1", crop: "Spinach", quantity: 2.4, unit: "kg", harvestedOn: dateOffset(-8), notes: "" },
  ];

  return { plots, plantings, harvests };
}

export async function readFarmData(): Promise<FarmData> {
  ensurePersistenceConfigured();
  if (sql) {
    await initializeDatabase();
    const rows = await sql`SELECT data FROM fieldnote_farm WHERE id = 'main'`;
    if (rows.length > 0) return rows[0].data as FarmData;

    const initialData = createInitialData();
    await sql`INSERT INTO fieldnote_farm (id, data)
      VALUES ('main', ${JSON.stringify(initialData)}::jsonb)
      ON CONFLICT (id) DO NOTHING`;
    const seededRows = await sql`SELECT data FROM fieldnote_farm WHERE id = 'main'`;
    return seededRows[0].data as FarmData;
  }

  mkdirSync(dataDirectory, { recursive: true });
  if (!existsSync(dataFile)) {
    const initialData = createInitialData();
    await writeFarmData(initialData);
    return initialData;
  }
  return JSON.parse(readFileSync(dataFile, "utf8")) as FarmData;
}

export async function writeFarmData(data: FarmData): Promise<void> {
  ensurePersistenceConfigured();
  if (sql) {
    await initializeDatabase();
    await sql`INSERT INTO fieldnote_farm (id, data, updated_at)
      VALUES ('main', ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()`;
    return;
  }

  mkdirSync(dataDirectory, { recursive: true });
  const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(data, null, 2), "utf8");
  renameSync(temporaryFile, dataFile);
}

export function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}