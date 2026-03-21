"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { DEMO_USER } from "@/lib/demo-user";
import type { CalendarEvent } from "@/lib/types";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export function useCalendarEvents(month: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Compute month range
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const startOfMonth = new Date(year, monthIdx, 1).toISOString();
  const endOfMonth = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999).toISOString();

  useEffect(() => {
    const supabase = createClient();

    async function fetchEvents() {
      setLoading(true);
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("workspace_id", WORKSPACE_ID)
        .gte("start_time", startOfMonth)
        .lte("start_time", endOfMonth)
        .order("start_time", { ascending: true });

      setEvents((data ?? []) as CalendarEvent[]);
      setLoading(false);
    }

    fetchEvents();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("calendar:events")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calendar_events",
        },
        (payload) => {
          const newEvent = payload.new as CalendarEvent;
          // Only add if in current month range
          if (newEvent.start_time >= startOfMonth && newEvent.start_time <= endOfMonth) {
            setEvents((prev) => {
              if (prev.some((e) => e.id === newEvent.id)) return prev;
              return [...prev, newEvent].sort(
                (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
              );
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calendar_events",
        },
        (payload) => {
          const updated = payload.new as CalendarEvent;
          setEvents((prev) =>
            prev.map((e) => (e.id === updated.id ? updated : e))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "calendar_events",
        },
        (payload) => {
          const oldId = (payload.old as { id: string }).id;
          setEvents((prev) => prev.filter((e) => e.id !== oldId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [startOfMonth, endOfMonth]);

  const createEvent = useCallback(
    async (event: {
      title: string;
      description?: string;
      start_time: string;
      end_time: string;
      all_day?: boolean;
      color?: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({
          workspace_id: WORKSPACE_ID,
          title: event.title,
          description: event.description || null,
          start_time: event.start_time,
          end_time: event.end_time,
          all_day: event.all_day ?? false,
          color: event.color ?? "#378ADD",
          created_by: DEMO_USER.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CalendarEvent;
    },
    []
  );

  const updateEvent = useCallback(
    async (id: string, updates: Partial<CalendarEvent>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("calendar_events")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CalendarEvent;
    },
    []
  );

  const deleteEvent = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }, []);

  return { events, loading, createEvent, updateEvent, deleteEvent };
}
