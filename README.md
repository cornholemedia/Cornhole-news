# Cornhole News

A Hacker News–style community site for news and discussion across the 12
Midwestern states — now wired up to a real Supabase backend (auth, posts,
voting, comments).

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
   - `supabase/migrations/20261007_midwest_page_copy.sql`
   - `supabase/migrations/20261008_newsletter_subscribers.sql`
   - `supabase/migrations/20261009_job_postings.sql`
   - `supabase/migrations/20261012_politics_tag.sql`
   - `supabase/migrations/20261013_digest_stories.sql`
   - `supabase/migrations/20261014_publish_one_digest_story.sql`
   - `supabase/migrations/20261015_digest_story_politics.sql`
   - `supabase/migrations/20261016_digest_trade_industry.sql`
   - `supabase/migrations/20261017_user_bans.sql`
   - `supabase/migrations/20261017_content_guards.sql`
   - `supabase/migrations/20261017_form_lockdown.sql`
   - `supabase/migrations/20261017_privacy_newsletter.sql`
   - `supabase/migrations/20261019_legal_placeholders.sql`
   - `supabase/migrations/20261019_post_rate_limit_scope.sql`
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
   Set them for Production and Preview. Do not put the Resend key, the
   digest secret, or the service role key in any variable whose name starts
   with `NEXT_PUBLIC_`.
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon public key.
     Signed-in reads and writes for posts, comments, and votes use this key.
     Contact, newsletter, and job saves use `SUPABASE_SERVICE_ROLE_KEY` below.
     The digest ingest route uses that key too.
   - `RESEND_API_KEY` = your Resend API key. This sends the form emails
     and the newsletter confirmation. If it is missing, the site still saves
     the form or signup and tells the visitor it was received. Nothing is
     emailed until the key is set.
   - `CONTACT_FROM_EMAIL` = the From address on a domain you have verified
     in Resend, for example `Cornhole News <noreply@cornholenews.news>`.
     The site does not send mail until this is set. `onboarding@resend.dev`
     is not used.
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` = the
     Cloudflare Turnstile site key and secret. Set both, then redeploy.
     If either one is missing, the check is skipped and the forms still work.
   - `SUPABASE_AUTH_CAPTCHA` = `true` only after you turn on Supabase's
     CAPTCHA with the same Turnstile secret. Leave it unset until then.
     Turnstile tokens can be checked only once, so the app verifies them
     itself unless this is `true`.
   - `NEWSLETTER_UNSUBSCRIBE_SECRET` = a random string, at least 16
     characters. It signs unsubscribe links. If it is unset, the app signs
     those links with `SUPABASE_SERVICE_ROLE_KEY` instead.
   - `SHOW_ADS` = `true` only when you want the dashed ad boxes to show.
     Leave it unset until real ads exist. Change it in Vercel, then redeploy.
   - `DIGEST_INGEST_SECRET` = a long random string, at least 16 characters.
     The daily Midwest digest job sends it as `Authorization: Bearer …`.
     The review page does not use this secret.
   - `SUPABASE_SERVICE_ROLE_KEY` = the service role key, or the newer secret
     key (`sb_secret_…`), from Supabase **Project Settings → API Keys**.
     The server uses it for the digest ingest, contact form, newsletter,
     job board, rate limits, and unsubscribe. Do not create a `NEXT_PUBLIC_`
     copy. Redeploy after you set it.
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
- **Redirect URLs** — add the production callback, and localhost only while
  you are testing on your own machine:
  - `https://cornholenews.news/auth/callback`
  - `http://localhost:3000/auth/callback`

`https://www.cornholenews.news` redirects to `https://cornholenews.news`.
Do not add a `vercel.app` preview address. Password reset and signup
confirmation always return to the site URL above.

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

`{{ .RedirectTo }}` is `https://cornholenews.news/auth/callback`.
The callback checks the token, then sends the user to `/reset-password` to
choose a new password. Keep the redirect URL free of a query string — the
template adds `?token_hash=`.

Signup confirmation uses the same callback. Open **Authentication → Emails →
Confirm signup** and replace the template with `supabase/templates/confirmation.html`:

```html
<h2>Confirm your email</h2>

<p>Follow the link below to confirm your Cornhole News account. After that, you can log in.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup">Confirm your email</a>
</p>
```

Leave **Confirm email** turned on before the public launch.

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
- **Politics tag** — authors and admins can mark a post as political when they submit or edit it. Tagged posts show a small Politics badge. The home page has a Show politics switch (on by default). The choice is remembered in the browser, and on the account when someone is signed in.
- **About / Jobs / Advertise / Privacy / Terms / Contact** — editable page copy stored in Supabase, with the
  built-in text as a fallback until a page is saved
- **Contact form** — name, email, optional subject, and message. A copy is saved in Supabase and emailed to the contact inbox.
- **Job board** — `/jobs` lists approved Midwest jobs. Employers post for free at `/jobs/post`. An admin reviews each one before it appears. A posting lasts 30 days after approval. Older job applications, if any, stay in the database and are no longer collected on the site.
- **Inbox addresses** — an admin can change the contact and jobs inboxes at `/admin`
- **Newsletter** — the footer has an email signup. Addresses are saved in Supabase. Admins can view them and export a CSV at `/admin`. A confirmation email is sent only when `RESEND_API_KEY` is set.
- **Signup** — requires a confirmation that the person is at least 13 and agrees to the Terms and Privacy Policy
- **Ads** — the sidebar placeholders stay hidden unless `SHOW_ADS=true`
- **Daily digest** — an automated job can send Midwest stories to `/api/digest/ingest`. They stay hidden until an admin publishes them at `/admin/review`. Published stories are normal posts by Cornhole News. Politics stays off unless the admin turns it on for that story.

## Daily Midwest digest

The job sends one day at a time. Stories stay in a private queue until an admin opens `/admin/review` and clicks **Publish** on each one. Each story has a Politics checkbox, off by default. Delete hides one story. **Finished** hides every story still waiting for the selected date and leaves published stories up. The date list is only the last 7 days in Chicago time, and only days that already have stories. Choosing a date loads it immediately. A later send of that same date and URL does not bring a deleted story back, and it does not change a story that was already published or clear its Politics checkbox. Links left out of a later send stay pending until you delete them. Nothing is posted automatically. Clicking Publish twice does not create two posts.

Run `supabase/migrations/20261013_digest_stories.sql` in the Supabase SQL editor, then `supabase/migrations/20261014_publish_one_digest_story.sql`, then `supabase/migrations/20261015_digest_story_politics.sql`, then `supabase/migrations/20261016_digest_trade_industry.sql`. Create the **Cornhole News** author using the steps at the top of the first digest file. Set `DIGEST_INGEST_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel and redeploy.

```bash
curl -sS -X POST "https://cornholenews.news/api/digest/ingest" \
  -H "Authorization: Bearer $DIGEST_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "digest_date": "2026-10-13",
    "stories": [
      {
        "section": "QUIRKY",
        "headline": "Town crowns a new cornhole champion",
        "url": "https://example.com/cornhole-champion",
        "paper": "Des Moines Register",
        "state": "IA",
        "synopsis": "A packed gym watched the final bags land."
      }
    ]
  }'
```

`section` is exactly one of `QUIRKY`, `SERIOUS`, `AROUND THE MIDWEST`, `NATIONAL PRESS`, or `TRADE & INDUSTRY`. `state` is the two-letter code that shows up as "Paper, ST". `url` must be `https`. At most 100 stories per request. A successful response looks like `{"ok":true,"digest_date":"2026-10-13","inserted":1,"updated":0,"skipped":0}`. `skipped` means that URL was already published or deleted for that date and was left alone.

On the review page, choose a date from the last 7 Chicago days that have stories. The newest of those that still has waiting stories is selected by default, and changing the date loads it right away. **Publish** on a story creates one post: the headline is the title, the link is the URL, and the text is the synopsis plus ` — Paper, ST`. The author is Cornhole News. `is_political` follows that story's Politics checkbox. The story then shows as published, with a link to the new post. Turning Politics on or off after publishing updates the linked post. The checkbox is saved on the queue row, so a reload before publishing keeps it.

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
   Then run these, in order. Each one is safe to run more than once:
   - `supabase/migrations/20261007_forms_and_settings.sql`
   - `supabase/migrations/20261007_signup_age_confirmation.sql`
   - `supabase/migrations/20261007_legal_pages_text.sql`
   - `supabase/migrations/20261007_midwest_page_copy.sql`
   - `supabase/migrations/20261008_newsletter_subscribers.sql`
   - `supabase/migrations/20261009_job_postings.sql`
   - `supabase/migrations/20261012_politics_tag.sql`
   - `supabase/migrations/20261013_digest_stories.sql`
   - `supabase/migrations/20261014_publish_one_digest_story.sql`
   - `supabase/migrations/20261015_digest_story_politics.sql`
   - `supabase/migrations/20261016_digest_trade_industry.sql`

   `20261007_midwest_page_copy.sql` fills in Privacy and Terms only while the saved page still
   says PLACEHOLDER. It will not overwrite a page you have already edited.
   `20261008_newsletter_subscribers.sql` adds the footer signup table. Run it after the forms file.
   `20261009_job_postings.sql` adds the Midwest job board. Run it after the newsletter file.
   It does not delete old job applications or resume files.
   `20261012_politics_tag.sql` adds a Politics tag on posts and a saved home-page
   preference for signed-in readers. Run it after the job board file. It does not
   change who can read or edit posts. Existing posts stay untagged.
   `20261013_digest_stories.sql` adds the queue for the daily Midwest digest.
   Run it after the politics file. It does not publish anything. Create the
   Cornhole News author after it, using the steps at the top of that file.
   `20261014_publish_one_digest_story.sql` lets the review page publish one
   story at a time. Run it after the digest queue file. Clicking Publish
   twice does not create a second post.
   `20261015_digest_story_politics.sql` adds a Politics flag on each digest
   story and lets Finished hide every story still waiting for one date.
   Run it after the one-story publish file. Existing stories stay untagged.
   `20261016_digest_trade_industry.sql` adds the TRADE & INDUSTRY section.
   Run it after the digest queue file. It does not change stories already saved.
   Then run these, in this order, before the matching site deploy:
   - `supabase/migrations/20261017_user_bans.sql`
   - `supabase/migrations/20261017_content_guards.sql`
   - `supabase/migrations/20261017_form_lockdown.sql`
   - `supabase/migrations/20261017_privacy_newsletter.sql`
   - `supabase/migrations/20261019_legal_placeholders.sql`
   - `supabase/migrations/20261019_post_rate_limit_scope.sql`
   The first reserves username `Cornhole_Admin` and adds bans. The second
   limits posts and comments and freezes `created_at`. The third stops
   anonymous writes to the contact, newsletter, and job tables, and to the
   old resume bucket. The fourth updates the saved privacy page where it
   still says the site has no newsletter. The fifth fills any leftover
   address, state, and agent tokens, adds the one-click unsubscribe
   sentence to the saved privacy page, and sets the privacy and terms
   dates to October 18, 2026. The sixth keeps the 6-per-hour and 20-per-day
   post caps on signed-in writers, and leaves digest publish outside those caps.
   Re-running `20261017_content_guards.sql` puts the caps back on digest publish;
   run the sixth file again if you do that. Re-running `20260923_editable_pages.sql`
   after the ban file removes the ban guard. Run `20261017_user_bans.sql` again
   if you do that.
2. Mark the account that should edit pages. In the SQL editor:

```sql
UPDATE profiles SET is_admin = true WHERE username = 'your_username';
```

Replace `your_username` with the username they signed up with. The public API
cannot change `is_admin` or `is_banned`. Use the SQL editor. Do not sign up
as `Cornhole_Admin`. That username is reserved and is not promoted automatically.
3. Log in as that user. The header shows an **admin** link. Open `/admin`, edit a
   page, and save. The public page shows the saved title, subtitle, and body.
   A blank body keeps the built-in copy. Privacy and Terms ship as full drafts.
   Have a lawyer review them. The mailing address, governing state, and
   designated agent are set in `src/lib/legal-placeholders.ts`. Public pages
   substitute those three values, including text saved in the database.
   The admin editor still shows the tokens until you replace them there too.
   The contact and jobs pages show that saved text above the forms.
4. On the same admin screen, set the two inbox addresses, open **Review digest**
   for the daily Midwest queue, and review job postings.
   Contact-form messages go to the first address. New job postings are emailed to
   the second. Both start as `cornholemedia@gmail.com`. Saving here does not
   require a new deploy. Approve a posting and it shows on `/jobs` for 30 days.
   Email is sent only when `RESEND_API_KEY` is set. The posting is still saved
   if that key is missing.

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
    jobs/                      → Midwest job board, plus a free post-a-job form
    admin/                     → admin-only editor for those pages, form inboxes, job postings, newsletter subscribers, and /admin/review for the daily digest
    api/digest/ingest/         → server-only endpoint the daily job uses to submit pending stories
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

- `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` send the form emails. Without the
  Resend key, a saved form still shows a success message.
- `SHOW_ADS=true` shows the dashed ad boxes. Leave it out to hide them.
- `DIGEST_INGEST_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` let a local server
  accept a digest. Leave them out and the ingest route answers that it is
  not configured. Do not prefix either name with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` only if you want local links in
  previews. Production should keep `https://cornholenews.news`.

Vercel Web Analytics is included in the site. In the Vercel project, open
**Analytics** and turn it on if the dashboard asks you to.
Open [http://localhost:3000](http://localhost:3000)
