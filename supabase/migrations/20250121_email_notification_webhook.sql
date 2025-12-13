-- Enable the pg_net extension to make HTTP requests
create extension if not exists pg_net;

-- Function to call the Edge Function
create or replace function public.handle_new_message()
returns trigger as $$
begin
  -- REPLACE WITH YOUR PROJECT URL AND SERVICE ROLE KEY
  begin
    perform net.http_post(
      url := 'https://gnzaawkvxnyutqubjvuv.supabase.co/functions/v1/send-unread-email',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduemFhd2t2eG55dXRxdWJqdnV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU1OTA5MiwiZXhwIjoyMDc5MTM1MDkyfQ.5slbyVLiMIflFKjerk7PX0yHLO0TThWS8qSLtlAYWvI"}',
      body := json_build_object('record', row_to_json(new))::jsonb
    );
  exception when others then
    -- Log error but don't block the message insert
    raise warning 'Failed to trigger email notification: %', SQLERRM;
  end;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function on every new message
drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.handle_new_message();
