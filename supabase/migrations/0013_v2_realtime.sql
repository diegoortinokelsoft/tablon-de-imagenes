-- 0013_v2_realtime: miembros y solicitudes en tiempo real (el dueño ve llegar las solicitudes,
-- y quien pidió acceso ve la aprobación sin recargar). Los eventos respetan RLS.
alter publication supabase_realtime add table public.round_members, public.access_requests;
