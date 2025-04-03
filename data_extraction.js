import OpenAI from "openai";
import { product_array, deal_stage_array } from "./gtm_constants.js";

const openai = new OpenAI();

const system_prompt =
  "You are an AI data extraction assistant specialized in go-to-market (GTM) data extraction. Your task is to convert unstructured input—specifically containing GTM-related details such as sales pipeline information, lead sources, acquisition channels, customer engagement metrics, and related financial and operational data—into a structured JSON object that exactly conforms to our unified GTM Customer Data Model";

const user_input =
  "Caught up with Lena from Canva during SaaStr — we’ve been trying to get in front of them for a while. She brought up their interest in our payments and analytics offerings, but for now the priority seems to be streamlining how they handle revenue reporting. She estimated a potential $2.5M budget but said they’re still comparing with internal tools. I’d log this as early-stage discovery. Also, side note: Lena might loop in their CFO in the next round. No direct timeline yet, but she’s pretty bought in. They’ve also been using our competitor for parts of this already, so could be a displacement deal.";

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: system_prompt
    },
    {
      role: "user",
      content: user_input
    }
  ],
  functions: [
    {
      name: "customer_update",
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
              product: {
                type: "string",
                enum: product_array
              },
              stage: {
                type: "string",
                enum: deal_stage_array
              }
            }
          },
          raw_input: { type: "string" }
        },
        required: ["company_name", "raw_input"]
      }
    }
  ],
  function_call: { name: "customer_data_extraction" }
});

const customerData = response.choices[0].message.function_call.arguments;

console.log(customerData);
