import React from 'react';
import Avatar from '@mui/material/Avatar';
import GroupIcon from '@mui/icons-material/Group';

export interface Competitor {
  id: string;
  url: string;
  label: string;
  price: number;
  inStock: boolean;
  percentDiff: number;
  lastChecked: string;
}

interface CompetitorTableProps {
  data: Competitor[];
  onDelete: (id: string) => void;
}

export const CompetitorTable: React.FC<CompetitorTableProps> = ({ data = [], onDelete }) => (
  <div className="overflow-x-auto w-full">
    <table className="min-w-full bg-white rounded shadow text-sm">
      <thead>
        <tr className="bg-gray-50">
          <th className="px-4 py-3 text-left font-medium text-gray-600">Competitor</th>
          <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
          <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
          <th className="px-4 py-3 text-left font-medium text-gray-600">Change</th>
          <th className="px-4 py-3 text-left font-medium text-gray-600">Last Checked</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id} className="border-t hover:bg-gray-50 transition-colors">
            <td className="px-4 py-3 break-all max-w-xs flex items-center gap-3">
              <Avatar sx={{ bgcolor: '#e0e7ff', color: '#3730a3', width: 32, height: 32, fontSize: 18 }}>
                <GroupIcon fontSize="small" />
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">{row.label}</div>
                <div className="text-gray-500 text-xs truncate">{row.url}</div>
              </div>
            </td>
            <td className="px-4 py-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                row.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {row.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </td>
            <td className="px-4 py-3 font-medium">
              {row.price > 0 ? `$${row.price.toFixed(2)}` : 'N/A'}
            </td>
            <td className="px-4 py-3">
              {row.percentDiff !== 0 && (
                <span className={`text-xs font-medium ${
                  row.percentDiff > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {row.percentDiff > 0 ? '+' : ''}{row.percentDiff.toFixed(1)}%
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">{row.lastChecked}</td>
            <td className="px-4 py-3">
              <button 
                onClick={() => onDelete(row.id)} 
                className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
