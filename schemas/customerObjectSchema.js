export const customerObjectSchema = {
  name: "customer_update",
  description: "Extract customer info from unstructured GTM text.",
  parameters: {
    type: "object",
    properties: {
      company_name: {
        type: "string",
        description: "The name of the company mentioned"
      },
      contact: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact's name" },
          email: {
            type: "string",
            description: "Contact's email if available"
          }
        },
        required: ["name"]
      },
      deal: {
        type: "object",
        properties: {
          value: {
            type: "number",
            description: "The monetary value of the deal in USD"
          },
          product: {
            type: "string",
            description: "The product or service being sold"
          },
          stage: {
            type: "string",
            description:
              "The stage of the deal (e.g., lead, opportunity, closed_won, closed_lost)"
          }
        },
        required: ["value"]
      },
      raw_input: {
        type: "string",
        description: "The original input text"
      }
    },
    required: ["company_name", "raw_input"]
  }
};
