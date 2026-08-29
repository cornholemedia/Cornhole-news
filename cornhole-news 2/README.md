# Cornhole News

A Hacker News–inspired community site for cornhole news, discussion, and links.

## Current Status

This is the **frontend framework** with:

- Gold header (`#ebb73f`)
- Blue navigation (`#3f679b`): Top | New | About | Jobs | Advertise
- Right-hand ad sidebar (~300px)
- Clean sans-serif layout
- Mock story data on the home and New pages

Next steps will be connecting Supabase (auth, posts, comments, voting, moderator tools).

---

## How to get this onto GitHub

### 1. Create a new repository on GitHub
1. Go to [github.com/new](https://github.com/new)
2. Repository name: `cornhole-news` (or whatever you prefer)
3. Keep it **Private** for now (you can make it public later)
4. **Do not** check “Add a README” or any other files
5. Click **Create repository**

### 2. Upload this project

**Option A – Easiest (GitHub website)**
1. On the empty repository page, click **uploading an existing file**
2. Drag the entire contents of the `cornhole-news` folder into the browser
3. Commit the files

**Option B – Command line (recommended)**
Open a terminal in the `cornhole-news` folder and run:

```bash
git init
git add .
git commit -m "Initial Cornhole News framework"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/cornhole-news.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

---

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
  app/
    page.tsx          → Top stories (home)
    new/page.tsx      → Newest
    about/page.tsx
    jobs/page.tsx
    advertise/page.tsx
    layout.tsx        → Header + ad sidebar wrapper
    globals.css
  components/
    Header.tsx
    AdSidebar.tsx
    StoryList.tsx
    StoryItem.tsx
  lib/
    mock-data.ts      → Temporary fake stories
```

---

## Design Tokens (easy to change)

In `src/app/globals.css`:

- `--header-bg: #ebb73f`
- `--nav-text: #3f679b`
- `--page-bg: #f6f6ef`

You can also change colors directly in the Tailwind classes in the components.
