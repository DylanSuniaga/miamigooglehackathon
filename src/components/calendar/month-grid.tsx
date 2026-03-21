"use client";

import type { CalendarEvent } from "@/lib/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_EVENTS = 3;

interface MonthGridProps {
  month: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export function MonthGrid({ month, events, onDayClick, onEventClick }: MonthGridProps) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();

  // Build calendar grid days
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const days: (Date | null)[] = [];
  // Leading empty cells
  for (let i = 0; i < startOffset; i++) days.push(null);
  // Actual days
  for (let d = 1; d <= totalDays; d++) days.push(new Date(year, monthIdx, d));
  // Trailing empty cells to fill last row
  while (days.length % 7 !== 0) days.push(null);

  // Map events by date string for quick lookup
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const dateKey = new Date(event.start_time).toDateString();
    const arr = eventsByDate.get(dateKey) || [];
    arr.push(event);
    eventsByDate.set(dateKey, arr);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[var(--hm-border)]">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-xs font-medium text-[var(--hm-muted)] uppercase tracking-wider"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`empty-${i}`}
                className="border-b border-r border-[var(--hm-border)] bg-[var(--hm-surface)] opacity-40"
              />
            );
          }

          const dayEvents = eventsByDate.get(day.toDateString()) || [];
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS;
          const today = isToday(day);
          const isCurrentMonth = day.getMonth() === monthIdx;

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`border-b border-r border-[var(--hm-border)] p-1.5 cursor-pointer transition-colors hover:bg-[var(--hm-surface)] min-h-[100px] ${
                !isCurrentMonth ? "opacity-40" : ""
              }`}
            >
              {/* Day number */}
              <div className="flex justify-end mb-1">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    today
                      ? "bg-[var(--hm-accent)] text-white font-bold"
                      : "text-[var(--hm-text)]"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Event pills */}
              <div className="flex flex-col gap-0.5">
                {visibleEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs truncate text-left hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: `${event.color}18`,
                      borderLeft: `3px solid ${event.color}`,
                    }}
                  >
                    <span className="truncate text-[var(--hm-text)]">{event.title}</span>
                  </button>
                ))}
                {overflowCount > 0 && (
                  <span className="text-xs text-[var(--hm-muted)] pl-1">
                    +{overflowCount} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
