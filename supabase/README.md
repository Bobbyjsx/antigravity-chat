# Supabase Setup

This directory contains Supabase migrations for the Antigravity Chat application.

## Running Migrations

### Option 1: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
   ```bash
  brew install supabase/tap/supabase
   ```

2. Link to your Supabase project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Push migrations to Supabase:
   ```bash
   supabase db push
   ```

### Option 2: Manual SQL Execution

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `migrations/20250120_initial_schema.sql`
4. Click "Run"

## Schema Overview

The database includes the following tables:

- **users**: User profiles (extends auth.users)
- **conversations**: Chat conversations (1-on-1 or group)
- **conversation_members**: Junction table for conversation participants
- **messages**: Chat messages

All tables have Row Level Security (RLS) enabled to ensure users can only access their own data.
