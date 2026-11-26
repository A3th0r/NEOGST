'use strict';

var browser = globalThis.browser || globalThis.chrome;

var initDone = !!globalThis.__neoGstInitDone;
var port;
var process;
var SEARCHTP_BRIDGE_VERSION = "2";
var SEARCHTP_REQUEST_EVENT = "gc-returns-pro-searchtp-request-v2";
var SEARCHTP_RESPONSE_EVENT = "gc-returns-pro-searchtp-response-v2";
var GSTR3B_PDF_REQUEST_EVENT = "gc-returns-pro-gstr3b-pdf-request-v1";
var GSTR3B_PDF_RESPONSE_EVENT = "gc-returns-pro-gstr3b-pdf-response-v1";
var GOODSERVICE_REQUEST_EVENT = "gc-returns-pro-goodservice-request-v1";
var GOODSERVICE_RESPONSE_EVENT = "gc-returns-pro-goodservice-response-v1";
var GST_TEMPLATE_STATUS_REQUEST_EVENT = "gc-returns-pro-template-status-request-v1";
var GST_TEMPLATE_STATUS_RESPONSE_EVENT = "gc-returns-pro-template-status-response-v1";

if (!initDone) {
    init();
}

function init() {
  log('Initialising content script.');
  
  registerProcessors();
  fillSearchTpFromHash();
  ensureSearchTpPageBridge();
  ensureGoodservicePageBridge();

  if (!globalThis.__neoGstOnConnectListenerAdded) {
    browser.runtime.onConnect.addListener(function(p) {
      port = p;
      
      log(`Port ${port.name} is now open.`);
      port.onDisconnect.addListener(x => log(`Port ${port.name} is now closed.`));
      port.onMessage.addListener(function (msg) {
        var target = process[msg.request];

        if (target) {
          target(msg);
        }
        else {
          msg.status = false;
          msg.error = "Unknown request";
          log('Sending response: ' + JSON.stringify(msg));
          port.postMessage(msg);
        }
      });
    });
    globalThis.__neoGstOnConnectListenerAdded = true;
  }

  initDone = true;
  globalThis.__neoGstInitDone = true;
}

function ensureGoodservicePageBridge() {
  // Injected via the manifest in the page MAIN world (document_start), which is
  // exempt from the page CSP. (Inline injection was removed - strict GST pages
  // such as litserv block inline <script>.)
  globalThis.__neoGstGoodserviceBridgeReady = SEARCHTP_BRIDGE_VERSION;
}

function readGoodserviceTemplateStatusViaPage() {
  return new Promise(function (resolve) {
    ensureGoodservicePageBridge();
    var requestId = "gc-returns-pro-template-status-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      resolve({ status: false, error: "Timed out waiting for GST template status." });
    }, 10000);
    function onMessage(event) {
      if (event.source !== window) return;
      var data = event.data || {};
      if (data.type !== GST_TEMPLATE_STATUS_RESPONSE_EVENT || data.requestId !== requestId) return;
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(data.payload || { status: false, error: "Empty GST template status response." });
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ type: GST_TEMPLATE_STATUS_REQUEST_EVENT, requestId: requestId }, "*");
  });
}

function requestGoodserviceViaPage(payload) {
  return new Promise(function (resolve) {
    ensureGoodservicePageBridge();
    var requestId = "gc-returns-pro-goodservice-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      resolve({ status: false, error: "Timed out waiting for GST portal response." });
    }, 130000);
    function onMessage(event) {
      if (event.source !== window) return;
      var data = event.data || {};
      if (data.type !== GOODSERVICE_RESPONSE_EVENT || data.requestId !== requestId) return;
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(data.payload || { status: false, error: "Empty GST portal response." });
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ type: GOODSERVICE_REQUEST_EVENT, requestId: requestId, payload: payload || {} }, "*");
  });
}

function ensureSearchTpPageBridge() {
  // Injected via the manifest in the page MAIN world (document_start); CSP-exempt.
  globalThis.__neoGstSearchBridgeReady = SEARCHTP_BRIDGE_VERSION;
}


function requestSearchTpViaPage(payload) {
  return new Promise(function (resolve) {
    ensureSearchTpPageBridge();
    var requestId = "gc-returns-pro-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    var completed = false;
    var timer = setTimeout(function () {
      if (completed) return;
      completed = true;
      window.removeEventListener("message", onMessage);
      resolve({ status: false, error: "Timed out waiting for GST portal response." });
    }, 20000);

    function onMessage(event) {
      if (event.source !== window) return;
      var data = event.data || {};
      if (data.type !== SEARCHTP_RESPONSE_EVENT || data.requestId !== requestId) return;
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(data.payload || { status: false, error: "Empty GST portal response." });
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ type: SEARCHTP_REQUEST_EVENT, requestId: requestId, payload: payload || {} }, "*");
  });
}

function requestGstr3bPdfViaPageOnce(payload, timeoutMs) {
  return new Promise(function (resolve) {
    var requestId = "gc-returns-pro-gstr3b-pdf-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      resolve({ status: false, error: "Timed out waiting for the portal PDF." });
    }, timeoutMs || 100000);
    function onMessage(event) {
      if (event.source !== window) return;
      var data = event.data || {};
      if (data.type !== GSTR3B_PDF_RESPONSE_EVENT || data.requestId !== requestId) return;
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(data.payload || { status: false, error: "Empty portal PDF response." });
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ type: GSTR3B_PDF_REQUEST_EVENT, requestId: requestId, payload: payload || {} }, "*");
  });
}

async function requestGstr3bPdfViaPage(payload) {
  // When an extension is reloaded while the GST SPA remains open, Chrome can
  // leave the document_start MAIN-world script from the prior build absent.
  // Detect that quickly, ask the service worker to inject it again, then retry.
  var first = await requestGstr3bPdfViaPageOnce(payload, 8000);
  if (!first || !/timed out/i.test(String(first.error || ""))) return first;
  try {
    await browser.runtime.sendMessage({ type: "ensure-gstr3b-page-bridge" });
  } catch (bridgeError) { /* the next result retains the useful timeout */ }
  return requestGstr3bPdfViaPageOnce(payload, 100000);
}

function fillSearchTpFromHash() {
  try {
    const hash = String(location.hash || "");
    const match = hash.match(/gstin=([^&]+)/i);
    if (!match) return;
    const gstin = decodeURIComponent(match[1] || "").trim().toUpperCase();
    if (!gstin) return;
    let attempts = 0;
    const timer = setInterval(function () {
      attempts += 1;
      const input =
        document.getElementById("for_gstin") ||
        document.querySelector('input[name="for_gstin"]') ||
        document.querySelector('input[placeholder*="GSTIN"]');
      if (input) {
        input.focus();
        input.value = gstin;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        clearInterval(timer);
      } else if (attempts >= 12) {
        clearInterval(timer);
      }
    }, 500);
  } catch (error) {
    log("Unable to fill searchtp GSTIN from hash.");
  }
}

if (!globalThis.__neoGstPortalMessageListenerAdded) {
  function sendMissingUrl(sendResponse) {
    sendResponse({ status: false, error: "Missing URL" });
  }

  function sendPortalHttpResponse(sendResponse, promise) {
    promise
      .then((resp) => {
        sendResponse({
          status: true,
          statusCode: 200,
          response: typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data),
          responseUrl: "",
        });
      })
      .catch((err) => {
        sendResponse({
          status: false,
          statusCode: (err && err.statusCode) || 0,
          response: "",
          responseUrl: "",
          error: err && err.message ? err.message : String(err),
        });
      });
  }

  function handlePortalHttpMessage(msg, sendResponse, fallbackUrl, method) {
    const url = msg.url || fallbackUrl;
    if (!url) {
      sendMissingUrl(sendResponse);
      return true;
    }
    sendPortalHttpResponse(
      sendResponse,
      gstXhrRequestWithRetry({ url, method: method === "POST" ? "POST" : "GET", headers: buildGstHeaders() }),
    );
    return true;
  }

  function handlePortalProfileDetail(sendResponse) {
    const url = location && location.origin ? `${location.origin}/services/auth/profile/detail` : null;
    if (!url) {
      sendMissingUrl(sendResponse);
      return true;
    }
    // This endpoint is unusual: the portal sends a zero-body POST without the
    // X-Requested-With or `at` headers used by the returns APIs. Keep this call
    // identical to the request made by the My Profile page (confirmed by HAR).
    sendPortalHttpResponse(
      sendResponse,
      gstXhrRequest({
        url,
        method: "POST",
        headers: { Accept: "application/json, text/plain, */*" },
      }),
    );
    return true;
  }

  function handlePortalProfileContacts(sendResponse) {
    const url = location && location.origin ? `${location.origin}/services/auth/profile/contacts` : null;
    if (!url) {
      sendMissingUrl(sendResponse);
      return true;
    }
    fetchGstAtToken().then(function(token) {
      if (!token) throw new Error("My Profile did not issue an at token for authorised-signatory contacts.");
      return gstXhrRequest({
        url,
        method: "POST",
        headers: { Accept: "application/json, text/plain, */*", at: token },
      });
    }).then(function(resp) {
      sendPortalHttpResponse(sendResponse, Promise.resolve(resp));
    }).catch(function(error) {
      sendResponse({
        status: false,
        statusCode: (error && error.statusCode) || 0,
        response: "",
        error: error && error.message ? error.message : String(error),
      });
    });
    return true;
  }

  function readRenderedProfileFields(sendResponse) {
    const fields = [];
    const add = function(label, value) {
      const cleanLabel = String(label || "").replace(/\s+/g, " ").trim();
      const cleanValue = String(value || "").replace(/\s+/g, " ").trim();
      if (cleanLabel && cleanValue && cleanLabel !== cleanValue) fields.push({ label: cleanLabel, value: cleanValue });
    };
    Array.from(document.querySelectorAll("tr")).forEach(function(row) {
      const cells = Array.from(row.querySelectorAll(":scope > th, :scope > td"));
      if (cells.length >= 2) add(cells[0].innerText, cells.slice(1).map(function(c) { return c.innerText; }).join(" "));
    });
    Array.from(document.querySelectorAll("dt")).forEach(function(dt) {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") add(dt.innerText, dd.innerText);
    });
    Array.from(document.querySelectorAll("label")).forEach(function(label) {
      const container = label.closest(".form-group, .row, li, section, fieldset") || label.parentElement;
      if (!container) return;
      const clone = container.cloneNode(true);
      Array.from(clone.querySelectorAll("label")).forEach(function(node) { node.remove(); });
      add(label.innerText, clone.innerText);
    });
    sendResponse({ status: true, response: JSON.stringify({ renderedProfileFields: fields }) });
    return true;
  }

  function handleAsyncGstinMessage(msg, sendResponse, requestFn, fallbackMessage) {
    const payload = msg.payload || {};
    const gstin = String(payload.gstin || "").trim().toUpperCase();
    if (!gstin) {
      sendResponse({ status: false, error: "Missing GSTIN" });
      return true;
    }
    requestFn(payload).then(function(result) {
      sendResponse(result);
    }).catch(function(error) {
      sendResponse({
        status: false,
        gstin: gstin,
        error: error && error.message ? error.message : fallbackMessage,
      });
    });
    return true;
  }

  browser.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === "gst-fill-searchtp") {
      const payload = msg.payload || {};
      const gstin = String(payload.gstin || "").trim().toUpperCase();
      const fillSearch = function() {
        const inputs = Array.from(document.querySelectorAll("input"));
        const input = inputs.find(function(el) {
          const text = String(el.id || el.name || el.placeholder || el.getAttribute("aria-label") || "").toLowerCase();
          return /gstin|search/.test(text);
        });
        if (input && gstin) {
          input.focus();
          input.value = gstin;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      let attempts = 0;
      const timer = setInterval(function() {
        attempts += 1;
        fillSearch();
        if (attempts >= 10) {
          clearInterval(timer);
        }
      }, 500);
      sendResponse({ status: true });
      return true;
    }
    if (msg.type === "portal-ustatus") {
      return handlePortalHttpMessage(msg, sendResponse, location && location.origin ? `${location.origin}/services/api/ustatus` : null, "GET");
    }
    if (msg.type === "portal-profile-detail") {
      return handlePortalProfileDetail(sendResponse);
    }
    if (msg.type === "portal-profile-contacts") {
      return handlePortalProfileContacts(sendResponse);
    }
    if (msg.type === "portal-busplaces") {
      return handlePortalHttpMessage(msg, sendResponse, location && location.origin ? `${location.origin}/services/auth/profile/busplaces` : null, "POST");
    }
    if (msg.type === "portal-profile-rendered") {
      return readRenderedProfileFields(sendResponse);
    }
    if (msg.type === "portal-filing-snapshot") {
      return handlePortalHttpMessage(msg, sendResponse, "https://services.gst.gov.in/returns/auth/api/filingsnapshot", "GET");
    }
    if (msg.type === "searchtp-return-status") {
      return handleAsyncGstinMessage(msg, sendResponse, requestSearchTpViaPage, "searchtp-return-status failed");
    }
    if (msg.type === "searchtp-goodservice") {
      return handleAsyncGstinMessage(msg, sendResponse, requestGoodserviceViaPage, "searchtp-taxpayerDetails failed");
    }
    if (msg.type === "searchtp-at-token") {
      fetchGstAtToken().then(function(token) {
        sendResponse(token
          ? { status: true, at: token }
          : { status: false, error: "The Search Taxpayer page did not issue an at token." });
      }).catch(function(error) {
        sendResponse({ status: false, error: error && error.message ? error.message : "Unable to obtain the Search Taxpayer token." });
      });
      return true;
    }
    if (msg.type === "searchtp-template-status") {
      readGoodserviceTemplateStatusViaPage().then(function (result) {
        sendResponse(result);
      });
      return true;
    }
  });
  globalThis.__neoGstPortalMessageListenerAdded = true;
}

/////// Helper functions ///////

// ── Ported directly from GST Jet's content.js (their n() and a() functions) ──
// This is their actual working request function, not a reimplementation.
// Cached session token (Jet's module-level `t`) + in-flight dedup lock (`e`).
// Backed on globalThis and declared with `var` (not `let`) so a second
// evaluation of this content script in the same page world — which Chrome does
// on some SPA re-injections — neither throws "Identifier 'cachedAtToken' has
// already been declared" nor discards the token already minted on the first run.
var cachedAtToken = globalThis.__neoGstCachedAtToken || null;
var atTokenFetchInFlight = null;

function buildGstHeaders(explicitToken, withContentType) {
  const headers = { "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/plain, */*" };
  if (withContentType) headers["Content-Type"] = "application/json";
  const token = explicitToken || cachedAtToken;
  if (token) headers.at = token;
  return headers;
}

// Mints/caches the services.gst.gov.in session token, reading it from the
// response header first (matching the portal's own behaviour) and falling
// back to the JSON body. Jet calls this once and reuses the result; so do we.
async function fetchGstAtToken() {
  if (atTokenFetchInFlight) return atTokenFetchInFlight;
  atTokenFetchInFlight = (async () => {
    try {
      // Mint the token from the CURRENT subdomain's ustatus, not a hardcoded
      // services.gst.gov.in URL. The GST portal issues `at` session tokens
      // per subdomain, so a payment.gst.gov.in request that 403s must be
      // retried with a payment.gst.gov.in token — a services token is useless
      // there (and the cross-origin fetch to services would be CORS-blocked
      // anyway). gstr2b's ustatus additionally needs ?adhrflag=N.
      let statusUrl;
      try {
        const host = location.hostname.toLowerCase();
        statusUrl =
          host === "gstr2b.gst.gov.in"
            ? `${location.origin}/services/api/ustatus?adhrflag=N`
            : `${location.origin}/services/api/ustatus`;
      } catch (e) {
        statusUrl = "https://services.gst.gov.in/services/api/ustatus";
      }
      const resp = await fetch(statusUrl, {
        method: "GET",
        credentials: "include",
        headers: buildGstHeaders(undefined, false),
      });
      let token = resp.headers.get("at");
      if (!token) {
        try {
          const body = await resp.clone().json();
          if (body && body.at) token = body.at;
        } catch (e) {
          /* ignore */
        }
      }
      if (token) {
        cachedAtToken = token;
        globalThis.__neoGstCachedAtToken = token;
      }
      return cachedAtToken;
    } catch (e) {
      return cachedAtToken;
    } finally {
      atTokenFetchInFlight = null;
    }
  })();
  return atTokenFetchInFlight;
}

// The actual GST Jet request function (their `n`), ported as-is: builds an
// XHR with the exact header set/order Jet uses (Accept default,
// X-Requested-With always, CSRF token from cookie when not using `at`,
// JSON auto-parse on success, "Access Denied" message normalization on
// failure), and rejects on failure rather than silently resolving.
function gstXhrRequest(reqOptions) {
  const {
    url,
    method = "GET",
    headers = {},
    body = null,
    responseType = "text",
    omitCredentials = false,
  } = reqOptions;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = !omitCredentials;
    xhr.open(method, url, true);
    xhr.responseType = responseType;

    xhr.onload = () => {
      const responseHeaders = {};
      xhr.getAllResponseHeaders().split("\r\n").forEach((line) => {
        const parts = line.split(": ");
        if (parts.length === 2) responseHeaders[parts[0].toLowerCase()] = parts[1];
      });
      if (xhr.status >= 200 && xhr.status < 300) {
        let data = xhr.response;
        if (responseType === "arraybuffer" && data instanceof ArrayBuffer) {
          const bytes = new Uint8Array(data);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          data = window.btoa(binary);
        } else if (responseType === "text" || !responseType) {
          const contentType = xhr.getResponseHeader("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              data = JSON.parse(xhr.responseText);
            } catch (e) {
              /* leave as text */
            }
          }
        }
        resolve({ success: true, data, headers: responseHeaders });
      } else {
        let errText = "";
        if (xhr.response instanceof ArrayBuffer) {
          try {
            errText = new TextDecoder().decode(xhr.response);
          } catch (e) {
            errText = `Binary error (${xhr.response.byteLength} bytes)`;
          }
        } else {
          errText = xhr.response || xhr.responseText || xhr.statusText;
        }
        if (errText && typeof errText === "string" && errText.toLowerCase().includes("accessdenied")) {
          errText = "Access Denied (Session likely invalid or subdomain jump failed)";
        }
        const err = new Error(`HTTP Error ${xhr.status} for ${new URL(url).pathname}: ${errText}`);
        err.statusCode = xhr.status;
        err.responseHeaders = responseHeaders;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error(`Network Error for ${new URL(url).hostname}`));
    xhr.ontimeout = () => reject(new Error(`Request timed out for ${new URL(url).pathname}`));

    if (!headers.Accept && !headers.accept) xhr.setRequestHeader("Accept", "application/json, text/plain, */*");
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    const cookieMatch = document.cookie.match(/csrftoken=([^;]+)/) || document.cookie.match(/CSRF-TOKEN=([^;]+)/);
    if (cookieMatch && cookieMatch[1] && !headers["X-CSRF-TOKEN"] && !headers.at) {
      xhr.setRequestHeader("X-CSRF-TOKEN", cookieMatch[1]);
    }
    Object.keys(headers).forEach((key) => {
      if (key.toLowerCase() === "content-type" && body) return; // set explicitly below when sending a body
      if (headers[key] !== undefined && headers[key] !== null) {
        try {
          xhr.setRequestHeader(key, headers[key]);
        } catch (e) {
          /* ignore unsafe header */
        }
      }
    });

    if (!body || (method !== "POST" && method !== "PUT")) {
      xhr.send();
    } else {
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(typeof body === "string" ? body : JSON.stringify(body));
    }
  });
}

// Wraps gstXhrRequest with one automatic retry on 403/Access Denied after
// re-minting a fresh 'at' token — same resilience Jet's litserv calls have.
async function gstXhrRequestWithRetry(reqOptions, attempt) {
  try {
    return await gstXhrRequest(reqOptions);
  } catch (err) {
    const status = err && err.statusCode;
    const looksAuthRelated = status === 403 || (err && /access denied/i.test(err.message || ""));
    if (looksAuthRelated && !attempt) {
      const freshToken = await fetchGstAtToken();
      const retryHeaders = freshToken ? { ...reqOptions.headers, at: freshToken } : reqOptions.headers;
      return gstXhrRequestWithRetry({ ...reqOptions, headers: retryHeaders }, 1);
    }
    throw err;
  }
}

function log(msg, obj) {
  if (!obj)
    console.log(new Date().toISOString() + ": " + msg);
  else
    console.log(`${new Date().toISOString()}: ${msg} (${obj.constructor.name}) ${JSON.stringify(obj)}`);
}

async function zipAsync(fileData, fileName) {
  let zip = new JSZip();
  zip.file(fileName, fileData);
  return await zip.generateAsync({type:"blob"});
}

function saveFile(filename, content, contentType) {
  var a = document.createElement('a');
  var blob = new Blob([content], {type : contentType});
  a.href = window.URL.createObjectURL(blob);
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click(); //this is probably the key - simulating a click on a download link
  a.parentNode.removeChild(a);
}

function clickUrl(url, onNewTab) {
  var a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  
  if (onNewTab)
    a.target = '_blank';

  document.body.appendChild(a);
  a.click(); //this is probably the key - simulating a click on a download link
  a.parentNode.removeChild(a);
}

/////// Process functions ///////

function registerProcessors() {
  process = {};
  process['get'] = processGet;
  process['getBlob'] = processGetBlob;
  process['getBlobBase64'] = processGetBlobBase64;
  process['log'] = processLog;
  process['save-json-as-zip'] = processZipAndSave;
  process['download-url'] = processDownloadUrl;
  process['getGstin'] = processGetGstin;
  process['request'] = processRequest;
  process['portal-gstr3b-pdf'] = processPortalGstr3bPdf;
}

async function processPortalGstr3bPdf(msg) {
  var result = await requestGstr3bPdfViaPage({ period: msg.period });
  msg.status = !!(result && result.status);
  msg.statusCode = msg.status ? 200 : 0;
  msg.responseBase64 = (result && result.base64) || "";
  msg.filename = (result && result.filename) || "";
  msg.error = (result && result.error) || "";
  port.postMessage(msg);
}

// Generic request processor: supports GET/POST with custom headers + body,
// and returns response headers (needed for the GST portal's 'at' session
// token used by litserv/notices endpoints).
async function processRequest(msg) {
  try {
    const resp = await gstXhrRequestWithRetry({
      url: msg.url,
      method: msg.method || "GET",
      headers: msg.headers || {},
      body: msg.body != null ? msg.body : null,
      withCredentials: msg.withCredentials !== false,
    });
    msg.status = true;
    msg.statusCode = 200;
    msg.response = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
    msg.responseHeaders = resp.headers || {};
  } catch (err) {
    msg.status = false;
    msg.statusCode = (err && err.statusCode) || 0;
    msg.response = "";
    msg.error = err && err.message ? err.message : String(err);
    msg.responseHeaders = (err && err.responseHeaders) || {};
  }
  port.postMessage(msg);
}

async function processGet(msg) {
  try {
    const resp = await gstXhrRequestWithRetry({ url: msg.url, headers: msg.headers || {} });
    msg.status = true;
    msg.statusCode = 200;
    msg.response = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
  } catch (err) {
    msg.status = false;
    msg.statusCode = (err && err.statusCode) || 0;
    msg.response = "";
    msg.error = err && err.message ? err.message : String(err);
  }

  //log('Sending response: ' + JSON.stringify(msg));

  port.postMessage(msg);
}

async function processGetBlob(msg) {
  try {
    const resp = await gstXhrRequestWithRetry({ url: msg.url, headers: msg.headers || {}, responseType: "blob" });
    msg.status = true;
    msg.statusCode = 200;
    msg.response = null;
    if (resp.data && resp.data.size > 0) {
      msg.response = URL.createObjectURL(resp.data);
    }
  } catch (err) {
    msg.status = false;
    msg.statusCode = (err && err.statusCode) || 0;
    msg.response = null;
    msg.error = err && err.message ? err.message : String(err);
  }

  port.postMessage(msg);
}

async function processGetBlobBase64(msg) {
  try {
    const resp = await gstXhrRequestWithRetry({ url: msg.url, headers: msg.headers || {}, responseType: "blob" });
    msg.status = true;
    msg.statusCode = 200;
    msg.response = null;
    msg.responseBase64 = "";
    if (resp.data && resp.data.size > 0) {
      const bytes = new Uint8Array(await resp.data.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 0x8000));
      }
      msg.responseBase64 = btoa(binary);
      msg.contentType = resp.data.type || "application/octet-stream";
    }
  } catch (err) {
    msg.status = false;
    msg.statusCode = (err && err.statusCode) || 0;
    msg.response = null;
    msg.responseBase64 = "";
    msg.error = err && err.message ? err.message : String(err);
  }
  port.postMessage(msg);
}

function processLog(msg) {
  msg.status = true;
  msg.statusCode = 200;
  log(msg.text, msg.obj);
  port.postMessage(msg);
}

async function processZipAndSave(msg) {
  let zipData = await zipAsync(msg.jsonData, `${msg.jsonfilename}.json`);
  saveFile(msg.zipfilename+".zip", zipData, "application/zip");
  msg.status = true;
  msg.statusCode = 200;
  port.postMessage(msg);
}

function processDownloadUrl(msg) {
  if (msg && msg.url) {
    clickUrl(msg.url, !!msg.newTab);
    msg.status = true;
    msg.statusCode = 200;
  } else {
    msg.status = false;
    msg.statusCode = 400;
  }
  port.postMessage(msg);
}

function processGetGstin(msg) {
  try {
    const text = document.body ? document.body.innerText || "" : "";
    const match = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z0-9]{1}Z[A-Z0-9]{1}\b/);
    msg.status = true;
    msg.statusCode = 200;
    msg.response = match ? match[0] : "";
  } catch (e) {
    msg.status = false;
    msg.statusCode = 500;
    msg.response = "";
  }
  port.postMessage(msg);
}
