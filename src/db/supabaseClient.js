import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check for required environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Please define them in your .env file."
  );
}

// Create a Supabase client with the service role key for server-side operations
// Use service role key for full database access (server-side only)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Initialize connection to Supabase
 */
export async function initDB() {
  try {
    // Perform a simple query to ensure connectivity
    const { data, error } = await supabase
      .from("companies")
      .select("id")
      .limit(1);

    if (error) throw error;
    console.log("Successfully connected to Supabase");
  } catch (error) {
    console.error("Error connecting to Supabase:", error);
    throw error;
  }
}

/**
 * Process customer data update from the schema
 * @param {Object} data - Customer data object following the schema
 * @param {Object} options - Additional options
 * @returns {Object} - Record IDs for created/updated records
 */
export async function processCustomerUpdate(data, options = {}) {
  // Extract all relevant data
  const {
    company_name,
    description,
    industry_vertical,
    sub_industry,
    b2b_or_b2c,
    size,
    website_url,
    country_hq,
    other_countries,
    revenue,
    employee_size,
    child_companies,
    customer_segment_label,
    primary_contact,
    account_team,
    company_hierarchy,
    decision_country,
    company_address,
    company_legal_entity,
    contact,
    contacts,
    deal,
    raw_input
  } = data;

  try {
    // 1. Process company data
    const companyId = await upsertCompany(
      {
        company_name,
        description,
        industry_vertical,
        sub_industry,
        b2b_or_b2c,
        size,
        website_url,
        country_hq,
        other_countries,
        revenue,
        employee_size,
        child_companies,
        customer_segment_label,
        primary_contact,
        account_team,
        company_hierarchy,
        decision_country,
        company_address,
        company_legal_entity
      },
      options
    );

    // 2. Process contacts data
    let contactIds = [];
    let primaryContactId = null;

    // Handle the new contacts array if available
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      for (const contactData of contacts) {
        // Ensure is_primary is false by default - user will set this later
        const contactWithoutPrimary = {
          ...contactData,
          is_primary: false // Override any is_primary value from the extraction
        };

        const contactId = await upsertContact(
          companyId,
          contactWithoutPrimary,
          options
        );
        contactIds.push(contactId);
      }
    }
    // Legacy support for single contact object
    else if (contact && contact.name) {
      const contactWithoutPrimary = {
        ...contact,
        is_primary: false // Override any is_primary value from the extraction
      };

      const contactId = await upsertContact(
        companyId,
        contactWithoutPrimary,
        options
      );
      contactIds.push(contactId);
    }
    // Handle case where only primary_contact string is available
    else if (primary_contact && typeof primary_contact === "string") {
      // Create a contact object from primary_contact string
      const contactObj = {
        name: primary_contact,
        email: "",
        phone: "",
        title: "",
        influence_role: "",
        is_primary: false // Never automatically set primary
      };
      const contactId = await upsertContact(companyId, contactObj, options);
      contactIds.push(contactId);
    }

    // 3. Process deal data if available
    let dealId = null;
    if (deal) {
      // If product is mentioned in the deal, ensure it exists in the products table
      let productId = null;
      if (deal.deal_product) {
        productId = await getOrCreateProduct(deal.deal_product);
      }

      dealId = await upsertDeal(companyId, productId, deal, options);
    }

    // Use the first contact as the log reference if no explicit primary exists
    const logContactId = contactIds.length > 0 ? contactIds[0] : null;

    // 4. Log the raw interaction in user_prompt_logs table
    const logId = await logCustomerInteraction(
      companyId,
      logContactId, // Use the reference contact ID for the log
      dealId,
      raw_input,
      options // Pass options for employee info if available
    );

    console.log(
      `Supabase transaction complete: company_id=${companyId}, contact_ids=[${contactIds.join(
        ", "
      )}], deal_id=${dealId || "none"}`
    );

    return {
      companyId,
      contactIds,
      dealId,
      logId
    };
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
}

/**
 * Create a history entry for tracking changes
 * @param {Object} oldValues - Previous field values
 * @param {Object} newValues - New field values
 * @param {String} entityType - Type of entity (company, contact, deal)
 * @param {Object} options - Additional options
 * @returns {Object} - History entry object
 */
function createHistoryEntry(oldValues, newValues, entityType, options = {}) {
  const { employee_id, employee_name } = options;

  return {
    timestamp: new Date().toISOString(),
    employee_id: employee_id || null,
    employee_name: employee_name || null,
    entity_type: entityType,
    changes: Object.keys(newValues).reduce((acc, key) => {
      // Only include fields that are different
      if (
        oldValues &&
        JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key]) &&
        newValues[key] !== undefined
      ) {
        acc[key] = {
          old: oldValues ? oldValues[key] : null,
          new: newValues[key]
        };
      }
      return acc;
    }, {})
  };
}

/**
 * Upsert a company record
 * @param {Object} companyData - Company data to insert/update
 * @param {Object} options - Additional options
 * @returns {String} - Company ID
 */
async function upsertCompany(companyData, options = {}) {
  const {
    company_name,
    description,
    industry_vertical,
    sub_industry,
    b2b_or_b2c,
    size,
    website_url,
    country_hq,
    other_countries,
    revenue,
    employee_size,
    child_companies,
    customer_segment_label,
    primary_contact,
    account_team,
    company_hierarchy,
    decision_country,
    company_address,
    company_legal_entity
  } = companyData;

  // First check if the company exists
  let { data: existingCompany } = await supabase
    .from("companies")
    .select("*")
    .eq("name", company_name)
    .single();

  let companyId;
  let companyHistory = [];

  // If company exists, update it
  if (existingCompany) {
    companyId = existingCompany.id;
    companyHistory = existingCompany.change_history || [];

    // Create history entry for changes
    const historyEntry = createHistoryEntry(
      existingCompany,
      companyData,
      "company",
      options
    );

    // Only add history entry if there are actual changes
    if (Object.keys(historyEntry.changes).length > 0) {
      companyHistory.push(historyEntry);
    }

    // Update the company
    const { error } = await supabase
      .from("companies")
      .update({
        description,
        industry_vertical,
        sub_industry,
        b2b_or_b2c,
        size,
        website_url,
        country_hq,
        other_countries,
        revenue,
        employee_size,
        child_companies,
        customer_segment_label,
        primary_contact,
        account_team,
        company_hierarchy,
        decision_country,
        company_address,
        company_legal_entity,
        updated_at: new Date(),
        change_history: companyHistory
      })
      .eq("id", companyId);

    if (error) throw error;
  }
  // If company doesn't exist, create a new one
  else {
    companyId = uuidv4();

    // Create a new history entry for company creation
    const historyEntry = createHistoryEntry(
      null,
      companyData,
      "company",
      options
    );

    // Only add history if there are actual values
    if (Object.keys(historyEntry.changes).length > 0) {
      companyHistory.push(historyEntry);
    }

    // Insert the new company
    const { error } = await supabase.from("companies").insert({
      id: companyId,
      name: company_name,
      description,
      industry_vertical,
      sub_industry,
      b2b_or_b2c,
      size,
      website_url,
      country_hq,
      other_countries,
      revenue,
      employee_size,
      child_companies,
      customer_segment_label,
      primary_contact,
      account_team,
      company_hierarchy,
      decision_country,
      company_address,
      company_legal_entity,
      change_history: companyHistory
    });

    if (error) throw error;
  }

  return companyId;
}

/**
 * Upsert a contact record
 * @param {String} companyId - Company ID
 * @param {Object} contactData - Contact data to insert/update
 * @param {Object} options - Additional options
 * @returns {String} - Contact ID
 */
async function upsertContact(companyId, contactData, options = {}) {
  const { name, email, phone, title, influence_role, is_primary } = contactData;

  // Get company name for denormalized field
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  if (!company) {
    throw new Error(`Company with ID ${companyId} not found`);
  }

  // Check if contact exists by name and company
  let { data: existingContact } = await supabase
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .eq("name", name)
    .single();

  let contactId;
  let contactHistory = [];

  // If contact exists, update it
  if (existingContact) {
    contactId = existingContact.id;
    contactHistory = existingContact.change_history || [];

    // Create history entry for changes
    const historyEntry = createHistoryEntry(
      existingContact,
      contactData,
      "contact",
      options
    );

    // Only add history if there are actual changes
    if (Object.keys(historyEntry.changes).length > 0) {
      contactHistory.push(historyEntry);
    }

    // Update the contact
    const { error } = await supabase
      .from("contacts")
      .update({
        email,
        phone,
        title,
        influence_role,
        is_primary,
        company_name: company.name,
        updated_at: new Date(),
        change_history: contactHistory
      })
      .eq("id", contactId);

    if (error) throw error;
  }
  // If contact doesn't exist, create a new one
  else {
    contactId = uuidv4();

    // Create a new history entry for contact creation
    const historyEntry = createHistoryEntry(
      null,
      contactData,
      "contact",
      options
    );

    // Only add history if there are actual values
    if (Object.keys(historyEntry.changes).length > 0) {
      contactHistory.push(historyEntry);
    }

    // Insert the new contact
    const { error } = await supabase.from("contacts").insert({
      id: contactId,
      company_id: companyId,
      name,
      email,
      phone,
      title,
      influence_role,
      is_primary,
      company_name: company.name,
      change_history: contactHistory
    });

    if (error) throw error;
  }

  return contactId;
}

/**
 * Get or create a product
 * @param {String} productName - Product name
 * @returns {String} - Product ID
 */
async function getOrCreateProduct(productName) {
  // Check if product exists
  let { data: existingProduct } = await supabase
    .from("products")
    .select("id")
    .eq("name", productName)
    .single();

  if (existingProduct) {
    return existingProduct.id;
  }

  // Create a new product
  const productId = uuidv4();

  const { error } = await supabase.from("products").insert({
    id: productId,
    name: productName
  });

  if (error) throw error;

  return productId;
}

/**
 * Upsert a deal record
 * @param {String} companyId - Company ID
 * @param {String} productId - Product ID
 * @param {Object} dealData - Deal data to insert/update
 * @param {Object} options - Additional options
 * @returns {String} - Deal ID
 */
async function upsertDeal(companyId, productId, dealData, options = {}) {
  const {
    deal_id,
    deal_state,
    deal_amount,
    deal_amount_currency,
    stage,
    deal_payment_status,
    deal_start_date,
    deal_end_date,
    deal_expected_signing_date,
    deal_signing_date,
    deal_policy_state,
    deal_health,
    payment_frequency,
    acquisition_channel_source,
    acquisition_campaign_source,
    deal_activity
  } = dealData;

  // Process date fields - convert empty strings to null
  const processedDealData = {
    deal_id,
    deal_state,
    deal_amount,
    deal_amount_currency,
    stage,
    deal_payment_status,
    // Convert empty date strings to null values to prevent PostgreSQL errors
    deal_start_date: deal_start_date === "" ? null : deal_start_date,
    deal_end_date: deal_end_date === "" ? null : deal_end_date,
    deal_expected_signing_date:
      deal_expected_signing_date === "" ? null : deal_expected_signing_date,
    deal_signing_date: deal_signing_date === "" ? null : deal_signing_date,
    deal_policy_state,
    deal_health,
    payment_frequency,
    acquisition_channel_source,
    acquisition_campaign_source,
    deal_activity
  };

  // Get company and product names for denormalized fields
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  let productName = null;
  if (productId) {
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();

    if (product) {
      productName = product.name;
    }
  }

  // Check if deal exists by deal_id (if provided) or by company and product
  let existingDealQuery = supabase
    .from("deals")
    .select("*")
    .eq("company_id", companyId);

  if (deal_id) {
    existingDealQuery = existingDealQuery.eq("deal_id", deal_id);
  } else if (productId) {
    existingDealQuery = existingDealQuery.eq("product_id", productId);
  }

  let { data: existingDeals } = await existingDealQuery;
  let existingDeal =
    existingDeals && existingDeals.length > 0 ? existingDeals[0] : null;

  let dealId;
  let dealHistory = [];

  // If deal exists, update it
  if (existingDeal) {
    dealId = existingDeal.id;
    dealHistory = existingDeal.change_history || [];

    // Create history entry for changes
    const historyEntry = createHistoryEntry(
      existingDeal,
      processedDealData, // Use processed data for history
      "deal",
      options
    );

    // Only add history if there are actual changes
    if (Object.keys(historyEntry.changes).length > 0) {
      dealHistory.push(historyEntry);
    }

    // Update the deal with processed date values
    const { error } = await supabase
      .from("deals")
      .update({
        deal_id,
        deal_state,
        deal_amount,
        deal_amount_currency,
        stage,
        deal_payment_status,
        deal_start_date: processedDealData.deal_start_date,
        deal_end_date: processedDealData.deal_end_date,
        deal_expected_signing_date:
          processedDealData.deal_expected_signing_date,
        deal_signing_date: processedDealData.deal_signing_date,
        deal_policy_state,
        deal_health,
        payment_frequency,
        acquisition_channel_source,
        acquisition_campaign_source,
        deal_activity,
        company_name: company.name,
        product_name: productName,
        updated_at: new Date(),
        change_history: dealHistory
      })
      .eq("id", dealId);

    if (error) throw error;
  }
  // If deal doesn't exist, create a new one
  else {
    dealId = uuidv4();

    // Create a new history entry for deal creation
    const historyEntry = createHistoryEntry(
      null,
      processedDealData,
      "deal",
      options
    );

    // Only add history if there are actual values
    if (Object.keys(historyEntry.changes).length > 0) {
      dealHistory.push(historyEntry);
    }

    // Insert the new deal with processed date values
    const { error } = await supabase.from("deals").insert({
      id: dealId,
      company_id: companyId,
      product_id: productId,
      deal_id,
      deal_state,
      deal_amount,
      deal_amount_currency,
      stage,
      deal_payment_status,
      deal_start_date: processedDealData.deal_start_date,
      deal_end_date: processedDealData.deal_end_date,
      deal_expected_signing_date: processedDealData.deal_expected_signing_date,
      deal_signing_date: processedDealData.deal_signing_date,
      deal_policy_state,
      deal_health,
      payment_frequency,
      acquisition_channel_source,
      acquisition_campaign_source,
      deal_activity,
      company_name: company.name,
      product_name: productName,
      change_history: dealHistory
    });

    if (error) throw error;
  }

  return dealId;
}

/**
 * Log a customer interaction
 * @param {String} companyId - Company ID
 * @param {String} contactId - Contact ID
 * @param {String} dealId - Deal ID
 * @param {String} rawInput - Raw input text
 * @param {Object} options - Additional options
 * @returns {String} - Log ID
 */
async function logCustomerInteraction(
  companyId,
  contactId,
  dealId,
  rawInput,
  options = {}
) {
  const { employee_id, employee_name } = options;

  const logId = uuidv4();

  const { error } = await supabase.from("user_prompt_logs").insert({
    id: logId,
    company_id: companyId,
    contact_id: contactId,
    deal_id: dealId,
    raw_input: rawInput,
    interaction_type: "user_input",
    interaction_data: { source: "app" },
    employee_id,
    employee_name
  });

  if (error) throw error;

  return logId;
}

/**
 * Get a company by ID
 * @param {String} companyId - Company ID
 * @returns {Object} - Company record
 */
export async function getCompanyById(companyId) {
  const { data, error } = await supabase
    .from("companies")
    .select(
      `
      *,
      contacts(*),
      deals(*)
    `
    )
    .eq("id", companyId)
    .single();

  if (error) throw error;

  return data;
}

/**
 * Get customer interaction history by company ID
 * @param {String} companyId - Company ID
 * @param {Object} options - Additional options
 * @returns {Array} - History records
 */
export async function getCustomerHistoryByCompanyId(
  companyId,
  options = { limit: 100, offset: 0 }
) {
  const { limit, offset } = options;

  const { data, error } = await supabase
    .from("user_prompt_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("interaction_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return data;
}

/**
 * Get all companies
 * @param {Object} options - Additional options
 * @returns {Array} - Company records
 */
export async function getAllCompanies(options = { limit: 100, offset: 0 }) {
  const { limit, offset } = options;

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return data;
}

/**
 * Get entity history for vector search
 * @param {String} entityType - Type of entity (company, contact, deal)
 * @param {String} entityId - Entity ID
 * @returns {Object} - Entity record with history
 */
export async function getEntityHistoryForVectorSearch(entityType, entityId) {
  let tableMap = {
    company: "companies",
    contact: "contacts",
    deal: "deals"
  };

  const tableName = tableMap[entityType];

  if (!tableName) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", entityId)
    .single();

  if (error) throw error;

  return data;
}
