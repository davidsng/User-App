import { product_array, deal_stage_array } from "./gtm_constants.js";

const customer_object_schema = {
  name: "customer_update",
  description: "Extract customer info from unstructured GTM text.",
  parameters: {
    type: "object",
    properties: {
      company_name: { type: "string" },
      contact: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" }
        }
      },
      deal: {
        type: "object",
        properties: {
          value: { type: "number" },
          product: { type: "string", enum: product_array },
          stage: { type: "string", enum: deal_stage_array }
        }
      },
      raw_input: { type: "string" }
    },
    required: ["company_name", "raw_input"]
  }
};

export default customer_object_schema;
