import { ReactNode } from 'react';
import clsx from 'clsx';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  empty = 'No records found.',
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={clsx('px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap', col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className={clsx('px-4 py-3 align-middle', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
