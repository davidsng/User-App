import express from "express";
import cors from "cors";
import {
  processCustomerUpdate,
  getCompanyById,
  getCustomerHistoryByCompanyId,
  getAllCompanies
} from "./db/postgresqlLogic.js";
import { initDB } from "./db/db.js";
import { runMigrations } from "./db/migrateDatabases.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
async function initializeDatabase() {
  try {
    await initDB();
    await runMigrations();
    console.log("API server database initialized");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

// API Routes

// Get all companies (latest state)
app.get("/api/companies", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const companies = await getAllCompanies({ limit, offset });
    res.json({ success: true, data: companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch companies" });
  }
});

// Get company by ID
app.get("/api/companies/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    const companyData = await getCompanyById(companyId);

    if (!companyData) {
      return res
        .status(404)
        .json({ success: false, error: "Company not found" });
    }

    res.json({ success: true, data: companyData });
  } catch (error) {
    console.error(`Error fetching company ${req.params.companyId}:`, error);
    res.status(500).json({ success: false, error: "Failed to fetch company" });
  }
});

// Get company history
app.get("/api/companies/:companyId/history", async (req, res) => {
  try {
    const { companyId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const history = await getCustomerHistoryByCompanyId(companyId, {
      limit,
      offset
    });

    res.json({ success: true, data: history });
  } catch (error) {
    console.error(
      `Error fetching history for company ${req.params.companyId}:`,
      error
    );
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch company history" });
  }
});

// Process new customer data
app.post("/api/customer-updates", async (req, res) => {
  try {
    const customerData = req.body;

    // Validate required fields
    if (!customerData.company_name || !customerData.raw_input) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: company_name and raw_input are required"
      });
    }

    // Validate contact if provided
    if (customerData.contact && !customerData.contact.name) {
      return res.status(400).json({
        success: false,
        error: "Contact must have a name field if provided"
      });
    }

    // Validate deal if provided
    if (customerData.deal) {
      // No specific validation here as the schema allows flexible deal data
      // Just ensure it's an object
      if (typeof customerData.deal !== "object") {
        return res.status(400).json({
          success: false,
          error: "Deal must be an object if provided"
        });
      }
    }

    // Process the customer data
    const result = await processCustomerUpdate(customerData);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Error processing customer update:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process customer update",
      message: error.message
    });
  }
});

// Start the server
app.listen(PORT, async () => {
  await initializeDatabase();
  console.log(`API server running on port ${PORT}`);
});

export default app;
