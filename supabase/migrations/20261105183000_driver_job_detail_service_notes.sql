-- Prefer service_notes when exposing job detail to drivers.

create or replace function public.get_driver_job_detail(
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asg public.job_assignments;
  v_res public.reservations;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_asg from public.job_assignments where id = p_assignment_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.is_driver_user(v_asg.driver_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_res from public.reservations where id = v_asg.reservation_id;

  return jsonb_build_object(
    'assignment_id', v_asg.id,
    'status', v_asg.status,
    'offered_at', v_asg.offered_at,
    'responded_at', v_asg.responded_at,
    'refuse_reason', v_asg.refuse_reason,
    'service', jsonb_build_object(
      'reservation_id', v_res.id,
      'customer_first_name', public.customer_first_name(v_res.customer_name),
      'origin_address', v_res.origin_address,
      'destination_address', v_res.destination_address,
      'stops', coalesce(v_res.stops, '{}'::text[]),
      'service_type', v_res.service_type,
      'airport', v_res.airport,
      'slot_start', v_res.slot_start,
      'slot_end', v_res.slot_end,
      'hours_requested', v_res.hours_requested,
      'estimated_km', v_res.estimated_km,
      'notes', coalesce(v_res.service_notes, v_res.notes)
    )
  );
end;
$$;
