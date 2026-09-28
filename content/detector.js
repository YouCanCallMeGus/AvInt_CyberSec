/*
 * detector.js - Content script (mundo isolado), roda em document_start em todos os frames.
 *
 * Faz duas coisas:
 *  1) Injeta a "sonda" (pageProbe) no MUNDO PRINCIPAL da pagina, de forma sincrona
 *     (via <script>.textContent), garantindo que os hooks de canvas/storage/WebSocket
 *     sejam instalados ANTES do JS da pagina rodar.
 *  2) Inventaria o storage HTML5 (localStorage/sessionStorage/IndexedDB) - que e visivel
 *     ao content script por compartilhar a origem - e repassa ao background as mensagens
 *     que a sonda envia via window.postMessage.
 *
 * Fluxo:  pageProbe (mundo pagina) --postMessage--> detector.js (mundo isolado)
 *         --runtime.sendMessage--> background.js
 */

(function () {
  "use strict";

  const FRAME_HOST = location.hostname;

  /* ---------- 1) Sonda injetada no mundo principal ---------- */
  function pageProbe() {
    // Executa dentro da pagina. Comunica-se por window.postMessage({ __dp:true, ... }).
    const send = (payload) => {
      try { window.postMessage(Object.assign({ __dp: true }, payload), "*"); } catch (e) {}
    };

    // --- Canvas fingerprint ---
    const canvasEvidence = [];
    function flagCanvas(method, canvas) {
      let w = 0, h = 0, attached = false;
      try { w = canvas && canvas.width; h = canvas && canvas.height; } catch (e) {}
      try { attached = !!(canvas && canvas.isConnected); } catch (e) {}
      const small = (w && h && w * h <= 65536); // <= ~256x256
      // Heuristica: leitura de pixels de canvas offscreen/pequeno = fingerprint provavel.
      const evid = method + "() em canvas " + (w || "?") + "x" + (h || "?") +
                   (attached ? "" : " (offscreen)") + (small ? " (pequeno)" : "");
      if (canvasEvidence.indexOf(evid) === -1) {
        canvasEvidence.push(evid);
        send({ canvas: [evid] });
      }
    }
    try {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function () {
        flagCanvas("toDataURL", this);
        return origToDataURL.apply(this, arguments);
      };
      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      if (origToBlob) {
        HTMLCanvasElement.prototype.toBlob = function () {
          flagCanvas("toBlob", this);
          return origToBlob.apply(this, arguments);
        };
      }
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function () {
        try { flagCanvas("getImageData", this.canvas); } catch (e) {}
        return origGetImageData.apply(this, arguments);
      };
    } catch (e) {}

    // --- WebGL fingerprint (renderer/vendor mascarados) ---
    try {
      const wrapGetParam = (proto) => {
        if (!proto || !proto.getParameter) return;
        const orig = proto.getParameter;
        proto.getParameter = function (p) {
          // 37445/37446 = UNMASKED_VENDOR/RENDERER_WEBGL
          if (p === 37445 || p === 37446) {
            send({ canvas: ["WebGL getParameter(UNMASKED_" + (p === 37445 ? "VENDOR" : "RENDERER") + ")"] });
          }
          return orig.apply(this, arguments);
        };
      };
      if (window.WebGLRenderingContext) wrapGetParam(WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) wrapGetParam(WebGL2RenderingContext.prototype);
    } catch (e) {}

    // --- document.cookie definido por JS ---
    try {
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie") ||
                   Object.getOwnPropertyDescriptor(HTMLDocument.prototype, "cookie");
      if (desc && desc.set) {
        Object.defineProperty(document, "cookie", {
          get: function () { return desc.get.call(document); },
          set: function (v) { send({ jsCookies: [String(v)] }); return desc.set.call(document, v); },
          configurable: true
        });
      }
    } catch (e) {}

    // --- Escritas em storage (supercookie dinamico) ---
    try {
      const wrapSetItem = (storage, label) => {
        if (!storage) return;
        const orig = storage.setItem;
        storage.setItem = function (k) {
          send({ storageWrite: { where: label, key: String(k) } });
          return orig.apply(this, arguments);
        };
      };
      wrapSetItem(window.localStorage, "localStorage");
      wrapSetItem(window.sessionStorage, "sessionStorage");
    } catch (e) {}
    try {
      const origOpen = window.indexedDB && window.indexedDB.open;
      if (origOpen) {
        window.indexedDB.open = function (name) {
          send({ storageWrite: { where: "indexedDB", key: String(name) } });
          return origOpen.apply(this, arguments);
        };
      }
    } catch (e) {}

    // --- WebSocket (indicador de canal persistente com terceiro) ---
    try {
      const OrigWS = window.WebSocket;
      if (OrigWS) {
        window.WebSocket = function (url, protocols) {
          send({ hijack: [{ kind: "websocket", text: "WebSocket aberto para " + url, url: String(url) }] });
          return protocols ? new OrigWS(url, protocols) : new OrigWS(url);
        };
        window.WebSocket.prototype = OrigWS.prototype;
        window.WebSocket.OPEN = OrigWS.OPEN;
        window.WebSocket.CONNECTING = OrigWS.CONNECTING;
        window.WebSocket.CLOSING = OrigWS.CLOSING;
        window.WebSocket.CLOSED = OrigWS.CLOSED;
      }
    } catch (e) {}

    // --- Polling: fetch/XHR repetidos para o mesmo endpoint (BeEF-like) ---
    const callCounts = {};
    function trackCall(url) {
      let host = "";
      try { host = new URL(url, location.href).hostname; } catch (e) { return; }
      const key = host;
      callCounts[key] = (callCounts[key] || 0) + 1;
      if (callCounts[key] === 8) { // limiar de polling
        send({ hijack: [{ kind: "polling", text: "Polling frequente para " + host, domain: host }] });
      }
    }
    try {
      const origFetch = window.fetch;
      if (origFetch) {
        window.fetch = function (input) {
          try { trackCall(typeof input === "string" ? input : (input && input.url)); } catch (e) {}
          return origFetch.apply(this, arguments);
        };
      }
    } catch (e) {}
    try {
      const origXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        try { trackCall(url); } catch (e) {}
        return origXHROpen.apply(this, arguments);
      };
    } catch (e) {}

    // --- Session recording / key logging (categorias do Blacklight) ---
    try {
      const origAdd = EventTarget.prototype.addEventListener;
      const sensitive = {};
      EventTarget.prototype.addEventListener = function (type) {
        if (type === "keydown" || type === "keypress" || type === "keyup" ||
            type === "mousemove" || type === "input") {
          sensitive[type] = (sensitive[type] || 0) + 1;
          if (sensitive[type] === 3) {
            const isKey = type.indexOf("key") === 0;
            send({ hijack: [{ kind: "listener",
              text: (isKey ? "Possivel key-logging" : "Possivel session-recording") +
                    " (multiplos listeners de '" + type + "')" }] });
          }
        }
        return origAdd.apply(this, arguments);
      };
    } catch (e) {}

    // --- Adulteracao de nativos: alguem sobrescreveu alert/console? (hook grosseiro) ---
    try {
      setTimeout(function () {
        const suspects = [];
        try {
          if (window.alert && window.alert.toString().indexOf("[native code]") === -1)
            suspects.push("window.alert foi sobrescrito");
        } catch (e) {}
        try {
          // BeEF costuma expor um objeto global proprio.
          if (window.beef || window.BeEF) suspects.push("Objeto global BeEF detectado");
        } catch (e) {}
        suspects.forEach((s) => send({ hijack: [{ kind: "tamper", text: s }] }));
      }, 1500);
    } catch (e) {}
  }

  // Injeta a sonda de forma sincrona no mundo principal.
  try {
    const s = document.createElement("script");
    s.textContent = "(" + pageProbe.toString() + ")();";
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  } catch (e) { /* CSP pode bloquear em paginas rigidas; storage ainda e coletado abaixo */ }

  /* ---------- 2) Ponte: mensagens da sonda -> background ---------- */
  const buffer = { storageWrite: [] };
  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__dp !== true) return;

    if (d.canvas) send({ canvas: d.canvas });
    if (d.jsCookies) send({ jsCookies: d.jsCookies });
    if (d.hijack) send({ hijack: d.hijack });
    if (d.storageWrite) {
      // Acumula escritas dinamicas para relatar junto ao inventario.
      buffer.storageWrite.push(d.storageWrite);
    }
  }, false);

  function send(payload) {
    try {
      browser.runtime.sendMessage(Object.assign({ type: "pageEvidence", frameHost: FRAME_HOST }, payload));
    } catch (e) {}
  }

  /* ---------- 3) Inventario de storage (content script ve a mesma origem) ---------- */
  function inventoryStorage() {
    const out = { local: [], session: [], indexedDB: [] };
    try {
      for (let i = 0; i < localStorage.length; i++) out.local.push(localStorage.key(i));
    } catch (e) {}
    try {
      for (let i = 0; i < sessionStorage.length; i++) out.session.push(sessionStorage.key(i));
    } catch (e) {}

    // Escritas dinamicas capturadas pela sonda
    buffer.storageWrite.forEach((w) => {
      if (w.where === "localStorage" && out.local.indexOf(w.key) === -1) out.local.push(w.key);
      if (w.where === "sessionStorage" && out.session.indexOf(w.key) === -1) out.session.push(w.key);
      if (w.where === "indexedDB" && out.indexedDB.indexOf(w.key) === -1) out.indexedDB.push(w.key);
    });

    const finish = () => send({ storage: out });
    if (indexedDB && indexedDB.databases) {
      indexedDB.databases().then((dbs) => {
        (dbs || []).forEach((db) => { if (db.name && out.indexedDB.indexOf(db.name) === -1) out.indexedDB.push(db.name); });
        finish();
      }).catch(finish);
    } else {
      finish();
    }
  }

  // Inventaria apos carregamento e novamente 3s depois (storage pode crescer).
  if (document.readyState === "complete" || document.readyState === "interactive") {
    inventoryStorage();
  } else {
    window.addEventListener("DOMContentLoaded", inventoryStorage);
  }
  window.addEventListener("load", () => setTimeout(inventoryStorage, 3000));
})();
