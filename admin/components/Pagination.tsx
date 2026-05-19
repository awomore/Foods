'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);

  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-gray-500 mt-4">
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <div className="flex gap-1">
        <button
          disabled={page === 1}
          onClick={() => onChange(offset - limit)}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 py-1 rounded bg-gray-100 font-medium text-gray-700">
          {page}/{pages}
        </span>
        <button
          disabled={page === pages}
          onClick={() => onChange(offset + limit)}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
