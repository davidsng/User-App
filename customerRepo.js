import { v4 as uuidv4 } from "uuid";
import { pgClient } from "./db.js";

/**
 * Upsert customer data
 * @param {string} company_name - Company name
 * @param {string} contact_name - Contact name
 * @param {string} contact_email - Contact email
 * @param {number} deal_value - Deal value
 * @param {string} deal_product - Deal product
 * @param {string} deal_stage - Deal stage
 * @param {string} raw_input - Raw input text
 * @returns {string} - Record ID
 */
export async function upsertCustomer(
  company_name,
  contact_name,
  contact_email,
  deal_value,
  deal_product,
  deal_stage,
  raw_input
) {
  // Check if row already exists
  const existingRes = await pgClient.query(
    "SELECT * FROM customers WHERE company_name = $1",
    [company_name]
  );

  const existing = existingRes.rows[0];

  // Insert or update
  const recordId = existing?.id || uuidv4();
  await pgClient.query(
    `INSERT INTO customers (
      id, company_name, contact_name, contact_email,
      deal_value, deal_product, deal_stage, raw_input, updated_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8, NOW()
    )
    ON CONFLICT (company_name) DO UPDATE SET
      contact_name = EXCLUDED.contact_name,
      contact_email = EXCLUDED.contact_email,
      deal_value = EXCLUDED.deal_value,
      deal_product = EXCLUDED.deal_product,
      deal_stage = EXCLUDED.deal_stage,
      raw_input = EXCLUDED.raw_input,
      updated_at = NOW()
    `,
    [
      recordId,
      company_name,
      contact_name,
      contact_email,
      deal_value,
      deal_product,
      deal_stage,
      raw_input
    ]
  );

  return recordId;
}

/**
 * Get a customer by ID
 * @param {string} id - The customer ID
 * @returns {Promise<Object>} The customer record
 */
export async function getCustomerById(id) {
  try {
    const result = await pgClient.query(
      "SELECT * FROM customers WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error(`Error getting customer with ID ${id}:`, error);
    throw error;
  }
}
