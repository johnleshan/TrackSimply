import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MagicAI from './components/MagicAI';
import DashboardOverview from './components/tools/DashboardOverview';
import DebtTracker from './components/tools/DebtTracker';
import Bookkeeping from './components/tools/Bookkeeping';
import BudgetPlanner from './components/tools/BudgetPlanner';
import Analytics from './components/tools/Analytics';
import InventoryTracker from './components/tools/InventoryTracker';
import VehicleManagement from './components/tools/VehicleManagement';
import AccountManager from './components/tools/AccountManager';
import WhatsNew, { WhatsNewButton } from './components/WhatsNew';
import { getUnseenVersions } from './lib/whatsNew';
import { useAuth } from './context/AuthContext';
import { loadSettings } from './lib/appSettings';
import LoginScreen, { LoadingScreen } from './components/LoginScreen';
import Landing from './components/Landing';

const TOOL_TITLES = {
  overview: 'Dashboard',
  debt: 'Debt Tracker',
  bookkeeping: 'Bookkeeping',
  budget: 'Budget Planner',
  inventory: 'Inventory',
  vehicles: 'Fleet Registry',
  analytics: 'Analytics',
  accounts: 'Account Management',
};

const ThemeButton = ({ theme, toggleTheme }) => (
  <button
    className="app-header-btn"
    onClick={toggleTheme}
    aria-label="Toggle Theme"
    title="Toggle theme"
  >
    {theme === 'light' ? '🌙' : '☀️'}
  </button>
);

/* ✨ opens the What's New panel. Pass an OPEN callback, not a boolean, so the
   header markup is identical whether the panel is mounted or not. */
const HeaderActions = ({ theme, toggleTheme, user, onOpenWhatsNew, unseenCount, children }) => (
  <>
    {user && (
      <div className="app-header__user">
        <div className="app-header__avatar">{(user.username || 'G').slice(0, 2)}</div>
        <div className="app-header__user-meta">
          <span className="app-header__user-name">{user.username || 'Guest'}</span>
          <span className="app-header__user-role">{user.role}</span>
        </div>
      </div>
    )}
    {children}
    <WhatsNewButton unseenCount={unseenCount} onOpen={onOpenWhatsNew} />
    <ThemeButton theme={theme} toggleTheme={toggleTheme} />
  </>
);

/* Icons are inline SVG rather than glyphs: the previous ⏻ character is absent
   from the Windows system font stack and rendered as an empty box. */
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const LogoutButton = ({ logout }) => (
  <button className="app-header-btn app-header-btn--danger" onClick={logout} title="Logout" aria-label="Logout">
    <LogoutIcon />
  </button>
);

const MobileHeader = ({ title, theme, toggleTheme, logout, user, onOpenWhatsNew, unseenCount }) => (
  <header className="mobile-header">
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="mobile-brand-logo">TS</div>
      <span className="current-view-title">{title}</span>
    </div>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <HeaderActions theme={theme} toggleTheme={toggleTheme} user={user} onOpenWhatsNew={onOpenWhatsNew} unseenCount={unseenCount} />
      <LogoutButton logout={logout} />
    </div>
  </header>
);

/* Fixed 60px header: brand cell lines up with the sidebar, page title sits in
   the template's inset strip, actions dock to the right. */
const AppHeader = ({ title, theme, toggleTheme, logout, isCollapsed, user, onOpenWhatsNew, unseenCount }) => (
  <header className="app-header">
    <div className="app-header__brand">
      <div className="app-header__logo">TS</div>
      {!isCollapsed && <span className="app-header__name">TrackSimply</span>}
    </div>

    <div className="app-page-title">
      <span className="app-page-title__crumb">TrackSimply</span>
      <span className="app-page-title__sep">/</span>
      <span className="app-page-title__current">{title}</span>
    </div>

    <div className="app-header__actions">
      <HeaderActions theme={theme} toggleTheme={toggleTheme} user={user} onOpenWhatsNew={onOpenWhatsNew} unseenCount={unseenCount} />
      <LogoutButton logout={logout} />
    </div>
  </header>
);

function App() {
  const { user, logout, loading } = useAuth();
  const [activeTool, setActiveTool] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState(localStorage.getItem('tracksimply_theme') || 'light');
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [unseenWhatsNew, setUnseenWhatsNew] = useState(() => getUnseenVersions());
  // Public gate: marketing landing first; "Step inside" swaps in the sign-in.
  const [showLogin, setShowLogin] = useState(false);

  // Open once by itself when the visitor signs in and there is an unread
  // release. Cannot blaze past unnoticed, but also never interrupts your work.
  useEffect(() => {
    const unseen = getUnseenVersions();
    setUnseenWhatsNew(unseen);
    if (user && unseen.length > 0) {
      const t = setTimeout(() => setIsWhatsNewOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  const closeWhatsNew = () => {
    setIsWhatsNewOpen(false);
    setUnseenWhatsNew(getUnseenVersions());
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tracksimply_theme', theme);
  }, [theme]);

  // Load shared application settings once a user is present, so preferences are
  // in place before any tool renders.
  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => {
    const css = document.createElement("style");
    css.type = "text/css";
    css.appendChild(document.createTextNode("*, *::before, *::after { transition: none !important; }"));
    document.head.appendChild(css);
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
    requestAnimationFrame(() => requestAnimationFrame(() => document.head.removeChild(css)));
  };

  const getToolTitle = () => TOOL_TITLES[activeTool] || 'TrackSimply';

  const renderTool = () => {
    switch (activeTool) {
      case 'overview': return <DashboardOverview onSelectTool={setActiveTool} />;
      case 'debt': return <DebtTracker />;
      case 'bookkeeping': return <Bookkeeping />;
      case 'budget': return <BudgetPlanner />;
      case 'inventory': return <InventoryTracker />;
      case 'vehicles': return <VehicleManagement />;
      case 'analytics': return <Analytics />;
      case 'accounts': return <AccountManager />;
      default: return <DashboardOverview onSelectTool={setActiveTool} />;
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return showLogin ? (
      <LoginScreen onBack={() => setShowLogin(false)} />
    ) : (
      <Landing onStepInside={() => setShowLogin(true)} />
    );
  }

  return (
    <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {!isMobile && (
        <AppHeader
          title={getToolTitle()}
          theme={theme}
          toggleTheme={toggleTheme}
          logout={logout}
          isCollapsed={isSidebarCollapsed}
          user={user}
          onOpenWhatsNew={() => setIsWhatsNewOpen(true)}
          unseenCount={unseenWhatsNew.length}
        />
      )}

      <Sidebar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobile={isMobile}
      />

      {isMobile && (
        <MobileHeader
          title={getToolTitle()}
          theme={theme}
          toggleTheme={toggleTheme}
          logout={logout}
          user={user}
          onOpenWhatsNew={() => setIsWhatsNewOpen(true)}
          unseenCount={unseenWhatsNew.length}
        />
      )}

      <main className="main-content">
        {renderTool()}
      </main>

      <WhatsNew
        unseenVersions={unseenWhatsNew}
        open={isWhatsNewOpen}
        onClose={closeWhatsNew}
      />

      <MagicAI activeTool={activeTool} />
    </div>
  );
}

export default App;