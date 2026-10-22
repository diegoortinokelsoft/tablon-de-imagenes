-- 0007_realtime: cambios de competencias, publicaciones y votos en tiempo real.
alter publication supabase_realtime add table public.rounds, public.submissions, public.votes;
