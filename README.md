# Cornhole News

A Hacker News–style community site for cornhole news, discussion, and links —
now wired up to a real Supabase backend (auth, posts, voting, comments).

## Setup (no local installs needed)

### 1. Create your Supabase project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once it's ready, go to **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` in this repo, copy the whole file, paste it into
   the SQL editor, and click **Run**. This creates all the tables
   (profiles, posts, votes, comments) and security rules.
4. Go to **Project Settings → API**. You'll need two values from there:
   - **Project URL**
   - **anon public** key

### 2. Push this code to GitHub
- If you don't already have a repo, create one at [github.com/new](https://github.com/new).
- Upload all these files (drag-and-drop works fine via "Add file → Upload files",
  or use the repo's built-in web editor for one-off edits).

### 3. Connect the repo to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your GitHub repo.
2. Before deploying, add two **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon public key
3. Click **Deploy**. Vercel builds the site in the cloud — nothing runs on
   your machine.

### 4. (Optional) Turn off "confirm your email" for faster testing
By default Supabase requires email confirmation before login works. To skip
this while testing: **Authentication → Providers → Email** → turn off
"Confirm email". Turn it back on before going live publicly.

That's it — every time you push a change to GitHub, Vercel rebuilds and
redeploys automatically.

---

## What's actually live now

- **Accounts** — sign up / log in / log out (Supabase Auth, email + password)
- **Submitting posts** — logged-in users can submit a link or text post (`/submit`)
- **Voting** — logged-in users can upvote/un-upvote any post
- **Comments** — logged-in users can comment on any post
- **Top / New** — real ranked lists pulled from the database, not mock data

## Project structure

```
supabase/schema.sql        → run this once in Supabase's SQL editor
src/
  lib/supabase/
    client.ts               → Supabase client for browser/Client Components
    server.ts                → Supabase client for Server Components
    middleware.ts            → keeps auth sessions fresh
  lib/posts.ts               → data-fetching for top/new posts
  lib/time.ts                → "x minutes ago" formatting
  app/
    page.tsx                 → Top (ranked by votes)
    new/page.tsx              → New (ranked by time)
    item/[id]/page.tsx        → single post + comments
    user/[username]/page.tsx  → public profile + their submissions
    login/, signup/            → auth pages
    submit/                    → post a new story
  components/
    Header.tsx                → nav bar, shows login state
    PostList.tsx / PostItem.tsx → post rendering
    VoteButton.tsx             → upvote button
    Comments.tsx               → comment thread + form
```

## Design tokens

In `src/app/globals.css`:
- `--header-bg: #ebb73f`
- `--nav-text: #3f679b`
- `--page-bg: #f6f6ef`

## Run it locally (only if you ever have an unrestricted machine)

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase values
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)
