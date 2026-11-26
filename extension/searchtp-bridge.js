// NEO-GST searchtp — injected into the page MAIN world via the manifest
// (CSP-exempt, unlike inline <script> injection which strict GST pages block).
(function () {
    // Bump this marker whenever the bridge protocol changes.  It lets a
    // programmatic reinjection replace a bridge left behind by an older
    // extension build on an already-open GST portal page.
    if (window.__neoGstSearchBridgeInstalled === "3") return;
    window.__neoGstSearchBridgeInstalled = "3";

    function request(options) {
      return new Promise(function (resolve) {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open(options.method || "GET", options.url, true);
          xhr.withCredentials = true;
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
              finalUrl: xhr.responseURL || options.url
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

    window.addEventListener("message", function (event) {
      if (event.source !== window) return;
      var data = event.data || {};
      if (data.type === "gc-returns-pro-gstr3b-pdf-request-v1") {
        var period = String((data.payload || {}).period || "").trim();
        var respond = function (payload) {
          window.postMessage({ type: "gc-returns-pro-gstr3b-pdf-response-v1", requestId: data.requestId, payload: payload }, "*");
        };
        try {
          var controller = document.querySelector('[ng-controller="dashboardcrtl"], [data-ng-controller="dashboardcrtl"]');
          var scope = window.angular && controller ? (window.angular.element(controller).scope() || window.angular.element(controller).isolateScope()) : null;
          var injector = window.angular && controller ? window.angular.element(controller).injector() : null;
          // On the current portal build the injector is attached to the root
          // element rather than the dashboard template itself.
          if (!injector && window.angular) {
            injector = window.angular.element(document).injector() || window.angular.element(document.body).injector();
          }
          if (!injector && window.angular) {
            var appRoot = document.querySelector('[ng-app], [data-ng-app]');
            injector = appRoot ? window.angular.element(appRoot).injector() : null;
          }
          // Production Angular builds can hide element.scope().  Find the
          // dashboard controller through $rootScope instead.
          if (!scope && injector && injector.get) {
            try {
              var pendingScopes = [injector.get("$rootScope")];
              var visitedScopes = [];
              while (pendingScopes.length) {
                var candidate = pendingScopes.shift();
                if (!candidate || visitedScopes.indexOf(candidate) !== -1) continue;
                visitedScopes.push(candidate);
                if (typeof candidate.downloadGSTR3Bpdf === "function") {
                  scope = candidate;
                  break;
                }
                if (candidate.$$childHead) pendingScopes.push(candidate.$$childHead);
                if (candidate.$$nextSibling) pendingScopes.push(candidate.$$nextSibling);
              }
            } catch (scopeError) { /* detailed precondition below */ }
          }
          var shareData = injector && injector.get ? injector.get("shareData") : null;
          if (!period || !scope || !shareData || typeof scope.downloadGSTR3Bpdf !== "function" || !window.pdfMake) {
            var unavailable = [];
            if (!period) unavailable.push("period");
            if (!window.angular) unavailable.push("Angular portal runtime");
            if (!injector) unavailable.push("portal injector");
            if (!scope || typeof (scope && scope.downloadGSTR3Bpdf) !== "function") unavailable.push("GSTR-3B dashboard controller");
            if (!shareData) unavailable.push("portal session data");
            if (!window.pdfMake) unavailable.push("portal PDF renderer");
            respond({ status: false, error: "Portal PDF download is not ready: " + unavailable.join(", ") + ". Refresh the GST dashboard after reloading the extension." });
            return;
          }
          var originalPeriod = shareData.rtn_prd;
          var originalCreatePdf = window.pdfMake.createPdf;
          var finished = false;
          var restore = function () { window.pdfMake.createPdf = originalCreatePdf; shareData.rtn_prd = originalPeriod; };
          var timeout = window.setTimeout(function () {
            if (finished) return;
            finished = true; restore(); respond({ status: false, error: "The portal PDF renderer timed out." });
          }, 90000);
          shareData.rtn_prd = period;
          window.pdfMake.createPdf = function (definition) {
            var pdf = originalCreatePdf.call(window.pdfMake, definition);
            pdf.download = function () {
              pdf.getBase64(function (base64) {
                if (finished) return;
                finished = true; window.clearTimeout(timeout); restore();
                respond({ status: true, base64: base64, filename: "GSTR-3B_" + period + ".pdf" });
              });
            };
            return pdf;
          };
          var download = function () { scope.downloadGSTR3Bpdf(); };
          if (typeof scope.$applyAsync === "function") scope.$applyAsync(download);
          else download();
        } catch (error) {
          respond({ status: false, error: error && error.message ? error.message : "Portal PDF renderer failed." });
        }
        return;
      }
      if (data.type !== "gc-returns-pro-searchtp-request-v2") return;
      var payload = data.payload || {};
      var gstin = String(payload.gstin || "").trim().toUpperCase();
      var year = String(payload.year || "").trim();
      var fy = String(payload.fy || "").trim();
      var captchaInput =
        document.querySelector('input[name="captcha"]') ||
        document.querySelector('input[ng-model*="captcha"]') ||
        document.querySelector('input[id*="captcha"]');
      var captcha = String(payload.captcha || (captchaInput && captchaInput.value) || "").trim();
      var jsonHeaders = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=utf-8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      };
      if (!year) {
        year = String(new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear());
      }
      if (!fy) fy = year;
      var detailsUrl = "/services/api/search/taxpayerDetails";
      var returnUrl = "/services/api/search/taxpayerReturnDetails";
      var detailsBody = { gstin: gstin };
      if (captcha) detailsBody.captcha = captcha;

      Promise.all([
        request({ method: "POST", url: detailsUrl, headers: jsonHeaders, body: JSON.stringify(detailsBody) })
      ]).then(function (results) {
        return request({
          method: "POST",
          url: returnUrl,
          headers: jsonHeaders,
          body: JSON.stringify({ gstin: gstin, fy: fy || year })
        }).then(function (returnResp) {
          window.postMessage({
            type: "gc-returns-pro-searchtp-response",
            type: "gc-returns-pro-searchtp-response-v2",
            requestId: data.requestId,
            payload: {
              status: !!(returnResp && returnResp.ok),
              gstin: gstin,
              year: year,
              fy: fy || year,
              taxpayerDetails: results[0] ? results[0].responseText : null,
              taxpayerReturnDetails: returnResp ? returnResp.responseText : null,
              error: returnResp && !returnResp.ok ? (returnResp.error || ("taxpayerReturnDetails failed (" + returnResp.status + ")")) : ""
            }
          }, "*");
        });
      }).catch(function (error) {
        window.postMessage({
          type: "gc-returns-pro-searchtp-response",
          type: "gc-returns-pro-searchtp-response-v2",
          requestId: data.requestId,
          payload: {
            status: false,
            gstin: gstin,
            error: error && error.message ? error.message : "searchtp-return-status failed"
          }
        }, "*");
      });
    });
  })();
