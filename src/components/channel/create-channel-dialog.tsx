"use client";

import { useState } from "react";
import { Hash } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export function CreateChannelDialog({
  open,
  onClose,
  onCreate,
}: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = name.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    try {
      await onCreate(
        name.trim().toLowerCase().replace(/\s+/g, "-"),
        description.trim()
      );
      setName("");
      setDescription("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={onClose}>Create a channel</DialogHeader>
        <DialogBody>
          <p className="text-[13px] text-[var(--hm-muted)] mb-4">
            Channels are where your team communicates. They&apos;re best when
            organized around a topic — #product-launch, for example.
          </p>

          <label className="block mb-4">
            <span className="text-[13px] font-semibold text-[var(--hm-text)] mb-1 block">
              Name
            </span>
            <div className="flex items-center rounded-md border border-[var(--hm-border)] focus-within:border-[var(--hm-focus)] focus-within:shadow-[0_0_0_1px_var(--hm-focus)]">
              <Hash className="ml-3 h-4 w-4 text-[var(--hm-muted)]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. plan-budget"
                autoFocus
                className="flex-1 bg-transparent px-2 py-2 text-[14px] text-[var(--hm-text)] placeholder-[var(--hm-muted-light)] outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[var(--hm-text)] mb-1 block">
              Description{" "}
              <span className="font-normal text-[var(--hm-muted)]">(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              rows={2}
              className="w-full rounded-md border border-[var(--hm-border)] bg-transparent px-3 py-2 text-[14px] text-[var(--hm-text)] placeholder-[var(--hm-muted-light)] outline-none resize-none focus:border-[var(--hm-focus)] focus:shadow-[0_0_0_1px_var(--hm-focus)]"
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-[14px] font-medium text-[var(--hm-text)] hover:bg-[var(--hm-surface)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="rounded-md bg-[var(--hm-text)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--hm-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
