
const http = require('http');
const fs = require('fs');
const path = require('path');
const { summarize } = require('./src/insights');
const { getLiveSources } = require('./src/live_sources');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8837);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const STATE = path.join(ROOT, 'data', 'state.json');
function readState(){
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  state.insights = summarize(state);
  return state;
}
function send(res, code, body, type='application/json; charset=utf-8'){
  res.writeHead(code, {'content-type': type, 'cache-control':'no-store'});
  res.end(body);
}
function safeJoin(base, urlPath){
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(base, p));
  if (!file.startsWith(base)) return null;
  return file;
}
function toMarkdown(state){
  const lines=[];
  lines.push(`# ${state.meta.title}`,'',`As-of: ${state.meta.asOf}`,'',`> ${state.thesis}`,'');
  lines.push('## 区域风险排行');
  for (const r of state.regions.slice().sort((a,b)=>b.score-a.score)) lines.push(`- **${r.name}** (${r.risk}, ${r.score}/100): ${r.why} 下一步：${r.next}`);
  lines.push('', '## 数据源目录');
  for (const s of state.dataSources) lines.push(`- **${s.name}** / ${s.owner} / ${s.category}: ${s.fields}. 用途：${s.use}. URL: ${s.url}`);
  lines.push('', '## 自动化模块');
  for (const m of (state.automationPlan || [])) lines.push(`- **${m.module}** (${m.status}): ${m.endpoint} → ${m.output}`);
  return lines.join('\n');
}
const server = http.createServer((req,res)=>{
  try{
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/health') return send(res,200,JSON.stringify({ok:true, service:'us-power-grid-dashboard', time:new Date().toISOString(), port:PORT}));
    if (url.pathname === '/api/state') return send(res,200,JSON.stringify(readState()));
    if (url.pathname === '/api/live') return getLiveSources().then(live => send(res,200,JSON.stringify(live))).catch(e => send(res,500,JSON.stringify({ok:false,error:e.message})));
    if (url.pathname === '/api/export/markdown') return send(res,200,toMarkdown(readState()),'text/markdown; charset=utf-8');
    const file = safeJoin(PUBLIC, url.pathname);
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res,404,'not found','text/plain; charset=utf-8');
    const ext = path.extname(file).toLowerCase();
    const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
    send(res,200,fs.readFileSync(file),types[ext] || 'application/octet-stream');
  }catch(e){ send(res,500,JSON.stringify({ok:false,error:e.message})); }
});
server.listen(PORT, HOST, ()=> console.log(`us-power-grid-dashboard listening on ${HOST}:${PORT}`));
