var TRACKER_DOMAINS = new Set([
  "google-analytics.com", "googletagmanager.com", "googlesyndication.com",
  "googleadservices.com", "doubleclick.net", "google.com", "gstatic.com",
  "adservice.google.com", "2mdn.net", "app-measurement.com", "crashlytics.com",
  "facebook.com", "facebook.net", "fbcdn.net", "atdmt.com",
  "amazon-adsystem.com", "assoc-amazon.com",
  "bing.com", "clarity.ms", "licdn.com", "linkedin.com", "msn.com",
  "hotjar.com", "mixpanel.com", "segment.com", "segment.io", "amplitude.com",
  "fullstory.com", "mouseflow.com", "crazyegg.com", "quantserve.com",
  "quantcount.com", "scorecardresearch.com", "chartbeat.com", "parsely.com",
  "newrelic.com", "nr-data.net", "optimizely.com", "vwo.com", "heap.io",
  "matomo.cloud", "plausible.io", "cxense.com", "yandex.ru", "mc.yandex.ru",
  "criteo.com", "criteo.net", "taboola.com", "outbrain.com", "adnxs.com",
  "rubiconproject.com", "pubmatic.com", "openx.net", "casalemedia.com",
  "adsrvr.org", "rlcdn.com", "bidswitch.net", "smartadserver.com",
  "3lift.com", "sharethrough.com", "moatads.com", "adform.net", "teads.tv",
  "spotxchange.com", "yieldmo.com", "indexww.com", "gumgum.com", "media.net",
  "revcontent.com", "mgid.com", "adroll.com", "bluekai.com", "krxd.net",
  "demdex.net", "everesttech.net", "omtrdc.net", "2o7.net", "adobedtm.com",
  "liveramp.com", "id5-sync.com", "crwdcntrl.net", "agkn.com", "mathtag.com",
  "tapad.com", "eyeota.net", "exelator.com", "acuityplatform.com",
  "twitter.com", "x.com", "t.co", "ads-twitter.com", "tiktok.com",
  "tiktokcdn.com", "bytedance.com", "snapchat.com", "sc-static.net",
  "pinterest.com", "pinimg.com", "reddit.com", "redditstatic.com",
  "onesignal.com", "branch.io", "appsflyer.com", "adjust.com", "kochava.com",
  "tealiumiq.com", "ensighten.com", "bounceexchange.com", "zdassets.com",
  "cookiebot.com", "onetrust.com", "cookielaw.org", "usercentrics.eu",
  "chaordic.com.br", "linximpulse.com", "navdmp.com", "vitrinehost.com.br"
]);

function isKnownTracker(registrableDomain) {
  return TRACKER_DOMAINS.has(registrableDomain);
}
var SESSION_RECORDING_DOMAINS = new Set([
  "hotjar.com", "hotjar.io", "fullstory.com", "fs.com", "mouseflow.com",
  "clarity.ms", "logrocket.com", "logrocket.io", "smartlook.com",
  "inspectlet.com", "luckyorange.com", "luckyorange.net", "sessioncam.com",
  "contentsquare.net", "contentsquare.com", "quantummetric.com",
  "decibelinsight.net", "glassboxdigital.io", "yandex.ru", "mc.yandex.ru",
  "crazyegg.com", "hoverowl.com", "ptengine.com", "vwo.com"
]);

function isSessionRecorder(registrableDomain) {
  return SESSION_RECORDING_DOMAINS.has(registrableDomain);
}
