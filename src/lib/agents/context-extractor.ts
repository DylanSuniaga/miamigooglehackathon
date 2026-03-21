import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai";
import type { ContextDecision, ContextAction, ContextAssumption } from "@/lib/types";

const ExtractionResultSchema = z.object({
  summary: z.string().describe("Brief 1-2 sentence summary of the conversation context"),
  decisions: z.array(
    z.object({
      content: z.string().describe("The decision that was made"),
      rationale: z.string().nullable().describe("Why this decision was made"),
    })
  ),
  actions: z.array(
    z.object({
      description: z.string().describe("What needs to be done"),
      owner_name: z.string().nullable().describe("Who is responsible"),
      due_date: z.string().nullable().describe("ISO date string if mentioned"),
    })
  ),
  assumptions: z.array(
    z.object({
      assumption: z.string().describe("The assumption being made"),
      confidence: z
        .enum(["untested", "validated", "challenged", "disproved"])
        .describe("How confident the team is"),
      evidence: z.string().nullable().describe("Any supporting evidence"),
    })
  ),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

interface ExistingContext {
  decisions: ContextDecision[];
  actions: ContextAction[];
  assumptions: ContextAssumption[];
}

export async function extractContext(
  messages: { sender_type: string; sender_id: string; content: string; handle?: string }[],
  existing: ExistingContext,
  model: string,
  temperature: number
): Promise<ExtractionResult> {
  const conversationText = messages
    .map((m) => {
      const prefix = m.sender_type === "agent" ? `[@${m.handle ?? "agent"}]` : "[User]";
      return `${prefix}: ${m.content}`;
    })
    .join("\n\n");

  const existingText = [
    ...existing.decisions.map((d) => `- Decision: ${d.content}`),
    ...existing.actions.map((a) => `- Action: ${a.description}`),
    ...existing.assumptions.map((a) => `- Assumption: ${a.assumption}`),
  ].join("\n");

  const systemPrompt = `You extract structured context from team conversations. Identify:
1. DECISIONS — choices the team has made, with rationale
2. ACTION ITEMS — tasks assigned or implied, with owners if mentioned
3. ASSUMPTIONS — things taken for granted that may need validation

Rules:
- Be concise. Use bullet-point style.
- Only extract items clearly present in the conversation.
- Do NOT re-extract items that already exist.
${existingText ? `\nAlready extracted (do NOT duplicate):\n${existingText}` : ""}`;

  const { object } = await generateObject({
    model: getModel(model),
    schema: ExtractionResultSchema,
    system: systemPrompt,
    prompt: conversationText,
    temperature,
  });

  return object;
}
