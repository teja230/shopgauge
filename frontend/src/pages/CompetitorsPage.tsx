import React, { useEffect, useState } from 'react';
import { CompetitorTable } from '../components/ui/CompetitorTable';
import type { Competitor } from '../components/ui/CompetitorTable';
import { getCompetitors, addCompetitor, deleteCompetitor } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [url, setUrl] = useState('');
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const competitorsData = await getCompetitors();
        setCompetitors(competitorsData);
      } catch (e) {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
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
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <Toaster position="top-right" />
      <nav className="w-full max-w-3xl flex justify-between items-center mb-6">
        <Link to="/" className="text-blue-700 font-bold text-lg hover:underline">StoreSight</Link>
        <div className="space-x-4">
          <Link to="/dashboard" className="text-blue-700 font-semibold hover:underline">Dashboard</Link>
          <Link to="/competitors" className="text-blue-700 font-semibold hover:underline">Competitors</Link>
        </div>
      </nav>
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Competitor Price Watcher</h1>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            placeholder="Competitor URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
            required
          />
          <input
            type="text"
            placeholder="Product ID"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
            required
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Add
          </button>
        </form>
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
          </div>
        ) : competitors.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No competitors added yet. Start by adding a competitor URL above.</div>
        ) : (
          <CompetitorTable data={competitors} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
