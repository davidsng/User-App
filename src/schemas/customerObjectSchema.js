import { product_array } from "../utils/gtm_constants/productArray.js";
import { deal_stage_array } from "../utils/gtm_constants/dealStages.js";

export const customerObjectSchema = {
  name: "customer_update",
  description: "Extract enriched GTM customer info from unstructured text.",
  parameters: {
    type: "object",
    properties: {
      // Basic fields
      company_name: { type: "string", description: "Name of the company" },

      description: { type: "string", description: "Short textual description" },
      industry_vertical: { type: "string" },
      sub_industry: { type: "string" },
      b2b_or_b2c: {
        type: "string",
        description: "Possible values: B2B, B2C, etc."
      },
      size: {
        type: "string",
        description: "General size category e.g. SMB, midmarket."
      },
      website_url: { type: "string" },
      country_hq: { type: "string" },
      other_countries: {
        type: "array",
        items: { type: "string" },
        description: "List of other countries the company operates in."
      },
      revenue: {
        type: "number",
        description: "Approx annual revenue if known."
      },
      employee_size: {
        type: "number",
        description: "Approx # employees if known."
      },
      child_companies: {
        type: "array",
        items: { type: "string" }
      },
      customer_segment_label: {
        type: "string",
        description: "e.g., 'Enterprise' or 'SMB'."
      },
      primary_contact: {
        type: "string",
        description:
          "The main contact person for this company. This is typically set by users, not automatically determined, unless specified in the text by the user."
      },
      account_team: {
        type: "array",
        items: { type: "string" },
        description:
          "Internal owners or collaborators assigned to this account."
      },
      company_hierarchy: { type: "string" },
      decision_country: { type: "string" },
      company_address: { type: "string" },
      company_legal_entity: { type: "string" },

      // Multiple contacts
      contacts: {
        type: "array",
        description:
          "Array of all contacts mentioned in the unstructured text. Always include the primary_contact in this array.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Full name of the contact"
            },
            email: {
              type: "string",
              description: "Email address of the contact"
            },
            phone: {
              type: "string",
              description: "Phone number of the contact"
            },
            title: {
              type: "string",
              description: "Job title of the contact"
            },
            influence_role: {
              type: "string",
              description: "Decision maker, influencer, user, etc."
            },
            is_primary: {
              type: "boolean",
              description:
                "Whether this contact is the primary contact for the company. This should be left as false by default, as it's a user decision."
            }
          },
          required: ["name"]
        }
      },

      // For backward compatibility
      contact: {
        type: "object",
        description:
          "DEPRECATED: Use contacts array instead. Will be removed in future versions.",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          title: { type: "string" },
          influence_role: { type: "string" }
        }
      },

      // Deal object (similar to your old 'deal')
      deal: {
        type: "object",
        properties: {
          deal_id: { type: "string" },
          deal_state: {
            type: "string",
            description: "prospect, lead, opportunity, closed_won, lost, etc."
          },
          deal_amount: { type: "number" },
          deal_amount_currency: { type: "string" },
          stage: {
            type: "string",
            enum: deal_stage_array,
            description: "One of your pipeline stages or a custom stage."
          },
          deal_payment_status: { type: "string" },
          deal_start_date: {
            type: "string",
            format: "date",
            description:
              "IMPORTANT: The date when the contract/agreement BEGINS. Must be in YYYY-MM-DD format. Examples: 'beginning of Q2' = '2023-04-01', 'starts next month' = (current date + 30 days), 'kicks off in January' = '2023-01-01'."
          },
          deal_end_date: {
            type: "string",
            format: "date",
            description:
              "IMPORTANT: The date when the contract/agreement ENDS or EXPIRES. Must be in YYYY-MM-DD format. Examples: 'contract ends in Q3' = '2023-09-30', 'valid until the end of the year' = '2023-12-31', 'expires December' = '2023-12-31'."
          },
          deal_expected_signing_date: {
            type: "string",
            format: "date",
            description:
              "IMPORTANT: The date when the deal is EXPECTED to be SIGNED or CLOSED. Must be in YYYY-MM-DD format. When text indicates 'close by', 'sign by', 'finalize by', or similar phrases, use THIS field. Examples: 'close by next week' = (current date + 7 days), 'sign before end of month' = (last day of current month), 'finalize by Q4' = '2023-12-31'."
          },
          deal_signing_date: {
            type: "string",
            format: "date",
            description:
              "IMPORTANT: The date when the deal was ACTUALLY SIGNED (past tense event). Must be in YYYY-MM-DD format. Use only when text clearly indicates the deal has ALREADY been signed. Examples: 'signed yesterday' = (current date - 1 day), 'closed last week' = (current date - 7 days), 'finalized at beginning of month' = (1st day of current month)."
          },
          deal_policy_state: { type: "string" },
          payment_frequency: { type: "string" },
          acquisition_channel_source: { type: "string" },
          acquisition_campaign_source: { type: "string" },
          deal_activity: { type: "string" }
        }
      },

      // Always record the raw text
      raw_input: { type: "string" }
    },
    required: ["company_name", "raw_input"]
  }
};
