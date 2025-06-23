import React from 'react';
import Avatar from '@mui/material/Avatar';
import GroupIcon from '@mui/icons-material/Group';

export interface Competitor {
  id: string;
  url: string;
  price: number;
  inStock: boolean;
  percentDiff: number;
  lastChecked: string;
  name?: string;
  image?: string;
}

interface CompetitorTableProps {
  data: Competitor[];
  onDelete: (id: string) => void;
}

export const CompetitorTable: React.FC<CompetitorTableProps> = ({ data = [], onDelete }) => (
  <div className="overflow-x-auto w-full">
    <table className="min-w-full bg-white rounded shadow text-sm">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left">Competitor</th>
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
            <td className="px-4 py-2 break-all max-w-xs flex items-center gap-2">
              <Avatar sx={{ bgcolor: '#e0e7ff', color: '#3730a3', width: 32, height: 32, fontSize: 18 }}>
                <GroupIcon fontSize="small" />
              </Avatar>
              <div className="min-w-0 flex-1">
                {row.name && (
                  <div className="font-medium text-gray-900 truncate">{row.name}</div>
                )}
                <div className="text-gray-500 text-xs truncate">{row.url}</div>
              </div>
            </td>
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
