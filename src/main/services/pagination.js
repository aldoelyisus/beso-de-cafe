'use strict';

const { getDb } = require('../db/connection');

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;

/**
 * Ejecuta una consulta paginada.
 *
 *   countSql  -> SELECT COUNT(*) AS n ...        (usa @params)
 *   rowsSql   -> SELECT ... LIMIT @limit OFFSET @offset   (usa @params + @limit + @offset)
 *
 * Devuelve { rows, total, page, pageSize, totalPages }.
 */
function paginate({ countSql, rowsSql, params = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE }) {
  const db = getDb();
  const size = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const total = db.prepare(countSql).get(params).n;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const offset = (current - 1) * size;

  const rows = db.prepare(rowsSql).all({ ...params, limit: size, offset });

  return { rows, total, page: current, pageSize: size, totalPages };
}

module.exports = { paginate, DEFAULT_PAGE_SIZE };
