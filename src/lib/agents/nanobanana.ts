export interface NanobananaResult {
  imageUrl: string;
  revisedPrompt?: string;
}

const API_BASE = "https://api.nanobananaapi.ai/api/v1/nanobanana";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // 2 minutes max

export async function generateImage(
  prompt: string
): Promise<NanobananaResult> {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) {
    throw new Error("NANOBANANA_API_KEY is not configured");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // Step 1: Submit generation task
  const submitRes = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      type: "TEXTTOIAMGE",
      numImages: 1,
      image_size: "1:1",
      callBackUrl: "https://localhost/noop",
    }),
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text().catch(() => "Unknown error");
    throw new Error(`Nanobanana submit error (${submitRes.status}): ${errorText}`);
  }

  const submitData = await submitRes.json();
  console.log("Nanobanana submit response:", JSON.stringify(submitData, null, 2));
  const taskId = submitData.data?.taskId || submitData.taskId || submitData.data?.task_id;
  if (!taskId) {
    throw new Error(`No taskId in Nanobanana response: ${JSON.stringify(submitData)}`);
  }

  // Step 2: Poll for completion
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(
      `${API_BASE}/record-info?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const task = pollData.data;

    if (!task) continue;

    // successFlag: 0=generating, 1=success, 2=creation failed, 3=generation failed
    if (task.successFlag === 1) {
      const imageUrl = task.response?.resultImageUrl || task.response?.originImageUrl;
      if (!imageUrl) {
        throw new Error("Task succeeded but no image URL in response");
      }
      return { imageUrl };
    }

    if (task.successFlag === 2 || task.successFlag === 3) {
      throw new Error(
        `Nanobanana generation failed: ${task.errorMessage || "Unknown error"}`
      );
    }
    // successFlag === 0: still generating, keep polling
  }

  throw new Error("Nanobanana image generation timed out after 2 minutes");
}
