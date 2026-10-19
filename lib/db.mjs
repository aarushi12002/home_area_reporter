import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.mjs";

let client;
let database;

export function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabase() {
  if (!hasDatabaseConfig())
    throw new Error("DATABASE_URL is required for persistent reports.");
  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      max: process.env.NODE_ENV === "production" ? 5 : 2,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    database = drizzle(client, { schema });
  }
  return { db: database, sql: client };
}

export async function closeDatabase() {
  if (client) await client.end({ timeout: 5 });
  client = undefined;
  database = undefined;
}
