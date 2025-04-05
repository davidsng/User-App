import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pgClient } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run migrations in order from the migrations directory
 * @param {Object} existingClient - Optional existing database client
 */
async function runMigrations(existingClient) {
  let client = existingClient;
  let shouldDisconnect = false;

  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir).sort();

    // Connect to the database if no client provided
    if (!client) {
      client = pgClient;
      await client.connect();
      shouldDisconnect = true;
    }

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const appliedResult = await client.query("SELECT name FROM migrations");
    const appliedMigrations = new Set(
      appliedResult.rows.map((row) => row.name)
    );

    // Apply missing migrations
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      // Start a transaction for this migration
      await client.query("BEGIN");

      try {
        // Run the migration
        await client.query(sql);

        // Mark as applied
        await client.query("INSERT INTO migrations (name) VALUES ($1)", [file]);

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`Error applying migration ${file}:`, error);
        throw error;
      }
    }
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  } finally {
    // Only disconnect if we created the connection
    if (shouldDisconnect) {
      await client.end();
    }
  }
}

// Run migrations when script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations().catch(console.error);
}

export { runMigrations };
