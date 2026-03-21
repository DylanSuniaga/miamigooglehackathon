import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

async function tryModel(name: string) {
  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel(name),
      value: "test window",
    });
    console.log(`${name} SUCCESS, length: ${embedding.length}`);
  } catch (err: any) {
    console.log(`${name} FAILED:`, err.message);
  }
}

async function run() {
  await tryModel("textembedding-gecko");
  await tryModel("textembedding-gecko@003");
  await tryModel("textembedding-gecko-multilingual");
}

run();
