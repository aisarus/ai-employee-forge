
-- Add new identity and deployment fields to agents
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS welcome_message text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fallback_message text DEFAULT '',
  ADD COLUMN IF NOT EXISTS about_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bot_username_hint text DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS bot_avatar_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_commands jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_display_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_short_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_about_text text DEFAULT '';

-- Create storage bucket for bot avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('bot-avatars', 'bot-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars
CREATE POLICY "Users can upload bot avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bot-avatars');

-- Allow public read access to avatars
CREATE POLICY "Public can view bot avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'bot-avatars');

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bot-avatars');

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bot-avatars');
