import { initDB, processCustomerUpdate } from "./db/index.js";
import { v4 as uuidv4 } from "uuid";

async function addTestData() {
  try {
    console.log("Initializing database connection...");
    await initDB();

    // Create a test data object
    const testData = {
      company_name: "Acme Corporation",
      description: "A fictional company that manufactures everything",
      industry_vertical: "Manufacturing",
      sub_industry: "General Products",
      b2b_or_b2c: "B2B",
      size: "Large",
      website_url: "https://acme.example.com",
      country_hq: "United States",
      other_countries: ["Canada", "Mexico"],
      revenue: 500000000,
      employee_size: 5000,
      primary_contact: "Wile E. Coyote",
      contacts: [
        {
          name: "Wile E. Coyote",
          email: "wile.coyote@acme.example.com",
          phone: "555-123-4567",
          title: "Chief Innovation Officer",
          influence_role: "Decision Maker"
        },
        {
          name: "Road Runner",
          email: "meep.meep@acme.example.com",
          phone: "555-789-0123",
          title: "VP of Logistics",
          influence_role: "Influencer"
        }
      ],
      deal: {
        deal_id: "ACME-2023-001",
        deal_state: "Active",
        deal_amount: 250000,
        stage: "Qualified",
        deal_start_date: "2023-07-01",
        deal_end_date: "2024-06-30",
        deal_product: "ACME Rocket Package"
      },
      raw_input:
        "Customer meeting with Acme Corporation to discuss their rocket package purchase. Wile E. Coyote is our main contact."
    };

    console.log("Adding test data to Supabase...");
    const result = await processCustomerUpdate(testData, {
      employee_id: uuidv4(),
      employee_name: "Test User"
    });

    console.log("Test data added successfully!");
    console.log("Result:", result);
  } catch (error) {
    console.error("Error adding test data:", error);
  }
}

addTestData();
