
function riskClass(score){
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
function summarize(state){
  const regions = state.regions || [];
  const sources = state.dataSources || [];
  const counts = regions.reduce((a,r)=>{ a[r.risk]=(a[r.risk]||0)+1; return a; }, {high:0,medium:0,low:0});
  const avgRisk = regions.length ? Math.round(regions.reduce((s,r)=>s+Number(r.score||0),0)/regions.length) : 0;
  const criticalSources = sources.filter(s=>['lmp','queue','gis','load'].includes(s.category));
  const topRegions = regions.slice().sort((a,b)=>b.score-a.score).slice(0,3);
  return { counts, avgRisk, criticalSourceCount: criticalSources.length, topRegions, dataSourceCount: sources.length, layerCount: (state.layers||[]).length };
}
function filterSources(state, category){
  if (!category || category === 'all') return state.dataSources || [];
  return (state.dataSources || []).filter(s => s.category === category);
}
module.exports = { riskClass, summarize, filterSources };
