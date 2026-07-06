
const assert = require('assert');
const { gradeConnector, summarizeEiaRows, eiaRegionUrl } = require('../src/live_sources');
assert.strictEqual(gradeConnector({ok:true}), 'live');
assert.strictEqual(gradeConnector({ok:false,error:'timeout'}), 'timeout');
assert.strictEqual(gradeConnector({credentialNeeded:true}), 'credential');
assert.strictEqual(gradeConnector({ok:false,error:'x'}), 'error');
const sample = { response: { data: [{period:'2026-07-06T00', type:'D', value:'12345', 'value-units':'megawatthours'}] } };
const s = summarizeEiaRows(sample);
assert.strictEqual(s.rows, 1);
assert.strictEqual(s.latestPeriod, '2026-07-06T00');
assert.strictEqual(s.value, 12345);
assert(eiaRegionUrl('PJM').includes('respondent'));
console.log('live source tests passed');
