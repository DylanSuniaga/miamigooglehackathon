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
          <p className="text-[13px] text-[#616061] mb-4">
            Channels are where your team communicates. They&apos;re best when
            organized around a topic — #product-launch, for example.
          </p>

          <label className="block mb-4">
            <span className="text-[13px] font-semibold text-[#1D1C1D] mb-1 block">
              Name
            </span>
            <div className="flex items-center rounded-md border border-[#E0E0E0] focus-within:border-[#1264A3] focus-within:shadow-[0_0_0_1px_#1264A3]">
              <Hash className="ml-3 h-4 w-4 text-[#616061]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. plan-budget"
                autoFocus
                className="flex-1 bg-transparent px-2 py-2 text-[14px] text-[#1D1C1D] placeholder-[#ABABAD] outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[#1D1C1D] mb-1 block">
              Description{" "}
              <span className="font-normal text-[#616061]">(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              rows={2}
              className="w-full rounded-md border border-[#E0E0E0] bg-transparent px-3 py-2 text-[14px] text-[#1D1C1D] placeholder-[#ABABAD] outline-none resize-none focus:border-[#1264A3] focus:shadow-[0_0_0_1px_#1264A3]"
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-[14px] font-medium text-[#1D1C1D] hover:bg-[#F0F0F0]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="rounded-md bg-[#1D1C1D] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#3D3C3D] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
