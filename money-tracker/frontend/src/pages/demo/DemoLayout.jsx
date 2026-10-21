import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, LogIn, LayoutDashboard, ArrowLeftRight, Tags, Store, UploadCloud, Info } from 'lucide-react';
import SoftAurora from '../../components/SoftAurora';
import { useDemo } from '../../context/DemoContext';
import LoginPromptModal from '../../components/Guest/LoginPromptModal';

const DemoLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isLoginPromptOpen, closeLoginPrompt, loginPromptFeature } = useDemo();

  const links = [
    { name: 'Dashboard', path: '/guest/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', path: '/guest/transactions', icon: ArrowLeftRight },
    { name: 'Categories', path: '/guest/categories', icon: Tags },
    { name: 'Merchants', path: '/guest/merchants', icon: Store },
    { name: 'Upload', path: '/guest/upload', icon: UploadCloud }
  ];

  const handleGoToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="relative min-h-screen bg-[#060010]">
      {/* Background aurora */}
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

      <div className="relative z-10 flex h-screen overflow-hidden text-text-primary font-sans">
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/70 z-40 md:hidden transition-opacity backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#111118] border-r border-[#22222E] flex flex-col pt-6 pb-6 px-4 shrink-0 shadow-2xl transition-transform duration-300 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Logo & Close Button */}
          <div className="flex items-center justify-between px-3 mb-8">
            <h1
              onClick={() => {
                window.location.href = '/guest/dashboard';
              }}
              className="brand-font text-2xl text-white flex items-baseline tracking-wide cursor-pointer hover:opacity-90 transition-opacity"
            >
              <span className="font-medium">SPEND</span>
              <span className="text-[32px] font-bold text-purple-400 ml-0.5 leading-none">
                X
              </span>
            </h1>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-purple-500/15 text-purple-300 font-semibold shadow-[inset_4px_0_0_#a855f7] border-l-4 border-purple-500'
                        : 'text-gray-400 hover:bg-[#181824] hover:text-white font-medium'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 transition-colors" />
                  <span className="tracking-wide text-sm">{link.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Guest Mode Badge & Login CTA in Sidebar */}
          <div className="mt-auto border-t border-[#22222E] pt-4 px-1 space-y-3">
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-xs font-semibold text-purple-300 tracking-wide uppercase">
                Guest Mode
              </span>
              <span className="text-[11px] text-gray-400 font-medium">
                Sample Data
              </span>
            </div>

            <button
              onClick={handleGoToLogin}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-[0_0_15px_rgba(124,58,237,0.25)]"
            >
              <LogIn className="w-4 h-4" />
              <span>Log In for Full Access</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Top Header */}
          <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#111118] border-b border-[#22222E] shrink-0 gap-3">
            {/* Mobile Hamburger Button */}
            <div className="flex items-center gap-3 md:hidden">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-gray-300 hover:text-white rounded-xl bg-white/5 border border-white/10"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="brand-font text-lg font-bold text-white tracking-wide">
                SPEND<span className="text-purple-400">X</span>
              </span>
            </div>

            {/* Guest Banner */}
            <div className="hidden sm:flex items-center gap-2.5 text-xs text-gray-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-full">
              <Info className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                <strong>Guest Mode:</strong> You are viewing sample financial data.
              </span>
            </div>

            {/* Header Right Log In Button */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleGoToLogin}
                className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 rounded-xl transition-all shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden xs:inline sm:inline">Log In</span>
                <span className="xs:hidden sm:hidden">Log In</span>
              </button>
            </div>
          </header>

          {/* Render child pages */}
          <main className="flex-1 overflow-y-auto min-w-0 bg-[#0A0A0F]">
            {children}
          </main>
        </div>
      </div>

      {/* Global Login Prompt Modal for protected guest actions */}
      <LoginPromptModal
        isOpen={isLoginPromptOpen}
        onClose={closeLoginPrompt}
        onLogin={handleGoToLogin}
        featureName={loginPromptFeature}
      />
    </div>
  );
};

export default DemoLayout;
