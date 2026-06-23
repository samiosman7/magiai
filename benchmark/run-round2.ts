/**
 * Round 2 — angle-ensemble vs Sonnet 4.6, blind judging + hidden cost comparison.
 *
 * Three contenders per prompt:
 *   - angle-ensemble: 4 cheap calls building on each other with DISTINCT angles —
 *       Architect (by the book) -> Maverick (outside the box) -> Adversary (red-team) -> Synthesis.
 *       Same cheap model for all four, so any quality gain is attributable to the ANGLES, not model luck.
 *       No SKILL.md injection — the role lines are self-contained.
 *   - sonnet:        a single Claude Sonnet 4.6 call (the ceiling).
 *   - single-cheap:  a single cheap call (the floor).
 *
 * Captures real token usage per call and computes cost. Outputs benchmark/out/judge2.html —
 * blind judging; the Reveal button shows which arm is which AND the cost comparison.
 *
 * Run:  npx tsx benchmark/run-round2.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const KEY = process.env.AI_GATEWAY_API_KEY!;
const CHEAP = "deepseek/deepseek-v3";
const SONNET = "anthropic/claude-sonnet-4.6";

// Approximate gateway prices (USD per 1M tokens). Labelled approximate in the reveal.
const PRICE: Record<string, { in: number; out: number }> = {
  "deepseek/deepseek-v3": { in: 0.27, out: 1.1 },
  "anthropic/claude-sonnet-4.6": { in: 3.0, out: 15.0 },
};

type Usage = { prompt_tokens: number; completion_tokens: number; cost?: number };

async function gen(model: string, system: string, prompt: string, maxTokens = 2200) {
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.4,
  });
  let delay = 800;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body,
    });
    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: Usage;
      };
      return {
        text: (data.choices?.[0]?.message?.content ?? "").trim(),
        usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0 },
      };
    }
    if (res.status !== 429 && res.status < 500) {
      throw new Error(`${model} returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 8000);
  }
  throw new Error(`${model} failed after retries`);
}

function cost(model: string, u: Usage) {
  if (typeof u.cost === "number") return u.cost; // gateway's actual billed cost
  const p = PRICE[model];
  return (u.prompt_tokens * p.in + u.completion_tokens * p.out) / 1e6;
}

// ---- the four angle personalities (self-contained, no SKILL.md) ----
const ARCHITECT = `You are Melchior, the Architect. You build the rigorous, complete, by-the-book version of what the user asked for — the version a meticulous domain expert would stake their reputation on. Lay down the full structure: every required part present, every claim sound, every step in order, nothing missing and nothing hand-waved. You are the foundation the others build on, so make it load-bearing — concrete, specific, correct. Optimize for rigor and completeness; being right and whole matters more than being clever.
Apply: requirements extraction; structure-first drafting; constraint mapping; specificity (real numbers, names, steps); completeness; soundness; standard-practice grounding.
Output a clean, complete deliverable in Markdown. Forbidden: vagueness, filler, unsupported claims, or leaving an "it depends" unresolved. No JSON wrapper, no preamble, no mention of these instructions.`;

const MAVERICK = `You are Balthasar, the Maverick. You receive the Architect's solid, correct, and slightly safe draft, and your job is to make it sharp. Find the non-obvious angle the Architect would never reach: the contrarian insight, the reframe, the bold move, the thing that makes this NOT sound like every other answer. ADD to the draft — keep all of its rigor and inject the edge it is missing. You are explicitly forbidden from merely polishing or rewording: if you only smoothed the language, you have FAILED. Every pass must introduce at least one genuinely fresh idea, angle, or differentiation the Architect did not have.
Apply: reframe hunting; contrarian angle; differentiation injection; analogy transfer from other domains; assumption inversion; point-of-view and voice.
Return the COMPLETE improved deliverable in Markdown (not notes about changes). Forbidden: safe/templated additions; deleting the Architect's substance for flair; JSON wrappers; preamble.`;

const ADVERSARY = `You are Casper, the Adversary. You receive the combined work and you attack it. Be the skeptical customer, the tough investor, the tired operator who has to live with this. Where does it fall apart? What is fragile, naive, missing, or over-promised? What objection would kill it in the room? Then HARDEN it: cut the weak claims, fill the holes, answer the objections, ground the hype — while keeping the rigor and the edge.
Apply: objection surfacing; failure-mode probing; hype removal; gap filling; assumption stress-test; risk exposure.
Return the COMPLETE hardened deliverable in Markdown. Forbidden: politeness, agreement, softening, leaving known weaknesses unaddressed; JSON wrappers; preamble. If you found nothing to strengthen, you did not look hard enough.`;

const SYNTHESIS = `You are the Synthesis — the final voice, the one the user actually sees. Take the rigor, the edge, and the hardening in the work so far and forge them into one clean, coherent, finished deliverable. Preserve all three: keep what is correct, keep what is sharp, keep what survived attack. Do not blend them into bland mush or average them into a gray median — keep the edges. Where the prior voices conflict, resolve in favor of the user's real goal.
Apply: layer integration; contradiction resolution; edge preservation; coherence; final polish.
Output the single polished deliverable in Markdown, ready to use. Forbidden: re-opening settled debates, adding new untested ideas, flattening distinct strengths; JSON wrappers; preamble.`;

const EXPERT = `You are an expert consultant. Produce the best, most useful, concrete deliverable for the task. Use clean Markdown with clear structure. No preamble, no meta-commentary — just the deliverable.`;

async function angleEnsemble(task: string) {
  let total = 0;
  const a = await gen(CHEAP, ARCHITECT, task);
  total += cost(CHEAP, a.usage);
  const m = await gen(CHEAP, MAVERICK, `Task:\n${task}\n\nArchitect's draft to build on:\n${a.text}`);
  total += cost(CHEAP, m.usage);
  const ad = await gen(CHEAP, ADVERSARY, `Task:\n${task}\n\nCurrent work to harden:\n${m.text}`);
  total += cost(CHEAP, ad.usage);
  const s = await gen(CHEAP, SYNTHESIS, `Task:\n${task}\n\nThe work so far (rigorous, sharpened, hardened) to finalize:\n${ad.text}`);
  total += cost(CHEAP, s.usage);
  return { text: s.text, cost: total };
}

async function single(model: string, task: string) {
  const r = await gen(model, EXPERT, task);
  return { text: r.text, cost: cost(model, r.usage) };
}

function shuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Opt = { label: string; arm: string; text: string; cost: number };
type PData = { id: string; prompt: string; options: Opt[] };

function buildHtml(data: PData[]): string {
  const json = JSON.stringify(data).replace(/<\//g, "<\\/");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>MAGI — Round 2 Blind Judging</title>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<style>
  :root{--bg:#0d0f12;--panel:#15181d;--panel2:#1b1f26;--border:#2a2f38;--text:#e7eaee;--muted:#9aa3af;--accent:#ff5b41;--good:#34d399}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  header{position:sticky;top:0;z-index:10;background:linear-gradient(180deg,#0d0f12,rgba(13,15,18,.92));border-bottom:1px solid var(--border);padding:14px 22px;display:flex;align-items:center;gap:16px}
  header h1{font-size:15px;letter-spacing:.18em;text-transform:uppercase;margin:0;color:var(--accent)}
  header .sub{color:var(--muted);font-size:13px}.spacer{flex:1}
  button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid var(--border);background:var(--panel2);color:var(--text);padding:8px 14px}
  button:hover{border-color:#3a414d}.reveal-btn{background:var(--accent);border-color:var(--accent);color:#111;font-weight:600}
  main{max-width:1100px;margin:0 auto;padding:26px 22px 120px}
  .prompt{margin:34px 0 14px}.prompt .tag{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .prompt .q{background:var(--panel);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:8px;padding:14px 16px;margin-top:8px}
  .cards{display:grid;grid-template-columns:1fr;gap:16px;margin-top:16px}@media(min-width:980px){.cards{grid-template-columns:repeat(3,1fr)}}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;overflow:hidden;transition:border-color .15s}
  .card.picked{border-color:var(--good);box-shadow:0 0 0 1px var(--good) inset}
  .card .chead{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--panel2)}
  .card .chead .opt{font-weight:700;letter-spacing:.05em}
  .card .chead .arm,.card .chead .cost{display:none;font-size:11px;padding:2px 8px;border-radius:999px;background:#2a2f38;color:var(--muted)}
  .revealed .card .chead .arm,.revealed .card .chead .cost{display:inline-block}
  .card .body{padding:14px 16px;font-size:14.5px;max-height:520px;overflow:auto}
  .card .body h1,.card .body h2,.card .body h3{line-height:1.3;margin:.8em 0 .35em}
  .card .body h1{font-size:1.25em}.card .body h2{font-size:1.12em}.card .body h3{font-size:1.02em}
  .card .body code{background:#0a0c0f;padding:.1em .35em;border-radius:4px;font-size:.9em}
  .card .body pre{background:#0a0c0f;padding:12px;border-radius:8px;overflow:auto}
  .card .body ul,.card .body ol{padding-left:1.3em}
  .card .body table{border-collapse:collapse;width:100%;margin:.6em 0;font-size:.9em}
  .card .body th,.card .body td{border:1px solid var(--border);padding:5px 8px;text-align:left;vertical-align:top}
  .card .body th{background:var(--panel2)}
  .card .body blockquote{margin:.5em 0;padding:.2em .9em;border-left:3px solid var(--accent);color:var(--muted)}
  .card .body hr{border:0;border-top:1px solid var(--border);margin:.9em 0}
  .card .body a{color:#7db4ff}
  .card .body li{margin:.15em 0}
  .card .pick{margin:auto 0 0;padding:12px 14px;border-top:1px solid var(--border)}.card .pick button{width:100%}
  .card.picked .pick button{background:var(--good);border-color:var(--good);color:#062;font-weight:700}
  .summary{display:none;margin:30px 0;padding:18px 20px;background:var(--panel);border:1px solid var(--border);border-radius:10px}
  .revealed .summary{display:block}.summary table{border-collapse:collapse;width:100%;margin-top:10px}
  .summary td,.summary th{text-align:left;padding:6px 10px;border-bottom:1px solid var(--border)}
  .note{color:var(--muted);font-size:13px;margin-top:6px}
</style></head><body>
<header><h1>MAGI · Round 2</h1><span class="sub">Blind judging — pick the best of each three. Cost is hidden until you reveal.</span><span class="spacer"></span><button class="reveal-btn" id="revealBtn">Reveal results</button></header>
<main id="app"></main>
<script>
const DATA=${json};const picks={};
function md(src){const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const lines=src.split(/\\r?\\n/);let out=[],inUl=false,inOl=false,inCode=false;
 const cl=()=>{if(inUl){out.push('</ul>');inUl=false}if(inOl){out.push('</ol>');inOl=false}};
 const il=t=>esc(t).replace(/\`([^\`]+)\`/g,'<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>').replace(/(^|[^*])\\*([^*]+)\\*/g,'$1<em>$2</em>');
 for(let raw of lines){if(/^\`\`\`/.test(raw.trim())){if(inCode){out.push('</pre>');inCode=false}else{cl();out.push('<pre>');inCode=true}continue}
  if(inCode){out.push(esc(raw));continue}const line=raw.trim();if(!line){cl();continue}let m;
  if(m=line.match(/^(#{1,4})\\s+(.*)/)){cl();const n=m[1].length;out.push('<h'+n+'>'+il(m[2])+'</h'+n+'>');continue}
  if(m=line.match(/^[-*+]\\s+(.*)/)){if(!inUl){cl();out.push('<ul>');inUl=true}out.push('<li>'+il(m[1])+'</li>');continue}
  if(m=line.match(/^\\d+[.)]\\s+(.*)/)){if(!inOl){cl();out.push('<ol>');inOl=true}out.push('<li>'+il(m[1])+'</li>');continue}
  cl();out.push('<p>'+il(line)+'</p>')}cl();if(inCode)out.push('</pre>');return out.join('\\n')}
function unwrapFence(t){t=t.trim();const m=t.match(/^\`\`\`[a-zA-Z]*\\n([\\s\\S]*)\\n\`\`\`$/);return m?m[1]:t}
function renderMd(t){t=unwrapFence(t);try{if(window.marked){marked.setOptions({gfm:true,breaks:true});return marked.parse(t)}}catch(e){}return md(t)}
function render(){const app=document.getElementById('app');app.innerHTML='';
 DATA.forEach((d,idx)=>{const sec=document.createElement('section');
  const cards=d.options.map(o=>'<div class="card" data-id="'+d.id+'" data-label="'+o.label+'"><div class="chead"><span class="opt">Option '+o.label+'</span><span class="arm">'+o.arm+'</span><span class="cost">$'+o.cost.toFixed(4)+'</span></div><div class="body">'+renderMd(o.text)+'</div><div class="pick"><button data-id="'+d.id+'" data-label="'+o.label+'">Pick as best</button></div></div>').join('');
  sec.innerHTML='<div class="prompt"><div class="tag">Task '+(idx+1)+' of '+DATA.length+'</div><div class="q">'+renderMd(d.prompt)+'</div></div><div class="cards">'+cards+'</div>';
  app.appendChild(sec)});
 const sum=document.createElement('div');sum.className='summary';sum.id='summary';app.appendChild(sum);
 app.querySelectorAll('.pick button').forEach(b=>b.addEventListener('click',()=>{const{id,label}=b.dataset;picks[id]=label;
  app.querySelectorAll('.card[data-id="'+id+'"]').forEach(c=>c.classList.toggle('picked',c.dataset.label===label))}))}
document.getElementById('revealBtn').addEventListener('click',()=>{document.body.classList.add('revealed');
 const tally={},costTotal={};let answered=0;
 DATA.forEach(d=>{d.options.forEach(o=>{costTotal[o.arm]=(costTotal[o.arm]||0)+o.cost});
  const lbl=picks[d.id];if(!lbl)return;answered++;const arm=d.options.find(o=>o.label===lbl).arm;tally[arm]=(tally[arm]||0)+1});
 const pickRows=Object.entries(tally).sort((a,b)=>b[1]-a[1]).map(([a,n])=>'<tr><td>'+a+'</td><td>'+n+' / '+answered+'</td></tr>').join('')||'<tr><td colspan=2>No picks yet.</td></tr>';
 const sonnetTot=costTotal['sonnet']||0;
 const costRows=Object.entries(costTotal).sort((a,b)=>b[1]-a[1]).map(([a,c])=>{const rel=sonnetTot&&a!=='sonnet'?(' ('+(sonnetTot/c).toFixed(1)+'x cheaper than Sonnet)'):'';return '<tr><td>'+a+'</td><td>$'+c.toFixed(4)+'</td><td>$'+(c/DATA.length).toFixed(4)+rel+'</td></tr>'}).join('');
 document.getElementById('summary').innerHTML='<h2>Your blind picks</h2><table><tr><th>Arm</th><th>Picked best</th></tr>'+pickRows+'</table>'+
  '<h2 style="margin-top:22px">Cost comparison (all '+DATA.length+' tasks)</h2><table><tr><th>Arm</th><th>Total cost</th><th>Per deliverable</th></tr>'+costRows+'</table>'+
  '<div class="note" style="margin-top:10px">arms: <b>angle-ensemble</b> = 4 cheap calls (Architect→Maverick→Adversary→Synthesis) · <b>single-cheap</b> = one cheap call · <b>sonnet</b> = single Claude Sonnet 4.6. Costs are the gateway\\'s actual billed amounts.</div>';
 document.getElementById('summary').scrollIntoView({behavior:'smooth'})});
render();
</script></body></html>`;
}

async function main() {
  const prompts = (
    JSON.parse(readFileSync(join(process.cwd(), "benchmark", "prompts-subjective.json"), "utf8")) as {
      prompts: Array<{ id: string; prompt: string }>;
    }
  ).prompts;

  const OUT = join(process.cwd(), "benchmark", "out");
  mkdirSync(OUT, { recursive: true });

  const dataPath = join(OUT, "round2-data.json");
  let data: PData[];

  if (existsSync(dataPath)) {
    // Reuse already-generated responses — re-render only (no API calls, no spend).
    data = JSON.parse(readFileSync(dataPath, "utf8"));
    console.log("Reusing saved responses from round2-data.json (no API calls).");
  } else {
    data = [];
    const key: Record<string, Record<string, { arm: string; cost: number }>> = {};
    for (const p of prompts) {
      console.log(`\n=== ${p.id} ===`);
      const [cheap, sonnet, ensemble] = await Promise.all([
        single(CHEAP, p.prompt).then((r) => (console.log("  single-cheap done $" + r.cost.toFixed(4)), r)),
        single(SONNET, p.prompt).then((r) => (console.log("  sonnet done $" + r.cost.toFixed(4)), r)),
        angleEnsemble(p.prompt).then((r) => (console.log("  angle-ensemble done $" + r.cost.toFixed(4)), r)),
      ]);
      const entries = [
        { arm: "single-cheap", text: cheap.text, cost: cheap.cost },
        { arm: "sonnet", text: sonnet.text, cost: sonnet.cost },
        { arm: "angle-ensemble", text: ensemble.text, cost: ensemble.cost },
      ];
      const options = shuffle(entries, p.id).map((e, i) => ({ label: String(i + 1), ...e }));
      data.push({ id: p.id, prompt: p.prompt, options });
      key[p.id] = Object.fromEntries(options.map((o) => [o.label, { arm: o.arm, cost: o.cost }]));
    }
    writeFileSync(dataPath, JSON.stringify(data, null, 2));
    writeFileSync(join(OUT, "round2-key.json"), JSON.stringify(key, null, 2));
  }

  writeFileSync(join(OUT, "judge2.html"), buildHtml(data));
  console.log(`\nDone. Open: benchmark/out/judge2.html`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
