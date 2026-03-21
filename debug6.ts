import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

async function run() {
  const { embedding } = await embed({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    value: "test window",
  });
  const tail = embedding.slice(768);
  const sum = tail.reduce((a, b) => a + Math.abs(b), 0);
  console.log("sum of elements after index 768:", sum);
  console.log("first 5 elements:", embedding.slice(0, 5));
}
run();
