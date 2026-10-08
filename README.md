# Rico — Chatbots That Remember

Rico is a voice-first AI assistant that *remembers*. Talk to it, and it holds a conversation across sessions using the **Walrus** memory layer.

## Setup Instructions

1. **Supabase & Database**
   - Create a Supabase project (Free Tier).
   - Enable the Google provider in Authentication.
   - Run the following SQL to create the memory table:
     ```sql
     create table memory_log (
       memory_id text primary key,
       blob_id text,
       text text not null,
       user_id text not null,
       namespace text not null,
       created_at timestamptz not null,
       superseded_by text
     );
     ```

2. **Google Cloud & Gmail API**
   - Create a Google Cloud project (in testing mode).
   - Enable the Gmail API and add these scopes to the consent screen: `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.send`. (Note: `.send` is sensitive, testing mode is fine for demos).
   - Add test users.

3. **Text-to-Speech (Google Cloud TTS)**
   - Enable the Cloud Text-to-Speech API in the same project.
   - Create an API key restricted to this API. (A billing account might be required for the project, though usage will likely stay in the free tier).

4. **MemWal (Walrus Memory)**
   - Generate a delegate key and account ID at the staging dashboard: `https://staging.memory.walrus.xyz`.

5. **Environment Variables**
   Create a `.env.local` file at the root:
   ```env
   # SERVER (Do not leak)
   GROQ_API_KEY=your_groq_key
   MEMWAL_PRIVATE_KEY=your_memwal_delegate_key_hex
   MEMWAL_ACCOUNT_ID=your_memwal_account_id
   MEMWAL_SERVER_URL=https://relayer-staging.memory.walrus.xyz
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # CLIENT (Safe for frontend bundle)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_GOOGLE_TTS_API_KEY=your_google_tts_api_key
   ```

6. **Seed Demo Data**
   - Start the dev server: `npm run dev`
   - In another terminal, run: `node scripts/seed.mjs`

7. **Deploy**
   - Push to GitHub and connect to Vercel. Ensure all environment variables (server and client) are added in the Vercel dashboard.

## Caveats & Notes
- The TTS API key is shipped in the frontend bundle (NEXT_PUBLIC_). In a true production app, this would be proxied through the server.
- The `MEMWAL_SERVER_URL` must point to the staging relayer to avoid 401 errors.
