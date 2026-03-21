"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarEvent } from "@/lib/types";

const COLOR_OPTIONS = [
  { label: "Blue", value: "#378ADD" },
  { label: "Red", value: "#E8593C" },
  { label: "Purple", value: "#7F77DD" },
  { label: "Green", value: "#1D9E75" },
  { label: "Orange", value: "#BA7517" },
  { label: "Pink", value: "#E85D75" },
];

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    all_day: boolean;
    color: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  event: CalendarEvent | null;
  defaultDate: Date | null;
}

function toLocalDateTimeString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function EventDialog({
  open,
  onClose,
  onSave,
  onDelete,
  event,
  defaultDate,
}: EventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState("#378ADD");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setAllDay(event.all_day);
      setColor(event.color);
      if (event.all_day) {
        setStartTime(toLocalDateString(new Date(event.start_time)));
        setEndTime(toLocalDateString(new Date(event.end_time)));
      } else {
        setStartTime(toLocalDateTimeString(new Date(event.start_time)));
        setEndTime(toLocalDateTimeString(new Date(event.end_time)));
      }
    } else if (defaultDate) {
      setTitle("");
      setDescription("");
      setAllDay(false);
      setColor("#378ADD");
      const start = new Date(defaultDate);
      start.setHours(9, 0, 0, 0);
      const end = new Date(defaultDate);
      end.setHours(10, 0, 0, 0);
      setStartTime(toLocalDateTimeString(start));
      setEndTime(toLocalDateTimeString(end));
    }
    setConfirmDelete(false);
  }, [event, defaultDate, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const startDate = allDay
        ? new Date(`${startTime}T00:00:00`).toISOString()
        : new Date(startTime).toISOString();
      const endDate = allDay
        ? new Date(`${endTime}T23:59:59`).toISOString()
        : new Date(endTime).toISOString();

      await onSave({
        title: title.trim(),
        description: description.trim(),
        start_time: startDate,
        end_time: endDate,
        all_day: allDay,
        color,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        {event ? "Edit Event" : "New Event"}
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--hm-text)] mb-1 block">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--hm-text)] mb-1 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="all-day"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="all-day" className="text-sm text-[var(--hm-text)]">All day</label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-[var(--hm-text)] mb-1 block">Start</label>
                <Input
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? startTime.slice(0, 10) : startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--hm-text)] mb-1 block">End</label>
                <Input
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? endTime.slice(0, 10) : endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--hm-text)] mb-1 block">Color</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`h-7 w-7 rounded-full transition-all ${
                      color === c.value ? "ring-2 ring-offset-2 ring-[var(--hm-accent)]" : ""
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          {onDelete && (
            <div className="mr-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--hm-muted)]">Delete?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={onDelete}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? "Saving..." : event ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
