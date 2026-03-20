"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, onClose, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-[480px] rounded-xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
        {children}
      </div>
    </div>
  );
}

interface DialogHeaderProps {
  children: ReactNode;
  onClose: () => void;
}

export function DialogHeader({ children, onClose }: DialogHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-1">
      <h2 className="text-[18px] font-bold text-[#1D1C1D]">{children}</h2>
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#616061] hover:bg-[#F0F0F0] hover:text-[#1D1C1D]"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

interface DialogBodyProps {
  children: ReactNode;
}

export function DialogBody({ children }: DialogBodyProps) {
  return <div className="px-6 py-4">{children}</div>;
}

interface DialogFooterProps {
  children: ReactNode;
}

export function DialogFooter({ children }: DialogFooterProps) {
  return (
    <div className="flex items-center justify-end gap-2 px-6 pb-5">
      {children}
    </div>
  );
}
