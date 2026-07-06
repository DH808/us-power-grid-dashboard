
const SOURCE_TIMEOUT_MS = Number(process.env.SOURCE_TIMEOUT_MS || 3500);
function withTimeout(ms){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), ms);
  return { signal: controller.signal, done: ()=>clearTimeout(timer) };
}
async function fetchJson(url, opts={}){
  const t = withTimeout(opts.timeoutMs || SOURCE_TIMEOUT_MS);
  const started = Date.now();
  try{
    const res = await fetch(url, { signal: t.signal, headers: { 'user-agent':'us-power-grid-dashboard/0.2' }});
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch(e) {}
    return { ok: res.ok, status: res.status, ms: Date.now()-started, bytes: text.length, json, error: res.ok ? null : text.slice(0,180) };
  } catch(e){
    return { ok:false, status:0, ms: Date.now()-started, bytes:0, json:null, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { t.done(); }
}
async function fetchHead(url, opts={}){
  const t = withTimeout(opts.timeoutMs || SOURCE_TIMEOUT_MS);
  const started = Date.now();
  try{
    const res = await fetch(url, { method:'GET', signal: t.signal, headers: { 'user-agent':'us-power-grid-dashboard/0.2' }});
    const text = await res.text();
    return { ok: res.ok, status: res.status, ms: Date.now()-started, bytes: text.length, sample: text.slice(0,140), error: res.ok ? null : text.slice(0,140) };
  } catch(e){
    return { ok:false, status:0, ms: Date.now()-started, bytes:0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { t.done(); }
}
function eiaRegionUrl(respondent){
  const q = new URLSearchParams();
  q.set('frequency','hourly');
  q.append('data[0]','value');
  q.append('facets[respondent][]', respondent);
  q.append('sort[0][column]','period');
  q.append('sort[0][direction]','desc');
  q.set('offset','0');
  q.set('length','24');
  if (process.env.EIA_API_KEY) q.set('api_key', process.env.EIA_API_KEY);
  return 'https://api.eia.gov/v2/electricity/rto/region-data/data/?' + q.toString();
}
function summarizeEiaRows(json){
  const rows = json && json.response && Array.isArray(json.response.data) ? json.response.data : [];
  const demandRows = rows.filter(r => String(r.type || r['type-name'] || '').toLowerCase().includes('demand') || String(r.type || '').toUpperCase()==='D');
  const sample = (demandRows[0] || rows[0] || null);
  return { rows: rows.length, latestPeriod: sample ? sample.period : null, value: sample ? Number(sample.value) : null, unit: sample ? (sample['value-units'] || sample.units || 'MWh') : null };
}
function gradeConnector(result){
  if (result.credentialNeeded) return 'credential';
  if (result.ok) return 'live';
  if (result.error === 'timeout') return 'timeout';
  return 'error';
}
async function getLiveSources(){
  const connectors = [
    { id:'eia_pjm_load', label:'EIA-930 PJM Load', category:'load', url:eiaRegionUrl('PJM'), parser:'eia', requiresEnv:'EIA_API_KEY' },
    { id:'eia_ercot_load', label:'EIA-930 ERCOT Load', category:'load', url:eiaRegionUrl('ERCO'), parser:'eia', requiresEnv:'EIA_API_KEY' },
    { id:'pjm_dataminer', label:'PJM Data Miner', category:'lmp', url:'https://dataminer2.pjm.com', parser:'head' },
    { id:'lbnl_queues', label:'LBNL Queued Up', category:'queue', url:'https://emp.lbl.gov/queues', parser:'head' },
    { id:'epa_egrid', label:'EPA eGRID', category:'emissions', url:'https://www.epa.gov/egrid/download-data', parser:'head' }
  ];
  const results = await Promise.all(connectors.map(async c => {
    const result = c.requiresEnv && !process.env[c.requiresEnv] ? { ok:false, status:0, ms:0, bytes:0, json:null, error:`missing ${c.requiresEnv}`, credentialNeeded:true } : (c.parser === 'eia' ? await fetchJson(c.url) : await fetchHead(c.url));
    const metric = c.parser === 'eia' && result.json ? summarizeEiaRows(result.json) : null;
    return { ...c, status: gradeConnector(result), httpStatus: result.status, ms: result.ms, bytes: result.bytes, metric, error: result.error || null };
  }));
  const summary = results.reduce((a,r)=>{ a[r.status]=(a[r.status]||0)+1; return a; }, {live:0,credential:0,timeout:0,error:0});
  return { asOf: new Date().toISOString(), summary, connectors: results };
}
module.exports = { getLiveSources, gradeConnector, summarizeEiaRows, eiaRegionUrl };
