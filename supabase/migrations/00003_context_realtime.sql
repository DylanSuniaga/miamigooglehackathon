-- Enable realtime for context tables so the panel updates live
alter publication supabase_realtime add table context_decisions;
alter publication supabase_realtime add table context_actions;
alter publication supabase_realtime add table context_assumptions;
