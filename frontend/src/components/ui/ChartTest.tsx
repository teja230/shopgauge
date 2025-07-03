import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Simple test data
const testData = [
  { date: '2024-01-01', revenue: 1000 },
  { date: '2024-01-02', revenue: 1200 },
  { date: '2024-01-03', revenue: 800 },
  { date: '2024-01-04', revenue: 1500 },
  { date: '2024-01-05', revenue: 1100 },
];

const ChartTest: React.FC = () => {
  console.log('🧪 ChartTest rendering with data:', testData);
  
  return (
    <div style={{ width: '100%', height: '400px', border: '1px solid #ccc', padding: '20px' }}>
      <h2>Chart Test Component</h2>
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={testData}>
            <defs>
              <linearGradient id="testGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#2563eb"
              fill="url(#testGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartTest; 