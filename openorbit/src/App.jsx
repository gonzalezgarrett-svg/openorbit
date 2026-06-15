import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Satellite, Rocket, Zap, Sparkles, Github, Loader2, Orbit, Gauge, Timer,
  CircleDot, Image as ImageIcon, Send, Sun, Globe2, TriangleAlert, Radio,
  LayoutGrid, Telescope, ArrowRight, ChevronRight,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
//  OpenOrbit — live space data, explained.
//  Landing page → tabbed mission-control console.
//  Raw telemetry (mono) → plain language (sans). AI explanations woven in.
// ════════════════════════════════════════════════════════════════════════════

const NASA_KEY = import.meta.env.VITE_NASA_API_KEY || "DEMO_KEY"; // set VITE_NASA_API_KEY to raise the rate limit
const LOCAL_BG = "/space-bg.jpg";

// __AI_START__
async function aiComplete(prompt) {
  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    return (data.text || "").trim() || "No explanation came back — try again.";
  } catch {
    return "Couldn't reach the explainer. Check that the API key is set, then try again.";
  }
}
// __AI_END__

// ── helpers ─────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const wrapLon = (l) => ((((l + 180) % 360) + 360) % 360) - 180;
const fmt = (n, d = 2) => Number(n).toFixed(d);
const comma = (n) => Math.round(n).toLocaleString();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const MAPW = 720, MAPH = 360, INC = 51.6, LD_KM = 384400;
const projX = (lon) => ((lon + 180) / 360) * MAPW;
const projY = (lat) => ((90 - lat) / 180) * MAPH;

function haversine(a, b, c, d) {
  const dLat = (c - a) * DEG, dLon = (d - b) * DEG;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * DEG) * Math.cos(c * DEG) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}
const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
function absTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "TBD";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function countdown(iso, now) {
  const ms = new Date(iso) - now;
  if (isNaN(ms)) return null;
  if (ms <= 0) return { live: true };
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const statusColor = (s) => {
  s = (s || "").toLowerCase();
  if (s.includes("go") || s.includes("success") || s.includes("flight")) return "#cfe0ff";
  if (s.includes("hold") || s.includes("tbd") || s.includes("tbc")) return "#ffb454";
  if (s.includes("fail")) return "#ff6b6b";
  return "#9aa6c4";
};
function kpStatus(kp) {
  if (kp >= 7) return { t: "Severe storm — auroras far from the poles", c: "#ff6b6b" };
  if (kp >= 5) return { t: "Geomagnetic storm — auroras likely", c: "#ffb454" };
  if (kp >= 4) return { t: "Unsettled — minor activity", c: "#a9d6c8" };
  return { t: "Quiet — calm conditions", c: "#5eeaff" };
}

const SAMPLE_LAUNCHES = [
  { name: "Starlink Group 12-5", provider: "SpaceX", rocket: "Falcon 9 Block 5", pad: "Cape Canaveral SLC-40", net: new Date(Date.now() + 31 * 36e5).toISOString(), status: "Go" },
  { name: "Crew-12", provider: "SpaceX / NASA", rocket: "Falcon 9 Block 5", pad: "Kennedy LC-39A", net: new Date(Date.now() + 9 * 864e5).toISOString(), status: "Go" },
  { name: "Kuiper KA-03", provider: "Blue Origin", rocket: "New Glenn", pad: "Cape Canaveral LC-36", net: new Date(Date.now() + 18 * 864e5).toISOString(), status: "TBD" },
  { name: "Gaganyaan G1", provider: "ISRO", rocket: "LVM3", pad: "Satish Dhawan SLP", net: new Date(Date.now() + 26 * 864e5).toISOString(), status: "TBD" },
];
const SAMPLE_NEO = { count: 7, closest: { name: "2026 LF4", distLD: 3.1, distKm: 1191640, vel: 41200, sizeM: 64, hazardous: false } };
const SAMPLE_APOD = {
  title: "The Pillars of Creation", url: "", mediaType: "image",
  explanation: "These towering columns of cold gas and dust sit in the Eagle Nebula, about 6,500 light-years away, where new stars are being born inside the dense clouds.",
};

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "tracker", label: "ISS Tracker", icon: Satellite },
  { id: "launches", label: "Launches", icon: Rocket },
  { id: "weather", label: "Space Weather", icon: Zap },
  { id: "asteroids", label: "Asteroids", icon: CircleDot },
  { id: "discover", label: "Discover", icon: Telescope },
];

const cssText = `

*{box-sizing:border-box}
.oo{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;color:#fff;
  min-height:100vh;position:relative;line-height:1.5;-webkit-font-smoothing:antialiased;background:transparent}
.mono{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}

/* backdrop: real image + dim veil */
.bg{position:fixed;inset:0;z-index:-3;background:#000}
.bg::after{content:"";position:absolute;inset:0;opacity:.4;background-image:
  radial-gradient(1.2px 1.2px at 18% 24%,#dfe8ff 50%,transparent),
  radial-gradient(1px 1px at 72% 16%,#cfe0ff 50%,transparent),
  radial-gradient(1px 1px at 44% 62%,#9fb6e6 50%,transparent),
  radial-gradient(1.1px 1.1px at 84% 70%,#dfe8ff 50%,transparent),
  radial-gradient(1px 1px at 28% 82%,#9fb6e6 50%,transparent),
  radial-gradient(1px 1px at 62% 40%,#cfe0ff 50%,transparent)}
.bgimg{position:fixed;inset:0;z-index:-2;background-size:cover;background-position:center bottom;
  opacity:.92;filter:brightness(.95)}
.bgveil{position:fixed;inset:0;z-index:-1;background:
  linear-gradient(180deg, rgba(0,0,0,.30) 0%, rgba(0,0,0,.22) 45%, rgba(0,0,0,.46) 100%),
  radial-gradient(1500px 950px at 50% 22%, rgba(0,0,0,0), rgba(0,0,0,.38) 82%)}

/* ── landing ─────────────────────────────────────────────── */
.land{position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden}
.orbitg{display:none}
.lnav{position:relative;display:flex;justify-content:space-between;align-items:center;
  max-width:1180px;margin:0 auto;width:100%;padding:26px 24px}
.lnav a{color:rgba(255,255,255,.7);text-decoration:none;font-size:12px;letter-spacing:.14em;
  text-transform:uppercase;display:inline-flex;align-items:center;gap:8px}
.lnav a:hover{color:#fff}
.lhero{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:24px 24px 90px}
.leyebrow{letter-spacing:.42em;font-size:11px;color:rgba(255,255,255,.62);text-transform:uppercase;margin-bottom:22px}
.lhead{font-family:'Space Grotesk','Inter',sans-serif;font-weight:700;letter-spacing:.005em;text-transform:uppercase;
  font-size:clamp(38px,7.4vw,78px);line-height:1.0;margin:0;max-width:15ch;text-shadow:0 4px 60px rgba(0,0,0,.6)}
.lhead .amber{color:#fff}
.lsub{color:rgba(255,255,255,.72);font-size:clamp(15px,2.1vw,19px);max-width:580px;margin:24px auto 0;
  line-height:1.65;font-weight:300;text-shadow:0 2px 30px rgba(0,0,0,.6)}
.lcta{display:flex;gap:14px;margin-top:38px;flex-wrap:wrap;justify-content:center}
.lbtn{display:inline-flex;align-items:center;gap:10px;background:#fff;color:#000;border:none;
  font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding:16px 30px;border-radius:2px;cursor:pointer}
.lbtn:hover{background:#d9dde4}
.lghost{display:inline-flex;align-items:center;gap:10px;background:transparent;color:#fff;
  border:1px solid rgba(255,255,255,.5);font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  padding:16px 26px;border-radius:2px;cursor:pointer;text-decoration:none}
.lghost:hover{background:rgba(255,255,255,.08);border-color:#fff}
.lticker{margin-top:34px;font-size:11px;letter-spacing:.06em;color:rgba(255,255,255,.55);display:inline-flex;align-items:center;gap:10px}
.ld{width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 9px rgba(255,255,255,.8)}
.ld.s{background:#5b647e;box-shadow:none}

.featwrap{position:relative;max-width:1180px;margin:0 auto;width:100%;padding:60px 24px 72px}
.fhead{text-align:center;font-family:'Space Grotesk','Inter',sans-serif;font-size:11px;letter-spacing:.28em;
  text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:30px}
.feat{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.08)}
@media(max-width:760px){.feat{grid-template-columns:1fr}}
.featcard{text-align:left;background:rgba(6,8,14,.72);backdrop-filter:blur(10px);padding:30px 26px;cursor:pointer;transition:background .2s}
.featcard:hover{background:rgba(14,18,28,.82)}
.ficon{width:34px;height:34px;display:grid;place-items:center;color:#fff;opacity:.85}
.ftitle{font-family:'Space Grotesk','Inter',sans-serif;font-weight:600;font-size:13px;letter-spacing:.06em;
  text-transform:uppercase;margin:18px 0 9px;display:flex;align-items:center;gap:8px}
.fdesc{color:rgba(255,255,255,.55);font-size:13.5px;line-height:1.6;font-weight:300}

/* ── console shell ───────────────────────────────────────── */
.topbar{position:sticky;top:0;z-index:20;background:rgba(0,0,0,.55);backdrop-filter:blur(18px);
  border-bottom:1px solid rgba(255,255,255,.08)}
.tbin{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;
  max-width:1180px;margin:0 auto;padding:15px 24px}
.brand{display:flex;align-items:center;gap:12px;cursor:pointer}
.mark{width:30px;height:30px;display:grid;place-items:center;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:3px}
.word{font-family:'Space Grotesk','Inter',sans-serif;font-weight:700;letter-spacing:.3em;font-size:15px;line-height:1}
.tag{display:none}
.barright{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.clocks{display:flex;gap:18px}
.clock .k{font-size:9px;letter-spacing:.18em;color:rgba(255,255,255,.4);text-transform:uppercase}
.clock .t{font-size:13px;color:rgba(255,255,255,.85);letter-spacing:.05em}
.brief{display:inline-flex;align-items:center;gap:8px;background:transparent;color:#fff;
  border:1px solid rgba(255,255,255,.4);font-weight:600;font-size:11px;letter-spacing:.12em;text-transform:uppercase;
  padding:10px 16px;border-radius:2px;cursor:pointer}
.brief:hover{background:rgba(255,255,255,.08);border-color:#fff}
.brief:disabled{opacity:.5;cursor:default}
.tabbar{max-width:1180px;margin:0 auto;display:flex;gap:0;padding:0 14px;overflow-x:auto;scrollbar-width:none}
.tabbar::-webkit-scrollbar{display:none}
.tab{flex:0 0 auto;display:inline-flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;
  color:rgba(255,255,255,.5);font-size:11.5px;font-weight:500;letter-spacing:.13em;text-transform:uppercase;
  padding:15px 18px;border-bottom:1px solid transparent;white-space:nowrap}
.tab:hover{color:rgba(255,255,255,.85)}
.tab.active{color:#fff;border-color:#fff}
.tabmain{max-width:1180px;margin:0 auto;padding:38px 24px 90px}
.pagehead{margin-bottom:26px}
.ptitle{font-family:'Space Grotesk','Inter',sans-serif;font-size:clamp(22px,3.4vw,30px);font-weight:600;
  letter-spacing:.04em;text-transform:uppercase;color:#fff}
.psub{color:rgba(255,255,255,.5);font-size:13.5px;margin-top:7px;font-weight:300;max-width:60ch}

/* ── shared panels ───────────────────────────────────────── */
.hero{position:relative;border:1px solid rgba(255,255,255,.1);border-radius:4px;overflow:hidden;background:rgba(0,0,0,.35)}
.hero svg{display:block;width:100%;height:auto}
.ov{position:absolute;pointer-events:none}
.ov.tl{top:15px;left:16px}.ov.tr{top:15px;right:16px;text-align:right}.ov.bl{left:16px;bottom:14px;right:16px}
.pill{display:inline-flex;align-items:center;gap:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.14);
  border-radius:2px;padding:7px 11px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.85);backdrop-filter:blur(6px)}
.live{display:inline-flex;align-items:center;gap:7px;color:rgba(255,255,255,.7);font-size:10px;letter-spacing:.18em;text-transform:uppercase}
.coord{font-size:11px;color:rgba(255,255,255,.75);letter-spacing:.04em}.coord b{color:#fff;font-weight:600}

.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;margin-top:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08)}
@media(max-width:820px){.stats{grid-template-columns:repeat(2,1fr)}}
.stat{background:rgba(6,8,14,.6);backdrop-filter:blur(10px);padding:18px 18px}
.stat .k{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:7px}
.stat .v{font-size:25px;font-weight:600;color:#fff;margin-top:10px;line-height:1.05}
.stat .u{font-size:12px;color:rgba(255,255,255,.45)}

.card{background:rgba(6,8,14,.5);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,.09);border-radius:4px;padding:24px}
.head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.htitle{display:flex;align-items:center;gap:10px;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.55)}

.cd{display:flex;gap:10px;margin:18px 0 6px}
.cdc{flex:1;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:3px;padding:13px 4px;text-align:center}
.cdc .n{font-size:28px;font-weight:700;color:#fff;line-height:1}
.cdc .l{font-size:9px;letter-spacing:.16em;color:rgba(255,255,255,.45);text-transform:uppercase;margin-top:6px}
.lnext{font-size:13px;color:rgba(255,255,255,.7);margin-bottom:2px}.lnext b{color:#fff;font-weight:600}
.row{display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid rgba(255,255,255,.07)}
.lname{font-weight:600;font-size:14px;display:flex;align-items:center;gap:10px}
.lmeta{color:rgba(255,255,255,.45);font-size:11.5px;margin-top:3px}
.spill{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;border:1px solid;border-radius:2px;padding:2px 7px}
.when{color:rgba(255,255,255,.75);font-size:11.5px;text-align:right;white-space:nowrap}.whensub{color:rgba(255,255,255,.4);font-size:10.5px;margin-top:3px}

.kp{display:flex;align-items:baseline;gap:14px;margin:16px 0 6px}
.kpn{font-size:46px;font-weight:700;color:#fff;line-height:1}
.gbar{height:6px;border-radius:0;background:rgba(255,255,255,.1);overflow:hidden;margin-top:14px}
.gfill{height:100%;background:#fff}
.neo{display:flex;gap:16px;align-items:center;margin:16px 0 2px}
.neobig{font-size:42px;font-weight:700;color:#fff;line-height:1}
.neogrid{display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;margin-top:14px}
.neogrid .k{font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.45)}
.neogrid .v{font-size:15px;color:#fff;font-weight:600;margin-top:2px}

.apod{display:grid;grid-template-columns:360px 1fr;gap:24px}
@media(max-width:760px){.apod{grid-template-columns:1fr}}
.apimg{width:100%;height:240px;border-radius:3px;object-fit:cover;border:1px solid rgba(255,255,255,.12);display:block;background:rgba(255,255,255,.03)}
.apph{width:100%;height:240px;border-radius:3px;border:1px solid rgba(255,255,255,.12);
  background:radial-gradient(140px 90px at 32% 32%,#2a3568,transparent),radial-gradient(170px 130px at 74% 70%,#16406a,transparent),#05070e;
  display:grid;place-items:center;color:rgba(255,255,255,.4)}
.aptitle{font-family:'Space Grotesk','Inter',sans-serif;font-size:22px;font-weight:600;letter-spacing:.02em;color:#fff;margin:2px 0 12px}
.aptext{font-size:13.5px;color:rgba(255,255,255,.6);line-height:1.7;font-weight:300}

.ask{background:rgba(6,8,14,.5);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.09);border-radius:4px;padding:24px}
.askrow{display:flex;gap:12px;margin-top:16px}
.askin{flex:1;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.15);border-radius:2px;padding:14px 16px;color:#fff;font-size:14px;font-family:inherit;outline:none}
.askin:focus{border-color:rgba(255,255,255,.55)}
.askin::placeholder{color:rgba(255,255,255,.35)}
.asksend{background:#fff;color:#000;border:none;border-radius:2px;padding:0 20px;font-weight:600;font-size:11px;letter-spacing:.12em;text-transform:uppercase;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.asksend:disabled{opacity:.5;cursor:default}
.chips{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}
.chip{background:transparent;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);font-size:12px;padding:7px 13px;border-radius:2px;cursor:pointer}
.chip:hover{border-color:rgba(255,255,255,.4);color:#fff}

.btn{display:inline-flex;align-items:center;gap:8px;margin-top:18px;background:transparent;color:#fff;
  border:1px solid rgba(255,255,255,.4);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;
  padding:11px 18px;border-radius:2px;cursor:pointer}
.btn:hover{background:rgba(255,255,255,.08);border-color:#fff}.btn:disabled{opacity:.5;cursor:default}
.btn:focus-visible,.brief:focus-visible,.asksend:focus-visible,.lbtn:focus-visible,.tab:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ai{margin-top:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-left:2px solid rgba(255,255,255,.55);border-radius:0 3px 3px 0;padding:16px 18px}
.ailead{font-size:9.5px;text-transform:uppercase;letter-spacing:.2em;color:rgba(255,255,255,.55);display:flex;align-items:center;gap:8px;margin-bottom:9px}
.aitext{font-size:14px;color:rgba(255,255,255,.82);line-height:1.7;font-weight:300}
.muted{font-size:12px;color:rgba(255,255,255,.42);font-weight:300}
.sk{background:linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.08),rgba(255,255,255,.03));background-size:200% 100%;animation:sh 1.4s infinite;border-radius:3px}
@keyframes sh{to{background-position:-200% 0}}
@keyframes spin{to{transform:rotate(360deg)}}

/* overview */
.briefcard{background:rgba(6,8,14,.5);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:24px;margin-bottom:18px}
.briefhead{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.glance{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;margin-top:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08)}
@media(max-width:760px){.glance{grid-template-columns:1fr}}
.gtile{text-align:left;background:rgba(6,8,14,.6);backdrop-filter:blur(10px);padding:26px;cursor:pointer;transition:background .2s}
.gtile:hover{background:rgba(14,18,28,.8)}
.gtop{display:flex;justify-content:space-between;align-items:center}
.gk{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:8px}
.gview{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6);display:inline-flex;align-items:center;gap:4px}
.gbig{font-size:30px;font-weight:700;color:#fff;margin-top:14px;line-height:1}
.gsmall{font-size:12.5px;color:rgba(255,255,255,.5);margin-top:8px;font-weight:300}

.foot{margin-top:40px;border-top:1px solid rgba(255,255,255,.08);padding-top:20px;color:rgba(255,255,255,.4);font-size:11px;letter-spacing:.04em;
  display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center}
.foot a{color:rgba(255,255,255,.7);text-decoration:none}
button{font-family:inherit}
`;

function Backdrop({ url }) {
  const img = url || LOCAL_BG;
  return (
    <>
      <div className="bg" />
      <div className="bgimg" style={{ backgroundImage: `url(${img})` }} />
      <div className="bgveil" />
    </>
  );
}

function Spin({ on }) {
  return on ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />;
}

// ── map (presentational) ────────────────────────────────────────────────────
function MapBlock({ displayIss, sun, track, coords, stars, issLive, dist }) {
  const issX = projX(displayIss.longitude), issY = projY(displayIss.latitude);
  return (
    <div className="hero">
      <svg viewBox={`0 0 ${MAPW} ${MAPH}`} role="img" aria-label="World map tracking the International Space Station">
        <defs>
          <radialGradient id="day" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bcd4ff" stopOpacity="0.14" />
            <stop offset="45%" stopColor="#bcd4ff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#bcd4ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="trk" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width={MAPW} height={MAPH} fill="#070b16" />
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#cdd6ea" opacity={s.o} />)}
        <ellipse cx={sun.x} cy={sun.y} rx={300} ry={210} fill="url(#day)" />
        {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => (
          <line key={"v" + lon} x1={projX(lon)} y1={0} x2={projX(lon)} y2={MAPH} stroke="#16213c" strokeWidth="1" />
        ))}
        {[-60, -30, 0, 30, 60].map((lat) => (
          <line key={"h" + lat} x1={0} y1={projY(lat)} x2={MAPW} y2={projY(lat)} stroke={lat === 0 ? "#1d2b4c" : "#16213c"} strokeWidth="1" />
        ))}
        <path d={track} fill="none" stroke="url(#trk)" strokeWidth="1.6" strokeDasharray="2 4" opacity="0.85" />
        <circle cx={sun.x} cy={sun.y} r={5} fill="#e8eefc" />
        <circle cx={sun.x} cy={sun.y} r={5} fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.5">
          <animate attributeName="r" values="6;13;6" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
        </circle>
        {coords && (
          <g>
            <circle cx={projX(coords.lon)} cy={projY(coords.lat)} r={4} fill="#5eead4" />
            <text x={projX(coords.lon) + 8} y={projY(coords.lat) + 3} fill="#5eead4" fontSize="10" fontFamily="monospace">YOU</text>
          </g>
        )}
        <circle cx={issX} cy={issY} r={5} fill="#eafaff" />
        <circle cx={issX} cy={issY} r={5} fill="none" stroke="#ffffff" strokeWidth="1.4">
          <animate attributeName="r" values="5;16;5" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x={issX + 9} y={issY - 7} fill="#eafaff" fontSize="11" fontFamily="monospace" fontWeight="600">ISS</text>
      </svg>
      <div className="ov tl"><span className="pill"><Globe2 size={13} /> TRACKING · ISS (ZARYA)</span></div>
      <div className="ov tr">
        <span className="live" style={issLive ? {} : { color: "#8a93ad" }}>
          <span className={`ld ${issLive ? "" : "s"}`} />{issLive ? "LIVE TELEMETRY" : "SIMULATED"}
        </span>
      </div>
      <div className="ov bl">
        <span className="pill coord mono">
          LAT <b>{fmt(displayIss.latitude)}°</b>&nbsp;&nbsp;LON <b>{fmt(displayIss.longitude)}°</b>&nbsp;&nbsp;ALT <b>{comma(displayIss.altitude)} km</b>
          {dist != null && <>&nbsp;&nbsp;·&nbsp;&nbsp;{comma(dist)} km from you</>}
        </span>
      </div>
    </div>
  );
}

// ── landing page ────────────────────────────────────────────────────────────
function Landing({ onEnter, displayIss, issLive }) {
  const F = [
    { id: "tracker", icon: Satellite, t: "Live ISS map", d: "Watch the station orbit Earth in real time, with its ground track and your location." },
    { id: "launches", icon: Rocket, t: "Launch countdown", d: "The next rockets going up worldwide, with a ticking countdown to liftoff." },
    { id: "weather", icon: Zap, t: "Space weather", d: "Today's geomagnetic activity and whether auroras are likely tonight." },
    { id: "asteroids", icon: CircleDot, t: "Near-Earth asteroids", d: "What's passing close to Earth today — distance, size, and speed." },
    { id: "discover", icon: ImageIcon, t: "Picture of the day", d: "NASA's daily astronomy image, explained in plain language." },
    { id: "discover", icon: Sparkles, t: "Ask the sky", d: "Type any space question and get a clear, beginner-friendly answer." },
  ];
  return (
    <div className="land">
      <div className="lnav">
        <div className="brand" style={{ cursor: "default" }}>
          <div className="mark"><Satellite size={19} /></div>
          <div><div className="word">OPENORBIT</div></div>
        </div>
        <a href="https://github.com" target="_blank" rel="noreferrer"><Github size={15} /> GitHub</a>
      </div>

      <div className="lhero">
        <svg className="orbitg" width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
          <defs>
            <radialGradient id="earth" cx="38%" cy="34%" r="70%">
              <stop offset="0%" stopColor="#2f6fc7" /><stop offset="70%" stopColor="#15408a" /><stop offset="100%" stopColor="#0c2552" />
            </radialGradient>
          </defs>
          <ellipse cx="75" cy="75" rx="62" ry="30" fill="none" stroke="#2a3a64" strokeWidth="1" transform="rotate(-22 75 75)" />
          <circle cx="75" cy="75" r="26" fill="url(#earth)" stroke="#3a63a8" strokeWidth="0.6" />
          <circle cx="68" cy="68" r="5" fill="#3f7fd0" opacity="0.5" />
          <circle cx="84" cy="82" r="7" fill="#3f7fd0" opacity="0.4" />
          <g>
            <circle r="3.4" fill="#eafaff" />
            <circle r="3.4" fill="none" stroke="#5eeaff" strokeWidth="1" opacity="0.6">
              <animate attributeName="r" values="3.4;8;3.4" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
            </circle>
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto"
              path="M13 75 a62 30 -22 1 1 124 0 a62 30 -22 1 1 -124 0" />
          </g>
        </svg>

        <div className="leyebrow">Live space console</div>
        <h1 className="lhead">See what's happening in space — <span className="amber">right now.</span></h1>
        <p className="lsub">OpenOrbit tracks the Space Station, rocket launches, space weather, and asteroids live — and translates the raw data into plain language anyone can understand.</p>
        <div className="lcta">
          <button className="lbtn" onClick={() => onEnter("overview")}>Enter the console <ArrowRight size={17} /></button>
          <a className="lghost" href="https://github.com" target="_blank" rel="noreferrer"><Github size={16} /> View source</a>
        </div>
        <div className="lticker mono">
          <span className={`ld ${issLive ? "" : "s"}`} />
          {issLive ? "LIVE" : "SIM"} · ISS @ LAT {fmt(displayIss.latitude)}° LON {fmt(displayIss.longitude)}° · {comma(displayIss.altitude)} km
        </div>
      </div>

      <div className="featwrap">
        <div className="fhead">What you can explore</div>
        <div className="feat">
          {F.map((f, i) => (
            <button className="featcard" key={i} onClick={() => onEnter(f.id)}>
              <div className="ficon"><f.icon size={19} /></div>
              <div className="ftitle">{f.t} <ChevronRight size={14} style={{ color: "#5b647e" }} /></div>
              <div className="fdesc">{f.d}</div>
            </button>
          ))}
        </div>
        <div className="foot" style={{ marginTop: 26 }}>
          <span>Open source · MIT · Data: wheretheiss.at · The Space Devs · NOAA SWPC · NASA</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Github size={13} /> Not affiliated with NASA</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("landing");
  const [tab, setTab] = useState("overview");
  const [now, setNow] = useState(new Date());
  const [iss, setIss] = useState(null);
  const [issLive, setIssLive] = useState(false);
  const [coords, setCoords] = useState(null);
  const [launches, setLaunches] = useState(null);
  const [lLive, setLLive] = useState(false);
  const [kp, setKp] = useState(null);
  const [kpLive, setKpLive] = useState(false);
  const [neo, setNeo] = useState(null);
  const [neoLive, setNeoLive] = useState(false);
  const [apod, setApod] = useState(null);
  const [apLive, setApLive] = useState(false);
  const [apErr, setApErr] = useState(false);
  const [bgReady, setBgReady] = useState(false);
  const [ai, setAi] = useState({});
  const [ask, setAsk] = useState({ q: "", loading: false, text: "" });
  const askRef = useRef(null);

  const stars = useMemo(
    () => Array.from({ length: 70 }, () => ({ x: Math.random() * MAPW, y: Math.random() * MAPH, r: Math.random() * 1.1 + 0.2, o: Math.random() * 0.5 + 0.15 })),
    []
  );

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  const loadIss = useCallback(async () => {
    try {
      const r = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
      if (!r.ok) throw 0;
      setIss(await r.json()); setIssLive(true);
    } catch { setIssLive(false); }
  }, []);
  useEffect(() => { loadIss(); const id = setInterval(loadIss, 4000); return () => clearInterval(id); }, [loadIss]);

  const enter = useCallback((t) => {
    setTab(t || "overview"); setView("console");
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }), () => {}, { timeout: 8000 });
  }, []);

  useEffect(() => {
    fetch("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=5")
      .then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((d) => {
        setLaunches((d.results || []).map((x) => ({
          name: x.name, provider: x.launch_service_provider?.name || "—",
          rocket: x.rocket?.configuration?.name || "", pad: x.pad?.location?.name || x.pad?.name || "",
          net: x.net, status: x.status?.abbrev || x.status?.name || "",
        })));
        setLLive(true);
      })
      .catch(() => { setLaunches(SAMPLE_LAUNCHES); setLLive(false); });
  }, []);

  useEffect(() => {
    fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json")
      .then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((rows) => { setKp(parseFloat(rows[rows.length - 1][1])); setKpLive(true); })
      .catch(() => { setKp(3); setKpLive(false); });
  }, []);

  useEffect(() => {
    const t = new Date().toISOString().slice(0, 10);
    fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${t}&end_date=${t}&api_key=${NASA_KEY}`)
      .then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((d) => {
        const arr = (d.near_earth_objects && d.near_earth_objects[t]) || [];
        if (!arr.length) throw 0;
        let best = null;
        arr.forEach((o) => {
          const ca = o.close_approach_data?.[0];
          if (!ca) return;
          const km = parseFloat(ca.miss_distance.kilometers);
          if (!best || km < best.distKm)
            best = { name: o.name.replace(/[()]/g, ""), distKm: km, distLD: km / LD_KM,
              vel: parseFloat(ca.relative_velocity.kilometers_per_hour),
              sizeM: o.estimated_diameter.meters.estimated_diameter_max,
              hazardous: o.is_potentially_hazardous_asteroid };
        });
        setNeo({ count: arr.length, closest: best }); setNeoLive(true);
      })
      .catch(() => { setNeo(SAMPLE_NEO); setNeoLive(false); });
  }, []);

  useEffect(() => {
    fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}`)
      .then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((d) => { setApod({ title: d.title, url: d.media_type === "image" ? d.url : "", mediaType: d.media_type, explanation: d.explanation }); setApLive(true); })
      .catch(() => { setApod(SAMPLE_APOD); setApLive(false); });
  }, []);

  useEffect(() => {
    if (apod && apod.url) {
      const im = new Image();
      im.onload = () => setBgReady(true);
      im.onerror = () => setBgReady(false);
      im.src = apod.url;
    }
  }, [apod]);

  const run = async (key, prompt) => {
    setAi((p) => ({ ...p, [key]: { loading: true, text: "" } }));
    const text = await aiComplete(prompt);
    setAi((p) => ({ ...p, [key]: { loading: false, text } }));
  };
  const doAsk = async (qIn) => {
    const q = (qIn ?? ask.q).trim();
    if (!q) return;
    setAsk({ q, loading: true, text: "" });
    const text = await aiComplete(`Answer this space, astronomy, or spaceflight question for a curious beginner in 3-4 short, accurate sentences. No markdown, no headings. Question: ${q}`);
    setAsk({ q, loading: false, text });
  };

  const displayIss = useMemo(() => {
    if (issLive && iss) return iss;
    const t = now.getTime() / 1000;
    const lon = wrapLon((t / 60) * 3.9 - 60 + (t % 86400) / 240);
    const lat = INC * Math.sin((t / 60) * 0.068);
    return { latitude: lat, longitude: lon, altitude: 418 + 6 * Math.sin(t / 400), velocity: 27580, visibility: "—" };
  }, [issLive, iss, now]);

  const dist = coords ? haversine(coords.lat, coords.lon, displayIss.latitude, displayIss.longitude) : null;

  const track = useMemo(() => {
    const A = INC, lon0 = displayIss.longitude, lat0 = displayIss.latitude;
    const phase = lon0 - (Math.asin(clamp(lat0 / A, -1, 1)) / DEG);
    let p = "";
    for (let lon = -180; lon <= 180; lon += 3) {
      const lat = A * Math.sin((lon - phase) * DEG);
      p += `${lon === -180 ? "M" : "L"}${projX(lon).toFixed(1)} ${projY(lat).toFixed(1)} `;
    }
    return p;
  }, [displayIss]);

  const sun = useMemo(() => {
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const lon = wrapLon(-(utcH - 12) * 15);
    const lat = 23.44 * Math.sin((2 * Math.PI / 365) * (dayOfYear(now) - 81));
    return { lon, lat, x: projX(lon), y: projY(lat) };
  }, [now]);

  const next = launches && launches[0];
  const cd = next ? countdown(next.net, now) : null;
  const ks = kp != null ? kpStatus(kp) : null;
  const period = 92.7, orbits = (1440 / period).toFixed(1);

  const briefPrompt = () => {
    const parts = [];
    parts.push(`The ISS is over latitude ${fmt(displayIss.latitude)}, longitude ${fmt(displayIss.longitude)} at ${comma(displayIss.altitude)} km${dist ? `, about ${comma(dist)} km from me` : ""}.`);
    if (next) parts.push(`The next launch is ${next.name} by ${next.provider}, ${absTime(next.net)}.`);
    if (kp != null) parts.push(`The planetary K-index is ${fmt(kp, 1)}.`);
    if (neo?.closest) parts.push(`${neo.count} known asteroids pass near Earth today; the closest is ${neo.closest.name} at ${fmt(neo.closest.distLD, 1)} lunar distances.`);
    return `You are a friendly space guide. In 3-4 short, vivid sentences with no jargon and no markdown, give a curious beginner a quick "what's happening in space right now" briefing using these facts: ${parts.join(" ")}`;
  };

  if (view === "landing") {
    return (
      <div className="oo">
        <style>{cssText}</style>
        <Backdrop url={bgReady ? (apod && apod.url) : null} />
        <Landing onEnter={enter} displayIss={displayIss} issLive={issLive} />
      </div>
    );
  }

  const utc = now.toUTCString().slice(17, 25);
  const local = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // ── reusable panel fragments (kept as plain JSX, not components) ──
  const launchExplain = next && (
    <button className="btn" disabled={ai.launch?.loading} onClick={() => run("launch",
      `In 2-3 short, plain sentences with no markdown, explain to a curious beginner this upcoming rocket launch and why it matters: "${next.name}" by ${next.provider}${next.rocket ? ` on a ${next.rocket}` : ""}, launching ${absTime(next.net)}${next.pad ? ` from ${next.pad}` : ""}.`)}>
      <Spin on={ai.launch?.loading} /> Explain the next launch
    </button>
  );

  return (
    <div className="oo">
      <style>{cssText}</style>
      <Backdrop url={bgReady ? (apod && apod.url) : null} />

      <div className="topbar">
        <div className="tbin">
          <div className="brand" onClick={() => setView("landing")} title="Back to home">
            <div className="mark"><Satellite size={19} /></div>
            <div><div className="word">OPENORBIT</div><div className="tag">Live space data, explained.</div></div>
          </div>
          <div className="barright">
            <div className="clocks">
              <div className="clock"><div className="k">UTC</div><div className="t mono">{utc}</div></div>
              <div className="clock"><div className="k">Local</div><div className="t mono">{local}</div></div>
            </div>
            <button className="brief" onClick={() => { setTab("overview"); run("brief", briefPrompt()); }} disabled={ai.brief?.loading}>
              <Spin on={ai.brief?.loading} /> Brief me
            </button>
          </div>
        </div>
        <div className="tabbar" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tabmain">
        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <>
            <div className="pagehead">
              <div className="ptitle">Overview</div>
              <div className="psub">A snapshot of everything happening above you right now.</div>
            </div>
            <div className="briefcard">
              <div className="briefhead">
                <div className="htitle" style={{ color: "rgba(255,255,255,0.7)" }}><Sparkles size={14} /> Daily briefing</div>
                <button className="brief" onClick={() => run("brief", briefPrompt())} disabled={ai.brief?.loading}>
                  <Spin on={ai.brief?.loading} /> Brief me on the sky
                </button>
              </div>
              {ai.brief?.text
                ? <div className="aitext" style={{ marginTop: 12 }} aria-live="polite">{ai.brief.text}</div>
                : <div className="muted" style={{ marginTop: 10 }}>Tap “Brief me” for a plain-language summary of what’s overhead right now.</div>}
            </div>
            <div className="glance">
              <button className="gtile" onClick={() => setTab("tracker")}>
                <div className="gtop"><span className="gk"><Satellite size={13} /> Space Station</span><span className="gview">Track <ChevronRight size={12} /></span></div>
                <div className="gbig mono">{comma(displayIss.altitude)} km</div>
                <div className="gsmall mono">LAT {fmt(displayIss.latitude)}° · LON {fmt(displayIss.longitude)}°{dist != null ? ` · ${comma(dist)} km away` : ""}</div>
              </button>
              <button className="gtile" onClick={() => setTab("launches")}>
                <div className="gtop"><span className="gk"><Rocket size={13} /> Next launch</span><span className="gview">View <ChevronRight size={12} /></span></div>
                <div className="gbig" style={{ fontSize: 19, color: "#f3f6ff", fontWeight: 600 }}>{next ? next.name : "—"}</div>
                <div className="gsmall mono">{cd && !cd.live ? `T-minus ${cd.d}d ${String(cd.h).padStart(2, "0")}h ${String(cd.m).padStart(2, "0")}m` : next ? absTime(next.net) : ""}</div>
              </button>
              <button className="gtile" onClick={() => setTab("weather")}>
                <div className="gtop"><span className="gk"><Zap size={13} /> Space weather</span><span className="gview">View <ChevronRight size={12} /></span></div>
                <div className="gbig mono">Kp {kp != null ? fmt(kp, 1) : "—"}</div>
                <div className="gsmall">{ks ? ks.t : "Loading…"}</div>
              </button>
              <button className="gtile" onClick={() => setTab("asteroids")}>
                <div className="gtop"><span className="gk"><CircleDot size={13} /> Asteroids today</span><span className="gview">View <ChevronRight size={12} /></span></div>
                <div className="gbig mono">{neo ? neo.count : "—"}</div>
                <div className="gsmall">{neo?.closest ? `Closest ${neo.closest.name} · ${fmt(neo.closest.distLD, 1)} lunar distances` : "Loading…"}</div>
              </button>
            </div>
          </>
        )}

        {/* ── ISS TRACKER ── */}
        {tab === "tracker" && (
          <>
            <div className="pagehead">
              <div className="ptitle">ISS Tracker</div>
              <div className="psub">The International Space Station, live, on a world map with its orbital path.</div>
            </div>
            <MapBlock displayIss={displayIss} sun={sun} track={track} coords={coords} stars={stars} issLive={issLive} dist={dist} />
            <div className="stats">
              <div className="stat"><div className="k"><Gauge size={12} /> Altitude</div><div className="v mono">{comma(displayIss.altitude)} <span className="u">km</span></div></div>
              <div className="stat"><div className="k"><Radio size={12} /> Speed</div><div className="v mono">{comma(displayIss.velocity)} <span className="u">km/h</span></div></div>
              <div className="stat"><div className="k"><Timer size={12} /> Orbit period</div><div className="v mono">{period} <span className="u">min</span></div></div>
              <div className="stat"><div className="k"><Orbit size={12} /> Orbits / day</div><div className="v mono">{orbits}</div></div>
              <div className="stat"><div className="k"><Sun size={12} /> Sunrises / day</div><div className="v mono">16</div></div>
            </div>
            <div className="card" style={{ marginTop: 14 }}>
              <div className="htitle"><Satellite size={14} /> What am I looking at?</div>
              <button className="btn" disabled={ai.iss?.loading} onClick={() => run("iss",
                `In 2-3 short, vivid sentences with no jargon or markdown, explain to a curious 12-year-old what it means that the ISS is right now over latitude ${fmt(displayIss.latitude)}, longitude ${fmt(displayIss.longitude)}, at ${comma(displayIss.altitude)} km, moving ${comma(displayIss.velocity)} km/h${dist ? `, about ${comma(dist)} km from where I am` : ""}.`)}>
                <Spin on={ai.iss?.loading} /> Explain this
              </button>
              {ai.iss?.text && <div className="ai" aria-live="polite"><div className="ailead"><Sparkles size={12} /> In plain language</div><div className="aitext">{ai.iss.text}</div></div>}
            </div>
          </>
        )}

        {/* ── LAUNCHES ── */}
        {tab === "launches" && (
          <>
            <div className="pagehead">
              <div className="ptitle">Launches</div>
              <div className="psub">Upcoming rocket launches worldwide, with a live countdown to the next one.</div>
            </div>
            <div className="card">
              <div className="head">
                <span className="htitle"><Rocket size={14} /> Upcoming</span>
                <span className="live" style={lLive ? {} : { color: "#8a93ad" }}><span className={`ld ${lLive ? "" : "s"}`} />{lLive ? "LIVE" : "SAMPLE"}</span>
              </div>
              {next && (
                <div style={{ marginTop: 12 }}>
                  <div className="lnext">Next up · <b>{next.name}</b></div>
                  {cd && !cd.live ? (
                    <div className="cd">
                      {[["DAYS", cd.d], ["HRS", cd.h], ["MIN", cd.m], ["SEC", cd.s]].map(([l, n]) => (
                        <div className="cdc" key={l}><div className="n mono">{String(n).padStart(2, "0")}</div><div className="l">{l}</div></div>
                      ))}
                    </div>
                  ) : <div className="muted" style={{ margin: "10px 0" }}>Launching now / imminent</div>}
                </div>
              )}
              <div>
                {(launches || []).map((l, i) => (
                  <div className="row" key={i}>
                    <div>
                      <div className="lname">{l.name}
                        {l.status && <span className="spill" style={{ color: statusColor(l.status), borderColor: statusColor(l.status) }}>{l.status}</span>}
                      </div>
                      <div className="lmeta">{l.provider}{l.rocket ? ` · ${l.rocket}` : ""}</div>
                    </div>
                    <div><div className="when mono">{absTime(l.net)}</div>{l.pad && <div className="whensub">{l.pad}</div>}</div>
                  </div>
                ))}
                {!launches && <div className="sk" style={{ height: 64, marginTop: 10 }} />}
              </div>
              {launchExplain}
              {ai.launch?.text && <div className="ai" aria-live="polite"><div className="ailead"><Sparkles size={12} /> In plain language</div><div className="aitext">{ai.launch.text}</div></div>}
            </div>
          </>
        )}

        {/* ── SPACE WEATHER ── */}
        {tab === "weather" && (
          <>
            <div className="pagehead">
              <div className="ptitle">Space Weather</div>
              <div className="psub">Geomagnetic conditions and your chance of catching an aurora.</div>
            </div>
            <div className="card">
              <div className="head">
                <span className="htitle"><Zap size={14} /> Planetary K-index</span>
                <span className="live" style={kpLive ? {} : { color: "#8a93ad" }}><span className={`ld ${kpLive ? "" : "s"}`} />{kpLive ? "LIVE" : "SAMPLE"}</span>
              </div>
              {ks ? (
                <>
                  <div className="kp"><span className="kpn mono">{fmt(kp, 1)}</span><span style={{ color: ks.c, fontSize: 14, fontWeight: 600 }}>{ks.t}</span></div>
                  <div className="gbar"><div className="gfill" style={{ width: `${clamp(kp / 9, 0, 1) * 100}%` }} /></div>
                  <div className="muted" style={{ marginTop: 8 }}>The Kp scale runs 0 (calm) to 9 (extreme storm). Higher values push auroras toward the equator.</div>
                  <button className="btn" disabled={ai.kp?.loading} onClick={() => run("kp",
                    `In 2-3 short, plain sentences with no jargon or markdown, explain to a beginner what a planetary K-index of ${fmt(kp, 1)} means for space weather and seeing auroras right now.`)}>
                    <Spin on={ai.kp?.loading} /> Explain this
                  </button>
                  {ai.kp?.text && <div className="ai" aria-live="polite"><div className="ailead"><Sparkles size={12} /> In plain language</div><div className="aitext">{ai.kp.text}</div></div>}
                </>
              ) : <div className="sk" style={{ height: 80, marginTop: 10 }} />}
            </div>
          </>
        )}

        {/* ── ASTEROIDS ── */}
        {tab === "asteroids" && (
          <>
            <div className="pagehead">
              <div className="ptitle">Asteroids</div>
              <div className="psub">Near-Earth objects making a close approach in the next 24 hours.</div>
            </div>
            <div className="card">
              <div className="head">
                <span className="htitle"><CircleDot size={14} /> Close approaches today</span>
                <span className="live" style={neoLive ? {} : { color: "#8a93ad" }}><span className={`ld ${neoLive ? "" : "s"}`} />{neoLive ? "LIVE" : "SAMPLE"}</span>
              </div>
              {neo ? (
                <>
                  <div className="neo">
                    <span className="neobig mono">{neo.count}</span>
                    <span style={{ fontSize: 13, color: "#b9c2d8" }}>tracked close approaches in the next 24h</span>
                  </div>
                  {neo.closest && (
                    <>
                      <div className="muted" style={{ marginTop: 4 }}>Closest: <b style={{ color: "#dbe2f2" }}>{neo.closest.name}</b>
                        {neo.closest.hazardous && <span className="spill" style={{ color: "#ff6b6b", borderColor: "#ff6b6b", marginLeft: 8 }}><TriangleAlert size={9} style={{ verticalAlign: -1 }} /> WATCH</span>}
                      </div>
                      <div className="neogrid">
                        <div><div className="k">Miss distance</div><div className="v mono">{fmt(neo.closest.distLD, 1)} LD</div></div>
                        <div><div className="k">Speed</div><div className="v mono">{comma(neo.closest.vel)} km/h</div></div>
                        <div><div className="k">Est. size</div><div className="v mono">{comma(neo.closest.sizeM)} m</div></div>
                        <div><div className="k">Distance</div><div className="v mono">{comma(neo.closest.distKm)} km</div></div>
                      </div>
                      <div className="muted" style={{ marginTop: 10 }}>1 LD (lunar distance) = the distance from Earth to the Moon, about 384,400 km.</div>
                    </>
                  )}
                  <button className="btn" disabled={ai.neo?.loading} onClick={() => run("neo",
                    `In 2-3 short, reassuring but accurate sentences with no markdown, explain to a beginner what it means that ${neo.count} asteroids pass near Earth today, the closest being ${neo.closest?.name} at ${fmt(neo.closest?.distLD, 1)} lunar distances (${comma(neo.closest?.distKm)} km), about ${comma(neo.closest?.sizeM)} m wide${neo.closest?.hazardous ? ", flagged potentially hazardous" : ""}. Note one lunar distance is the Earth-Moon distance.`)}>
                    <Spin on={ai.neo?.loading} /> Should I worry?
                  </button>
                  {ai.neo?.text && <div className="ai" aria-live="polite"><div className="ailead"><Sparkles size={12} /> In plain language</div><div className="aitext">{ai.neo.text}</div></div>}
                </>
              ) : <div className="sk" style={{ height: 100, marginTop: 10 }} />}
            </div>
          </>
        )}

        {/* ── DISCOVER ── */}
        {tab === "discover" && (
          <>
            <div className="pagehead">
              <div className="ptitle">Discover</div>
              <div className="psub">NASA's image of the day, and a place to ask anything about space.</div>
            </div>
            <div className="card">
              <div className="head">
                <span className="htitle"><ImageIcon size={14} /> NASA picture of the day</span>
                <span className="live" style={apLive ? {} : { color: "#8a93ad" }}><span className={`ld ${apLive ? "" : "s"}`} />{apLive ? "LIVE" : "SAMPLE"}</span>
              </div>
              {apod ? (
                <div className="apod" style={{ marginTop: 14 }}>
                  {apod.url && !apErr
                    ? <img className="apimg" src={apod.url} alt={apod.title} onError={() => setApErr(true)} />
                    : <div className="apph"><ImageIcon size={26} /></div>}
                  <div>
                    <div className="aptitle">{apod.title}</div>
                    <div className="aptext">{apod.explanation?.length > 420 ? apod.explanation.slice(0, 420) + "…" : apod.explanation}</div>
                    <button className="btn" disabled={ai.apod?.loading} onClick={() => run("apod",
                      `In 2-3 short, vivid sentences for a curious beginner with no markdown, explain what this astronomy image shows and why it's interesting. Title: "${apod.title}". Context: ${apod.explanation?.slice(0, 500)}`)}>
                      <Spin on={ai.apod?.loading} /> Explain it simply
                    </button>
                    {ai.apod?.text && <div className="ai" aria-live="polite"><div className="ailead"><Sparkles size={12} /> In plain language</div><div className="aitext">{ai.apod.text}</div></div>}
                  </div>
                </div>
              ) : <div className="sk" style={{ height: 220, marginTop: 14 }} />}
            </div>

            <div className="ask" style={{ marginTop: 14 }}>
              <span className="htitle"><Sparkles size={14} /> Ask the sky</span>
              <div className="askrow">
                <input ref={askRef} className="askin" placeholder="Ask anything about space…  (e.g. why doesn't the ISS fall down?)"
                  value={ask.q} onChange={(e) => setAsk((p) => ({ ...p, q: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") doAsk(); }} />
                <button className="asksend" onClick={() => doAsk()} disabled={ask.loading || !ask.q.trim()}>
                  {ask.loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />} Ask
                </button>
              </div>
              <div className="chips">
                {["Why doesn't the ISS fall down?", "What is a Kp index?", "How fast is the speed of light?", "Meteor vs asteroid?"].map((q) => (
                  <button className="chip" key={q} onClick={() => { setAsk((p) => ({ ...p, q })); doAsk(q); }}>{q}</button>
                ))}
              </div>
              {ask.text && <div className="ai" aria-live="polite"><div className="ailead"><Sparkles size={12} /> {ask.q}</div><div className="aitext">{ask.text}</div></div>}
            </div>
          </>
        )}

        <div className="foot">
          <span>Open source · MIT · Data: wheretheiss.at · The Space Devs · NOAA SWPC · NASA APOD &amp; NeoWs</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Github size={13} /> Not affiliated with NASA</span>
        </div>
              </div>
    </div>
  );
}
