import { v4 as uuidv4 } from "uuid";
import { pgClient } from "./db.js";

/**
 * Process customer data update from the schema
 * @param {Object} data - Customer data object following the schema
 * @param {Object} options - Additional options
 * @param {Object} existingClient - Optional existing database client
 * @returns {Object} - Record IDs for created/updated records
 */
export async function processCustomerUpdate(
  data,
  options = {},
  existingClient = null
) {
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

  // Start a transaction to ensure data consistency
  let client;
  let shouldReleaseClient = false;

  try {
    // Use the existing client or create a new one
    if (existingClient) {
      client = existingClient;
    } else {
      client = await pgClient.connect();
      shouldReleaseClient = true;
    }

    await client.query("BEGIN");

    // 1. Process company data
    const companyId = await upsertCompany(
      client,
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
          client,
          companyId,
          contactWithoutPrimary,
          options
        );
        contactIds.push(contactId);

        // We no longer automatically set primaryContactId based on contact name matching
        // primaryContactId will be set by the user directly through the UI
      }
    }
    // Legacy support for single contact object
    else if (contact && contact.name) {
      const contactWithoutPrimary = {
        ...contact,
        is_primary: false // Override any is_primary value from the extraction
      };

      const contactId = await upsertContact(
        client,
        companyId,
        contactWithoutPrimary,
        options
      );
      contactIds.push(contactId);
      // No automatic primary contact designation
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
      const contactId = await upsertContact(
        client,
        companyId,
        contactObj,
        options
      );
      contactIds.push(contactId);
      // No automatic primary contact designation
    }

    // 3. Process deal data if available
    let dealId = null;
    if (deal) {
      // If product is mentioned in the deal, ensure it exists in the products table
      let productId = null;
      if (deal.deal_product) {
        productId = await getOrCreateProduct(client, deal.deal_product);
      }

      dealId = await upsertDeal(client, companyId, productId, deal, options);
    }

    // Use the first contact as the log reference if no explicit primary exists
    const logContactId = contactIds.length > 0 ? contactIds[0] : null;

    // 4. Log the raw interaction in user_prompt_logs table
    const logId = await logCustomerInteraction(
      client,
      companyId,
      logContactId, // Use the reference contact ID for the log
      dealId,
      raw_input,
      options // Pass options for employee info if available
    );

    await client.query("COMMIT");

    console.log(
      `PostgreSQL transaction complete: company_id=${companyId}, contact_ids=[${contactIds.join(
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
    await client.query("ROLLBACK");
    console.error("Transaction failed:", error);
    throw error;
  } finally {
    if (shouldReleaseClient) {
      client.release();
    }
  }
}

/**
 * Helper function to create an enhanced history entry
 * @param {Object} oldValues - Previous field values
 * @param {Object} newValues - New field values
 * @param {string} entityType - Type of entity (company, contact, deal)
 * @param {Object} options - Additional options
 * @returns {Object} Enhanced history entry
 */
function createHistoryEntry(oldValues, newValues, entityType, options = {}) {
  // Determine which fields have changed
  const changedFields = [];
  const previousValues = {};

  for (const [key, newValue] of Object.entries(newValues)) {
    // Skip fields we don't want to track
    if (["id", "created_at", "updated_at", "change_history"].includes(key)) {
      continue;
    }

    // Only track fields that have values in both old and new
    if (
      oldValues[key] !== undefined &&
      newValue !== undefined &&
      oldValues[key] !== newValue
    ) {
      changedFields.push(key);
      previousValues[key] = oldValues[key];
    }
  }

  // Don't create history if nothing changed
  if (changedFields.length === 0) {
    return null;
  }

  // Determine change category
  let changeCategory = "GENERAL_UPDATE";
  let changeType = "MINOR";

  if (entityType === "company") {
    if (
      changedFields.includes("industry_vertical") ||
      changedFields.includes("size")
    ) {
      changeCategory = "COMPANY_CLASSIFICATION";
      changeType = "MAJOR";
    } else if (
      changedFields.includes("revenue") ||
      changedFields.includes("employee_size")
    ) {
      changeCategory = "COMPANY_METRICS";
      changeType = "MAJOR";
    } else if (
      changedFields.includes("website_url") ||
      changedFields.includes("country_hq")
    ) {
      changeCategory = "COMPANY_DETAILS";
    }
  } else if (entityType === "contact") {
    if (changedFields.includes("email") || changedFields.includes("phone")) {
      changeCategory = "CONTACT_INFO";
    } else if (
      changedFields.includes("title") ||
      changedFields.includes("influence_role")
    ) {
      changeCategory = "CONTACT_ROLE";
      changeType = "MAJOR";
    }
  } else if (entityType === "deal") {
    if (
      changedFields.includes("stage") ||
      changedFields.includes("deal_state")
    ) {
      changeCategory = "DEAL_STAGE";
      changeType = "MAJOR";
    } else if (changedFields.includes("deal_amount")) {
      changeCategory = "DEAL_VALUE";
      changeType = "MAJOR";
    } else if (
      changedFields.includes("deal_signing_date") ||
      changedFields.includes("deal_expected_signing_date")
    ) {
      changeCategory = "DEAL_TIMELINE";
      changeType = "MAJOR";
    }
  }

  // Create human-readable summary
  let summary = "";
  if (entityType === "company") {
    const name = newValues.name || oldValues.name;
    summary = `Updated ${changedFields.join(", ")} for company ${name}`;

    // More specific summaries for common changes
    if (changedFields.includes("industry_vertical")) {
      summary = `Changed ${name}'s industry from ${
        oldValues.industry_vertical || "unspecified"
      } to ${newValues.industry_vertical}`;
    }
  } else if (entityType === "contact") {
    const name = newValues.name || oldValues.name;
    summary = `Updated ${changedFields.join(", ")} for contact ${name}`;

    if (changedFields.includes("title")) {
      summary = `Updated ${name}'s title from ${
        oldValues.title || "unspecified"
      } to ${newValues.title}`;
    }
  } else if (entityType === "deal") {
    summary = `Updated ${changedFields.join(", ")} for deal`;

    if (changedFields.includes("stage")) {
      summary = `Deal stage changed from ${
        oldValues.stage || "unspecified"
      } to ${newValues.stage}`;
    } else if (changedFields.includes("deal_amount")) {
      summary = `Deal amount updated from ${oldValues.deal_amount || 0} to ${
        newValues.deal_amount
      }`;
    } else if (changedFields.includes("deal_signing_date")) {
      summary = `Deal was signed on ${newValues.deal_signing_date}`;
    } else if (changedFields.includes("deal_expected_signing_date")) {
      summary = `Expected signing date updated to ${newValues.deal_expected_signing_date}`;
    }
  }

  // Create searchable text for vector store
  const vectorSearchableText = `
    ${summary}. 
    Changed fields: ${changedFields.join(", ")}. 
    Previous values: ${Object.entries(previousValues)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}.
    ${changeType === "MAJOR" ? "This is a significant change." : ""}
  `;

  // Create the history entry
  return {
    timestamp: new Date().toISOString(),
    change_type: changeType,
    change_category: changeCategory,
    changed_fields: changedFields,
    summary,
    vector_searchable_text: vectorSearchableText,
    source: options.source || "API",
    user_id: options.userId,
    user_name: options.userName,
    user_prompt_logs_id: options.logId,
    previous_values: previousValues,
    version: "1.0"
  };
}

/**
 * Upsert company data with history tracking
 * @param {Object} client - DB client within transaction
 * @param {Object} companyData - Company data object
 * @param {Object} options - Additional options
 * @returns {string} - Company ID
 */
async function upsertCompany(client, companyData, options = {}) {
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

  // Check if company already exists
  const existingRes = await client.query(
    "SELECT id, change_history FROM companies WHERE name = $1",
    [company_name]
  );

  const isUpdate = existingRes.rows.length > 0;
  const companyId = isUpdate ? existingRes.rows[0].id : uuidv4();

  // If it's an update, prepare history entry
  let changeHistory = [];
  if (isUpdate) {
    // Get current data as snapshot for history
    const currentData = await client.query(
      "SELECT * FROM companies WHERE id = $1",
      [companyId]
    );

    const currentValues = currentData.rows[0];

    // Create history entry
    const historyEntry = createHistoryEntry(
      currentValues,
      companyData,
      "company",
      options
    );

    // Add to history if changes were detected
    if (historyEntry) {
      // Load existing history and append new entry
      changeHistory = currentValues.change_history || [];
      changeHistory.push(historyEntry);

      // Limit history length if needed
      if (changeHistory.length > 20) {
        changeHistory = changeHistory.slice(-20);
      }
    } else {
      // No changes, keep existing history
      changeHistory = currentValues.change_history || [];
    }
  }

  // Add/update in companies table with history tracking
  if (isUpdate) {
    // For updates, use existing created_at
    await client.query(
      `INSERT INTO companies (
        id, name, description, industry_vertical, sub_industry, 
        b2b_or_b2c, size, website_url, country_hq, other_countries,
        revenue, employee_size, child_companies, customer_segment_label,
        primary_contact, account_team, company_hierarchy, decision_country,
        company_address, company_legal_entity, change_history
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, $10, 
        $11, $12, $13, $14, 
        $15, $16, $17, $18, 
        $19, $20, $21
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = COALESCE(EXCLUDED.description, companies.description),
        industry_vertical = COALESCE(EXCLUDED.industry_vertical, companies.industry_vertical),
        sub_industry = COALESCE(EXCLUDED.sub_industry, companies.sub_industry),
        b2b_or_b2c = COALESCE(EXCLUDED.b2b_or_b2c, companies.b2b_or_b2c),
        size = COALESCE(EXCLUDED.size, companies.size),
        website_url = COALESCE(EXCLUDED.website_url, companies.website_url),
        country_hq = COALESCE(EXCLUDED.country_hq, companies.country_hq),
        other_countries = COALESCE(EXCLUDED.other_countries, companies.other_countries),
        revenue = COALESCE(EXCLUDED.revenue, companies.revenue),
        employee_size = COALESCE(EXCLUDED.employee_size, companies.employee_size),
        child_companies = COALESCE(EXCLUDED.child_companies, companies.child_companies),
        customer_segment_label = COALESCE(EXCLUDED.customer_segment_label, companies.customer_segment_label),
        primary_contact = COALESCE(EXCLUDED.primary_contact, companies.primary_contact),
        account_team = COALESCE(EXCLUDED.account_team, companies.account_team),
        company_hierarchy = COALESCE(EXCLUDED.company_hierarchy, companies.company_hierarchy),
        decision_country = COALESCE(EXCLUDED.decision_country, companies.decision_country),
        company_address = COALESCE(EXCLUDED.company_address, companies.company_address),
        company_legal_entity = COALESCE(EXCLUDED.company_legal_entity, companies.company_legal_entity),
        updated_at = NOW(),
        change_history = EXCLUDED.change_history`,
      [
        companyId,
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
        JSON.stringify(changeHistory)
      ]
    );
    console.log(
      `PostgreSQL: Updated company table with id=${companyId}, name="${company_name}"`
    );
  } else {
    // For new companies, use a simplified query that's proven to work
    await client.query(
      `INSERT INTO companies (
        id, name, description, industry_vertical, sub_industry, 
        b2b_or_b2c, size, website_url, country_hq, other_countries,
        revenue, employee_size, child_companies, customer_segment_label,
        primary_contact, account_team, company_hierarchy, decision_country,
        company_address, company_legal_entity, change_history
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, $10, 
        $11, $12, $13, $14, 
        $15, $16, $17, $18, 
        $19, $20, $21
      )`,
      [
        companyId,
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
        JSON.stringify(changeHistory)
      ]
    );
    console.log(
      `PostgreSQL: Inserted new company in table with id=${companyId}, name="${company_name}"`
    );
  }

  return companyId;
}

/**
 * Upsert contact data with history tracking if fields change
 * @param {Object} client - DB client within transaction
 * @param {string} companyId - Company ID the contact belongs to
 * @param {Object} contactData - Contact data object
 * @param {Object} options - Additional options
 * @returns {string} - Contact ID
 */
async function upsertContact(client, companyId, contactData, options = {}) {
  const { name, email, phone, title, influence_role, is_primary } = contactData;

  // Get company name for denormalization
  const companyResult = await client.query(
    "SELECT name FROM companies WHERE id = $1",
    [companyId]
  );
  const companyName =
    companyResult.rows.length > 0 ? companyResult.rows[0].name : null;

  // Check if contact already exists for this company
  const existingRes = await client.query(
    "SELECT id, email, phone, title, influence_role, is_primary, change_history FROM contacts WHERE company_id = $1 AND name = $2",
    [companyId, name]
  );

  const isUpdate = existingRes.rows.length > 0;
  const contactId = isUpdate ? existingRes.rows[0].id : uuidv4();

  // Prepare history tracking if this is an update
  let changeHistory = [];
  if (isUpdate) {
    const existing = existingRes.rows[0];

    // Create history entry
    const historyEntry = createHistoryEntry(
      existing,
      contactData,
      "contact",
      options
    );

    if (historyEntry) {
      // Load existing history and append
      changeHistory = existing.change_history || [];
      changeHistory.push(historyEntry);

      // Limit history length if needed
      if (changeHistory.length > 10) {
        changeHistory = changeHistory.slice(-10);
      }
    } else {
      // No changes, keep existing history
      changeHistory = existing.change_history || [];
    }
  }

  // Add/update in contacts table
  await client.query(
    `INSERT INTO contacts (
      id, company_id, name, email, phone, title, influence_role, is_primary,
      company_name, created_at, updated_at, change_history
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, NOW(), $11
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = COALESCE(EXCLUDED.email, contacts.email),
      phone = COALESCE(EXCLUDED.phone, contacts.phone),
      title = COALESCE(EXCLUDED.title, contacts.title),
      influence_role = COALESCE(EXCLUDED.influence_role, contacts.influence_role),
      is_primary = COALESCE(EXCLUDED.is_primary, contacts.is_primary),
      company_name = EXCLUDED.company_name,
      updated_at = NOW(),
      change_history = EXCLUDED.change_history
    `,
    [
      contactId,
      companyId,
      name,
      email,
      phone,
      title,
      influence_role,
      is_primary || false,
      companyName,
      isUpdate && existingRes.rows[0].created_at
        ? existingRes.rows[0].created_at
        : new Date(),
      JSON.stringify(changeHistory)
    ]
  );

  // Add the logging before return
  if (isUpdate) {
    console.log(
      `PostgreSQL: Updated contact table with id=${contactId}, name="${name}"${
        is_primary ? " (PRIMARY)" : ""
      }, company="${companyName}"`
    );
  } else {
    console.log(
      `PostgreSQL: Inserted new contact in table with id=${contactId}, name="${name}"${
        is_primary ? " (PRIMARY)" : ""
      }, company="${companyName}"`
    );
  }

  return contactId;
}

/**
 * Get or create product record
 * @param {Object} client - DB client within transaction
 * @param {string} productName - Product name
 * @returns {string} - Product ID
 */
async function getOrCreateProduct(client, productName) {
  const existingRes = await client.query(
    "SELECT id FROM products WHERE name = $1",
    [productName]
  );

  if (existingRes.rows.length > 0) {
    return existingRes.rows[0].id;
  }

  const productId = uuidv4();
  await client.query(
    `INSERT INTO products (id, name, created_at) 
     VALUES ($1, $2, NOW())`,
    [productId, productName]
  );

  return productId;
}

/**
 * Upsert deal data with history tracking for important changes
 * @param {Object} client - DB client within transaction
 * @param {string} companyId - Company ID the deal belongs to
 * @param {string} productId - Product ID (optional)
 * @param {Object} dealData - Deal data object
 * @param {Object} options - Additional options
 * @returns {string} - Deal ID
 */
async function upsertDeal(
  client,
  companyId,
  productId,
  dealData,
  options = {}
) {
  const {
    deal_id,
    deal_state,
    deal_amount,
    deal_amount_currency,
    stage,
    deal_payment_status,
    deal_start_date,
    deal_end_date,
    deal_policy_state,
    deal_health,
    payment_frequency,
    acquisition_channel_source,
    acquisition_campaign_source,
    deal_activity,
    deal_expected_signing_date,
    deal_signing_date
  } = dealData;

  // Clean up date fields - convert empty strings to null
  const cleanDealStartDate =
    deal_start_date && deal_start_date.trim() !== "" ? deal_start_date : null;
  const cleanDealEndDate =
    deal_end_date && deal_end_date.trim() !== "" ? deal_end_date : null;
  const cleanDealExpectedSigningDate =
    deal_expected_signing_date && deal_expected_signing_date.trim() !== ""
      ? deal_expected_signing_date
      : null;
  const cleanDealSigningDate =
    deal_signing_date && deal_signing_date.trim() !== ""
      ? deal_signing_date
      : null;

  // Get company name from companies table
  const companyResult = await client.query(
    "SELECT name FROM companies WHERE id = $1",
    [companyId]
  );

  const companyName =
    companyResult.rows.length > 0 ? companyResult.rows[0].name : null;

  // Get product name if productId is provided
  let productName = null;
  if (productId) {
    const productResult = await client.query(
      "SELECT name FROM products WHERE id = $1",
      [productId]
    );
    productName =
      productResult.rows.length > 0 ? productResult.rows[0].name : null;
  }

  // Check for existing deal with this ID or similar characteristics
  let existingRes;

  if (deal_id) {
    existingRes = await client.query(
      "SELECT id, deal_state, deal_amount, stage, change_history FROM deals WHERE company_id = $1 AND deal_id = $2",
      [companyId, deal_id]
    );
  } else {
    // Try to find matching deal by other characteristics if no deal_id
    existingRes = await client.query(
      "SELECT id, deal_state, deal_amount, stage, change_history FROM deals WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1",
      [companyId]
    );
  }

  const isUpdate = existingRes.rows.length > 0;
  const dealId = isUpdate ? existingRes.rows[0].id : uuidv4();

  // Track history for updates
  let changeHistory = [];
  if (isUpdate) {
    const existing = existingRes.rows[0];

    // Create history entry
    const historyEntry = createHistoryEntry(
      existing,
      dealData,
      "deal",
      options
    );

    if (historyEntry) {
      // Add to history
      changeHistory = existing.change_history || [];
      changeHistory.push(historyEntry);

      // Keep reasonable history size
      if (changeHistory.length > 15) {
        changeHistory = changeHistory.slice(-15);
      }
    } else {
      // No changes
      changeHistory = existing.change_history || [];
    }
  }

  // Add/update deal record
  await client.query(
    `INSERT INTO deals (
      id, company_id, product_id, deal_id, deal_state, deal_amount, 
      deal_amount_currency, stage, deal_payment_status, deal_start_date, 
      deal_end_date, deal_policy_state, deal_health, payment_frequency,
      acquisition_channel_source, acquisition_campaign_source, deal_activity, 
      deal_expected_signing_date, deal_signing_date, change_history,
      company_name, product_name
    ) VALUES (
      $1, $2, $3, $4, $5, $6, 
      $7, $8, $9, $10, 
      $11, $12, $13, $14, 
      $15, $16, $17, $18, $19, $20,
      $21, $22
    )
    ON CONFLICT (id) DO UPDATE SET
      created_at = COALESCE(deals.created_at, NOW()),
      deal_id = COALESCE(EXCLUDED.deal_id, deals.deal_id),
      product_id = COALESCE(EXCLUDED.product_id, deals.product_id),
      deal_state = COALESCE(EXCLUDED.deal_state, deals.deal_state),
      deal_amount = COALESCE(EXCLUDED.deal_amount, deals.deal_amount),
      deal_amount_currency = COALESCE(EXCLUDED.deal_amount_currency, deals.deal_amount_currency),
      stage = COALESCE(EXCLUDED.stage, deals.stage),
      deal_payment_status = COALESCE(EXCLUDED.deal_payment_status, deals.deal_payment_status),
      deal_start_date = COALESCE(EXCLUDED.deal_start_date, deals.deal_start_date),
      deal_end_date = COALESCE(EXCLUDED.deal_end_date, deals.deal_end_date),
      deal_policy_state = COALESCE(EXCLUDED.deal_policy_state, deals.deal_policy_state),
      deal_health = COALESCE(EXCLUDED.deal_health, deals.deal_health),
      payment_frequency = COALESCE(EXCLUDED.payment_frequency, deals.payment_frequency),
      acquisition_channel_source = COALESCE(EXCLUDED.acquisition_channel_source, deals.acquisition_channel_source),
      acquisition_campaign_source = COALESCE(EXCLUDED.acquisition_campaign_source, deals.acquisition_campaign_source),
      deal_activity = COALESCE(EXCLUDED.deal_activity, deals.deal_activity),
      deal_expected_signing_date = COALESCE(EXCLUDED.deal_expected_signing_date, deals.deal_expected_signing_date),
      deal_signing_date = COALESCE(EXCLUDED.deal_signing_date, deals.deal_signing_date),
      company_name = EXCLUDED.company_name,
      product_name = EXCLUDED.product_name,
      updated_at = NOW(),
      change_history = EXCLUDED.change_history
    `,
    [
      dealId,
      companyId,
      productId,
      deal_id,
      deal_state,
      deal_amount,
      deal_amount_currency,
      stage,
      deal_payment_status,
      cleanDealStartDate,
      cleanDealEndDate,
      deal_policy_state,
      deal_health,
      payment_frequency,
      acquisition_channel_source,
      acquisition_campaign_source,
      deal_activity,
      cleanDealExpectedSigningDate,
      cleanDealSigningDate,
      JSON.stringify(changeHistory),
      companyName,
      productName
    ]
  );

  if (isUpdate) {
    console.log(
      `PostgreSQL: Updated deal table with id=${dealId}, company="${
        companyName || "Unknown"
      }", amount=${deal_amount || "N/A"}, stage="${stage || "N/A"}"`
    );
  } else {
    console.log(
      `PostgreSQL: Inserted new deal in table with id=${dealId}, company="${
        companyName || "Unknown"
      }", amount=${deal_amount || "N/A"}, stage="${stage || "N/A"}"`
    );
  }

  return dealId;
}

/**
 * Log a user prompt in the user_prompt_logs table
 * @param {Object} client - The PostgreSQL client
 * @param {string} companyId - The company ID
 * @param {string} contactId - The contact ID
 * @param {string} dealId - The deal ID
 * @param {string} rawInput - The raw input text
 * @param {Object} [employee] - Optional employee information
 * @param {string} [employee.id] - The employee ID
 * @param {string} [employee.name] - The employee name
 * @returns {Promise<string>} The log ID
 */
async function logCustomerInteraction(
  client,
  companyId,
  contactId,
  dealId,
  rawInput,
  employee = {}
) {
  const logId = uuidv4();

  await client.query(
    `INSERT INTO user_prompt_logs (
      id, company_id, contact_id, deal_id, raw_input, employee_id, employee_name, 
      interaction_type, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, NOW()
    )`,
    [
      logId,
      companyId,
      contactId,
      dealId,
      rawInput,
      employee.id || null,
      employee.name || null,
      "user_input" // Default interaction type
    ]
  );

  return logId;
}

/**
 * Get company by ID with related entities
 * @param {string} companyId - The company ID
 * @returns {Promise<Object>} The company with related entities
 */
export async function getCompanyById(companyId) {
  try {
    // Get company data
    const companyResult = await pgClient.query(
      "SELECT * FROM companies WHERE id = $1",
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return null;
    }

    const company = companyResult.rows[0];

    // Get contacts for this company
    const contactsResult = await pgClient.query(
      "SELECT * FROM contacts WHERE company_id = $1",
      [companyId]
    );

    // Get deals for this company
    const dealsResult = await pgClient.query(
      `SELECT d.*, p.name as product_name 
       FROM deals d 
       LEFT JOIN products p ON d.product_id = p.id
       WHERE d.company_id = $1
       ORDER BY d.updated_at DESC`,
      [companyId]
    );

    return {
      company,
      contacts: contactsResult.rows,
      deals: dealsResult.rows
    };
  } catch (error) {
    console.error(`Error getting company with ID ${companyId}:`, error);
    throw error;
  }
}

/**
 * Get customer interaction history by company ID
 * @param {string} companyId - The company ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of historical interactions
 */
export async function getCustomerHistoryByCompanyId(
  companyId,
  options = { limit: 100, offset: 0 }
) {
  try {
    const result = await pgClient.query(
      `SELECT cd.*, c.name as contact_name, d.deal_amount, d.stage,
       p.name as product_name
       FROM user_prompt_logs cd
       LEFT JOIN contacts c ON cd.contact_id = c.id
       LEFT JOIN deals d ON cd.deal_id = d.id
       LEFT JOIN products p ON d.product_id = p.id
       WHERE cd.company_id = $1
       ORDER BY cd.created_at DESC
       LIMIT $2 OFFSET $3`,
      [companyId, options.limit, options.offset]
    );

    return result.rows;
  } catch (error) {
    console.error(
      `Error getting customer history for company ID ${companyId}:`,
      error
    );
    throw error;
  }
}

/**
 * Get all companies
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of companies
 */
export async function getAllCompanies(options = { limit: 100, offset: 0 }) {
  try {
    const result = await pgClient.query(
      "SELECT * FROM companies ORDER BY updated_at DESC LIMIT $1 OFFSET $2",
      [options.limit, options.offset]
    );

    return result.rows;
  } catch (error) {
    console.error("Error getting all companies:", error);
    throw error;
  }
}

// Add a function to get history for vector search
export async function getEntityHistoryForVectorSearch(entityType, entityId) {
  try {
    let query;
    let params;

    if (entityType === "company") {
      query = "SELECT change_history FROM companies WHERE id = $1";
      params = [entityId];
    } else if (entityType === "contact") {
      query = "SELECT change_history FROM contacts WHERE id = $1";
      params = [entityId];
    } else if (entityType === "deal") {
      query = "SELECT change_history FROM deals WHERE id = $1";
      params = [entityId];
    } else {
      throw new Error(`Invalid entity type: ${entityType}`);
    }

    const result = await pgClient.query(query, params);

    if (result.rows.length === 0 || !result.rows[0].change_history) {
      return [];
    }

    // Extract just the needed fields for vector embedding
    return result.rows[0].change_history.map((entry) => ({
      timestamp: entry.timestamp,
      summary: entry.summary,
      vector_searchable_text: entry.vector_searchable_text,
      change_type: entry.change_type,
      change_category: entry.change_category
    }));
  } catch (error) {
    console.error(`Error getting ${entityType} history:`, error);
    throw error;
  }
}
