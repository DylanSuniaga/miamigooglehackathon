import { Trash2 } from "lucide-react";

interface MessageBubbleProps {
  senderName: string;
  senderType: "user" | "agent" | "system";
  avatar: string | null;
  avatarColor?: string;
  color?: string;
  model?: string;
  content: string;
  timestamp: string;
  onDelete?: () => void;
}

export function MessageBubble({
  senderName,
  senderType,
  avatar,
  avatarColor,
  content,
  timestamp,
  onDelete,
}: MessageBubbleProps) {
  const isAgent = senderType === "agent";

  return (
    <div className="group relative flex gap-3 px-5 py-3 hover:bg-[#F8F8F8]">
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5">
        {isAgent ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F0F0] text-lg">
            {avatar}
          </div>
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold"
            style={{ backgroundColor: avatarColor || "#1264A3" }}
          >
            {senderName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-[#1D1C1D]">
            {senderName}
          </span>
          <span className="text-[12px] text-[#ABABAD]">{timestamp}</span>
        </div>
        <div className="mt-0.5 text-[15px] leading-[1.5] text-[#1D1C1D] whitespace-pre-wrap">
          {renderContent(content)}
        </div>
      </div>

      {/* Hover actions */}
      {onDelete && (
        <div className="absolute right-4 top-2 hidden group-hover:flex items-center gap-0.5 rounded-md border border-[#E0E0E0] bg-white shadow-sm">
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#616061] hover:bg-[#FDE8E8] hover:text-red-600"
            title="Delete message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function renderContent(content: string) {
  // Simple markdown-like rendering for bold text
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
