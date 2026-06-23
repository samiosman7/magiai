/**
 * Subjective blind-judging build.
 *
 * Three contenders per prompt:
 *   - chain:        3 DIFFERENT cheap models building on each other (draft -> improve -> improve,
 *                   each told to ADD quality, depth, and specifics). This is the Magi thesis.
 *   - single-cheap: one cheap model alone (same model that starts the chain) — isolates the chain's value.
 *   - sonnet:       a single Claude Sonnet call — the quality ceiling.
 *
 * Outputs benchmark/out/judge.html — a self-contained page that shows each prompt's three
 * responses shuffled and labelled Option 1/2/3 (you don't see which is which). You pick the best;
 * a Reveal button at the end shows the key and tallies which arm you preferred.
 *
 * Run:  npx tsx benchmark/run-subjective.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

import { generateText } from "../lib/magi/providers";

const CHAIN = [
  "deepseek/deepseek-v3",
  "alibaba/qwen3-next-80b-a3b-instruct",
  "meta/llama-3.3-70b",
];
const SINGLE_CHEAP = "deepseek/deepseek-v3";
const SONNET = "anthropic/claude-sonnet-4.5";

const EXPERT_SYSTEM =
  "You are an expert consultant. Produce the best, most useful, concrete deliverable for the task. Use clean Markdown with clear structure. No preamble, no 'as an AI', no meta commentary — just the deliverable.";

const IMPROVE_SYSTEM =
  "You are an expert reviser improving another expert's draft. Make it materially BETTER, not just reworded: add depth, concrete specifics, numbers and examples; fill gaps; fix weak or generic reasoning; sharpen structure and voice. Keep everything that is already strong. Do not shorten for its own sake — raise the quality and usefulness. Return the COMPLETE improved deliverable in clean Markdown, with no notes about what you changed.";

async function gen(model: string, system: string, prompt: string, maxTokens = 2200) {
  const res = await generateText({ provider: "vercel", model, system, prompt, maxTokens, temperature: 0.4 });
  return res.text.trim();
}

async function singleAnswer(model: string, task: string) {
  return gen(model, EXPERT_SYSTEM, task);
}

// 3 cheap models building on each other, each adding quality.
async function chainAnswer(task: string) {
  let draft = await gen(CHAIN[0], EXPERT_SYSTEM, task);
  for (const model of CHAIN.slice(1)) {
    draft = await gen(model, IMPROVE_SYSTEM, `Task:\n${task}\n\nCurrent draft to improve:\n${draft}`);
  }
  return draft;
}

// seeded shuffle so labelling is stable across re-runs of the same data
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

type Entry = { arm: string; text: string };
type PromptData = { id: string; prompt: string; options: Array<{ label: string; arm: string; text: string }> };

function buildHtml(data: PromptData[]): string {
  const json = JSON.stringify(data).replace(/<\//g, "<\\/");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MAGI — Blind Deliverable Judging</title>
<style>
  :root { --bg:#0d0f12; --panel:#15181d; --panel2:#1b1f26; --border:#2a2f38; --text:#e7eaee; --muted:#9aa3af; --accent:#ff5b41; --good:#34d399; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
  header { position:sticky; top:0; z-index:10; background:linear-gradient(180deg,#0d0f12,rgba(13,15,18,.92)); border-bottom:1px solid var(--border); padding:14px 22px; display:flex; align-items:center; gap:16px; }
  header h1 { font-size:15px; letter-spacing:.18em; text-transform:uppercase; margin:0; color:var(--accent); }
  header .sub { color:var(--muted); font-size:13px; }
  header .spacer { flex:1; }
  button { font:inherit; cursor:pointer; border-radius:8px; border:1px solid var(--border); background:var(--panel2); color:var(--text); padding:8px 14px; }
  button:hover { border-color:#3a414d; }
  .reveal-btn { background:var(--accent); border-color:var(--accent); color:#111; font-weight:600; }
  main { max-width:1100px; margin:0 auto; padding:26px 22px 120px; }
  .prompt { margin:34px 0 14px; }
  .prompt .tag { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
  .prompt .q { background:var(--panel); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:8px; padding:14px 16px; margin-top:8px; }
  .cards { display:grid; grid-template-columns:1fr; gap:16px; margin-top:16px; }
  @media(min-width:980px){ .cards{ grid-template-columns:repeat(3,1fr); } }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden; transition:border-color .15s; }
  .card.picked { border-color:var(--good); box-shadow:0 0 0 1px var(--good) inset; }
  .card .chead { display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid var(--border); background:var(--panel2); }
  .card .chead .opt { font-weight:700; letter-spacing:.05em; }
  .card .chead .arm { display:none; font-size:11px; padding:2px 8px; border-radius:999px; background:#2a2f38; color:var(--muted); }
  .revealed .card .chead .arm { display:inline-block; }
  .card .body { padding:14px 16px; font-size:14.5px; max-height:520px; overflow:auto; }
  .card .body h1,.card .body h2,.card .body h3 { line-height:1.3; margin:.8em 0 .35em; }
  .card .body h1{font-size:1.25em} .card .body h2{font-size:1.12em} .card .body h3{font-size:1.02em}
  .card .body code { background:#0a0c0f; padding:.1em .35em; border-radius:4px; font-size:.9em; }
  .card .body pre { background:#0a0c0f; padding:12px; border-radius:8px; overflow:auto; }
  .card .body ul,.card .body ol { padding-left:1.3em; }
  .card .pick { margin:auto 0 0; padding:12px 14px; border-top:1px solid var(--border); }
  .card .pick button { width:100%; }
  .card.picked .pick button { background:var(--good); border-color:var(--good); color:#062; font-weight:700; }
  .summary { display:none; margin:30px 0; padding:18px 20px; background:var(--panel); border:1px solid var(--border); border-radius:10px; }
  .revealed .summary { display:block; }
  .summary table { border-collapse:collapse; width:100%; margin-top:10px; }
  .summary td,.summary th { text-align:left; padding:6px 10px; border-bottom:1px solid var(--border); }
  .note { color:var(--muted); font-size:13px; margin-top:6px; }
</style>
</head>
<body>
<header>
  <h1>MAGI</h1>
  <span class="sub">Blind deliverable judging — pick the best of each three. You won't see which is which until you reveal.</span>
  <span class="spacer"></span>
  <button class="reveal-btn" id="revealBtn">Reveal results</button>
</header>
<main id="app"></main>
<script>
const DATA = ${json};
const picks = {}; // id -> chosen label

function md(src){
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines = src.split(/\\r?\\n/);
  let out=[], inUl=false, inOl=false, inCode=false;
  const closeLists=()=>{ if(inUl){out.push('</ul>');inUl=false;} if(inOl){out.push('</ol>');inOl=false;} };
  const inline = t => esc(t)
    .replace(/\`([^\`]+)\`/g,'<code>$1</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')
    .replace(/(^|[^*])\\*([^*]+)\\*/g,'$1<em>$2</em>');
  for(let raw of lines){
    if(/^\`\`\`/.test(raw.trim())){ if(inCode){out.push('</pre>');inCode=false;} else {closeLists();out.push('<pre>');inCode=true;} continue; }
    if(inCode){ out.push(esc(raw)); continue; }
    const line=raw.trim();
    if(!line){ closeLists(); continue; }
    let m;
    if(m=line.match(/^(#{1,4})\\s+(.*)/)){ closeLists(); const n=m[1].length; out.push('<h'+n+'>'+inline(m[2])+'</h'+n+'>'); continue; }
    if(m=line.match(/^[-*+]\\s+(.*)/)){ if(!inUl){closeLists();out.push('<ul>');inUl=true;} out.push('<li>'+inline(m[1])+'</li>'); continue; }
    if(m=line.match(/^\\d+[.)]\\s+(.*)/)){ if(!inOl){closeLists();out.push('<ol>');inOl=true;} out.push('<li>'+inline(m[1])+'</li>'); continue; }
    closeLists(); out.push('<p>'+inline(line)+'</p>');
  }
  closeLists(); if(inCode) out.push('</pre>');
  return out.join('\\n');
}

function render(){
  const app=document.getElementById('app');
  app.innerHTML='';
  DATA.forEach((d,idx)=>{
    const sec=document.createElement('section');
    const cards=d.options.map(o=>\`
      <div class="card" data-id="\${d.id}" data-label="\${o.label}">
        <div class="chead"><span class="opt">Option \${o.label}</span><span class="arm">\${o.arm}</span></div>
        <div class="body">\${md(o.text)}</div>
        <div class="pick"><button data-id="\${d.id}" data-label="\${o.label}">Pick as best</button></div>
      </div>\`).join('');
    sec.innerHTML=\`
      <div class="prompt"><div class="tag">Task \${idx+1} of \${DATA.length}</div>
        <div class="q">\${md(d.prompt)}</div></div>
      <div class="cards">\${cards}</div>\`;
    app.appendChild(sec);
  });
  const sum=document.createElement('div'); sum.className='summary'; sum.id='summary'; app.appendChild(sum);

  app.querySelectorAll('.pick button').forEach(b=>{
    b.addEventListener('click',()=>{
      const {id,label}=b.dataset; picks[id]=label;
      app.querySelectorAll('.card[data-id="'+id+'"]').forEach(c=>{
        c.classList.toggle('picked', c.dataset.label===label);
      });
    });
  });
}

document.getElementById('revealBtn').addEventListener('click',()=>{
  document.body.classList.add('revealed');
  const tally={}; let answered=0;
  DATA.forEach(d=>{
    const lbl=picks[d.id]; if(!lbl) return; answered++;
    const arm=d.options.find(o=>o.label===lbl).arm;
    tally[arm]=(tally[arm]||0)+1;
  });
  const rows=Object.entries(tally).sort((a,b)=>b[1]-a[1])
    .map(([arm,n])=>'<tr><td>'+arm+'</td><td>'+n+' / '+answered+'</td></tr>').join('')
    || '<tr><td colspan=2>No picks yet.</td></tr>';
  document.getElementById('summary').innerHTML=
    '<h2>Your blind picks</h2><div class="note">Each card now shows which model produced it.</div>'+
    '<table><tr><th>Arm</th><th>Times you picked it best</th></tr>'+rows+'</table>'+
    '<div class="note" style="margin-top:10px">arms: <b>chain</b> = 3 cheap models building on each other &nbsp;·&nbsp; <b>single-cheap</b> = one cheap model alone &nbsp;·&nbsp; <b>sonnet</b> = single Claude Sonnet</div>';
  document.getElementById('summary').scrollIntoView({behavior:'smooth'});
});

render();
</script>
</body>
</html>`;
}

async function main() {
  const prompts = (
    JSON.parse(readFileSync(join(process.cwd(), "benchmark", "prompts-subjective.json"), "utf8")) as {
      prompts: Array<{ id: string; prompt: string }>;
    }
  ).prompts;

  const OUT = join(process.cwd(), "benchmark", "out");
  mkdirSync(OUT, { recursive: true });

  const data: PromptData[] = [];
  const key: Record<string, Record<string, string>> = {};

  for (const p of prompts) {
    console.log(`\n=== ${p.id} ===`);
    const [cheap, sonnet, chain] = await Promise.all([
      singleAnswer(SINGLE_CHEAP, p.prompt).then((t) => (console.log("  single-cheap done"), t)),
      singleAnswer(SONNET, p.prompt).then((t) => (console.log("  sonnet done"), t)),
      chainAnswer(p.prompt).then((t) => (console.log("  chain done"), t)),
    ]);
    const entries: Entry[] = [
      { arm: "single-cheap", text: cheap },
      { arm: "sonnet", text: sonnet },
      { arm: "chain", text: chain },
    ];
    const shuffled = shuffle(entries, p.id);
    const options = shuffled.map((e, i) => ({ label: String(i + 1), arm: e.arm, text: e.text }));
    data.push({ id: p.id, prompt: p.prompt, options });
    key[p.id] = Object.fromEntries(options.map((o) => [o.label, o.arm]));
  }

  writeFileSync(join(OUT, "subjective-key.json"), JSON.stringify(key, null, 2));
  writeFileSync(join(OUT, "judge.html"), buildHtml(data));
  console.log(`\nDone. Open: benchmark/out/judge.html`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
