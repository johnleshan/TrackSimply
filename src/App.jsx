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
import { useAuth } from './context/AuthContext';
import { loadSettings } from './lib/appSettings';

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

const MobileHeader = ({ title, theme, toggleTheme, logout }) => (
  <header className="mobile-header">
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="mobile-brand-logo">TS</div>
      <span className="current-view-title">{title}</span>
    </div>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <ThemeButton theme={theme} toggleTheme={toggleTheme} />
      <LogoutButton logout={logout} />
    </div>
  </header>
);

/* Fixed 60px header: brand cell lines up with the sidebar, page title sits in
   the template's inset strip, actions dock to the right. */
const AppHeader = ({ title, theme, toggleTheme, logout, isCollapsed, user }) => (
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
      {user && (
        <div className="app-header__user">
          <div className="app-header__avatar">{(user.username || 'G').slice(0, 2)}</div>
          <div className="app-header__user-meta">
            <span className="app-header__user-name">{user.username || 'Guest'}</span>
            <span className="app-header__user-role">{user.role}</span>
          </div>
        </div>
      )}
      <ThemeButton theme={theme} toggleTheme={toggleTheme} />
      <LogoutButton logout={logout} />
    </div>
  </header>
);

const LoginScreen = ({ theme, toggleTheme }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    const result = await login(username, password);
    if (!result.success) {
      setError(result.reason);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <button className="app-header-btn" onClick={toggleTheme} aria-label="Toggle Theme" title="Toggle theme">
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <div className="card login-card">
        <div className="login-brand">
          <div className="app-header__logo">TS</div>
          <h1>TrackSimply</h1>
          <p>Sign in to your business workspace</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="reveal-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying Account...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

const LoadingScreen = () => (
  <div className="login-screen">
    <div className="loading-block">
      <div className="spinner" />
      <p>CONNECTING TO CLOUD...</p>
    </div>
  </div>
);

function App() {
  const { user, logout, loading } = useAuth();
  const [activeTool, setActiveTool] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState(localStorage.getItem('tracksimply_theme') || 'light');

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
    return <LoginScreen theme={theme} toggleTheme={toggleTheme} />;
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
        <MobileHeader title={getToolTitle()} theme={theme} toggleTheme={toggleTheme} logout={logout} />
      )}

      <main className="main-content">
        {renderTool()}
      </main>

      <MagicAI activeTool={activeTool} />
    </div>
  );
}

export default App;