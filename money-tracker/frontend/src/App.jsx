import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import MerchantMapping from './pages/MerchantMapping';
import Login from './pages/Login';
import SoftAurora from './components/SoftAurora';
import IntroLoader from './components/IntroLoader';
import { AuthProvider, useAuth } from './context/AuthContext';
import DemoLayout from './pages/demo/DemoLayout';
import DemoUpload from './pages/demo/DemoUpload';
import DemoMerchants from './pages/demo/DemoMerchants';
import DemoDashboard from './pages/demo/DemoDashboard';
import { DemoProvider } from './context/DemoContext';
import IntroVideoModal from './components/Onboarding/IntroVideoModal';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [introLoading, setIntroLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Show intro loader first (existing behavior — keep this)
  if (introLoading) {
    return <IntroLoader onFinish={() => setIntroLoading(false)} />;
  }

  const isDemoRoute = window.location.pathname.startsWith('/demo');
  if (isDemoRoute) {
    return (
      <DemoProvider>
        <Router>
          <DemoLayout>
            <Routes>
              <Route path="/demo" element={<Navigate to="/demo/upload" replace />} />
              <Route path="/demo/upload"    element={<DemoUpload />} />
              <Route path="/demo/merchants" element={<DemoMerchants />} />
              <Route path="/demo/dashboard" element={<DemoDashboard />} />
            </Routes>
          </DemoLayout>
        </Router>
      </DemoProvider>
    );
  }

  // Wait for auth check to complete
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#060010'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(124,58,237,0.3)',
          borderTopColor: '#7c3aed',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in — show login page only
  if (!user) {
    return <Login />;
  }

  // Logged in — show full app
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Router>
        <div className="relative min-h-screen bg-[#060010]">
          <IntroVideoModal />
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <SoftAurora
              speed={0.6}
              scale={1.5}
              brightness={1}
              color1="#c084fc"
              color2="#6366f1"
              noiseFrequency={2.5}
              noiseAmplitude={1}
              bandHeight={0.5}
              bandSpread={1}
              octaveDecay={0.1}
              layerOffset={0}
              colorSpeed={1}
              enableMouseInteraction={false}
            />
          </div>
          <div className="relative z-10">
            <div className="flex h-screen bg-[#0A0A0F] text-text-primary font-sans overflow-hidden">
              <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
              
              {/* Overlay for mobile drawer */}
              {isSidebarOpen && (
                <div 
                  className="fixed inset-0 bg-black/60 z-20 md:hidden transition-opacity duration-300"
                  onClick={() => setIsSidebarOpen(false)}
                />
              )}

              <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Mobile top navigation bar */}
                <div className="md:hidden flex items-center justify-between px-6 py-4 bg-[#111118] border-b border-[#22222E] z-10 shrink-0">
                  <h1 
                    onClick={() => window.location.reload()} 
                    className="brand-font text-xl text-white flex items-baseline tracking-wide cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <span className="font-medium">SPEND</span>
                    <span className="text-[26px] font-bold text-purple-400 ml-0.5 leading-none">
                      X
                    </span>
                  </h1>
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 text-text-primary hover:bg-[#12121c] rounded-xl border border-white/10 transition-colors"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                </div>

                <main className="flex-1 overflow-y-auto min-w-0 md:pl-64">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/merchants" element={<MerchantMapping />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          </div>
        </div>
      </Router>
    </motion.div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
