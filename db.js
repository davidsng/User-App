import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pkg;

if (!process.env.PG_CONNECTION_STRING) {
  throw new Error(
    "Missing PG_CONNECTION_STRING. Please define it in your .env file."
  );
}

export const pgClient = new Client({
  connectionString: process.env.PG_CONNECTION_STRING
});

export async function initDB() {
  await pgClient.connect();
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY,
      company_name TEXT UNIQUE,
      contact_name TEXT,
      contact_email TEXT,
      deal_value REAL,
      deal_product TEXT,
      deal_stage TEXT,
      raw_input TEXT,
      updated_at TIMESTAMP
    );
  `);
}
