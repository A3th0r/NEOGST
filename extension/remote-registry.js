// =============================================================================
// remote-registry.js  —  GitHub tag-based module updates (data only, no remote code)
// -----------------------------------------------------------------------------
// Loaded as a classic script right AFTER registry.bundle.js and BEFORE popup.js.
//
// 1. SYNC (runs immediately): if a newer registry was previously downloaded from
//    GitHub and saved in localStorage, it replaces the bundled NEOGST_REGISTRY
//    data before popup.js reads it.
// 2. ASYNC (every time the popup opens): asks GitHub for the newest version tag.
//    If it is newer than what is installed, a banner asks the user to update.
//    "Update" downloads registry data pinned to that tag, validates it, saves it
//    and reloads the popup. "Skip" hides that tag until a newer one appears.
//
// Only JSON data is downloaded (return configs, computed-module recipes, lists).
// It is parsed with JSON.parse and never evaluated, so this is allowed in
// Manifest V3 and by the Chrome Web Store / Edge Add-ons policies. Engine code
// (popup.js, computed-engine.js, ...) still ships inside the extension package.
// =============================================================================
;(function (root) {
  "use strict";

  var OWNER = "A3th0r";
  var REPO = "NEOGST";
  var REGISTRY_PATHS = ["extension/registry.json", "extension/registry.bundle.js"];
  var TAGS_URL = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/tags?per_page=50";
  var CHECK_CACHE_MS = 10 * 60 * 1000; // GitHub API allows 60 unauthenticated calls/hour

  var LS_DATA = "neogst.remote.registry";   // { tag, version, registry }
  var LS_SKIP = "neogst.remote.skippedTag";
  var LS_CHECK = "neogst.remote.lastCheck"; // { at, tag }
  var LS_DONE = "neogst.remote.justUpdated";

  var REG = root.NEOGST_REGISTRY;
  if (!REG) return;

  var api = (root.browser || root.chrome);
  var manifestVersion = "0";
  try { manifestVersion = api.runtime.getManifest().version || "0"; } catch (e) {}

  // ── helpers ────────────────────────────────────────────────────────────────
  function ls(key, value) {
    try {
      if (value === undefined) return root.localStorage.getItem(key);
      if (value === null) root.localStorage.removeItem(key);
      else root.localStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }
  function readJson(key) {
    try { return JSON.parse(ls(key) || "null"); } catch (e) { return null; }
  }
  function parseVer(tag) {
    var m = /^v?(\d+(?:\.\d+)*)$/.exec(String(tag || "").trim());
    return m ? m[1].split(".").map(Number) : null;
  }
  function cmp(a, b) { // semver-ish compare of two arrays / strings; returns -1, 0, 1
    a = Array.isArray(a) ? a : parseVer(a) || [0];
    b = Array.isArray(b) ? b : parseVer(b) || [0];
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }
  var REQUIRED = {
    categoryOrder: "array", pills: "array", labels: "object",
    configMaps: "object", listed: "object", computed: "object"
  };
  function validRegistry(r) {
    if (!r || typeof r !== "object") return false;
    for (var k in REQUIRED) {
      var v = r[k];
      if (REQUIRED[k] === "array" ? !Array.isArray(v) : !(v && typeof v === "object" && !Array.isArray(v))) return false;
    }
    // every listed key must have a config, so the UI can never reference a missing module
    for (var cat in r.listed) {
      var map = r.configMaps[cat] || {};
      var keys = r.listed[cat];
      if (!Array.isArray(keys)) return false;
      for (var i = 0; i < keys.length; i++) {
        if (!map[keys[i]]) return false;
      }
    }
    return true;
  }
  function extractFromBundle(text) {
    // registry.bundle.js contains:  var REG = { ...json... };   then  REG.configMap = ...
    var start = text.indexOf("var REG = ");
    var end = text.indexOf("};\n\n  REG.configMap");
    if (start < 0 || end < 0) return null;
    return JSON.parse(text.slice(start + "var REG = ".length, end + 1));
  }

  // ── 1. apply a previously downloaded registry (synchronous) ────────────────
  var stored = readJson(LS_DATA);
  var activeVersion = manifestVersion;
  var activeTag = null;
  if (stored && stored.registry) {
    var needsNewerExt = stored.registry.minExtensionVersion &&
      cmp(stored.registry.minExtensionVersion, manifestVersion) > 0;
    // If the extension itself was updated past the stored data, bundled data wins.
    var storedIsNewer = cmp(stored.version, manifestVersion) > 0;
    if (storedIsNewer && !needsNewerExt && validRegistry(stored.registry)) {
      Object.keys(REQUIRED).forEach(function (k) { REG[k] = stored.registry[k]; });
      if (stored.registry.listedComposition) REG.listedComposition = stored.registry.listedComposition;
      activeVersion = stored.version;
      activeTag = stored.tag;
    } else {
      ls(LS_DATA, null);
    }
  }
  REG.remoteInfo = { installedVersion: activeVersion, installedTag: activeTag, bundledVersion: manifestVersion };

  // ── 2. check GitHub for a newer tag (async, every popup open) ──────────────
  function latestTag() {
    var cached = readJson(LS_CHECK);
    if (cached && cached.tag && Date.now() - cached.at < CHECK_CACHE_MS) return Promise.resolve(cached.tag);
    return fetch(TAGS_URL, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("GitHub " + r.status); return r.json(); })
      .then(function (tags) {
        var best = null;
        tags.forEach(function (t) {
          var v = parseVer(t && t.name);
          if (v && (!best || cmp(v, best.v) > 0)) best = { name: t.name, v: v };
        });
        if (best) ls(LS_CHECK, JSON.stringify({ at: Date.now(), tag: best.name }));
        return best && best.name;
      });
  }

  function fetchRegistryAtTag(tag, i) {
    i = i || 0;
    if (i >= REGISTRY_PATHS.length) return Promise.reject(new Error("registry file not found at " + tag));
    var url = "https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/" + encodeURIComponent(tag) + "/" + REGISTRY_PATHS[i];
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then(function (text) {
        var obj = REGISTRY_PATHS[i].slice(-5) === ".json" ? JSON.parse(text) : extractFromBundle(text);
        if (!validRegistry(obj)) throw new Error("invalid registry in " + REGISTRY_PATHS[i]);
        return obj;
      })
      .catch(function () { return fetchRegistryAtTag(tag, i + 1); });
  }

  // ── banner UI ──────────────────────────────────────────────────────────────
  function banner(html, buttons, tone) {
    var old = document.getElementById("neogst-update-banner");
    if (old) old.remove();
    var bar = document.createElement("div");
    bar.id = "neogst-update-banner";
    bar.style.cssText =
      "display:flex;align-items:center;gap:8px;padding:8px 12px;font-size:12px;" +
      "border-bottom:1px solid rgba(0,0,0,.1);color:#1c2436;background:" +
      (tone === "ok" ? "#e6f6ef" : tone === "warn" ? "#fff4e0" : "#e8f0ff") + ";";
    var msg = document.createElement("div");
    msg.style.cssText = "flex:1;line-height:1.3;";
    msg.innerHTML = html;
    bar.appendChild(msg);
    (buttons || []).forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.style.cssText =
        "border:1px solid " + (b.primary ? "#1456ff" : "#9aa5b8") + ";border-radius:6px;" +
        "padding:3px 10px;font-size:12px;cursor:pointer;color:" + (b.primary ? "#fff" : "#1c2436") +
        ";background:" + (b.primary ? "#1456ff" : "#fff") + ";";
      btn.addEventListener("click", function () { b.onClick(btn); });
      bar.appendChild(btn);
    });
    document.body.insertBefore(bar, document.body.firstChild);
    return bar;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function offerUpdate(tag) {
    var ver = tag.replace(/^v/, "");
    banner(
      "Module update <b>" + esc(tag) + "</b> is available (installed v" + esc(activeVersion) + ").",
      [
        {
          label: "Update", primary: true,
          onClick: function (btn) {
            btn.disabled = true; btn.textContent = "Updating…";
            fetchRegistryAtTag(tag).then(function (registry) {
              if (registry.minExtensionVersion && cmp(registry.minExtensionVersion, manifestVersion) > 0) {
                banner("<b>" + esc(tag) + "</b> needs a newer extension (v" + esc(registry.minExtensionVersion) +
                  "+). Update the extension itself first.", [], "warn");
                return;
              }
              ls(LS_DATA, JSON.stringify({ tag: tag, version: ver, registry: registry }));
              ls(LS_SKIP, null);
              ls(LS_DONE, tag);
              root.location.reload();
            }).catch(function (e) {
              banner("Update failed (" + esc(e && e.message || e) + "). Existing modules are unchanged.",
                [{ label: "Retry", onClick: function () { offerUpdate(tag); } }], "warn");
            });
          }
        },
        {
          label: "Skip",
          onClick: function () { ls(LS_SKIP, tag); var b = document.getElementById("neogst-update-banner"); if (b) b.remove(); }
        }
      ]
    );
  }

  function run() {
    var done = ls(LS_DONE);
    if (done) {
      ls(LS_DONE, null);
      var bar = banner("Modules updated to <b>" + esc(done) + "</b>.", [], "ok");
      setTimeout(function () { if (bar && bar.parentNode) bar.remove(); }, 4000);
    }
    latestTag().then(function (tag) {
      if (!tag) return;
      if (cmp(tag, activeVersion) <= 0) return;      // already current
      if (ls(LS_SKIP) === tag) return;               // user skipped this one
      offerUpdate(tag);
    }).catch(function () { /* offline / rate-limited: stay silent, keep current modules */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();

  // Settings hook: lets the popup (or console) force a fresh check / roll back to bundled data.
  REG.remote = {
    checkNow: function () { ls(LS_CHECK, null); ls(LS_SKIP, null); run(); },
    resetToBundled: function () { ls(LS_DATA, null); root.location.reload(); }
  };
})(typeof self !== "undefined" ? self : this);
