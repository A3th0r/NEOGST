"use strict";
/*
 * site-bridge.js — lets ONE website (your GitHub Pages site) talk to this
 * extension. Loaded by background.js via importScripts(), so it shares that
 * file's globals (runtimeApi, xhrRequest, forwardToTab, ensureSearchTpTab...).
 *
 * Security model:
 *  - Chrome only delivers external messages from origins listed in
 *    manifest.json -> externally_connectable. We ALSO re-check sender.origin.
 *  - Only the fixed actions below exist. There is no "run any script" action.
 *  - gst-fetch only reaches https://*.gst.gov.in hosts (never arbitrary URLs),
 *    so a compromised page cannot use the user's session cookies elsewhere.
 *  - Nothing here reads or sends GST credentials.
 */
const SITE_ALLOWED_ORIGINS = ["https://a3th0r.github.io"];
const SITE_GST_URL = /^https:\/\/(services|return|payment|gstr2b)\.gst\.gov\.in\//i;
const SITE_GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const SITE_MAX_BODY = 5 * 1024 * 1024;

function siteFail(sendResponse, error) {
  sendResponse({ ok: false, error: String(error) });
}

function siteHandle(msg, sendResponse) {
  switch (msg.action) {
    case "ping":
      sendResponse({ ok: true, name: "GC Returns Pro", version: runtimeApi.runtime.getManifest().version });
      return false;

    case "gst-tab-status":
      resolveActiveGstTabId((tabId) => sendResponse({ ok: true, hasGstTab: !!tabId, tabId: tabId || null }));
      return true;

    case "open-portal": {
      // Opens the GST login page. background=true keeps it from stealing focus.
      runtimeApi.tabs.create(
        { url: "https://services.gst.gov.in/services/login", active: msg.background !== true },
        (tab) => sendResponse(tab ? { ok: true, tabId: tab.id } : { ok: false, error: "Could not open tab" }),
      );
      return true;
    }

    case "gst-fetch": {
      // Authenticated fetch to the GST portal using the user's own session.
      const url = String(msg.url || "");
      if (!SITE_GST_URL.test(url)) return siteFail(sendResponse, "URL not allowed (gst.gov.in only)");
      const method = String(msg.method || "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") return siteFail(sendResponse, "Method not allowed");
      if (msg.body && String(msg.body).length > SITE_MAX_BODY) return siteFail(sendResponse, "Body too large");
      const headers = Object.assign(
        { Accept: "application/json, text/plain, */*", "X-Requested-With": "XMLHttpRequest" },
        msg.headers && typeof msg.headers === "object" ? msg.headers : {},
      );
      ["cookie", "host", "origin", "referer"].forEach((h) => {
        Object.keys(headers).forEach((k) => { if (k.toLowerCase() === h) delete headers[k]; });
      });
      xhrRequest(
        { method, url, headers, body: msg.body || null, responseType: msg.responseType === "arraybuffer" ? "arraybuffer" : "text" },
        (resp) => sendResponse({
          ok: !!(resp && resp.ok),
          statusCode: resp ? resp.status : 0,
          text: resp ? resp.responseText : "",
          base64: resp ? resp.responseBase64 : "",
          error: resp && !resp.ok ? resp.error || `HTTP ${resp.status}` : "",
        }),
      );
      return true;
    }

    case "taxpayer-search": {
      const gstin = String(msg.gstin || "").trim().toUpperCase();
      if (!SITE_GSTIN.test(gstin)) return siteFail(sendResponse, "Invalid GSTIN");
      xhrRequest(
        {
          method: "POST",
          url: "https://services.gst.gov.in/services/api/search/taxpayerDetails",
          headers: { Accept: "application/json, text/plain, */*", "Content-Type": "application/json;charset=utf-8" },
          body: JSON.stringify({ gstin }),
        },
        (resp) => sendResponse({
          ok: !!(resp && resp.ok),
          text: resp ? resp.responseText : "",
          error: resp && !resp.ok ? resp.error || `HTTP ${resp.status}` : "",
        }),
      );
      return true;
    }

    case "portal-profile":
    case "portal-filing-snapshot": {
      const type = msg.action === "portal-profile" ? "portal-profile-detail" : "portal-filing-snapshot";
      return forwardToTab(null, { type }, (resp) => sendResponse({ ok: !!(resp && resp.status !== false), data: resp }));
    }

    default:
      return siteFail(sendResponse, "Unknown action");
  }
}

runtimeApi.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const origin = sender && (sender.origin || (sender.url ? new URL(sender.url).origin : ""));
  if (!SITE_ALLOWED_ORIGINS.includes(origin)) {
    sendResponse({ ok: false, error: "Origin not allowed" });
    return false;
  }
  if (!msg || typeof msg.action !== "string") {
    sendResponse({ ok: false, error: "Bad request" });
    return false;
  }
  const keepOpen = siteHandle(msg, sendResponse);
  return keepOpen === true;
});
