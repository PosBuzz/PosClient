/**
 * Service worker update checks.
 *
 * The service worker intercepts navigation before the HTTP cache, so nginx cache
 * headers cannot make a deploy reach an installed PWA - only a newer service
 * worker can. The browser normally checks for one just on navigation, which
 * leaves an ordinary refresh a step behind after a deploy:
 *
 *   refresh 1 - old SW serves the old precached index.html; only now does the
 *               browser notice the new sw.js and start installing it
 *   refresh 2 - new SW is in control, new build is served
 *
 * That is why a single refresh looked like it did nothing and a hard reload
 * (which bypasses the SW entirely) appeared to be required.
 *
 * Checking for updates in the background fixes that. `registerType: "autoUpdate"`
 * already makes a newly installed SW call skipWaiting() + clientsClaim(), so by
 * the time the user refreshes, the new SW is active and that one refresh serves
 * the new build. The page is deliberately never reloaded automatically - a POS
 * terminal must not refresh itself out from under an in-progress sale.
 */

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const CHUNK_RELOAD_KEY = "chunk-reload-at";
const CHUNK_RELOAD_COOLDOWN = 10_000;

/**
 * A tab opened before a deploy still references the previous build's hashed
 * chunks, which no longer exist on the server once the new containers are up.
 * Opening a not-yet-visited lazy route then fails to import and the page hangs
 * on its Suspense fallback. Reload once to pick up the current build; the
 * cooldown stops a reload loop if the chunk is genuinely unreachable (offline).
 */
export function registerChunkErrorReload() {
  window.addEventListener("vite:preloadError", (event) => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0;
    } catch {
      // storage unavailable - still reload, the cooldown is best effort
    }
    if (Date.now() - last < CHUNK_RELOAD_COOLDOWN) return;

    event.preventDefault();
    try {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    window.location.reload();
  });
}

export function registerSWUpdateHandler() {
  if (!("serviceWorker" in navigator)) return;

  // A terminal can sit on one tab for a whole shift without navigating, so
  // without these checks the browser would never look for a new service worker.
  navigator.serviceWorker.ready.then((registration) => {
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration.update();
    };

    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
  });
}
