import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

async function run() {
  try {
    const { embedding: emb2 } = await embed({
      model: google.textEmbeddingModel("text-embedding-004", { outputDimensionality: 768 }),
      value: "test",
    });
    console.log("text-embedding-004 length:", emb2?.length);
  } catch (err: any) {
    console.error(err.message);
  }

  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      value: "test",
    });
    console.log("gemini-embedding-001 length:", embedding?.length);
  } catch (err: any) {
    console.error(err.message);
  }
}

run();
