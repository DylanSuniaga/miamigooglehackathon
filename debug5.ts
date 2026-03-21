import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

async function run() {
  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel("gemini-embedding-001", { outputDimensionality: 768 }),
      value: "test window",
    });
    console.log(`gemini-embedding-001 with outputDimensionality SUCCESS, length: ${embedding.length}`);
  } catch (err: any) {
    console.log(`gemini-embedding-001 FAILED:`, err.message);
  }
}

run();
