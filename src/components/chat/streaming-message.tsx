import ReactMarkdown from "react-markdown";

interface StreamingMessageProps {
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  model: string;
  content: string;
}

function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full animate-bounce"
          style={{
            backgroundColor: color,
            animationDelay: `${i * 150}ms`,
            animationDuration: "600ms",
          }}
        />
      ))}
    </div>
  );
}

export function StreamingMessage({
  agentName,
  agentEmoji,
  agentColor,
  model,
  content,
}: StreamingMessageProps) {
  const modelShort = model.includes(":") ? model.split(":")[1] : model;
  const hasContent = content.trim().length > 0;

  return (
    <div
      className="group relative flex gap-3 px-5 py-3"
      style={{ borderLeft: `3px solid ${agentColor}` }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F0F0] text-lg">
          {agentEmoji}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-[#1D1C1D]">
            {agentName}
          </span>
          {modelShort && (
            <span className="rounded bg-[#F0F0F0] px-1.5 py-0.5 text-[10px] font-mono text-[#616061]">
              {modelShort}
            </span>
          )}
          <span className="text-[12px] text-[#ABABAD]">
            {hasContent ? "typing..." : "thinking..."}
          </span>
        </div>
        <div className="mt-0.5 text-[15px] leading-[1.5] text-[#1D1C1D]">
          {hasContent ? (
            <div className="prose-sm max-w-none">
              <ReactMarkdown components={markdownComponents}>
                {content}
              </ReactMarkdown>
              <span
                className="inline-block w-[2px] h-[1em] align-text-bottom ml-0.5 animate-pulse"
                style={{ backgroundColor: agentColor }}
              />
            </div>
          ) : (
            <TypingDots color={agentColor} />
          )}
        </div>
      </div>
    </div>
  );
}

const markdownComponents = {
  h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
    <h1 className="text-xl font-bold mt-4 mb-2 text-[#1D1C1D]" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
    <h2 className="text-lg font-bold mt-3 mb-1.5 text-[#1D1C1D]" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
    <h3 className="text-base font-bold mt-2 mb-1 text-[#1D1C1D]" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.ComponentProps<"p">) => (
    <p className="mb-2 last:mb-0" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<"li">) => (
    <li className="leading-[1.5]" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }: React.ComponentProps<"strong">) => (
    <strong className="font-semibold" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: React.ComponentProps<"em">) => (
    <em className="italic" {...props}>{children}</em>
  ),
  code: ({ children, className, ...props }: React.ComponentProps<"code">) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`block bg-[#F5F5F5] rounded p-3 my-2 text-[13px] font-mono overflow-x-auto whitespace-pre ${className}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-[#F5F5F5] rounded px-1 py-0.5 text-[13px] font-mono text-[#E01E5A]" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }: React.ComponentProps<"pre">) => (
    <pre className="bg-[#F5F5F5] rounded-md my-2 overflow-x-auto" {...props}>{children}</pre>
  ),
  blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
    <blockquote className="border-l-4 border-[#E0E0E0] pl-3 my-2 text-[#616061] italic" {...props}>
      {children}
    </blockquote>
  ),
  a: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a className="text-[#1264A3] hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};
