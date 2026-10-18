import React from 'react';
import { LoadingSkeleton } from './StateViews';

export interface DataTableColumn {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'right';
  /** Renders the cell in tabular mono (values, IDs, scores). */
  mono?: boolean;
  className?: string;
}

interface DataTableProps {
  columns: DataTableColumn[];
  rows: React.ReactNode[][];
  loading?: boolean;
  /** EmptyState (or any node) rendered when `rows` is empty. */
  empty?: React.ReactNode;
  dense?: boolean;
  className?: string;
}

/**
 * DataTable — one table look for every register/list/comparison.
 * Numeric columns are right-aligned and tabular; headers are 12px muted.
 */
export const DataTable: React.FC<DataTableProps> = ({
  columns,
  rows,
  loading = false,
  empty,
  dense = false,
  className = '',
}) => {
  if (loading) return <LoadingSkeleton rows={4} className={className} />;
  if (rows.length === 0 && empty) return <>{empty}</>;

  const cellPadding = dense ? 'py-1.5' : 'py-2';

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="border-b border-eco-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-2 text-left text-meta font-medium text-eco-muted ${cellPadding} ${
                  column.align === 'right' ? 'text-right' : ''
                } ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-eco-border/60 last:border-b-0">
              {row.map((cell, cellIndex) => {
                const column = columns[cellIndex];
                return (
                  <td
                    key={column?.key ?? cellIndex}
                    className={`px-2 align-middle ${cellPadding} ${
                      column?.align === 'right' ? 'text-right' : ''
                    } ${column?.mono ? 'font-mono text-data tabular-nums' : ''} ${column?.className ?? ''}`}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
