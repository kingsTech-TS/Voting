// Plain module (not "use client") so the root Server Component can inline it.
export const THEME_STORAGE_KEY = "voting-theme";

/** Runs in <head> before first paint so there's no flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
