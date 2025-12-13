-- Create storage bucket for avatars
-- Run this in Supabase Dashboard -> Storage

-- Note: This needs to be done via the Supabase Dashboard UI:
-- 1. Go to Storage section
-- 2. Click "New bucket"
-- 3. Name: "avatars"
-- 4. Public: true (so avatars are publicly accessible)
-- 5. Click "Create bucket"

-- Then set up RLS policies for the bucket via SQL:

-- Allow anyone to read avatars
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Create-- Storage setup for group images
-- Run this in Supabase SQL Editor

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload group images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for group images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their group images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their group images" ON storage.objects;

-- Allow authenticated users to upload files to group-images bucket
CREATE POLICY "Authenticated users can upload group images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'group-images'
);

-- Allow public read access to group images
CREATE POLICY "Public read access for group images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'group-images');

-- Allow authenticated users to update files in group-images bucket
CREATE POLICY "Users can update their group images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'group-images')
WITH CHECK (bucket_id = 'group-images');

-- Allow authenticated users to delete files in group-images bucket
CREATE POLICY "Users can delete their group images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'group-images');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
