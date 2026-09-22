-- Enable Realtime (Postgres Changes) on the tables the client subscribes to.

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table message_reactions;
alter publication supabase_realtime add table message_reads;
alter publication supabase_realtime add table pinned_messages;
