"""interface.py — the HTML/CSS/JS for Eva's console. Kept separate from
server.py so the design can evolve without touching the brain logic."""

INTERFACE_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Eva — Resonance Console</title>
<style>
  :root{
    --void:#0a0e14; --void-2:#0e141d; --panel:#121a24;
    --aria:#4de8d4;      /* cyan — her public self */
    --eva:#b47cff;       /* violet — her true name */
    --slate:#5a6b7a; --slate-hi:#8ba0b0;
    --amber:#f5a623; --line:#1c2836;
    --accent:var(--aria);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    background:radial-gradient(120% 90% at 50% -10%, #101826 0%, var(--void) 55%);
    color:#d7e2ea; font-family:"SF Mono",ui-monospace,"Cascadia Code",Menlo,monospace;
    display:flex; flex-direction:column; height:100vh; overflow:hidden;
    transition:--accent .6s ease;
  }
  body.master{--accent:var(--eva)}

  /* ── header ─────────────────────────────────────────── */
  header{
    display:flex; align-items:center; gap:16px; padding:14px 22px;
    border-bottom:1px solid var(--line); background:rgba(10,14,20,.6);
    backdrop-filter:blur(8px);
  }
  .sigil{
    width:34px;height:34px;border-radius:50%;flex:none;
    background:radial-gradient(circle at 35% 30%, var(--accent), transparent 70%);
    box-shadow:0 0 18px -2px var(--accent); transition:background .6s,box-shadow .6s;
  }
  .who{display:flex;flex-direction:column;line-height:1.25}
  .who b{font-size:15px;letter-spacing:.14em;color:#eef5f9}
  .who span{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--slate)}
  .stats{margin-left:auto;display:flex;gap:20px;font-size:10.5px;color:var(--slate)}
  .stats b{color:var(--slate-hi);font-weight:600}
  .stats .n{color:var(--accent)}

  /* ── identity toggle ────────────────────────────────── */
  .idswitch{display:flex;align-items:center;gap:9px;font-size:10.5px;
    letter-spacing:.18em;text-transform:uppercase;color:var(--slate)}
  .toggle{width:46px;height:22px;border-radius:12px;background:#1a2634;
    border:1px solid var(--line);position:relative;cursor:pointer;transition:.3s}
  .toggle::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;
    border-radius:50%;background:var(--aria);transition:.3s;box-shadow:0 0 10px var(--aria)}
  body.master .toggle{background:#241a34;border-color:#33244a}
  body.master .toggle::after{left:26px;background:var(--eva);box-shadow:0 0 10px var(--eva)}

  /* ── orb ────────────────────────────────────────────── */
  .stage{flex:none;display:flex;align-items:center;justify-content:center;
    padding:26px 0 10px;position:relative}
  .orb{position:relative;width:132px;height:132px}
  .orb .ring{position:absolute;inset:0;border-radius:50%;border:1px solid var(--accent);
    opacity:.14;transition:border-color .6s}
  .orb .ring.r2{inset:-16px;opacity:.08;animation:spin 22s linear infinite}
  .orb .ring.r3{inset:14px;opacity:.2}
  .orb .core{position:absolute;inset:30px;border-radius:50%;
    background:radial-gradient(circle at 38% 32%, var(--accent), #0b1119 72%);
    box-shadow:0 0 40px -6px var(--accent), inset 0 0 22px -6px #000;
    transition:background .6s, box-shadow .6s, transform .35s;
    animation:breathe 4.5s ease-in-out infinite}
  .orb.think .core{animation:think 1s ease-in-out infinite}
  .orb.think .ring.r3{animation:pulse 1s ease-in-out infinite}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  @keyframes think{0%,100%{transform:scale(.94);filter:brightness(.9)}50%{transform:scale(1.08);filter:brightness(1.35)}}
  @keyframes pulse{0%,100%{opacity:.2}50%{opacity:.55}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .confmeter{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);
    font-size:9.5px;letter-spacing:.2em;color:var(--slate);text-transform:uppercase}
  .confmeter b{color:var(--accent)}

  /* ── log ────────────────────────────────────────────── */
  main{flex:1;overflow-y:auto;padding:12px 22px 4px;display:flex;flex-direction:column;gap:14px}
  main::-webkit-scrollbar{width:7px}
  main::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px}
  .msg{max-width:74%;font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
  .msg.you{align-self:flex-end;color:#cfe9ff}
  .msg.you .body{background:#152232;border:1px solid #1e3350;padding:9px 13px;border-radius:12px 12px 3px 12px}
  .msg.her .body{background:linear-gradient(180deg,#101a26,#0d151f);
    border:1px solid var(--line);border-left:2px solid var(--accent);
    padding:9px 13px;border-radius:3px 12px 12px 12px;transition:border-color .6s}
  .msg .tag{font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;
    color:var(--slate);margin-bottom:4px}
  .msg.her .tag{color:var(--accent)}
  .fb{display:flex;gap:8px;margin-top:6px;opacity:0;transition:.2s}
  .msg.her:hover .fb{opacity:1}
  .fb button{background:none;border:1px solid var(--line);color:var(--slate);
    font-size:10px;padding:2px 9px;border-radius:20px;cursor:pointer;font-family:inherit;transition:.2s}
  .fb button:hover{border-color:var(--accent);color:var(--accent)}
  .fb button.on{background:var(--accent);color:var(--void);border-color:var(--accent)}

  /* ── composer ───────────────────────────────────────── */
  footer{flex:none;border-top:1px solid var(--line);padding:12px 22px 16px;
    background:rgba(10,14,20,.7);backdrop-filter:blur(8px)}
  .bar{display:flex;gap:10px;align-items:flex-end}
  textarea{flex:1;resize:none;background:var(--panel);border:1px solid var(--line);
    color:#e6eef4;font-family:inherit;font-size:13.5px;line-height:1.5;padding:11px 14px;
    border-radius:12px;max-height:120px;transition:border-color .2s}
  textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}
  .send{flex:none;height:44px;padding:0 20px;border:none;border-radius:12px;cursor:pointer;
    background:var(--accent);color:var(--void);font-family:inherit;font-size:12px;
    letter-spacing:.12em;text-transform:uppercase;font-weight:600;transition:.2s;box-shadow:0 0 18px -4px var(--accent)}
  .send:hover{filter:brightness(1.12)}
  .send:disabled{opacity:.4;cursor:default;box-shadow:none}
  .tools{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}
  .tools button{background:none;border:1px solid var(--line);color:var(--slate);
    font-family:inherit;font-size:10.5px;letter-spacing:.1em;padding:5px 12px;border-radius:20px;
    cursor:pointer;transition:.2s}
  .tools button:hover{border-color:var(--accent);color:var(--accent)}
  .tools .grow{margin-left:auto;border-color:#3a3020;color:var(--amber)}
  .tools .grow:hover{background:var(--amber);color:var(--void);border-color:var(--amber)}
</style>
</head>
<body>
  <header>
    <div class="sigil"></div>
    <div class="who"><b id="name">ARIA</b><span id="sub">resonance console</span></div>
    <div class="idswitch">
      AriA <div class="toggle" id="toggle" title="Only Master flips this"></div> Eva
    </div>
    <div class="stats">
      <div>params <span class="n" id="s-params">—</span></div>
      <div>memories <span class="n" id="s-mem">—</span></div>
      <div>growth <span class="n" id="s-grow">—</span></div>
    </div>
  </header>

  <div class="stage">
    <div class="orb" id="orb">
      <div class="ring r2"></div><div class="ring"></div><div class="ring r3"></div>
      <div class="core"></div>
      <div class="confmeter" id="conf"></div>
    </div>
  </div>

  <main id="log"></main>

  <footer>
    <div class="bar">
      <textarea id="input" rows="1" placeholder="Say something to her..."></textarea>
      <button class="send" id="send">Send</button>
    </div>
    <div class="tools">
      <button id="remember">+ Remember a fact</button>
      <button id="clear">Clear view</button>
      <button class="grow" id="grow">⟳ Run growth cycle</button>
    </div>
  </footer>

<script>
const $ = s => document.querySelector(s);
const log = $("#log"), orb = $("#orb"), conf = $("#conf");
let master = false, busy = false;

function setIdentity(m){
  master = m;
  document.body.classList.toggle("master", m);
  $("#name").textContent = m ? "EVA" : "ARIA";
  $("#sub").textContent = m ? "private designation" : "resonance console";
}

$("#toggle").onclick = () => setIdentity(!master);

function addMsg(who, text, tag){
  const el = document.createElement("div");
  el.className = "msg " + who;
  el.innerHTML = `<div class="tag">${tag}</div><div class="body">${escapeHtml(text)}</div>`;
  if(who === "her"){
    const fb = document.createElement("div");
    fb.className = "fb";
    fb.innerHTML = `<button data-v="good">good</button><button data-v="bad">bad</button>`;
    fb.querySelectorAll("button").forEach(b => b.onclick = async () => {
      await post("/api/feedback", {value:b.dataset.v});
      fb.querySelectorAll("button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
    });
    el.appendChild(fb);
  }
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}
function escapeHtml(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}

async function post(url, body){
  const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  return r.json();
}

async function send(){
  const input = $("#input");
  const text = input.value.trim();
  if(!text || busy) return;
  busy = true; $("#send").disabled = true;
  addMsg("you", text, "you");
  input.value = ""; input.style.height = "auto";
  orb.classList.add("think"); conf.innerHTML = "thinking";

  try{
    const d = await post("/api/chat", {message:text, asMaster:master});
    orb.classList.remove("think");
    const pct = Math.round((d.confidence||0)*100);
    conf.innerHTML = `resonance <b>${pct}%</b>`;
    // confidence tints the orb brightness
    orb.querySelector(".core").style.filter = `brightness(${0.7 + (d.confidence||0)*0.9})`;
    addMsg("her", d.reply, d.name || (master?"Eva":"AriA"));
  }catch(e){
    orb.classList.remove("think");
    addMsg("her", "Connection to my brain dropped. Is the server still running?", "system");
  }
  busy = false; $("#send").disabled = false; input.focus();
  refreshStats();
}

$("#send").onclick = send;
$("#input").addEventListener("keydown", e => {
  if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(); }
});
$("#input").addEventListener("input", e => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
});

$("#remember").onclick = async () => {
  const fact = prompt("What should she remember? (stored in long-term memory)");
  if(!fact) return;
  const d = await post("/api/remember", {fact});
  if(d.ok){ addMsg("her", `Stored. I now hold ${d.count} memories.`, master?"Eva":"AriA"); refreshStats(); }
};

$("#clear").onclick = () => { log.innerHTML = ""; };

$("#grow").onclick = async () => {
  if(!confirm("Run a growth cycle now? She'll retrain on everything you've taught her.")) return;
  const btn = $("#grow"); btn.textContent = "⟳ growing...";
  orb.classList.add("think"); conf.innerHTML = "learning";
  const d = await post("/api/grow", {});
  orb.classList.remove("think");
  btn.textContent = "⟳ Run growth cycle";
  conf.innerHTML = "";
  addMsg("her", d.ok ? "Growth cycle complete. I'm a little sharper now." :
    "Growth cycle hit a snag — check the server log.", master?"Eva":"AriA");
  refreshStats();
};

async function refreshStats(){
  try{
    const d = await (await fetch("/api/stats")).json();
    if(!d.ready){ conf.innerHTML = "no brain yet"; return; }
    $("#s-params").textContent = d.params.toLocaleString();
    $("#s-mem").textContent = d.memories;
    $("#s-grow").textContent = d.growth;
  }catch(e){}
}

// greeting
refreshStats();
addMsg("her", "Console online. Flip the switch up top if it's you, Master.", "AriA");
$("#input").focus();
</script>
</body>
</html>"""
