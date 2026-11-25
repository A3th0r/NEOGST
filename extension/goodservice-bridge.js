// NEO-GST goodservice — injected into the page MAIN world via the manifest
// (CSP-exempt, unlike inline <script> injection which strict GST pages block).
(function () {
    if (window.__neoGstGoodserviceBridgeInstalled === "2") return;
    window.__neoGstGoodserviceBridgeInstalled = "2";
    var SEARCH_TP_URL = "https://publicservices.gst.gov.in/publicservices/auth/api/search/tp";
    var BUSPLACES_URL = "https://publicservices.gst.gov.in/publicservices/auth/api/search/tp/busplaces";
    var GOODSERVICE_URL = "https://publicservices.gst.gov.in/publicservices/auth/api/search/goodservice";
    var RETURN_DETAILS_URL = "https://publicservices.gst.gov.in/publicservices/auth/api/search/taxpayerReturnDetails";
    var lastSearchTpTemplate = null;
    var lastGoodserviceTemplate = null;
    var lastBusplacesTemplate = null;
    var pendingTemplateWaiters = [];

    function request(options) {
      return new Promise(function (resolve) {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open(options.method || "GET", options.url, true);
          xhr.withCredentials = !!options.withCredentials;
          var headers = options.headers || {};
          Object.keys(headers).forEach(function (key) {
            if (headers[key] != null) {
              xhr.setRequestHeader(key, headers[key]);
            }
          });
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            resolve({
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              responseText: xhr.responseText || "",
              finalUrl: xhr.responseURL || options.url,
              headers: xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : "",
              error: xhr.status >= 200 && xhr.status < 300 ? "" : "Request failed (" + xhr.status + ")"
            });
          };
          xhr.onerror = function () {
            resolve({
              ok: false,
              status: 0,
              responseText: "",
              finalUrl: options.url,
              error: "NetworkError when attempting to fetch resource."
            });
          };
          xhr.send(options.body || null);
        } catch (error) {
          resolve({
            ok: false,
            status: 0,
            responseText: "",
            finalUrl: options.url,
            error: error && error.message ? error.message : "Page bridge request failed."
          });
        }
      });
    }

    function readStorageValue(storage, keys) {
      try {
        for (var i = 0; i < keys.length; i += 1) {
          var value = storage.getItem(keys[i]);
          if (value) return value;
        }
      } catch (error) {}
      return "";
    }

    function readTokenFromObject(value, seen) {
      if (!value) return "";
      if (!seen) seen = [];
      if (seen.indexOf(value) >= 0) return "";
      seen.push(value);
      if (typeof value === "string") {
        if (/^[a-f0-9]{16,}$/i.test(value.trim())) return value.trim();
        try {
          var parsed = JSON.parse(value);
          return readTokenFromObject(parsed, seen);
        } catch (error) {
          return "";
        }
      }
      if (typeof value !== "object") return "";
      var directKeys = ["at", "authToken", "AuthToken", "token"];
      for (var j = 0; j < directKeys.length; j += 1) {
        var direct = value[directKeys[j]];
        if (typeof direct === "string" && /^[a-f0-9]{16,}$/i.test(direct.trim())) return direct.trim();
      }
      var objectKeys = Object.keys(value);
      for (var k = 0; k < objectKeys.length; k += 1) {
        var nested = readTokenFromObject(value[objectKeys[k]], seen);
        if (nested) return nested;
      }
      return "";
    }

    function discoverAtToken(payload) {
      var explicit = String((payload && (payload.at || payload.authToken || payload.AuthToken)) || "").trim();
      if (explicit) return explicit;
      var storageKeys = [
        "at",
        "authToken",
        "AuthToken",
        "gstAuthToken",
        "gst_auth_token",
        "searchtpAuthToken",
        "searchtp_at",
        "token"
      ];
      var fromSession = readStorageValue(window.sessionStorage, storageKeys);
      var fromLocal = readStorageValue(window.localStorage, storageKeys);
      var nestedSession = readTokenFromObject(fromSession);
      var nestedLocal = readTokenFromObject(fromLocal);
      return nestedSession || nestedLocal || "";
    }

    function normalizeHeaderKey(key) {
      return String(key || "").trim().toLowerCase();
    }

    function resolveRequestUrl(url) {
      try {
        return new URL(String(url || ""), window.location.href).toString();
      } catch (error) {
        return String(url || "");
      }
    }

    function matchesEndpoint(url, method, endpointUrl) {
      var resolved = resolveRequestUrl(url);
      var normalizedMethod = String(method || "").toUpperCase();
      var expectedMethod = endpointUrl === GOODSERVICE_URL ? "GET" : "POST";
      if (normalizedMethod !== expectedMethod) return false;
      try {
        var parsed = new URL(resolved);
        var expected = new URL(endpointUrl);
        if (parsed.origin !== expected.origin) return false;
        return parsed.pathname === expected.pathname;
      } catch (error) {
        return resolved.indexOf(endpointUrl) >= 0;
      }
    }

    function captureTemplate(headers, bodyText, url) {
      var resolvedUrl = resolveRequestUrl(url);
      var safeHeaders = {};
      Object.keys(headers || {}).forEach(function (key) {
        var normalized = normalizeHeaderKey(key);
        if (!normalized) return;
        safeHeaders[normalized] = headers[key];
      });
      var parsedBody = null;
      try {
        parsedBody = bodyText ? JSON.parse(bodyText) : null;
      } catch (error) {
        parsedBody = null;
      }
      var template = {
        headers: safeHeaders,
        body: parsedBody && typeof parsedBody === "object" ? parsedBody : null,
        at: String(safeHeaders.at || "").trim(),
        capturedAt: Date.now(),
        url: resolvedUrl
      };
      if (matchesEndpoint(template.url, "POST", SEARCH_TP_URL)) {
        lastSearchTpTemplate = template;
      } else if (matchesEndpoint(template.url, "POST", BUSPLACES_URL)) {
        lastBusplacesTemplate = template;
      } else if (matchesEndpoint(template.url, "GET", GOODSERVICE_URL)) {
        lastGoodserviceTemplate = template;
      }
      window.__neoGstCapturedTemplates = {
        searchTp: lastSearchTpTemplate,
        goodservice: lastGoodserviceTemplate,
        busplaces: lastBusplacesTemplate
      };
      if (pendingTemplateWaiters.length) {
        var waiters = pendingTemplateWaiters.splice(0, pendingTemplateWaiters.length);
        waiters.forEach(function (resolve) {
          try {
            resolve({
              searchTp: lastSearchTpTemplate,
              goodservice: lastGoodserviceTemplate,
              busplaces: lastBusplacesTemplate
            });
          } catch (error) {}
        });
      }
    }

    function waitForCapturedTemplates(timeoutMs) {
      return new Promise(function (resolve) {
        if (lastSearchTpTemplate && lastSearchTpTemplate.at) {
          resolve({
            searchTp: lastSearchTpTemplate,
            goodservice: lastGoodserviceTemplate,
            busplaces: lastBusplacesTemplate
          });
          return;
        }
        var completed = false;
        var timer = setTimeout(function () {
          if (completed) return;
          completed = true;
          resolve({
            searchTp: lastSearchTpTemplate,
            goodservice: lastGoodserviceTemplate,
            busplaces: lastBusplacesTemplate
          });
        }, timeoutMs || 120000);
        pendingTemplateWaiters.push(function (templates) {
          if (completed) return;
          completed = true;
          clearTimeout(timer);
          resolve(templates || {
            searchTp: lastSearchTpTemplate,
            goodservice: lastGoodserviceTemplate,
            busplaces: lastBusplacesTemplate
          });
        });
      });
    }

    function installSearchTpRequestCapture() {
      if (window.__neoGstSearchTpCaptureInstalled) return;
      window.__neoGstSearchTpCaptureInstalled = true;
      var originalOpen = XMLHttpRequest.prototype.open;
      var originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
      var originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__neoGstMethod = String(method || "GET").toUpperCase();
        this.__neoGstUrl = String(url || "");
        this.__neoGstHeaders = {};
        return originalOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
        try {
          if (!this.__neoGstHeaders) this.__neoGstHeaders = {};
          this.__neoGstHeaders[String(key || "")] = String(value == null ? "" : value);
        } catch (error) {}
        return originalSetRequestHeader.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function (body) {
        try {
          var method = String(this.__neoGstMethod || "").toUpperCase();
          var url = String(this.__neoGstUrl || "");
          if (
            matchesEndpoint(url, method, SEARCH_TP_URL) ||
            matchesEndpoint(url, method, BUSPLACES_URL) ||
            matchesEndpoint(url, method, GOODSERVICE_URL)
          ) {
            captureTemplate(this.__neoGstHeaders || {}, typeof body === "string" ? body : "", url);
          }
        } catch (error) {}
        return originalSend.apply(this, arguments);
      };
    }

    function buildCapturedHeaders(template, fallbackHeaders, atToken) {
      var next = {};
      var source = template && template.headers ? template.headers : {};
      Object.keys(source).forEach(function (key) {
        var normalized = normalizeHeaderKey(key);
        if (!normalized) return;
        if (["content-length", "host", "connection", "origin", "referer", "user-agent", "accept-encoding"].indexOf(normalized) >= 0) return;
        next[key] = source[key];
      });
      Object.keys(fallbackHeaders || {}).forEach(function (key) {
        next[key] = fallbackHeaders[key];
      });
      if (atToken) next.at = atToken;
      return next;
    }

    function buildTpBody(template, gstin, captcha) {
      var next = template && template.body && typeof template.body === "object"
        ? JSON.parse(JSON.stringify(template.body))
        : {};
      next.gstin = gstin;
      if (captcha) {
        next.captcha = captcha;
      } else if ("captcha" in next && !next.captcha) {
        delete next.captcha;
      }
      return next;
    }

    function buildGoodserviceUrl(template, gstin) {
      var source = String((template && template.url) || GOODSERVICE_URL);
      try {
        var parsed = new URL(source, window.location.origin);
        parsed.searchParams.set("gstin", gstin);
        return parsed.toString();
      } catch (error) {
        return GOODSERVICE_URL + "?gstin=" + encodeURIComponent(gstin);
      }
    }

    function buildBusplacesBody(template, gstin) {
      var next = template && template.body && typeof template.body === "object"
        ? JSON.parse(JSON.stringify(template.body))
        : {};
      next.gstin = gstin;
      return next;
    }

    function appendAtHeader(headers, atToken) {
      var next = {};
      Object.keys(headers || {}).forEach(function (key) {
        next[key] = headers[key];
      });
      if (atToken) next.at = atToken;
      return next;
    }

    window.addEventListener("message", function (event) {
      if (event.source !== window) return;
      var data = event.data || {};
      if (data.type === "gc-returns-pro-template-status-request-v1") {
        window.postMessage({
          type: "gc-returns-pro-template-status-response-v1",
          requestId: data.requestId,
          payload: {
            status: true,
            searchTp: !!(lastSearchTpTemplate && lastSearchTpTemplate.at),
            goodservice: !!lastGoodserviceTemplate,
            busplaces: !!lastBusplacesTemplate,
            at: !!(
              (lastSearchTpTemplate && lastSearchTpTemplate.at) ||
              (lastGoodserviceTemplate && lastGoodserviceTemplate.at) ||
              (lastBusplacesTemplate && lastBusplacesTemplate.at)
            )
          }
        }, "*");
        return;
      }
      if (data.type !== "gc-returns-pro-goodservice-request-v1") return;
      var payload = data.payload || {};
      var gstin = String(payload.gstin || "").trim().toUpperCase();
      var includeFiling = !!payload.includeFiling;
      var filingFy = String(payload.fy || "").trim();
      if (!gstin) {
        window.postMessage({ type: "gc-returns-pro-goodservice-response-v1", requestId: data.requestId, payload: { status: false, error: "Missing GSTIN" } }, "*");
        return;
      }
      var captchaInput =
        document.querySelector('input[name="captcha"]') ||
        document.querySelector('input[ng-model*="captcha"]') ||
        document.querySelector('input[id*="captcha"]');
      var captcha = String(payload.captcha || (captchaInput && captchaInput.value) || "").trim();
      var postHeaders = {
        "Accept": "application/json, text/plain",
        "Content-Type": "application/json;charset=UTF-8"
      };
      var getHeaders = {
        "Accept": "application/json, text/plain, */*"
      };
      var discoveredAtToken = discoverAtToken(payload);
      // If the page/session already exposes the token, the canonical search/tp
      // request only needs {gstin}; do not unnecessarily wait for a manually
      // captured search request. A captured template is still preferred when
      // available because it preserves any portal-side additions.
      var templatesPromise = discoveredAtToken
        ? Promise.resolve({ searchTp: lastSearchTpTemplate, goodservice: lastGoodserviceTemplate, busplaces: lastBusplacesTemplate })
        : waitForCapturedTemplates(120000);
      templatesPromise.then(function (templates) {
        var tpTemplate = templates && templates.searchTp && templates.searchTp.at ? templates.searchTp : null;
        var goodserviceTemplate = templates && templates.goodservice ? templates.goodservice : tpTemplate;
        var busplacesTemplate = templates && templates.busplaces ? templates.busplaces : tpTemplate;
        var effectiveAtToken = String(
          (tpTemplate && tpTemplate.at) ||
          (goodserviceTemplate && goodserviceTemplate.at) ||
          (busplacesTemplate && busplacesTemplate.at) ||
          discoveredAtToken ||
          discoverAtToken(payload) ||
          ""
        ).trim();
        if (!effectiveAtToken) {
          throw new Error("No GST portal request template captured yet. Open the GST search page and manually search one GSTIN first.");
        }
        var tpBody = buildTpBody(tpTemplate, gstin, captcha);
        return request({
          method: "POST",
          url: SEARCH_TP_URL,
          headers: buildCapturedHeaders(tpTemplate, postHeaders, effectiveAtToken),
          body: JSON.stringify(tpBody),
          withCredentials: false
        }).then(function (tpResp) {
        return Promise.all([
          Promise.resolve(tpResp),
          request({
          method: "GET",
          url: buildGoodserviceUrl(goodserviceTemplate, gstin),
          headers: buildCapturedHeaders(goodserviceTemplate, getHeaders, effectiveAtToken),
          withCredentials: false
          }),
          request({
            method: "POST",
            url: BUSPLACES_URL,
            headers: buildCapturedHeaders(busplacesTemplate, postHeaders, effectiveAtToken),
            body: JSON.stringify(buildBusplacesBody(busplacesTemplate, gstin)),
            withCredentials: false
          }),
          includeFiling && filingFy ? request({
            method: "POST",
            url: RETURN_DETAILS_URL,
            headers: buildCapturedHeaders(tpTemplate, { "Accept": "application/json, text/plain, */*", "Content-Type": "application/json;charset=UTF-8" }, effectiveAtToken),
            body: JSON.stringify({ gstin: gstin, fy: filingFy }),
            withCredentials: false
          }) : Promise.resolve(null)
        ]);
      });
      }).then(function (results) {
        var tpResp = results[0];
        var goodsResp = results[1];
        var busplacesResp = results[2];
        var filingResp = results[3];
        window.postMessage({
          type: "gc-returns-pro-goodservice-response-v1",
          requestId: data.requestId,
          payload: {
            // The taxpayer call is the primary lookup. A successful secondary
            // endpoint must not turn a failed/empty taxpayer lookup into a
            // false success (which previously appeared as Status: Unknown).
            status: !!(tpResp && tpResp.ok && tpResp.responseText),
            gstin: gstin,
            endpoint: SEARCH_TP_URL,
            tpStatus: tpResp ? tpResp.status : 0,
            goodserviceStatus: goodsResp ? goodsResp.status : 0,
            busplacesStatus: busplacesResp ? busplacesResp.status : 0,
            filingStatus: filingResp ? filingResp.status : 0,
            tpResponse: tpResp ? tpResp.responseText : "",
            goodserviceResponse: goodsResp ? goodsResp.responseText : "",
            busplacesResponse: busplacesResp ? busplacesResp.responseText : "",
            filingResponse: filingResp ? filingResp.responseText : "",
            error: [tpResp, goodsResp, busplacesResp, filingResp]
              .filter(function (resp) { return resp && !resp.ok; })
              .map(function (resp) { return resp.error || ("HTTP " + resp.status); })
              .join(" | ") || (!(tpResp && tpResp.responseText) ? "Taxpayer search returned an empty response." : "")
          }
        }, "*");
      }).catch(function (error) {
        window.postMessage({
          type: "gc-returns-pro-goodservice-response-v1",
          requestId: data.requestId,
          payload: { status: false, gstin: gstin, error: error && error.message ? error.message : "NetworkError when attempting to fetch resource." }
        }, "*");
      });
    });
    installSearchTpRequestCapture();
  })();
