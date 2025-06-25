import React from 'react';
import { useAuth } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const { shop } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Welcome to ShopGauge</h2>
        <p className="text-gray-600">
          Your store {shop} is now connected. We're analyzing your store data and will show you insights soon.
        </p>
      </div>
    </div>
  );
};

export default Dashboard; 