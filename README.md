# Cornhole News

A Hacker News–style community site for cornhole news, discussion, and links —
now wired up to a real Supabase backend (auth, posts, voting, comments).

## Setup (no local installs needed)

### 1. Create your Supabase project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once it's ready, go to **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` in this repo, copy the whole file, paste it into
   the SQL editor, and click **Run**. This creates all the tables
   (profiles, posts, votes, comments, pages) and security rules.
   If the project already ran an older `schema.sql`, also run these files
   the same way, in this order:
   - `supabase/migrations/20260923_editable_pages.sql`
   - `supabase/migrations/20260930_legal_pages.sql`
   - `supabase/migrations/20260930_revoke_function_execute.sql`
   - `supabase/migrations/20261007_forms_and_settings.sql`
   - `supabase/migrations/20261007_signup_age_confirmation.sql`
   - `supabase/migrations/20261007_legal_pages_text.sql`
4. Go to **Project Settings → API**. You'll need two values from there:
   - **Project URL**
   - **anon public** key

### 2. Push this code to GitHub
- If you don't already have a repo, create one at [github.com/new](https://github.com/new).
- Upload all these files (drag-and-drop works fine via "Add file → Upload files",
  or use the repo's built-in web editor for one-off edits).

### 3. Connect the repo to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your GitHub repo.
2. Before deploying, add these **Environment Variables**.
   Set them for Production and Preview. Do not put the service role key or
   the Resend key in any variable whose name starts with `NEXT_PUBLIC_`.
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` = the **service_role** secret from
     Project Settings → API. The contact form and job applications need this
     to save a copy and to store resumes. It stays on the server.
   - `RESEND_API_KEY` = your Resend API key. This sends the form emails.
     If it is missing, the site still saves the form and tells the visitor
     it was received. Nothing is emailed until the key is set.
   - `CONTACT_FROM_EMAIL` = the From address. Leave it unset until the
     domain is verified at Resend. Unset, the site uses
     `Cornhole News <onboarding@resend.dev>`. After verification, set it to
     `Cornhole News <noreply@cornholenews.news>` and redeploy.
   - `SHOW_ADS` = `true` only when you want the dashed ad boxes to show.
     Leave it unset until real ads exist. Change it in Vercel, then redeploy.
   - `NEXT_PUBLIC_SITE_URL` is optional. The site already uses
     `https://cornholenews.news`. Set this only if the public address changes.
3. Click **Deploy**. Vercel builds the site in the cloud — nothing runs on
   your machine.

### 4. (Optional) Turn off "confirm your email" for faster testing
By default Supabase requires email confirmation before login works. To skip
this while testing: **Authentication → Providers → Email** → turn off
"Confirm email". Turn it back on before going live publicly.

### 5. Allow password-reset links
Forgot-password uses Supabase's `resetPasswordForEmail` flow. No new Vercel
environment variables are required — the app sends people back to
`{the site they're on}/auth/callback`. Supabase will only do that if the URL
is allowed.

In the Supabase dashboard, open **Authentication → URL Configuration**:

- **Site URL**: `https://cornholenews.news`
  (use `http://localhost:3000` only while testing on your own machine)
- **Redirect URLs** — add every origin you use, with this exact path:
  - `https://cornholenews.news/auth/callback`
  - `https://cornhole-news-5.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

`https://www.cornholenews.news` redirects to `https://cornholenews.news`.
The old `https://cornhole-news.vercel.app` address is no longer used.

This app uses `@supabase/ssr`, which is the PKCE flow. Supabase's default
reset email only finishes signing the user in when the link is opened in the
**same browser** that requested it. For a link that works from any device,
open **Authentication → Emails → Reset password** and replace the template
with `supabase/templates/recovery.html`:

```html
<h2>Reset your password</h2>

<p>We received a request to reset your password. Follow the link below to choose a new one.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
</p>
```

`{{ .RedirectTo }}` is the `/auth/callback` URL from the forgot-password page.
The callback checks the token, then sends the user to `/reset-password` to
choose a new password. Keep the redirect URL free of a query string — the
template adds `?token_hash=`.

After the new password is saved, the site signs every other device out and
keeps the browser that just changed the password logged in.

That's it — every time you push a change to GitHub, Vercel rebuilds and
redeploys automatically.

---

## What's actually live now

- **Accounts** — sign up / log in / log out / forgot password (Supabase Auth, email + password)
- **Submitting posts** — logged-in users can submit a link or text post (`/submit`)
- **Voting** — logged-in users can upvote/un-upvote any post
- **Comments** — logged-in users can comment on any post
- **Top / New** — real ranked lists pulled from the database, not mock data
- **About / Jobs / Advertise / Privacy / Terms / Contact** — editable page copy stored in Supabase, with the
  built-in text as a fallback until a page is saved
- **Contact form** — name, email, optional subject, and message. A copy is saved in Supabase and emailed to the contact inbox.
- **Job applications** — the form on `/jobs` stores the application, puts the resume in a private bucket, and emails a 7-day download link
- **Inbox addresses** — an admin can change the contact and jobs inboxes at `/admin`
- **Signup** — requires a confirmation that the person is at least 13 and agrees to the Terms and Privacy Policy
- **Ads** — the sidebar placeholders stay hidden unless `SHOW_ADS=true`

## Adding a logo

The header is ready for a logo next to the words “Cornhole News”. Nothing
shows there until you add one, so the title and the mobile menu look the
same as they do today.

**Easiest:** add a file to the `public` folder and name it exactly one of
these:

- `logo.svg`
- `logo.png`
- `logo.webp`
- `logo.jpg`
- `logo.jpeg`

Push that file to GitHub. The next deploy shows it to the left of the title.
A wide logo is kept small so it does not cover the Menu button on a phone.

**Or set a path.** In `src/lib/site.ts`, change `SITE_LOGO_SRC` from `""` to
the file’s address on the site, for example `"/logo.png"`. You can instead
set the Vercel environment variable `NEXT_PUBLIC_SITE_LOGO` to that same
path and redeploy. That variable wins if both are set.

To remove the logo, delete the `public/logo.*` file, set `SITE_LOGO_SRC`
back to `""`, and clear `NEXT_PUBLIC_SITE_LOGO` if you used it.

## Editing site pages

Signed-in admins can change About, Jobs, Advertise, Privacy, Terms, and Contact at `/admin` without a code deploy.
Everyone else is redirected away, and row level security blocks writes from
accounts that are not admins.

1. In the Supabase **SQL Editor**, run `supabase/migrations/20260923_editable_pages.sql`
   if you have not already, then run `supabase/migrations/20260930_legal_pages.sql`
   and `supabase/migrations/20260930_revoke_function_execute.sql`.
   Skip the older file if you just ran a current `supabase/schema.sql` on a new project,
   but still run the two `20260930` files if those pages or function changes are not there yet.
   Then run these three, in order. Each one is safe to run more than once:
   - `supabase/migrations/20261007_forms_and_settings.sql`
   - `supabase/migrations/20261007_signup_age_confirmation.sql`
   - `supabase/migrations/20261007_legal_pages_text.sql`

   The last file fills in Privacy and Terms only while the saved page still
   says PLACEHOLDER. It will not overwrite a page you have already edited.
2. Mark the account that should edit pages. In the SQL editor:

```sql
UPDATE profiles SET is_admin = true WHERE username = 'your_username';
```

Replace `your_username` with the username they signed up with. The public API
cannot change `is_admin`; use the SQL editor (this also re-applies it for
`Cornhole_Admin` if that profile exists).
3. Log in as that user. The header shows an **admin** link. Open `/admin`, edit a
   page, and save. The public page shows the saved title, subtitle, and body.
   A blank body keeps the built-in copy. Privacy and Terms ship as full drafts.
   Have a lawyer review them, and replace the square-bracket items (`[STATE]`,
   `[MAILING ADDRESS]`, and `[DESIGNATED AGENT NAME]`) before you rely on them.
   The contact and jobs pages show that saved text above the forms.
4. On the same admin screen, set the two inbox addresses. Contact-form messages
   go to the first. Job applications go to the second. Both start as
   `cornholemedia@gmail.com`. Saving here does not require a new deploy.

New accounts have to check that they are at least 13 and that they agree to
the Terms and the Privacy Policy. The site does not ask for a birthdate. If
you create a user from the Supabase dashboard instead of the signup page, set
User Metadata to `{"age_confirmed": true, "username": "their_name"}`.

Body formatting: a blank line starts a paragraph, `## Heading`, `- item`,
`**bold**`, `[label](/path)` or `[label](https://example.com)`, and
`note: smaller gray line`.

## Project structure

```
supabase/schema.sql        → run this once in Supabase's SQL editor
supabase/migrations/       → later SQL: editable pages, legal pages, function locks
supabase/templates/recovery.html → paste into the Reset password email template
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
    forgot-password/           → request a reset email
    reset-password/            → choose a new password after the email link
    auth/callback/             → exchanges the Supabase reset link for a session
    submit/                    → post a new story
    about/, jobs/, advertise/  → pages, content from the pages table
    privacy/, terms/, contact/ → same editor; contact also has a message form
    jobs/                      → editable page, plus a job application form
    admin/                     → admin-only editor for those pages and the form inboxes
  components/
    Header.tsx                → nav bar, shows login state and an optional logo
    PasswordInput.tsx         → password field with a show/hide button
    PostList.tsx / PostItem.tsx → post rendering
    VoteButton.tsx             → upvote button
    Comments.tsx               → comment thread + form
```

## Design tokens

In `src/app/globals.css`:
- `--header-bg: #ebb73f`
- `--nav-text: #3f679b`
- `--page-bg: #f6f6ef`
- Form fields use `.field-label`, `.field-input`, and `.field-button`
  (white fields, darker borders, and a blue focus ring)

## Run it locally (only if you ever have an unrestricted machine)

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase values
npm run dev
```

Optional local values in `.env.local`:

- `SUPABASE_SERVICE_ROLE_KEY` lets the contact and jobs forms save while you
  are testing on your own machine. Never commit this value.
- `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` send the form emails. Without the
  Resend key, a saved form still shows a success message.
- `SHOW_ADS=true` shows the dashed ad boxes. Leave it out to hide them.
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` only if you want local links in
  previews. Production should keep `https://cornholenews.news`.

Vercel Web Analytics is included in the site. In the Vercel project, open
**Analytics** and turn it on if the dashboard asks you to.
Open [http://localhost:3000](http://localhost:3000)
