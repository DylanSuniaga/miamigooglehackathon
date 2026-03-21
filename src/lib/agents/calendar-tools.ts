import { createServiceClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/types";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export async function createCalendarEvent(params: {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  color?: string;
  channel_id?: string;
  agent_id: string;
  created_by: string;
}): Promise<CalendarEvent> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      workspace_id: WORKSPACE_ID,
      title: params.title,
      description: params.description || null,
      start_time: params.start_time,
      end_time: params.end_time,
      all_day: params.all_day ?? false,
      color: params.color ?? "#378ADD",
      created_by: params.created_by,
      created_by_agent: params.agent_id,
      channel_id: params.channel_id || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create event: ${error.message}`);
  return data as CalendarEvent;
}

export async function listCalendarEvents(params: {
  start_date: string;
  end_date: string;
}): Promise<CalendarEvent[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .gte("start_time", params.start_date)
    .lte("start_time", params.end_date)
    .order("start_time", { ascending: true });

  if (error) throw new Error(`Failed to list events: ${error.message}`);
  return (data ?? []) as CalendarEvent[];
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId);

  if (error) throw new Error(`Failed to delete event: ${error.message}`);
}
