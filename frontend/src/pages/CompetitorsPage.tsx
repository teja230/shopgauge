import React, { useEffect, useState } from 'react';
import { CompetitorTable } from '../components/ui/CompetitorTable';
import type { Competitor } from '../components/ui/CompetitorTable';
import { getCompetitors, addCompetitor, deleteCompetitor } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function CompetitorsPage() {
  const { shop } = useAuth();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [url, setUrl] = useState('');
  const [productId, setProductId] = useState('');

  useEffect(() => {
    // Clear data if no shop (logout/disconnect)
    if (!shop) {
      setCompetitors([]);
      setUrl('');
      setProductId('');
      return;
    }

    async function fetchData() {
      try {
        const competitorsData = await getCompetitors();
        setCompetitors(competitorsData);
      } catch (e) {
        toast.error('Failed to load data');
      }
    }
    fetchData();
  }, [shop]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      setCompetitors([]);
      setUrl('');
      setProductId('');
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newComp = await addCompetitor(url, productId);
      setCompetitors((prev) => [...prev, newComp]);
      toast.success('Competitor added');
      setUrl('');
      setProductId('');
    } catch {
      toast.error('Failed to add competitor');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      toast.success('Competitor deleted');
    } catch {
      toast.error('Failed to delete competitor');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 flex flex-col items-center">
      <Toaster position="top-right" />
      <nav className="w-full max-w-3xl flex justify-between items-center mb-8 bg-white rounded-2xl shadow px-6 py-4">
        <Link to="/" className="text-blue-700 font-extrabold text-2xl tracking-tight flex items-center gap-2">
          <span className="bg-blue-600 text-white rounded-full px-2 py-1 text-lg">S</span> StoreSight
        </Link>
        <div className="space-x-4">
          <Link to="/dashboard" className="text-blue-700 font-semibold hover:underline transition-colors">Dashboard</Link>
          <Link to="/competitors" className="text-blue-700 font-semibold hover:underline transition-colors">Competitors</Link>
        </div>
      </nav>
      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-2xl shadow p-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 sm:mb-0 flex items-center gap-2">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path fill="#2563eb" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path fill="#2563eb" d="M17 12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5 5-2.24 5-5zm-8 0c0-1.65 1.35-3 3-3s3 1.35 3 3-1.35 3-3 3-3-1.35-3-3z"/></svg>
            Competitor Price Watcher
          </h1>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Competitor URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none transition"
              required
            />
            <input
              type="text"
              placeholder="Product ID"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none transition"
              required
            />
            <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
              Add
            </button>
          </form>
        </div>
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Tracked Competitors</h2>
          <CompetitorTable data={competitors} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
}

// Inside CompetitorTable component (assuming it's a custom component), update the row rendering to include Avatar/Icon
/*
{competitors.map((competitor) => (
  <TableRow key={competitor.id}>
    <TableCell>
      <Avatar sx={{ bgcolor: '#e0e7ff', color: '#3730a3', mr: 1 }}>
        <GroupIcon />
      </Avatar>
      {competitor.name || competitor.url}
    </TableCell>
    ...
  </TableRow>
))}
*/
