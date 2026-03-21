"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function PreviewPage() {
  const params = useParams();
  const messageId = params.id as string;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreview() {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("metadata")
        .eq("id", messageId)
        .single();

      if (fetchError || !data) {
        setError("Message not found");
        return;
      }

      const meta = data.metadata as Record<string, unknown> | undefined;
      const execution = meta?.execution as { html?: string } | undefined;

      if (!execution?.html) {
        setError("No HTML preview available for this message");
        return;
      }

      setHtml(execution.html);
    }

    if (messageId) loadPreview();
  }, [messageId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-gray-600">{error}</p>
          <a href="/" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Back to Hivemind
          </a>
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading preview...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <span className="text-sm font-medium text-gray-700">
          Hivemind — Live Preview
        </span>
        <a
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          Back to Hivemind
        </a>
      </div>
      <iframe
        srcDoc={html}
        sandbox="allow-scripts allow-modals"
        className="flex-1 w-full border-0"
        title="Code Preview"
      />
    </div>
  );
}
