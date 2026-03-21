export interface NanobananaResult {
  imageUrl: string;
  revisedPrompt?: string;
}

export async function generateImage(
  prompt: string,
  model: string = "gemini-2.5-flash-preview-image-generation"
): Promise<NanobananaResult> {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) {
    throw new Error("NANOBANANA_API_KEY is not configured");
  }

  const response = await fetch("https://api.nanobananaapi.ai/generate-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      model,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Nanobanana API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Extract image URL from response
  // The API may return the URL in different fields depending on version
  const imageUrl = data.image_url || data.imageUrl || data.url || data.data?.url;
  if (!imageUrl) {
    throw new Error("No image URL in Nanobanana response");
  }

  return {
    imageUrl,
    revisedPrompt: data.revised_prompt || data.revisedPrompt,
  };
}
