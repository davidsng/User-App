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

/**
 * Initialize database connection
 * Database schema is managed by the migration system in migrateDatabases.js
 */
export async function initDB() {
  try {
    await pgClient.connect();
  } catch (error) {
    console.error("Error connecting to PostgreSQL:", error);
    throw error;
  }
}
