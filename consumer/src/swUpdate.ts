/**
 * Service worker update handling.
 *
 * vite-plugin-pwa's `registerType: "autoUpdate"` only makes the new service
 * worker call skipWaiting() + clientsClaim(). It does NOT reload open pages, and
 * the injected registerSW.js is a bare register() call. Without the code below, a
 * deploy lands like this:
 *
 *   load N   - old SW serves the old precached index.html; new SW installs and
 *              activates in the background, but the page on screen is still old
 *   load N+1 - new SW is in control, new index.html is served
 *
 * so a single refresh looks like it did nothing and users reach for a hard
 * reload (which works only because it bypasses the SW). Reloading on
 * controllerchange collapses that to a single automatic refresh.
 */

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

export function registerSWUpdateHandler() {
  if (!("serviceWorker" in navigator)) return;

  // Snapshot before any activation: on a first-ever visit there is no controller,
  // and clientsClaim() will fire controllerchange even though the page already
  // holds the newest build. Reloading there would be a pointless extra refresh.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  // A POS terminal can sit on one tab for a whole shift. The browser only checks
  // for a new SW on navigation, so without this a deploy would never reach it.
  navigator.serviceWorker.ready.then((registration) => {
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration.update();
    };

    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
  });
}
