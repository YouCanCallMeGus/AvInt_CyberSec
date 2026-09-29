"use strict";

const tabData = new Map();

let settings = { blockingEnabled: false, customBlocklist: [] };

browser.storage.local.get(["blockingEnabled", "customBlocklist"]).then((s) => {
  if (typeof s.blockingEnabled === "boolean") settings.blockingEnabled = s.blockingEnabled;
  if (Array.isArray(s.customBlocklist)) settings.customBlocklist = s.customBlocklist;
});

function cap(arr, n) {
  return arr.length > n ? arr.slice(0, n) : arr;
}

function blankReport(baseUrl) {
  const baseDomain = baseUrl ? getRegistrableDomain(hostOf(baseUrl)) : null;
  return {
    baseUrl: baseUrl || null,
    baseDomain: baseDomain,
    thirdParties: {},           
    firstPartyHosts: {},        
    cookies: {
      firstSession: 0, firstPersistent: 0,
      thirdSession: 0, thirdPersistent: 0,
      list: []                  
    },
    storage: { local: [], session: [], indexedDB: [] },
    canvas: { detected: false, evidence: [] },
    cookieSync: { detected: false, evidence: [] },
    bounce: { detected: false, evidence: [] },
    hijack: { detected: false, evidence: [] },
    _idParams: {},              
    _redirects: {},             
    blockedCount: 0,
    startedAt: Date.now()
  };
}

function getTab(tabId) {
  if (!tabData.has(tabId)) tabData.set(tabId, blankReport(null));
  return tabData.get(tabId);
}

function isBlocklisted(regDomain) {
  if (isKnownTracker(regDomain)) return true;
  return settings.customBlocklist.indexOf(regDomain) !== -1;
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const tabId = details.tabId;
    if (tabId < 0) return {}; // requisicoes sem aba (ex.: service worker interno)

    if (details.type === "main_frame") {
      tabData.set(tabId, blankReport(details.url));
      return {};
    }

    const docCtx = details.originUrl || details.documentUrl || "";
    if (docCtx === "") return {};

    const report = getTab(tabId);
    if (!report.baseDomain) {
      report.baseDomain = report.baseDomain || null;
    }

    const reqHost = hostOf(details.url);
    const reqDomain = getRegistrableDomain(reqHost);
    if (!reqDomain) return {};

    const third = report.baseDomain && reqDomain !== report.baseDomain;

    if (third) {
      const tp = report.thirdParties[reqDomain] || {
        count: 0, tracker: isKnownTracker(reqDomain), blocked: false, sample: []
      };
      tp.count += 1;
      if (tp.sample.length < 3) tp.sample.push(details.url.slice(0, 200));

      collectIdParams(report, details.url, reqDomain);

      if (isSessionRecorder(reqDomain)) {
        const line = "Servico de session-recording/keylogging: " + reqDomain;
        if (report.hijack.evidence.indexOf(line) === -1) {
          report.hijack.detected = true;
          report.hijack.evidence.push(line);
        }
      }

      report.thirdParties[reqDomain] = tp;

      if (settings.blockingEnabled && isBlocklisted(reqDomain)) {
        tp.blocked = true;
        report.blockedCount += 1;
        return { cancel: true };
      }
    } else if (reqDomain) {
      report.firstPartyHosts[reqDomain] = (report.firstPartyHosts[reqDomain] || 0) + 1;
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

function collectIdParams(report, url, reqDomain) {
  let u;
  try { u = new URL(url); } catch (e) { return; }
  u.searchParams.forEach((value) => {
    if (value.length >= 10 && value.length <= 128 && /^[A-Za-z0-9._\-]+$/.test(value) &&
        /[0-9]/.test(value) && /[A-Za-z]/.test(value)) {
      const arr = report._idParams[value] || [];
      if (arr.indexOf(reqDomain) === -1) arr.push(reqDomain);
      report._idParams[value] = arr;
      const thirdOnes = arr.filter((d) => d !== report.baseDomain);
      if (thirdOnes.length >= 2 && !hasEvidence(report.cookieSync.evidence, value)) {
        report.cookieSync.detected = true;
        report.cookieSync.evidence.push(
          "ID compartilhado \"" + value.slice(0, 24) + "...\" visto em: " + thirdOnes.join(", ")
        );
        report.cookieSync.evidence = cap(report.cookieSync.evidence, 10);
      }
    }
  });
}

function hasEvidence(list, needle) {
  return list.some((e) => e.indexOf(needle.slice(0, 24)) !== -1);
}

browser.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const tabId = details.tabId;
    if (tabId < 0) return;
    const report = getTab(tabId);

    const fromDomain = getRegistrableDomain(hostOf(details.url));
    const toDomain = getRegistrableDomain(hostOf(details.redirectUrl));

    if (details.type === "main_frame") {
      const chain = report._redirects[details.requestId] || [];
      if (chain.length === 0) chain.push(fromDomain);
      chain.push(toDomain);
      report._redirects[details.requestId] = chain;

      const origin = report.baseDomain;
      const intermediarios = chain.filter((d) => d && d !== origin && d !== toDomain);
      const terceiros = intermediarios.filter((d) => d !== origin);
      if (terceiros.length > 0) {
        report.bounce.detected = true;
        const ev = "Redirect de navegacao passou por: " + chain.join(" -> ");
        if (report.bounce.evidence.indexOf(ev) === -1) {
          report.bounce.evidence.push(ev);
          report.bounce.evidence = cap(report.bounce.evidence, 10);
        }
      }
    }
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const tabId = details.tabId;
    if (tabId < 0 || !details.responseHeaders) return {};
    const report = getTab(tabId);
    if (!report.baseDomain) return {};

    const reqDomain = getRegistrableDomain(hostOf(details.url));
    const party = reqDomain === report.baseDomain ? "first" : "third";

    for (const h of details.responseHeaders) {
      if (h.name.toLowerCase() !== "set-cookie" || !h.value) continue;
      const cookieStr = h.value.split("\n")[0]; // seguranca extra
      registerCookie(report, cookieStr, reqDomain, party, "http");
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

function registerCookie(report, cookieStr, domain, party, source) {
  const name = (cookieStr.split("=")[0] || "").trim();
  if (!name) return;
  const lower = cookieStr.toLowerCase();

  let persistent = false;
  let ttlLabel = "sessao";
  const maxAge = lower.match(/max-age=(-?\d+)/);
  if (maxAge) {
    const v = parseInt(maxAge[1], 10);
    if (v > 0) { persistent = true; ttlLabel = v + "s"; }
    else return; 
  } else if (lower.indexOf("expires=") !== -1) {
    const m = cookieStr.match(/expires=([^;]+)/i);
    if (m) {
      const exp = new Date(m[1]);
      if (!isNaN(exp.getTime())) {
        if (exp.getTime() <= Date.now()) return;
        persistent = true;
        ttlLabel = exp.toISOString().slice(0, 10);
      }
    }
  }

  if (party === "first") {
    if (persistent) report.cookies.firstPersistent++; else report.cookies.firstSession++;
  } else {
    if (persistent) report.cookies.thirdPersistent++; else report.cookies.thirdSession++;
  }

  const key = name + "@" + domain;
  if (!report.cookies.list.some((c) => c._key === key)) {
    report.cookies.list.push({
      _key: key, name: name, domain: domain, party: party,
      persistent: persistent, ttl: ttlLabel, source: source
    });
    report.cookies.list = cap(report.cookies.list, 80);
  }
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "pageEvidence") {
    const tabId = sender.tab ? sender.tab.id : -1;
    if (tabId < 0) return;
    const report = getTab(tabId);
    mergeEvidence(report, msg, sender);
    return;
  }

  if (msg && msg.type === "getReport") {
    const report = tabData.get(msg.tabId) || blankReport(null);
    return Promise.resolve(buildPublicReport(report));
  }

  if (msg && msg.type === "getSettings") {
    return Promise.resolve(settings);
  }
  if (msg && msg.type === "setBlocking") {
    settings.blockingEnabled = !!msg.value;
    browser.storage.local.set({ blockingEnabled: settings.blockingEnabled });
    return Promise.resolve(settings);
  }
  if (msg && msg.type === "setCustomBlocklist") {
    settings.customBlocklist = Array.isArray(msg.value) ? msg.value : [];
    browser.storage.local.set({ customBlocklist: settings.customBlocklist });
    return Promise.resolve(settings);
  }
});

function mergeEvidence(report, msg, sender) {
  const frameHost = msg.frameHost || (sender.tab ? hostOf(sender.tab.url) : "");
  const frameDomain = getRegistrableDomain(frameHost);
  const frameIsThird = report.baseDomain && frameDomain && frameDomain !== report.baseDomain;

  if (msg.storage) {
    if (Array.isArray(msg.storage.local)) {
      msg.storage.local.forEach((k) => addStorage(report.storage.local, k, frameDomain, frameIsThird));
    }
    if (Array.isArray(msg.storage.session)) {
      msg.storage.session.forEach((k) => addStorage(report.storage.session, k, frameDomain, frameIsThird));
    }
    if (Array.isArray(msg.storage.indexedDB)) {
      msg.storage.indexedDB.forEach((k) => addStorage(report.storage.indexedDB, k, frameDomain, frameIsThird));
    }
  }

  if (msg.canvas && msg.canvas.length) {
    report.canvas.detected = true;
    msg.canvas.forEach((e) => {
      const line = (frameIsThird ? "[3a: " + frameDomain + "] " : "") + e;
      if (report.canvas.evidence.indexOf(line) === -1) report.canvas.evidence.push(line);
    });
    report.canvas.evidence = cap(report.canvas.evidence, 12);
  }

  if (Array.isArray(msg.jsCookies)) {
    msg.jsCookies.forEach((c) => {
      registerCookie(report, c, frameDomain, frameIsThird ? "third" : "first", "js");
    });
  }

  if (msg.hijack && msg.hijack.length) {
    msg.hijack.forEach((e) => {
      if (e.kind === "listener") return;
      let line = e.text;
      if (e.domain) {
        const d = getRegistrableDomain(e.domain);
        const third = report.baseDomain && d && d !== report.baseDomain;
        if ((e.kind === "websocket" || e.kind === "polling") && !third) return;
        line += third ? " (3a parte: " + d + ")" : "";
      }
      if (report.hijack.evidence.indexOf(line) === -1) {
        report.hijack.detected = true;
        report.hijack.evidence.push(line);
      }
    });
    report.hijack.evidence = cap(report.hijack.evidence, 15);
  }
}

function addStorage(arr, key, domain, isThird) {
  const entry = (isThird ? "[3a] " : "") + domain + " :: " + key;
  if (!arr.some((x) => x === entry)) arr.push(entry);
  while (arr.length > 40) arr.pop();
}

function computeScore(report) {
  let score = 100;
  const breakdown = [];
  const push = (label, delta) => { if (delta !== 0) { score += delta; breakdown.push({ label, delta }); } };

  const tpDomains = Object.keys(report.thirdParties);
  const trackers = tpDomains.filter((d) => report.thirdParties[d].tracker);
  const nonTrackers = tpDomains.filter((d) => !report.thirdParties[d].tracker);

  push("Rastreadores de 3a parte (" + trackers.length + ")", -Math.min(trackers.length * 6, 36));
  push("Outros dominios de 3a parte (" + nonTrackers.length + ")", -Math.min(nonTrackers.length * 1, 10));
  const thirdCookies = report.cookies.thirdSession + report.cookies.thirdPersistent;
  push("Cookies de 3a parte (" + thirdCookies + ")", -Math.min(thirdCookies * 3, 18));
  push("Cookies persistentes de 3a parte (" + report.cookies.thirdPersistent + ")",
       -Math.min(report.cookies.thirdPersistent * 2, 10));
  const thirdStorage = report.storage.local.concat(report.storage.indexedDB)
                        .filter((e) => e.indexOf("[3a]") === 0).length;
  push("Storage HTML5 por 3a parte (" + thirdStorage + ")", thirdStorage > 0 ? -8 : 0);
  push("Canvas fingerprint", report.canvas.detected ? -15 : 0);
  push("Cookie sync", report.cookieSync.detected ? -12 : 0);
  push("Bounce tracking", report.bounce.detected ? -12 : 0);
  push("Indicadores de hijacking/hook", report.hijack.detected ? -20 : 0);

  score = Math.max(0, Math.min(100, score));
  let grade = "F";
  if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else if (score >= 40) grade = "D";

  return { score, grade, breakdown };
}

function buildPublicReport(report) {
  const scoring = computeScore(report);
  const tpDomains = Object.keys(report.thirdParties).map((d) => ({
    domain: d,
    count: report.thirdParties[d].count,
    tracker: report.thirdParties[d].tracker,
    blocked: report.thirdParties[d].blocked
  })).sort((a, b) => (b.tracker - a.tracker) || (b.count - a.count));

  return {
    baseUrl: report.baseUrl,
    baseDomain: report.baseDomain,
    thirdParties: tpDomains,
    thirdPartyCount: tpDomains.length,
    trackerCount: tpDomains.filter((d) => d.tracker).length,
    cookies: {
      firstSession: report.cookies.firstSession,
      firstPersistent: report.cookies.firstPersistent,
      thirdSession: report.cookies.thirdSession,
      thirdPersistent: report.cookies.thirdPersistent,
      list: report.cookies.list.map((c) => ({
        name: c.name, domain: c.domain, party: c.party,
        persistent: c.persistent, ttl: c.ttl, source: c.source
      }))
    },
    storage: report.storage,
    canvas: report.canvas,
    cookieSync: report.cookieSync,
    bounce: report.bounce,
    hijack: report.hijack,
    blockedCount: report.blockedCount,
    scoring: scoring
  };
}

browser.tabs.onRemoved.addListener((tabId) => tabData.delete(tabId));

function updateBadge(tabId) {
  const report = tabData.get(tabId);
  const n = report ? Object.keys(report.thirdParties).length : 0;
  browser.browserAction.setBadgeText({ tabId: tabId, text: n ? String(n) : "" });
  browser.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: "#b3261e" });
}
browser.webRequest.onCompleted.addListener(
  (d) => { if (d.tabId >= 0) updateBadge(d.tabId); },
  { urls: ["<all_urls>"] }
);
