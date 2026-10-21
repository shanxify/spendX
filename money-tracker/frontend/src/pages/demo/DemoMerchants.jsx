import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../../components/Layout/TopNav';
import MerchantMapper from '../../components/Categories/MerchantMapper';
import SearchBar from '../../components/Transactions/SearchBar';
import { useDemo } from '../../context/DemoContext';

const DemoMerchants = () => {
  const { merchants, categories, updateMerchantCategory, bulkUpdateMerchants } = useDemo();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(false);

  const filteredMerchants = useMemo(() => {
    let list = merchants || [];
    if (showUncategorizedOnly) {
      list = list.filter(m => m.category === 'Uncategorized');
    }
    if (search) {
      const query = search.toLowerCase();
      list = list.filter(m => 
        (m.display || '').toLowerCase().includes(query) ||
        (m.normalized || '').toLowerCase().includes(query)
      );
    }
    return list;
  }, [merchants, showUncategorizedOnly, search]);

  const uncatCount = useMemo(() => {
    return (merchants || []).filter(m => m.category === 'Uncategorized').length;
  }, [merchants]);

  if (!merchants || merchants.length === 0) {
    return (
      <div className="min-h-full bg-primary-bg pb-10">
        <TopNav 
          title="Merchant Mapping"
          meta="Manage merchant categories"
        />
        <div className="px-6 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
            <span className="text-3xl">🏪</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No transactions loaded</h3>
          <p className="text-gray-400 max-w-sm mb-6">
            Go back to Upload first and import a statement PDF to start mapping merchants.
          </p>
          <button 
            onClick={() => navigate('/guest/upload')}
            className="btn-primary bg-[#6c63ff] hover:bg-[#5b54e0]"
          >
            Go to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-primary-bg pb-10 flex flex-col">
      <TopNav 
        title="Merchant Mapping"
        meta="Map merchants to categories for automatic categorization"
        actions={
          <button 
            onClick={() => navigate('/guest/dashboard')}
            className="btn-primary bg-[#6c63ff] hover:bg-[#5b54e0] font-medium text-sm flex items-center gap-2 py-2 px-4 shadow-[0_0_15px_rgba(108,99,255,0.25)]"
          >
            Continue to Dashboard →
          </button>
        }
      />
      
      <div className="px-6 lg:px-10 py-6 max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col animate-in fade-in duration-300">
        
        {/* Info Banner */}
        <div className="glass-panel p-4 flex gap-3 items-start border border-accent/20 bg-[#6C63FF]/5 rounded-2xl">
          <span className="text-lg">💡</span>
          <div>
            <h4 className="text-sm font-bold text-white mb-0.5">Sample Merchant Mapping (Guest Mode)</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              SpendX groups identical UPI merchant transactions together for quick categorization. In Guest Mode, changes reflect in-memory. Log in to save permanent rules.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#0c0c14] border border-white/10 p-4 rounded-2xl shadow-md">
          <SearchBar value={search} onChange={setSearch} />
          
          <button 
            onClick={() => setShowUncategorizedOnly(prev => !prev)}
            className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all ${
              showUncategorizedOnly 
                ? 'bg-warning/10 border-warning text-warning' 
                : 'bg-secondary-bg border-border text-text-muted hover:border-text-muted hover:text-text-primary'
            }`}
          >
            {showUncategorizedOnly ? 'Showing Uncategorized' : `🔴 ${uncatCount > 0 ? uncatCount : 'No'} Uncategorized`}
          </button>
        </div>

        <MerchantMapper 
          merchants={filteredMerchants}
          categories={categories}
          onUpdateCategory={updateMerchantCategory}
          onBulkUpdate={bulkUpdateMerchants}
          filters={{ search, uncategorized: showUncategorizedOnly }}
        />
      </div>
    </div>
  );
};

export default DemoMerchants;
