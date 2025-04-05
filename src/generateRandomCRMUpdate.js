import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export async function generateRandomCRMUpdate() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that writes realistic CRM update sentences for a Stripe Account Executive."
        },
        {
          role: "user",
          content:
            "Write a short CRM update a Stripe AE might add after a customer call. The update should be in the form of a sentence, not a question. It should include company name, product, and amount, email, phone number and deal stage and deal value"
        }
      ],
      temperature: 0.7,
      max_tokens: 60
    })
  });

  const data = await response.json();
  const crmUpdate = data.choices[0].message.content.trim();
  return crmUpdate;
}
