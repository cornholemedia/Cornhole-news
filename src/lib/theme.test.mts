import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FAQ_BODY } from "./faq.ts";
import { THEME_INIT_SCRIPT, themeIsDark } from "./theme.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function runThemeScript(stored: string | null, prefersDark: boolean, storageThrows = false) {
  const classes = new Set<string>();
  const root: { dataTheme?: string; style: { colorScheme?: string } } = { style: {} };
  const document = {
    documentElement: {
      setAttribute(name: string, value: string) {
        if (name === "data-theme") root.dataTheme = value;
      },
      classList: {
        toggle(name: string, on: boolean) {
          if (on) classes.add(name);
          else classes.delete(name);
        },
      },
      style: root.style,
    },
  };
  const localStorage = {
    getItem() {
      if (storageThrows) throw new Error("blocked");
      return stored;
    },
  };
  const window = {
    matchMedia() {
      return { matches: prefersDark };
    },
  };
  const run = new Function("document", "localStorage", "window", THEME_INIT_SCRIPT);
  run(document, localStorage, window);
  return { theme: root.dataTheme, dark: classes.has("dark"), colorScheme: root.style.colorScheme };
}

test("theme follows system until a saved choice says otherwise", () => {
  assert.equal(themeIsDark("system", true), true);
  assert.equal(themeIsDark("system", false), false);
  assert.equal(themeIsDark("dark", false), true);
  assert.equal(themeIsDark("light", true), false);

  assert.deepEqual(runThemeScript(null, true), { theme: "system", dark: true, colorScheme: "dark" });
  assert.deepEqual(runThemeScript(null, false), { theme: "system", dark: false, colorScheme: "light" });
  assert.deepEqual(runThemeScript("light", true), { theme: "light", dark: false, colorScheme: "light" });
  assert.deepEqual(runThemeScript("dark", false), { theme: "dark", dark: true, colorScheme: "dark" });
  assert.deepEqual(runThemeScript("nope", false), { theme: "system", dark: false, colorScheme: "light" });
  assert.deepEqual(runThemeScript(null, true, true), { theme: undefined, dark: false, colorScheme: undefined });
});

test("the theme script stays off cookies and out of the server render", () => {
  assert.equal(THEME_INIT_SCRIPT.includes("cookie"), false);
  assert.equal(THEME_INIT_SCRIPT.includes("headers"), false);
  assert.match(THEME_INIT_SCRIPT, /localStorage/);
  assert.match(THEME_INIT_SCRIPT, /prefers-color-scheme/);

  const layout = source("../app/layout.tsx");
  assert.match(layout, /id="theme-init"/);
  assert.match(layout, /THEME_INIT_SCRIPT/);
  assert.equal(layout.includes("cookies("), false);
  assert.equal(layout.includes("headers("), false);

  const faq = source("../app/faq/page.tsx");
  assert.match(faq, /createEditablePage\("faq"\)/);
  assert.match(faq, /export const revalidate = 3600/);
  assert.equal(faq.includes("cookies("), false);
  assert.equal(faq.includes("headers("), false);
  assert.equal(faq.includes("searchParams"), false);
  assert.match(source("./page-content.ts"), /"faq"/);
  assert.match(source("../app/admin/pages/actions.ts"), /revalidatePath\(`\/\$\{slug\}`\)/);
  const faqMigration = source("../../supabase/migrations/20261119_faq_page.sql");
  assert.match(faqMigration, /pages_slug_check/);
  assert.match(faqMigration, /'faq'/);
  assert.match(faqMigration, /on conflict \(slug\) do nothing/);
  assert.match(source("../../supabase/schema.sql"), /'about', 'faq', 'jobs'/);
  assert.match(source("../app/sitemap.ts"), /"\/faq"/);
  assert.match(source("../app/layout.tsx"), /href="\/faq"/);
  assert.match(source("../app/about/page.tsx"), /href="\/faq"/);
});

test("the FAQ matches the site, including the corrections", () => {
  assert.match(FAQ_BODY, /Illinois, Indiana, Iowa, Kansas, Michigan, Minnesota, Missouri, Nebraska, North Dakota, Ohio, South Dakota, and Wisconsin/);
  assert.match(FAQ_BODY, /Manitoba and Ontario/);
  assert.match(FAQ_BODY, /last 72 hours/);
  assert.match(FAQ_BODY, /\[\/rss\.xml\]\(\/rss\.xml\)/);
  assert.match(FAQ_BODY, /\[\/feed\]\(\/feed\)/);
  assert.match(FAQ_BODY, /\[\/jobs\/post\]\(\/jobs\/post\)/);
  assert.match(FAQ_BODY, /30 days/);
  assert.match(FAQ_BODY, /\[jobs page\]\(\/jobs\)/);
  assert.match(FAQ_BODY, /filter job openings by state/);
  assert.match(FAQ_BODY, /Not yet/);
  assert.match(FAQ_BODY, /\[contact page\]\(\/contact\)/);
  assert.match(FAQ_BODY, /\[terms of use\]\(\/terms\)/);
  assert.match(FAQ_BODY, /https:\/\/github\.com\/cornholemedia\/Cornhole-news/);
  assert.equal(FAQ_BODY.includes("/advertise"), false);
  assert.match(FAQ_BODY, /two sidebar spots/);
  assert.match(FAQ_BODY, /Show politics/);
  assert.match(FAQ_BODY, /New page is still newest first/);
});
