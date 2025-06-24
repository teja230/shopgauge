import React from 'react';
import Avatar from '@mui/material/Avatar';
import GroupIcon from '@mui/icons-material/Group';

export interface Competitor {
  name: string;
  website: string;
  status: 'active' | 'inactive';
  lastChecked: string;
  metrics?: {
    revenue?: number;
    products?: number;
    traffic?: number;
  };
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
          <th className="px-4 py-2 text-left">Status</th>
          <th className="px-4 py-2 text-left">Revenue</th>
          <th className="px-4 py-2 text-left">Products</th>
          <th className="px-4 py-2 text-left">Traffic</th>
          <th className="px-4 py-2 text-left">Last Checked</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.name} className="border-t">
            <td className="px-4 py-2 break-all max-w-xs flex items-center gap-2">
              <Avatar sx={{ bgcolor: '#e0e7ff', color: '#3730a3', width: 32, height: 32, fontSize: 18 }}>
                <GroupIcon fontSize="small" />
              </Avatar>
              <div className="min-w-0 flex-1">
                {row.name && (
                  <div className="font-medium text-gray-900 truncate">{row.name}</div>
                )}
                <div className="text-gray-500 text-xs truncate">{row.website}</div>
              </div>
            </td>
            <td className="px-4 py-2">
              <span className={`px-2 py-1 rounded-full text-xs ${
                row.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {row.status}
              </span>
            </td>
            <td className="px-4 py-2">
              {row.metrics?.revenue ? `$${row.metrics.revenue.toLocaleString()}` : 'N/A'}
            </td>
            <td className="px-4 py-2">
              {row.metrics?.products ? row.metrics.products.toLocaleString() : 'N/A'}
            </td>
            <td className="px-4 py-2">
              {row.metrics?.traffic ? row.metrics.traffic.toLocaleString() : 'N/A'}
            </td>
            <td className="px-4 py-2">{row.lastChecked}</td>
            <td className="px-4 py-2">
              <button onClick={() => onDelete(row.name)} className="text-red-500 hover:underline">Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
