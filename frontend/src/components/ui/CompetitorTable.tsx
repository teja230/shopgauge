import React from 'react';

export interface Competitor {
  id: string;
  url: string;
  price: number;
  inStock: boolean;
  percentDiff: number;
  lastChecked: string;
}

interface CompetitorTableProps {
  data: Competitor[];
  onDelete: (id: string) => void;
}

export const CompetitorTable: React.FC<CompetitorTableProps> = ({ data, onDelete }) => (
  <div className="overflow-x-auto w-full">
    <table className="min-w-full bg-white rounded shadow text-sm">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left">URL</th>
          <th className="px-4 py-2 text-left">Price</th>
          <th className="px-4 py-2 text-left">% Diff</th>
          <th className="px-4 py-2 text-left">In Stock</th>
          <th className="px-4 py-2 text-left">Last Checked</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id} className="border-t">
            <td className="px-4 py-2 break-all max-w-xs">{row.url}</td>
            <td className="px-4 py-2">${row.price.toFixed(2)}</td>
            <td className={`px-4 py-2 ${row.percentDiff < 0 ? 'text-red-600' : 'text-green-600'}`}>{row.percentDiff.toFixed(1)}%</td>
            <td className="px-4 py-2">{row.inStock ? 'Yes' : 'No'}</td>
            <td className="px-4 py-2">{row.lastChecked}</td>
            <td className="px-4 py-2">
              <button onClick={() => onDelete(row.id)} className="text-red-500 hover:underline">Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
