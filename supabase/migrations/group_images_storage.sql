-- Storage setup for group images
-- Run this in Supabase SQL Editor

-- Step 1: Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can upload group images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for group images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their group images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their group images" ON storage.objects;

-- Step 3: Create RLS policies

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
