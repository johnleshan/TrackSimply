import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MagicAI from './components/MagicAI';
import DashboardOverview from './components/tools/DashboardOverview';
import DebtTracker from './components/tools/DebtTracker';
import Bookkeeping from './components/tools/Bookkeeping';
import BudgetPlanner from './components/tools/BudgetPlanner';
import InventoryTracker from './components/tools/InventoryTracker';

const MobileHeader = ({ title }) => (
  <header className="mobile-header">
    <div className="brand-logo">TS</div>
    <span className="current-view-title">{title}</span>
  </header>
);

function App() {
  const [activeTool, setActiveTool] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState(localStorage.getItem('tracksimply_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tracksimply_theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => {
    // 1. Create a global 'kill-transition' style tag
    const css = document.createElement("style");
    css.type = "text/css";
    css.appendChild(document.createTextNode("*, *::before, *::after { transition: none !important; }"));
    document.head.appendChild(css);

    // 2. Switch theme
    setTheme(prev => prev === 'light' ? 'dark' : 'light');

    // 3. Remove the tag after a few frames to restore normal UI animations (like hovers)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.head.removeChild(css);
      });
    });
  };

  const getToolTitle = () => {
    const titles = {
      overview: 'Dashboard',
      debt: 'Debt Tracker',
      bookkeeping: 'Bookkeeping',
      budget: 'Budget Planner',
      inventory: 'Inventory'
    };
    return titles[activeTool] || 'TrackSimply';
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'overview':
        return <DashboardOverview onSelectTool={setActiveTool} />;
      case 'debt':
        return <DebtTracker />;
      case 'bookkeeping':
        return <Bookkeeping />;
      case 'budget':
        return <BudgetPlanner />;
      case 'inventory':
        return <InventoryTracker />;
      default:
        return <DashboardOverview onSelectTool={setActiveTool} />;
    }
  };

  return (
    <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {isMobile && <MobileHeader title={getToolTitle()} />}
      
      {/* Theme Toggle - Top Right */}
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme">
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <Sidebar 
        activeTool={activeTool} 
        onSelectTool={setActiveTool} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobile={isMobile}
      />
      <main className="main-content">
        {renderTool()}
      </main>

      <MagicAI activeTool={activeTool} />

      <style>{`
        .mobile-header {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px 20px;
          background: var(--bg-sidebar);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--glass-border);
          position: sticky;
          top: 0;
          z-index: 1000;
        }
        .current-view-title {
          font-weight: 700;
          font-size: 1.1rem;
          color: white;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        @media (min-width: 768px) {
          .mobile-header { display: none; }
        }

        .theme-toggle {
          position: fixed;
          top: 20px;
          right: 20px;
          background: var(--bg-secondary);
          border: 1px solid var(--glass-border);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2000;
          box-shadow: var(--shadow-lg);
          transition: var(--transition);
          font-size: 1.2rem;
        }
        .theme-toggle:hover {
          transform: scale(1.1);
          border-color: var(--accent-teal);
          transition: transform 0.2s ease, border-color 0s;
        }
        @media (max-width: 768px) {
          .theme-toggle {
            top: 15px;
            right: 20px;
            width: 36px;
            height: 36px;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
