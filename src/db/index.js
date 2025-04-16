import dotenv from "dotenv";
import * as postgresDB from "./postgresqlLogic.js";
import * as supabaseDB from "./supabaseClient.js";
import { initDB as initPostgresDB } from "./db.js";

dotenv.config();

// Determine which database implementation to use based on env var
const databaseType = process.env.DATABASE_TYPE || "postgres";

// Export the appropriate database functions based on the selected type
let dbImplementation;

if (databaseType === "supabase") {
  console.log("Using Supabase database implementation");
  dbImplementation = supabaseDB;
} else {
  console.log("Using PostgreSQL database implementation");
  dbImplementation = postgresDB;
}

// Initialize the appropriate database
export async function initDB() {
  if (databaseType === "supabase") {
    return await supabaseDB.initDB();
  } else {
    return await initPostgresDB();
  }
}

// Export all functions from the selected implementation
export const processCustomerUpdate = dbImplementation.processCustomerUpdate;
export const getCompanyById = dbImplementation.getCompanyById;
export const getCustomerHistoryByCompanyId =
  dbImplementation.getCustomerHistoryByCompanyId;
export const getAllCompanies = dbImplementation.getAllCompanies;
export const getEntityHistoryForVectorSearch =
  dbImplementation.getEntityHistoryForVectorSearch;
