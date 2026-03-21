export interface SandboxBlock {
  code: string;
  language: string;
  title?: string;
  mode?: string;
}

const SANDBOX_REGEX = /<sandbox([^>]*)>([\s\S]*?)<\/sandbox>/g;

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  for (const match of attrString.matchAll(regex)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

export function hasSandboxBlock(content: string): boolean {
  return /<sandbox[^>]*>[\s\S]*?<\/sandbox>/.test(content);
}

export function stripSandboxBlocks(content: string): string {
  return content.replace(SANDBOX_REGEX, "").trim();
}

export function extractSandboxBlocks(content: string): SandboxBlock[] {
  const blocks: SandboxBlock[] = [];
  for (const match of content.matchAll(SANDBOX_REGEX)) {
    const attrs = parseAttributes(match[1]);
    blocks.push({
      code: match[2].trim(),
      language: attrs.language || "python",
      title: attrs.title,
      mode: attrs.mode,
    });
  }
  return blocks;
}
