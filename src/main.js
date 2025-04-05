import OpenAI from "openai";
import dotenv from "dotenv";
import { pgClient, initDB } from "./db/db.js";
import {
  processCustomerUpdate,
  getCustomerHistoryByCompanyId,
  getCompanyById,
  getEntityHistoryForVectorSearch
} from "./db/postgresqlLogic.js";
import { openai } from "./utils/embeddingService.js";
import {
  initPineconeVectorStore,
  upsertVectorRecord,
  searchVectors,
  batchUpsertVectorRecords
} from "./utils/pineconeVectorStore.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { customerObjectSchema } from "./schemas/customerObjectSchema.js";
import { runMigrations } from "./db/migrateDatabases.js";

// Load environment variables
dotenv.config();

// Get today's date in YYYY-MM-DD format for system prompts
const today = new Date();
const todayFormatted = today.toISOString().split("T")[0]; // YYYY-MM-DD

// Check if migrations should be run (e.g., via command line argument)
const shouldRunMigrations = process.argv.includes("--run-migrations");

async function main() {
  try {
    // 1) Initialize database connection
    try {
      await initDB();

      // Only run migrations if explicitly requested
      if (shouldRunMigrations) {
        console.log("Running database migrations...");
        await runMigrations(pgClient);
        console.log("Migrations completed");
      }
    } catch (dbError) {
      console.error("Error initializing database:", dbError);
      throw dbError;
    }

    // 2) Init Pinecone Vector Store
    try {
      await initPineconeVectorStore();
    } catch (pineconeError) {
      console.error("Error initializing Pinecone Vector Store:", pineconeError);
      throw pineconeError;
    }

    // 3) Extract structured data from unstructured text
    try {
      const unstructuredText =
        "Spoke to Daniel from Spotify. US$90K deal for payments product. Spotify.com. Close by June 20. Matthew is the AE on this deal. ";

      // Log the unstructured input (requirement #1)
      console.log("Unstructured input received:", unstructuredText);

      // 4) GPT system prompt
      const systemPrompt =
        "You are an AI data extraction assistant specialized in go-to-market (GTM) data extraction. " +
        "Your task is to convert unstructured input—specifically containing GTM-related details such " +
        "as sales pipeline information, lead sources, acquisition channels, customer engagement metrics, " +
        "and related financial and operational data—into a structured JSON object that exactly conforms " +
        "to our unified GTM Customer Data Model. " +
        "\n\n" +
        "CONTACT EXTRACTION INSTRUCTIONS:\n" +
        "1. Extract ALL contacts mentioned in the text into a 'contacts' array.\n" +
        "2. For each contact, include name, email, phone, title, and influence_role if available.\n" +
        "3. DO NOT mark any contact as is_primary=true - this is a user decision.\n" +
        "4. Simply extract the contacts as mentioned in the text without prioritizing any of them.\n" +
        "5. If there is a clear main contact mentioned, you can include their name in the primary_contact field, but this will be confirmed by the user later.\n\n" +
        `CRITICAL DATE FORMATTING INSTRUCTIONS (Today's date is ${todayFormatted}):\n` +
        "1. ALL dates MUST be formatted as YYYY-MM-DD strings (ISO 8601 date format).\n" +
        "2. NEVER include time parts in any date field.\n" +
        "3. NEVER include natural language date expressions in your output (like 'end of Q2', 'next month', etc.).\n" +
        "4. ALWAYS convert these expressions to precise calendar dates before including them in your response.\n" +
        "5. If the exact date is unclear, make a reasonable inference based on context.\n" +
        "6. Use today's date as a reference point for relative expressions.\n\n" +
        "DEAL DATE FIELD SELECTION GUIDANCE:\n" +
        "- deal_expected_signing_date: Use when the text mentions 'close by', 'sign by', 'finalize by', or is about WHEN a deal will be signed in the future\n" +
        "- deal_signing_date: Use only when a deal has ALREADY been signed (past tense)\n" +
        "- deal_start_date: Use for when a contract/service BEGINS or STARTS\n" +
        "- deal_end_date: Use for when a contract/service ENDS or EXPIRES\n\n" +
        "Examples of required conversions:\n" +
        `- 'end of Q2' → '${today.getFullYear()}-06-30'\n` +
        `- 'end of the year' → '${today.getFullYear()}-12-31'\n` +
        `- 'next week' → '${
          new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        }'\n` +
        `- 'beginning of Q3' → '${today.getFullYear()}-07-01'\n` +
        `- 'mid-May' → '${today.getFullYear()}-05-15'\n` +
        `- 'June 1' → '${today.getFullYear()}-06-01'\n` +
        `- 'in a month' → '${
          new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        }'\n` +
        `- 'Q1' → '${today.getFullYear()}-03-31'\n` +
        `- 'Q2' → '${today.getFullYear()}-06-30'\n` +
        `- 'Q3' → '${today.getFullYear()}-09-30'\n` +
        `- 'Q4' → '${today.getFullYear()}-12-31'\n\n` +
        "If the year is not specified, use the current year. If a month is mentioned without a day, use the 1st day for 'beginning/start of' expressions and the last day of the month for 'end of' expressions. For 'mid-month' expressions, use the 15th.";

      // Note: TBC if I want to define the list of products and the deal stages and use as enum
      const product_array = ["payments", "analytics", "infrastructure"];
      const deal_stage_array = [
        "discovery",
        "negotiation",
        "closed_won",
        "closed_lost"
      ];

      let extractedData;
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: unstructuredText }
          ],
          functions: [customerObjectSchema],
          function_call: { name: "customer_update" }
        });

        extractedData = JSON.parse(
          response.choices[0].message.function_call.arguments
        );

        // Log the structured data (requirement #2)
        console.log("Data extracted:", JSON.stringify(extractedData, null, 2));
      } catch (aiError) {
        console.error("Error calling OpenAI:", aiError);
        throw aiError;
      }

      // Define date fields to process
      const dateFields = [
        "deal.deal_start_date",
        "deal.deal_end_date",
        "deal.deal_expected_signing_date",
        "deal.deal_signing_date"
      ];

      // Process natural language dates only if needed
      let processedData = extractedData;
      let needsDateProcessing = false;

      // Check if we need date processing
      if (extractedData.deal) {
        for (const field of [
          "deal_start_date",
          "deal_end_date",
          "deal_expected_signing_date",
          "deal_signing_date"
        ]) {
          if (
            extractedData.deal[field] &&
            typeof extractedData.deal[field] === "string" &&
            !/^\d{4}-\d{2}-\d{2}$/.test(extractedData.deal[field])
          ) {
            needsDateProcessing = true;
            console.log(
              `Found natural language date: ${field} = "${extractedData.deal[field]}"`
            );
            break;
          }
        }
      }

      // Only process dates if we found natural language date expressions
      if (needsDateProcessing) {
        console.log("Processing natural language dates with local parser...");
        processedData = processDateFields(extractedData, dateFields);

        // Log the differences
        if (JSON.stringify(extractedData) !== JSON.stringify(processedData)) {
          console.log(
            "Dates processed from natural language to formatted dates."
          );
        }
      }

      // 6) Store the extracted data in PostgreSQL
      const result = await processCustomerUpdate(
        processedData,
        {
          source: "OpenAI extraction",
          userId: "system",
          userName: "Automated Process"
        },
        pgClient
      );
      const { companyId, contactIds, dealId } = result;

      // Get history data for vector search
      const companyHistory = await getEntityHistoryForVectorSearch(
        "company",
        companyId
      );
      let historyText = "";

      if (companyHistory && companyHistory.length > 0) {
        historyText =
          "HISTORY:\n" +
          companyHistory
            .map((entry) => `${entry.timestamp} - ${entry.summary}`)
            .join("\n");
      }

      // 7) Prepare metadata for vector storage
      const textForEmbedding = `COMPANY: ${extractedData.company_name}
INDUSTRY: ${extractedData.industry_vertical || ""}
SIZE: ${extractedData.size || ""}
LOCATION: ${extractedData.country_hq || ""}
PRIMARY CONTACT: ${extractedData.primary_contact || ""}
CONTACTS: ${
        extractedData.contacts
          ? extractedData.contacts.map((c) => c.name).join(", ")
          : ""
      }
B2B_OR_B2C: ${extractedData.b2b_or_b2c || ""}
SUB_INDUSTRY: ${extractedData.sub_industry || ""}
WEBSITE: ${extractedData.website_url || ""}
OTHER_COUNTRIES: ${
        extractedData.other_countries
          ? JSON.stringify(extractedData.other_countries)
          : ""
      }
REVENUE: ${extractedData.revenue || ""}
EMPLOYEE_SIZE: ${extractedData.employee_size || ""}
CUSTOMER_SEGMENT: ${extractedData.customer_segment_label || ""}
DEAL STATE: ${extractedData.deal?.deal_state || ""}
DEAL AMOUNT: ${extractedData.deal?.deal_amount || ""}
STAGE: ${extractedData.deal?.stage || ""}
EXPECTED SIGNING: ${extractedData.deal?.deal_expected_signing_date || ""}
ACTUAL SIGNING: ${extractedData.deal?.deal_signing_date || ""}
ACQUISITION: ${extractedData.deal?.acquisition_channel_source || ""}
${historyText}
NOTES: ${extractedData.raw_input}`;

      const metadata = {
        // Company fields
        company_id: companyId,
        company_name: extractedData.company_name,
        description: extractedData.description,
        industry_vertical: extractedData.industry_vertical,
        sub_industry: extractedData.sub_industry,
        b2b_or_b2c: extractedData.b2b_or_b2c,
        size: extractedData.size,
        website_url: extractedData.website_url,
        country_hq: extractedData.country_hq,
        revenue: extractedData.revenue,
        employee_size: extractedData.employee_size,
        customer_segment_label: extractedData.customer_segment_label,
        primary_contact: extractedData.primary_contact,
        company_hierarchy: extractedData.company_hierarchy,
        decision_country: extractedData.decision_country,
        company_address: extractedData.company_address,
        company_legal_entity: extractedData.company_legal_entity,

        // Arrays as strings to avoid issues with Pinecone metadata
        other_countries: extractedData.other_countries
          ? JSON.stringify(extractedData.other_countries)
          : null,
        child_companies: extractedData.child_companies
          ? JSON.stringify(extractedData.child_companies)
          : null,
        account_team: extractedData.account_team
          ? JSON.stringify(extractedData.account_team)
          : null,

        // Contact arrays as strings
        contacts: extractedData.contacts
          ? JSON.stringify(extractedData.contacts)
          : null,

        // Legacy contact fields for backward compatibility
        contact_id: contactIds[0],
        contact_name: extractedData.contact?.name,
        contact_email: extractedData.contact?.email,
        contact_phone: extractedData.contact?.phone,
        contact_title: extractedData.contact?.title,
        contact_influence_role: extractedData.contact?.influence_role,

        // Deal fields
        deal_id: dealId,
        deal_state: extractedData.deal?.deal_state,
        deal_amount: extractedData.deal?.deal_amount,
        deal_amount_currency: extractedData.deal?.deal_amount_currency,
        deal_stage: extractedData.deal?.stage,
        deal_payment_status: extractedData.deal?.deal_payment_status,
        deal_start_date: extractedData.deal?.deal_start_date,
        deal_end_date: extractedData.deal?.deal_end_date,
        deal_expected_signing_date:
          extractedData.deal?.deal_expected_signing_date,
        deal_signing_date: extractedData.deal?.deal_signing_date,
        deal_policy_state: extractedData.deal?.deal_policy_state,
        payment_frequency: extractedData.deal?.payment_frequency,
        acquisition_channel_source:
          extractedData.deal?.acquisition_channel_source,
        acquisition_campaign_source:
          extractedData.deal?.acquisition_campaign_source,
        deal_activity: extractedData.deal?.deal_activity,

        // Original input
        raw_input: extractedData.raw_input,

        // Record IDs for referencing
        record_id: companyId
      };

      // Store in Pinecone Vector Store (logs handled by pineconeVectorStore.js - requirement #4)
      try {
        await upsertVectorRecord(
          companyId,
          textForEmbedding,
          metadata,
          companyHistory
        );
      } catch (storeError) {
        console.error("Error storing data in Pinecone:", storeError);
      }

      // Remove all the unnecessary search/fetch logs
      // 9) Search Pinecone for stored information
      try {
        const query = "What deal do we have with ABC Company?";

        // Search with minimum score filter
        const results = await searchVectors(query, 5, 0.5);

        // Process search results
        if (results.length > 0) {
        } else {
        }
      } catch (searchError) {
        console.error("Error searching Pinecone:", searchError);
      }

      // 10) Fetch from PostgreSQL for verification
      try {
        const companyData = await getCompanyById(companyId);

        // Also get company history
        const companyHistory = await getCustomerHistoryByCompanyId(companyId, {
          limit: 5
        });
      } catch (pgFetchError) {
        console.error("Error fetching from PostgreSQL:", pgFetchError);
      }
    } catch (error) {
      console.error("Error processing data:", error);
    } finally {
      try {
        await pgClient.end();
      } catch (e) {
        console.error("Error closing database connection:", e);
      }
    }
  } catch (error) {
    console.error("Application error:", error);
  }
}

main();
