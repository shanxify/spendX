import React, { useState, useMemo } from 'react';
import TopNav from '../../components/Layout/TopNav';
import TransactionTable from '../../components/Transactions/TransactionTable';
import SearchBar from '../../components/Transactions/SearchBar';
import { useDemo } from '../../context/DemoContext';
import { Trash2, Lock, Filter } from 'lucide-react';

const GuestTransactions = () => {
  const { transactions, categories, promptLogin } = useDemo();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter((tx) => {
      const matchesSearch =
        !searchTerm ||
        (tx.merchant && tx.merchant.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.category && tx.category.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        !selectedCategory ||
        selectedCategory === 'All Categories' ||
        tx.category === selectedCategory;

      const matchesType =
        !selectedType ||
        selectedType === 'All Types' ||
        tx.type === selectedType;

      return matchesSearch && matchesCat && matchesType;
    });
  }, [transactions, searchTerm, selectedCategory, selectedType]);

  const handleDelete = () => {
    promptLogin('Delete Transaction');
  };

  const handleUpdateCategory = () => {
    promptLogin('Modify Transaction Category');
  };

  const handleClearAll = () => {
    promptLogin('Clear Transactions');
  };

  return (
    <div className="min-h-full bg-primary-bg pb-12 flex flex-col">
      <TopNav
        title="Transactions"
        meta="Explore sample transactions and filters in Guest Mode"
        actions={
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        }
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col animate-in fade-in duration-300">
        {/* Sample Data Callout Banner */}
        <div className="bg-[#12121c] border border-purple-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <h4 className="text-sm font-semibold text-white">Sample Transactions List</h4>
              <p className="text-xs text-gray-400">
                You are browsing sample transactions in Guest Mode. Filter by category, type, or search for merchants.
              </p>
            </div>
          </div>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="shrink-0 px-3.5 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-xl transition-all"
          >
            Log In for Personal Data →
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-[#0c0c14] border border-white/10 p-4 rounded-2xl shadow-md">
          <div className="w-full md:w-72">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#181824] border border-white/10 text-gray-200 text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.name}>
                  {c.icon || '🏷️'} {c.name}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-[#181824] border border-white/10 text-gray-200 text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="debit">Debit (Expense)</option>
              <option value="credit">Credit (Income)</option>
            </select>
          </div>
        </div>

        {/* Transaction Table */}
        <TransactionTable
          transactions={filteredTransactions}
          categories={categories}
          onUpdateCategory={handleUpdateCategory}
          onDelete={handleDelete}
          loading={false}
        />
      </div>
    </div>
  );
};

export default GuestTransactions;
