// run-043.js
require('dotenv').config();
const postgres = require('postgres');

console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.slice(0, 20));

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

const stmts = [
 "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_rating SMALLINT CHECK (rider_rating BETWEEN 1 AND 5)",
 "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_rated_at TIMESTAMPTZ",
 "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_rating_note TEXT",
 "ALTER TABLE rider_profiles ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0",
 "ALTER TABLE rider_profiles ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0",
 "CREATE TABLE IF NOT EXISTS zones (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, service_areas TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())",
 "ALTER TABLE fleet_operators ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) DEFAULT 0.15",
 "ALTER TABLE rider_profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4)"
];

(async () => {
 try {
   for (let i = 0; i < stmts.length; i++) {
     const s = stmts[i];
     try { 
       const result = await sql.unsafe(s);
       console.log(`[${i+1}/8] ✓ OK: ${s.slice(0,70)}`);
     }
     catch(e) { 
       console.error(`[${i+1}/8] ✗ FAIL: ${s.slice(0,70)}`);
       console.error('       Error:', e.message || JSON.stringify(e));
     }
   }
 } finally {
   await sql.end();
   process.exit(0);
 }
})();

