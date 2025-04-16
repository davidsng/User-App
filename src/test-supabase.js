import { initDB, getAllCompanies } from "./db/index.js";

async function testSupabaseConnection() {
  try {
    console.log("Initializing database connection...");
    await initDB();

    console.log("Getting all companies...");
    const companies = await getAllCompanies();

    console.log(`Found ${companies.length} companies:`);
    companies.forEach((company) => {
      console.log(`- ${company.name} (${company.id})`);
    });

    console.log("Supabase connection test successful!");
  } catch (error) {
    console.error("Error testing Supabase connection:", error);
  }
}

testSupabaseConnection();
