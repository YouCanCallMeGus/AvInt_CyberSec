var MULTI_LABEL_SUFFIXES = new Set([
  "com.br", "net.br", "org.br", "gov.br", "edu.br", "art.br", "blog.br",
  "eco.br", "emp.br", "ind.br", "inf.br", "jus.br", "leg.br", "mp.br",
  "b.br", "app.br", "dev.br", "tv.br", "radio.br",
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "sch.uk",
  "ac.uk", "gov.uk", "nhs.uk", "police.uk", "mod.uk",
  "co.jp", "or.jp", "ne.jp", "ac.jp", "go.jp", "ad.jp",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "asn.au", "id.au",
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in",
  "co.kr", "or.kr", "ne.kr", "re.kr", "pe.kr", "go.kr", "ac.kr",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn", "ac.cn",
  "com.mx", "com.ar", "com.co", "com.pe", "com.ve", "com.uy", "com.py",
  "com.tr", "com.tw", "com.hk", "com.sg", "com.my", "com.ph", "com.vn",
  "co.za", "org.za", "net.za", "gov.za", "ac.za",
  "co.nz", "org.nz", "net.nz", "govt.nz", "ac.nz",
  "com.es", "com.pt", "com.pl", "com.ua", "com.ru",
  "co.il", "org.il", "net.il", "ac.il", "gov.il",
  "com.sa", "com.eg", "com.ng", "co.ke"
]);

function _isIpLiteral(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.indexOf(":") !== -1) return true;
  return false;
}

function getRegistrableDomain(host) {
  if (!host) return "";
  host = String(host).toLowerCase().replace(/\.$/, "");
  if (_isIpLiteral(host) || host === "localhost") return host;

  var parts = host.split(".");
  if (parts.length <= 2) return host;

  var last2 = parts.slice(-2).join(".");
  if (MULTI_LABEL_SUFFIXES.has(last2)) {
    return parts.slice(-3).join(".");
  }
  return last2;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}

function isThirdParty(reqHost, baseHost) {
  if (!reqHost || !baseHost) return false;
  var a = getRegistrableDomain(reqHost);
  var b = getRegistrableDomain(baseHost);
  if (!a || !b) return false;
  return a !== b;
}

if (typeof window !== "undefined") {
  window.__psl = { getRegistrableDomain: getRegistrableDomain, hostOf: hostOf, isThirdParty: isThirdParty };
}
