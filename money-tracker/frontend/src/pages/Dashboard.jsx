import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowDown, ArrowUp, Activity, Hash, FilterX, Mail } from 'lucide-react';
import Client from '../api/client';
import TopNav from '../components/Layout/TopNav';
import StatCard from '../components/Dashboard/StatCard';
import CategoryBreakdown from '../components/Dashboard/CategoryBreakdown';
import MonthlySummary from '../components/Dashboard/MonthlySummary';
import InsightsSection from '../components/Dashboard/InsightsSection';
import SpendingPieChart from '../components/Charts/SpendingPieChart';
import MonthlyBarChart from '../components/Charts/MonthlyBarChart';
import BorderGlow from '../components/BorderGlow';
import GlareHover from '../components/GlareHover';
import FeedbackModal from '../components/Feedback/FeedbackModal';
import { supabase } from '../supabaseClient';

const Dashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [apiCategories, setApiCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [openingBalance, setOpeningBalance] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [breakdownType, setBreakdownType] = useState('expenses'); // 'expenses' or 'income'

  useEffect(() => {
    const saved = localStorage.getItem("openingBalance");
    if (saved !== null) {
      setOpeningBalance(Number(saved));
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.user_metadata?.opening_balance !== undefined) {
          const val = Number(session.user.user_metadata.opening_balance) || 0;
          setOpeningBalance(val);
          localStorage.setItem("openingBalance", val);
        }
      }).catch(() => {});
    }
  }, []);

  const [errorMsg, setErrorMsg] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      console.log("FILTER:", fromDate, toDate);
      const [txRes, catRes] = await Promise.all([
        Client.getTransactions({
          from: fromDate,
          to: toDate,
          page: 1,
          limit: 5000
        }),
        Client.getCategories()
      ]);
      
      if (txRes && txRes.error) {
        setErrorMsg(txRes.error);
      } else {
        setTransactions(txRes.data || []);
      }
      
      if (catRes && catRes.error) {
        setErrorMsg(catRes.error);
      } else {
        setApiCategories(catRes || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setErrorMsg(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetDates = () => {
    setFromDate("");
    setToDate("");
  };

  // Re-calculate stats on the frontend
  const stats = useMemo(() => {
    const debits = transactions.filter(t => t.type === 'debit' && t.status !== 'Failed');
    const credits = transactions.filter(t => t.type === 'credit' && t.status !== 'Failed');

    const expenses = debits.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const income = credits.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const net = (openingBalance || 0) + income - expenses;

    const totals = {
      expenses: Math.round(expenses * 100) / 100,
      income: Math.round(income * 100) / 100,
      net: Math.round(net * 100) / 100,
      transactionCount: transactions.length
    };

    const FALLBACK_COLORS = [
      '#FF6B6B', '#FECB5A', '#4ECDC4', '#C7F464', 
      '#81D4FA', '#B39DDB', '#FFAB91', '#A5D6A7', 
      '#F48FB1', '#80CBC4', '#9FA8DA', '#FFCC80',
      '#FF8A65', '#4DB6AC', '#BA68C8', '#AED581'
    ];

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

    const usedColors = new Set();
    const sortedCategories = Object.values(breakdown).sort((a, b) => b.total - a.total);
    
    const categoryBreakdown = sortedCategories.map((cat, index) => {
      const dbCat = apiCategories.find(c => c.name === cat.name);
      let color = dbCat ? dbCat.color : null;
      if (!color || color === '#95A5A6' || usedColors.has(color)) {
        color = FALLBACK_COLORS.find(c => !usedColors.has(c)) || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
      }
      usedColors.add(color);
      return {
        ...cat,
        total: Math.round(cat.total * 100) / 100,
        percentage: grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) : "0",
        color
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

    const usedColorsInc = new Set();
    const sortedIncCategories = Object.values(incBreakdown).sort((a, b) => b.total - a.total);
    
    const incomeBreakdown = sortedIncCategories.map((cat, index) => {
      const dbCat = apiCategories.find(c => c.name === cat.name);
      let color = dbCat ? dbCat.color : null;
      if (!color || color === '#95A5A6' || usedColorsInc.has(color)) {
        color = FALLBACK_COLORS.find(c => !usedColorsInc.has(c)) || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
      }
      usedColorsInc.add(color);
      return {
        ...cat,
        total: Math.round(cat.total * 100) / 100,
        percentage: grandTotalInc > 0 ? ((cat.total / grandTotalInc) * 100).toFixed(1) : "0",
        color
      };
    });

    // Monthly Data
    const monthly = {};
    transactions.filter(t => t.status !== 'Failed').forEach(t => {
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
      const key = t.normalizedMerchant || t.merchant;
      if (!merchantMap[key]) merchantMap[key] = { display: t.merchant, category: t.category, total: 0, count: 0 };
      merchantMap[key].total += parseFloat(t.amount) || 0;
      merchantMap[key].count++;
    });

    const sortedMerchants = Object.values(merchantMap)
      .map(m => ({ ...m, total: Math.round(m.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    const topMerchants = sortedMerchants.slice(0, 5);

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

    // Recent transactions
    const recentTransactions = [...transactions]
      .filter(t => t.status !== 'Failed')
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    return { 
      totals, 
      categoryBreakdown, 
      incomeBreakdown, 
      monthlyData, 
      topMerchants, 
      recentTransactions, 
      topMerchantBySpend, 
      mostFrequentMerchant, 
      biggestExpense, 
      avgTransaction 
    };
  }, [transactions, apiCategories, openingBalance]);

  return (
    <div className="min-h-full bg-primary-bg pb-10">
      <TopNav 
        title="Dashboard"
        meta={`Last updated: ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`}
        actions={
          <GlareHover
            background="transparent"
            borderRadius="8px"
            borderColor="#2A2A3E"
            glareColor="#ffffff"
            glareOpacity={0.2}
            glareAngle={-30}
            glareSize={200}
            transitionDuration={600}
            width="auto"
            height="auto"
            style={{ width: 'auto', height: 'auto' }}
          >
            <button onClick={fetchData} className="btn-secondary text-sm">
              Refresh
            </button>
          </GlareHover>
        }
      />
      
      <div className="px-6 lg:px-10 py-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            <strong>Error:</strong> {errorMsg}
          </div>
        )}
        
        {/* DATE RANGE FILTER */}
        <div className="glass-panel p-4 flex flex-wrap gap-4 items-end border-border-light shadow-xl shadow-black/50">
          <div className="flex gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">
                <span className="sm:hidden">From</span>
                <span className="hidden sm:inline">From Date</span>
              </label>
              <input 
                type="date" 
                className="w-full bg-primary-bg border border-border text-text-primary px-3 py-2 rounded-lg 
                           focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent 
                           transition-all appearance-none"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">
                <span className="sm:hidden">To</span>
                <span className="hidden sm:inline">To Date</span>
              </label>
              <input 
                type="date" 
                className="w-full bg-primary-bg border border-border text-text-primary px-3 py-2 rounded-lg 
                           focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent 
                           transition-all appearance-none"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          {(fromDate || toDate) && (
            <button 
              onClick={resetDates}
              className="px-3 py-2 flex items-center gap-2 text-danger hover:bg-danger/10 rounded-lg transition-colors text-sm font-medium"
            >
              <FilterX size={16} />
              Reset
            </button>
          )}
          {(fromDate || toDate) && (
            <div className="ml-auto text-sm text-accent bg-accent/10 px-4 py-2 rounded-lg font-medium self-end">
              Showing data {fromDate ? `from ${fromDate}` : ''} {toDate ? `to ${toDate}` : ''}
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <>
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
                    onClick={() => {
                      setInputValue(openingBalance > 0 ? String(openingBalance) : "");
                      setShowModal(true);
                    }} 
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
          </>
        )}

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
                    supabase.auth.updateUser({ data: { opening_balance: val } }).catch(() => {});
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
                  supabase.auth.updateUser({ data: { opening_balance: 0 } }).catch(() => {});
                  setInputValue("");
                  setShowModal(false);
                }}
                className="mt-4 w-full text-red-400 text-sm"
              >
                Clear Opening Balance
              </button>
            </div>
          </div>
        )}
        {/* Footer Signature */}
        <div className="text-center mt-12 pb-6 flex flex-col items-center gap-2">
          <p className="text-xs tracking-wide text-white/30">
            Created by{" "}
            <span className="text-purple-400 font-semibold hover:text-purple-300 transition duration-300 cursor-pointer">
              SHANX
            </span>
          </p>
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition duration-300"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send feedback</span>
          </button>
        </div>

        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      </div>
    </div>
  );
};

export default Dashboard;
