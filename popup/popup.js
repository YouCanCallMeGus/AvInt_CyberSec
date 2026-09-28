/*
 * popup.js - Busca o relatorio da aba ativa no background e renderiza o painel.
 */
"use strict";

const $ = (id) => document.getElementById(id);
const GRADE_COLOR = { A: "var(--good)", B: "var(--good)", C: "var(--warn)", D: "var(--warn)", F: "var(--bad)" };

let activeTabId = null;

async function init() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  activeTabId = tab ? tab.id : null;

  const settings = await browser.runtime.sendMessage({ type: "getSettings" });
  $("blockToggle").checked = !!settings.blockingEnabled;
  $("customList").value = (settings.customBlocklist || []).join("\n");

  await loadReport();
}

async function loadReport() {
  if (activeTabId == null) return;
  const r = await browser.runtime.sendMessage({ type: "getReport", tabId: activeTabId });
  render(r);
}

function render(r) {
  // Cabecalho + medidor
  $("site").textContent = r.baseDomain || "(sem página)";
  $("sub").textContent = r.baseUrl ? shortUrl(r.baseUrl) : "abra uma página e recarregue";

  const sc = r.scoring || { score: 100, grade: "A", breakdown: [] };
  $("grade").textContent = sc.grade;
  $("score").textContent = sc.score + "/100";
  const ring = $("ring");
  const circ = 2 * Math.PI * 30;
  ring.style.strokeDashoffset = String(circ - (sc.score / 100) * circ);
  const col = GRADE_COLOR[sc.grade] || "var(--muted)";
  ring.style.stroke = col;
  $("grade").style.color = col;

  // Faixa de estatisticas
  const cookiesTotal = r.cookies.firstSession + r.cookies.firstPersistent +
                       r.cookies.thirdSession + r.cookies.thirdPersistent;
  const storageTotal = r.storage.local.length + r.storage.session.length + r.storage.indexedDB.length;
  $("s-third").textContent = r.thirdPartyCount;
  $("s-track").textContent = r.trackerCount;
  $("s-cookies").textContent = cookiesTotal;
  $("s-storage").textContent = storageTotal;

  // Sinalizadores
  const flags = [
    { on: r.canvas.detected, label: "Canvas FP", sev: "bad" },
    { on: r.cookieSync.detected, label: "Cookie sync", sev: "bad" },
    { on: r.bounce.detected, label: "Bounce", sev: "warn" },
    { on: r.hijack.detected, label: "Hijack/hook", sev: "bad" }
  ];
  $("flags").innerHTML = flags.map((f) =>
    `<span class="flag ${f.on ? "on " + f.sev : ""}"><span class="dot"></span>${f.label}</span>`
  ).join("");

  // Contador de bloqueios
  $("blockedCount").textContent = r.blockedCount ? (r.blockedCount + " bloqueados") : "";

  // Acordeao
  const acc = $("accordion");
  acc.innerHTML = "";
  acc.appendChild(sectionThirdParties(r));
  acc.appendChild(sectionCookies(r));
  acc.appendChild(sectionStorage(r));
  acc.appendChild(sectionEvidence(r));
  acc.appendChild(sectionScore(sc));
}

function makeAcc(title, count, bodyNode, open) {
  const d = document.createElement("details");
  d.className = "acc";
  if (open) d.open = true;
  const s = document.createElement("summary");
  s.innerHTML = `<span>${title}</span><span class="count">${count}</span>`;
  const b = document.createElement("div");
  b.className = "acc-body";
  b.appendChild(bodyNode);
  d.appendChild(s); d.appendChild(b);
  return d;
}

function sectionThirdParties(r) {
  const wrap = document.createElement("div");
  if (!r.thirdParties.length) { wrap.innerHTML = '<div class="empty">Nenhum domínio de terceira parte.</div>'; }
  r.thirdParties.forEach((tp) => {
    const row = document.createElement("div"); row.className = "row";
    const tags = [];
    if (tp.tracker) tags.push('<span class="tag track">rastreador</span>');
    if (tp.blocked) tags.push('<span class="tag block">bloqueado</span>');
    row.innerHTML = `<span class="dom">${esc(tp.domain)} <span class="count">×${tp.count}</span></span>
                     <span>${tags.join(" ")}</span>`;
    wrap.appendChild(row);
  });
  return makeAcc("Domínios de 3ª parte", `${r.thirdPartyCount} · ${r.trackerCount} rastr.`, wrap,
                 r.thirdPartyCount > 0);
}

function sectionCookies(r) {
  const c = r.cookies;
  const wrap = document.createElement("div");
  const summary = document.createElement("div");
  summary.className = "evi";
  summary.textContent =
    `1ª parte: ${c.firstSession} sessão / ${c.firstPersistent} persist.  |  ` +
    `3ª parte: ${c.thirdSession} sessão / ${c.thirdPersistent} persist.`;
  wrap.appendChild(summary);
  if (!c.list.length) wrap.innerHTML += '<div class="empty">Nenhum cookie observado via Set-Cookie/JS.</div>';
  c.list.forEach((ck) => {
    const row = document.createElement("div"); row.className = "row";
    const partyTag = ck.party === "third"
      ? '<span class="tag p3">3ª</span>' : '<span class="tag p1">1ª</span>';
    const ttl = ck.persistent ? ("persist. " + ck.ttl) : "sessão";
    row.innerHTML = `<span class="dom">${esc(ck.name)}<br><span class="count">${esc(ck.domain)} · ${ttl} · ${ck.source}</span></span>
                     <span>${partyTag}</span>`;
    wrap.appendChild(row);
  });
  const total = c.firstSession + c.firstPersistent + c.thirdSession + c.thirdPersistent;
  return makeAcc("Cookies", String(total), wrap);
}

function sectionStorage(r) {
  const wrap = document.createElement("div");
  const groups = [
    ["localStorage", r.storage.local],
    ["sessionStorage", r.storage.session],
    ["IndexedDB", r.storage.indexedDB]
  ];
  let any = false;
  groups.forEach(([label, arr]) => {
    if (!arr.length) return;
    any = true;
    const h = document.createElement("div"); h.className = "evi";
    h.style.fontWeight = "600"; h.textContent = `${label} (${arr.length})`;
    wrap.appendChild(h);
    arr.forEach((k) => {
      const e = document.createElement("div"); e.className = "evi"; e.textContent = "• " + k;
      wrap.appendChild(e);
    });
  });
  if (!any) wrap.innerHTML = '<div class="empty">Nenhum armazenamento HTML5 detectado.</div>';
  const total = r.storage.local.length + r.storage.session.length + r.storage.indexedDB.length;
  return makeAcc("Armazenamento HTML5", String(total), wrap);
}

function sectionEvidence(r) {
  const wrap = document.createElement("div");
  const blocks = [
    ["Canvas fingerprint", r.canvas],
    ["Cookie sync", r.cookieSync],
    ["Bounce tracking", r.bounce],
    ["Hijacking / hook", r.hijack]
  ];
  let any = false;
  blocks.forEach(([label, obj]) => {
    if (!obj.detected) return;
    any = true;
    const h = document.createElement("div"); h.className = "evi";
    h.style.fontWeight = "600"; h.style.color = "var(--bad)"; h.textContent = "⚑ " + label;
    wrap.appendChild(h);
    (obj.evidence || []).forEach((ev) => {
      const e = document.createElement("div"); e.className = "evi"; e.textContent = "  " + ev;
      wrap.appendChild(e);
    });
  });
  if (!any) wrap.innerHTML = '<div class="empty">Nenhuma ameaça avançada detectada.</div>';
  const n = [r.canvas, r.cookieSync, r.bounce, r.hijack].filter((x) => x.detected).length;
  return makeAcc("Ameaças detectadas", String(n), wrap, n > 0);
}

function sectionScore(sc) {
  const wrap = document.createElement("div");
  const head = document.createElement("div"); head.className = "evi";
  head.textContent = `Score base 100. Nota ${sc.grade} (${sc.score}/100).`;
  wrap.appendChild(head);
  sc.breakdown.forEach((b) => {
    const row = document.createElement("div"); row.className = "bd-row";
    row.innerHTML = `<span>${esc(b.label)}</span><span class="d ${b.delta < 0 ? "neg" : ""}">${b.delta}</span>`;
    wrap.appendChild(row);
  });
  return makeAcc("Como o score foi calculado", `${sc.score}/100`, wrap);
}

/* ---- utilidades ---- */
function esc(s) { return String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function shortUrl(u) { try { const x = new URL(u); return x.hostname + x.pathname.slice(0, 30); } catch (e) { return u; } }

/* ---- eventos ---- */
$("blockToggle").addEventListener("change", async (e) => {
  await browser.runtime.sendMessage({ type: "setBlocking", value: e.target.checked });
});
$("saveList").addEventListener("click", async () => {
  const list = $("customList").value.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean);
  await browser.runtime.sendMessage({ type: "setCustomBlocklist", value: list });
  $("savedMsg").textContent = "salvo — recarregue a página para aplicar";
  setTimeout(() => ($("savedMsg").textContent = ""), 4000);
});
$("refresh").addEventListener("click", loadReport);

init();
