export interface DelegationBlock {
  to: string;
  task: string;
}

export interface AgentSpecBlock {
  handle: string;
  display_name: string;
  avatar_emoji?: string;
  color?: string;
  model?: string;
  agent_type?: string;
  description?: string;
  system_prompt: string;
  tools?: string[];
}

const DELEGATION_REGEX = /<<<DELEGATE:([\s\S]*?)>>>/g;
const AGENT_SPEC_REGEX = /<<<AGENT_SPEC:([\s\S]*?)>>>/;

export function extractDelegationBlocks(content: string): DelegationBlock[] {
  const blocks: DelegationBlock[] = [];
  for (const match of content.matchAll(DELEGATION_REGEX)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.to && parsed.task) {
        blocks.push({ to: parsed.to, task: parsed.task });
      }
    } catch {
      // Skip malformed blocks
    }
  }
  return blocks;
}

export function stripDelegationBlocks(content: string): string {
  return content.replace(DELEGATION_REGEX, "").trim();
}

export function hasAgentSpecBlock(content: string): boolean {
  return AGENT_SPEC_REGEX.test(content);
}

export function extractAgentSpecBlock(content: string): AgentSpecBlock | null {
  const match = content.match(AGENT_SPEC_REGEX);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.handle && parsed.system_prompt) {
      return parsed as AgentSpecBlock;
    }
  } catch {
    // Skip malformed spec
  }
  return null;
}
