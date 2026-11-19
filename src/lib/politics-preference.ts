/**
 * Runs before the page paints. Sends a reader to the cached Top variant that
 * matches the show_politics cookie, without asking the server to read it.
 * The cookie name matches SHOW_POLITICS_COOKIE in show-politics.ts.
 */
export const POLITICS_PREFERENCE_SCRIPT = `
(function () {
  try {
    var name = "show_politics";
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    if (!match) return;
    var value = decodeURIComponent(match[1]);
    var path = location.pathname;
    var shownPage = path.match(/^\\/p\\/([1-9]\\d*)$/);
    var hiddenPage = path.match(/^\\/no-politics\\/p\\/([1-9]\\d*)$/);
    if (value === "0" && (path === "/" || shownPage)) {
      location.replace(shownPage ? "/no-politics/p/" + shownPage[1] : "/no-politics");
      return;
    }
    if (value === "1" && (path === "/no-politics" || hiddenPage)) {
      location.replace(hiddenPage ? "/p/" + hiddenPage[1] : "/");
    }
  } catch (e) {}
})();
`.trim();
