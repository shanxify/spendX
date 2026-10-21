import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Activity, Hash, Mail } from 'lucide-react';
import TopNav from '../../components/Layout/TopNav';
import StatCard from '../../components/Dashboard/StatCard';
import CategoryBreakdown from '../../components/Dashboard/CategoryBreakdown';
import MonthlySummary from '../../components/Dashboard/MonthlySummary';
import InsightsSection from '../../components/Dashboard/InsightsSection';
import SpendingPieChart from '../../components/Charts/SpendingPieChart';
import MonthlyBarChart from '../../components/Charts/MonthlyBarChart';
import BorderGlow from '../../components/BorderGlow';
import GlareHover from '../../components/GlareHover';
import { useDemo } from '../../context/DemoContext';

const DemoDashboard = () => {
  const { transactions, categories } = useDemo();
  const navigate = useNavigate();

  const [breakdownType, setBreakdownType] = useState('expenses'); // 'expenses' or 'income'
  const [openingBalance, setOpeningBalance] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("openingBalance");
    if (saved !== null) {
      setOpeningBalance(Number(saved));
      setInputValue(saved);
    }
  }, []);

  const stats = useMemo(() => {
    const debits = transactions.filter(t => t.type === 'debit');
    const credits = transactions.filter(t => t.type === 'credit');

    const expensesSum = debits.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const incomeSum = credits.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const net = (openingBalance || 0) + incomeSum - expensesSum;

    const totals = {
      expenses: Math.round(expensesSum * 100) / 100,
      income: Math.round(incomeSum * 100) / 100,
      net: Math.round(net * 100) / 100,
      transactionCount: transactions.length
    };

    // Category Breakdown (Expenses)
    const breakdown = {};
    debits.forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!breakdown[cat]) breakdown[cat] = { name: cat, total: 0, count: 0 };
      breakdown[cat].total += parseFloat(t.amount) || 0;
      breakdown[cat].count++;
    });

    let grandTotal = 0;
    Object.values(breakdown).forEach(c => grandTotal += c.total);

    const sortedCategories = Object.values(breakdown).sort((a, b) => b.total - a.total);
    const categoryBreakdown = sortedCategories.map((cat) => {
      const matchingCategory = categories.find(c => c.name === cat.name) || 
                               categories.find(c => c.name === 'Uncategorized');
      return {
        ...cat,
        total: Math.round(cat.total * 100) / 100,
        percentage: grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) : "0",
        color: matchingCategory?.color || '#6b7280',
        icon: matchingCategory?.icon || '📦'
      };
    });

    // Income Category Breakdown
    const incBreakdown = {};
    credits.forEach(t => {
      const merchantName = t.merchant || 'Unknown';
      if (!incBreakdown[merchantName]) incBreakdown[merchantName] = { name: merchantName, total: 0, count: 0 };
      incBreakdown[merchantName].total += parseFloat(t.amount) || 0;
      incBreakdown[merchantName].count++;
    });

    let grandTotalInc = 0;
    Object.values(incBreakdown).forEach(c => grandTotalInc += c.total);

    const sortedIncCategories = Object.values(incBreakdown).sort((a, b) => b.total - a.total);
    const incomeBreakdown = sortedIncCategories.map((cat) => {
      return {
        ...cat,
        total: Math.round(cat.total * 100) / 100,
        percentage: grandTotalInc > 0 ? ((cat.total / grandTotalInc) * 100).toFixed(1) : "0",
        color: '#10b981',
        icon: '💰'
      };
    });

    // Monthly Data
    const monthly = {};
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      if (!monthly[key]) monthly[key] = { key, label, debit: 0, credit: 0, count: 0 };
      
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'debit') monthly[key].debit += amt;
      else monthly[key].credit += amt;
      monthly[key].count++;
    });

    const monthlyData = Object.values(monthly)
      .map(m => ({
        ...m,
        debit: Math.round(m.debit * 100) / 100,
        credit: Math.round(m.credit * 100) / 100
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);

    // Top Merchants
    const merchantMap = {};
    debits.forEach(t => {
      const key = t.normalized || t.merchant;
      if (!merchantMap[key]) merchantMap[key] = { display: t.merchant, category: t.category, total: 0, count: 0 };
      merchantMap[key].total += parseFloat(t.amount) || 0;
      merchantMap[key].count++;
    });

    const sortedMerchants = Object.values(merchantMap)
      .map(m => ({ ...m, total: Math.round(m.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    const topMerchantBySpend = sortedMerchants.length > 0
      ? { display: sortedMerchants[0].display, total: sortedMerchants[0].total }
      : null;

    const mostFrequentMerchant = sortedMerchants.length > 0
      ? [...sortedMerchants].sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return b.total - a.total;
        })[0]
      : null;

    const biggestExpenseItem = debits.length > 0
      ? debits.reduce((max, t) => parseFloat(t.amount) > parseFloat(max.amount) ? t : max, debits[0])
      : null;

    const biggestExpense = biggestExpenseItem
      ? { merchant: biggestExpenseItem.merchant, amount: parseFloat(biggestExpenseItem.amount), date: biggestExpenseItem.date }
      : null;

    const avgTransaction = totals.transactionCount > 0
      ? parseFloat((totals.expenses / totals.transactionCount).toFixed(2))
      : 0;

    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    return { 
      totals, 
      categoryBreakdown, 
      incomeBreakdown, 
      monthlyData, 
      recentTransactions, 
      topMerchantBySpend, 
      mostFrequentMerchant, 
      biggestExpense, 
      avgTransaction 
    };
  }, [transactions, categories, openingBalance]);

  if (!transactions || transactions.length === 0) {
    return (
      <div className="min-h-full bg-primary-bg pb-10">
        <TopNav 
          title="Dashboard"
          meta="Your financial highlights at a glance"
        />
        <div className="px-6 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#6C63FF]/10 flex items-center justify-center mb-6">
            <span className="text-3xl">📊</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No data yet</h3>
          <p className="text-gray-400 max-w-sm mb-6">
            Upload a statement PDF to see your financial analytics.
          </p>
          <button 
            onClick={() => navigate('/guest/upload')}
            className="btn-primary bg-[#6c63ff] hover:bg-[#5b54e0]"
          >
            Upload Statement
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-primary-bg pb-10">
      <TopNav 
        title="Dashboard"
        meta={`Last updated: ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`}
      />
      
      <div className="px-6 lg:px-10 py-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Sample Data Disclaimer Banner */}
        <div className="bg-[#12121c] border border-purple-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <h4 className="text-sm font-semibold text-white">Sample Financial Analytics (Guest Mode)</h4>
              <p className="text-xs text-gray-400">
                You are viewing sample UPI data. Sign in to upload your real statements and access your personal dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="shrink-0 px-3.5 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-xl transition-all"
          >
            Log In for Full Access →
          </button>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <BorderGlow
            className="h-[140px] w-full"
            edgeSensitivity={30}
            glowColor="270 80 70"
            backgroundColor="#0c0c14"
            borderRadius={20}
            glowRadius={30}
            glowIntensity={0.6}
            coneSpread={20}
            animated={false}
            colors={['#7c3aed']}
          >
            <GlareHover
              className="rounded-[20px]"
              width="100%"
              height="100%"
              background="transparent"
              borderColor="transparent"
              glareColor="#ffffff"
              glareOpacity={0.1}
              glareSize={200}
              transitionDuration={500}
            >
              <div className="p-5 h-full">
                <StatCard 
                  title="Total Expenses" 
                  amount={stats.totals.expenses} 
                  icon={ArrowDown}
                  colorClass={{ text: 'text-danger', bg: 'bg-danger/10', bgBar: 'bg-danger/20', bgFill: 'bg-danger/60' }}
                />
              </div>
            </GlareHover>
          </BorderGlow>

          <BorderGlow
            className="h-[140px] w-full"
            edgeSensitivity={30}
            glowColor="270 80 70"
            backgroundColor="#0c0c14"
            borderRadius={20}
            glowRadius={30}
            glowIntensity={0.6}
            coneSpread={20}
            animated={false}
            colors={['#7c3aed']}
          >
            <GlareHover
              className="rounded-[20px]"
              width="100%"
              height="100%"
              background="transparent"
              borderColor="transparent"
              glareColor="#ffffff"
              glareOpacity={0.1}
              glareSize={200}
              transitionDuration={500}
            >
              <div className="p-5 h-full">
                <StatCard 
                  title="Total Income" 
                  amount={stats.totals.income} 
                  icon={ArrowUp}
                  colorClass={{ text: 'text-success', bg: 'bg-success/10', bgBar: 'bg-success/20', bgFill: 'bg-success/60' }}
                />
              </div>
            </GlareHover>
          </BorderGlow>

          <BorderGlow
            className="h-[140px] w-full"
            edgeSensitivity={30}
            glowColor="270 80 70"
            backgroundColor="#0c0c14"
            borderRadius={20}
            glowRadius={30}
            glowIntensity={0.6}
            coneSpread={20}
            animated={false}
            colors={['#7c3aed']}
          >
            <GlareHover
              className="rounded-[20px]"
              width="100%"
              height="100%"
              background="transparent"
              borderColor="transparent"
              glareColor="#ffffff"
              glareOpacity={0.1}
              glareSize={200}
              transitionDuration={500}
            >
              <div 
                onClick={() => setShowModal(true)} 
                className="p-5 h-full cursor-pointer hover:opacity-80 transition relative"
              >
                <StatCard 
                  title="Net Balance" 
                  amount={stats.totals.net} 
                  icon={Activity}
                  colorClass={{ text: 'text-accent', bg: 'bg-accent/10', bgBar: 'bg-accent/20', bgFill: 'bg-accent/60' }}
                  subtext={openingBalance > 0 ? `Includes opening ₹${openingBalance}` : 'Tap to add starting balance'}
                  hideBar={true}
                />
              </div>
            </GlareHover>
          </BorderGlow>

          <BorderGlow
            className="h-[140px] w-full"
            edgeSensitivity={30}
            glowColor="270 80 70"
            backgroundColor="#0c0c14"
            borderRadius={20}
            glowRadius={30}
            glowIntensity={0.6}
            coneSpread={20}
            animated={false}
            colors={['#7c3aed']}
          >
            <GlareHover
              className="rounded-[20px]"
              width="100%"
              height="100%"
              background="transparent"
              borderColor="transparent"
              glareColor="#ffffff"
              glareOpacity={0.1}
              glareSize={200}
              transitionDuration={500}
            >
              <div className="p-5 h-full">
                <StatCard 
                  title="Transactions" 
                  amount={stats.totals.transactionCount} 
                  icon={Hash}
                  colorClass={{ text: 'text-white/70', bg: 'bg-white/10', bgBar: 'bg-white/5', bgFill: 'bg-white/30' }}
                  hideBar={true}
                />
              </div>
            </GlareHover>
          </BorderGlow>
        </div>

        <InsightsSection 
          topMerchantBySpend={stats.topMerchantBySpend}
          mostFrequentMerchant={stats.mostFrequentMerchant}
          biggestExpense={stats.biggestExpense}
          avgTransaction={stats.avgTransaction}
          transactionCount={stats.totals.transactionCount}
        />

        {/* CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[400px]">
          <div className="bg-[#0c0c14] border border-white/10 rounded-2xl p-6 flex flex-col h-[350px] lg:h-full lg:col-span-1 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">
                {breakdownType === 'expenses' ? 'Spending Distribution' : 'Income Distribution'}
              </h3>
              <div className="flex bg-[#12121c] rounded-lg p-0.5 border border-white/10">
                <button 
                  onClick={() => setBreakdownType('expenses')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${breakdownType === 'expenses' ? 'bg-[#6C63FF] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Expenses
                </button>
                <button 
                  onClick={() => setBreakdownType('income')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${breakdownType === 'income' ? 'bg-[#6C63FF] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Income
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-[250px]">
              {transactions.length > 0 && (breakdownType === 'expenses' ? stats.categoryBreakdown.length > 0 : stats.incomeBreakdown.length > 0) ? (
                <SpendingPieChart data={breakdownType === 'expenses' ? stats.categoryBreakdown : stats.incomeBreakdown} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 font-medium">
                  No valid {breakdownType === 'expenses' ? 'expenses' : 'income'}
                </div>
              )}
            </div>
          </div>
          <div className="bg-[#0c0c14] border border-white/10 rounded-2xl p-6 flex flex-col h-[350px] lg:h-full lg:col-span-2 shadow-md">
            <h3 className="text-lg font-medium text-white mb-2">Monthly Cashflow</h3>
            <div className="flex-1 min-h-[250px]">
              {transactions.length > 0 && stats.monthlyData.length > 0 ? (
                <MonthlyBarChart data={stats.monthlyData} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 font-medium">No valid transaction data</div>
              )}
            </div>
          </div>
        </div>

        {/* LISTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto lg:h-[400px]">
          <div className="bg-[#0c0c14] border border-white/10 rounded-2xl p-6 overflow-hidden flex flex-col h-auto sm:h-[350px] lg:h-full shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-white">
                {breakdownType === 'expenses' ? 'Expense Categories' : 'Income Sources'}
              </h4>
            </div>
            <CategoryBreakdown categories={breakdownType === 'expenses' ? stats.categoryBreakdown : stats.incomeBreakdown} />
          </div>
          <div className="bg-[#0c0c14] border border-white/10 rounded-2xl p-6 overflow-hidden flex flex-col h-[350px] lg:h-full shadow-md">
            <MonthlySummary recentTransactions={stats.recentTransactions} />
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-[#1e1e2f] p-6 rounded-xl w-80 shadow-lg">
              <h2 className="text-white text-lg mb-2 font-semibold">
                Enter Opening Balance (Optional)
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Add opening balance only if needed
              </p>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter amount"
                className="w-full p-2 rounded bg-[#2a2a40] text-white mb-4 outline-none"
              />
              <div className="flex justify-between">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-500 rounded text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const val = Number(inputValue) || 0;
                    setOpeningBalance(val);
                    localStorage.setItem("openingBalance", val);
                    setShowModal(false);
                  }}
                  className="px-4 py-2 bg-purple-600 rounded text-white"
                >
                  Save
                </button>
              </div>
              <button
                onClick={() => {
                  setOpeningBalance(0);
                  localStorage.removeItem("openingBalance");
                  setInputValue("");
                  setShowModal(false);
                }}
                className="mt-4 w-full text-red-400 text-sm text-center"
              >
                Clear Opening Balance
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Floating Demo banner */}
      <div 
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          borderRadius: '999px',
          padding: '6px 16px',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          zIndex: 50
        }}
      >
        Guest Mode — Sample Data
      </div>
    </div>
  );
};

export default DemoDashboard;
