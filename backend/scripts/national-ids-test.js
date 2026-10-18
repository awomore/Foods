// Unit test for utils/nationalIds.js — the per-country rider ID rules.
// Usage: cd backend; node scripts/national-ids-test.js
const { validateId, publicIdTypes } = require('../utils/nationalIds');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });
const ok = (...a) => validateId(...a).ok;

check('NG: 11-digit NIN accepted', ok('NG', 'national_id', '12345678901'));
check('NG: NIN with spaces normalised', validateId('ng', 'national_id', '1234 5678 901').value === '12345678901');
check('NG: BVN refused', !ok('NG', 'bvn', '22222222222'));
check('NG: 10 digits refused', !ok('NG', 'national_id', '1234567890'));
check('NG: passport not offered (national ID only)', !ok('NG', 'passport', 'A12345678'));
check('NG: automatic check advertised', publicIdTypes('NG')[0].automatic === true);
check('GH: Ghana Card keeps its dashes', ok('GH', 'national_id', 'gha-123456789-0'));
check('GH: Ghana Card without dashes refused', !ok('GH', 'national_id', 'GHA1234567890'));
check('KE: 8-digit ID accepted', ok('KE', 'national_id', '12345678'));
check('ZA: 13-digit ID accepted', ok('ZA', 'national_id', '8001015009087'));
check('UG: NIN accepted', ok('UG', 'national_id', 'CM12345678ABCD'));
check('GB: passport accepted', ok('GB', 'passport', '123456789'));
check('GB: national_id not offered', !ok('GB', 'national_id', '123456789'));
check('DE (fallback): national ID accepted', ok('DE', 'national_id', 'T22000129'));
check('DE (fallback): passport accepted', ok('DE', 'passport', 'C01X00T47'));
check('DE (fallback): manual review, not automatic', publicIdTypes('DE').every(t => !t.automatic));
check('bad country code refused', !ok('Nigeria', 'national_id', '12345678901'));
check('empty value refused', !ok('KE', 'national_id', ''));
check('public types carry no regex', !JSON.stringify(publicIdTypes('NG')).includes('pattern'));

console.log('\n──── NATIONAL ID RULES TEST ────');
for (const r of results) console.log(`${r.ok.padEnd(5)} ${r.name}`);
const fails = results.filter(r => r.ok === 'FAIL').length;
console.log(`\n${results.length} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
