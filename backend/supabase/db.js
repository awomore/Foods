const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : 'prefer',
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

/**
 * Helper: run a query and return the first row (or null).
 */
async function queryOne(query, params = []) {
  const rows = await sql.unsafe(query, params);
  return rows[0] || null;
}

/**
 * Helper: insert a row and return it.
 * @param {string} table - table name
 * @param {object} data - { column: value } pairs
 * @returns the inserted row
 */
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');

  const rows = await sql.unsafe(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return rows[0];
}

/**
 * Helper: update rows and return them.
 * @param {string} table
 * @param {object} data - fields to update
 * @param {object} where - { column: value } conditions (AND-ed)
 */
async function update(table, data, where) {
  const dataKeys = Object.keys(data);
  const whereKeys = Object.keys(where);
  const allValues = [...Object.values(data), ...Object.values(where)];

  const setClause = dataKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const whereClause = whereKeys.map((k, i) => `${k} = $${dataKeys.length + i + 1}`).join(' AND ');

  const rows = await sql.unsafe(
    `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`,
    allValues
  );
  return rows;
}

/**
 * Helper: select rows with simple AND conditions.
 */
async function select(table, where = {}, options = {}) {
  const keys = Object.keys(where);
  const values = Object.values(where);
  const whereClause = keys.length
    ? 'WHERE ' + keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ')
    : '';
  const orderBy = options.orderBy ? `ORDER BY ${options.orderBy}` : '';
  const limit = options.limit ? `LIMIT ${options.limit}` : '';

  return await sql.unsafe(
    `SELECT * FROM ${table} ${whereClause} ${orderBy} ${limit}`,
    values
  );
}

module.exports = { sql, queryOne, insert, update, select };
