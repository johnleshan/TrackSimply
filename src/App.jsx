import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MagicAI from './components/MagicAI';
import DashboardOverview from './components/tools/DashboardOverview';
import DebtTracker from './components/tools/DebtTracker';
import Bookkeeping from './components/tools/Bookkeeping';
import BudgetPlanner from './components/tools/BudgetPlanner';
import InventoryTracker from './components/tools/InventoryTracker';
import AccountManager from './components/tools/AccountManager';
import { useAuth } from './context/AuthContext';

const MobileHeader = ({ title, theme, toggleTheme, logout }) => (
  <header className="mobile-header">
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div className="mobile-brand-logo">TS</div>
      <span className="current-view-title">{title}</span>
    </div>
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme" style={{ position: 'static' }}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      <button onClick={logout} title="Logout" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--glass-border)', background: 'var(--danger)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ✕
      </button>
    </div>
  </header>
);

const LoginScreen = () => {
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '30px', background: 'var(--bg-primary)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--accent-teal)', textAlign: 'center', marginBottom: '10px' }}>TrackSimply</h1>
        <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginBottom: '30px' }}>Please sign in to continue</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Username</label>
            <input 
              type="text" 
              placeholder="Username" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              style={{ width: '100%' }} 
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Password</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ width: '100%' }} 
                required 
              />
              <button 
                type="button" 
                className="reveal-btn" 
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', textAlign: 'center' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={isSubmitting}>
            {isSubmitting ? 'Verifying Account...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

const LoadingScreen = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--accent-teal)' }}>
    <div style={{ textAlign: 'center' }}>
      <div className="spinner" style={{ width: '50px', height: '50px', border: '5px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
      <p style={{ fontWeight: 600, letterSpacing: '1px' }}>CONNECTING TO CLOUD...</p>
    </div>
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
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

  const getToolTitle = () => {
    const titles = { 
      overview: 'Dashboard', 
      debt: 'Debt Tracker', 
      bookkeeping: 'Bookkeeping', 
      budget: 'Budget Planner', 
      inventory: 'Inventory',
      accounts: 'Account Management'
    };
    return titles[activeTool] || 'TrackSimply';
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'overview': return <DashboardOverview onSelectTool={setActiveTool} />;
      case 'debt': return <DebtTracker />;
      case 'bookkeeping': return <Bookkeeping />;
      case 'budget': return <BudgetPlanner />;
      case 'inventory': return <InventoryTracker />;
      case 'accounts': return <AccountManager />;
      default: return <DashboardOverview onSelectTool={setActiveTool} />;
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {isMobile && <MobileHeader title={getToolTitle()} theme={theme} toggleTheme={toggleTheme} logout={logout} />}
      
      {!isMobile && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', display: 'flex', gap: '10px', zIndex: 2000 }}>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme" style={{ position: 'static' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button onClick={logout} title="Logout" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid var(--glass-border)', background: 'var(--danger)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      )}

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
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-sidebar);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--glass-border);
          position: sticky;
          top: 0;
          z-index: 1000;
        }
        .mobile-brand-logo {
          background: linear-gradient(135deg, var(--accent-teal), #06b7d2);
          width: 36px;
          height: 36px;
          border-radius: 10px;
          color: #0f172a;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
        }
        .current-view-title {
          font-weight: 700;
          font-size: 1.1rem;
          color: var(--text-main);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        @media (min-width: 768px) {
          .mobile-header { display: none; }
        }

        .theme-toggle {
          background: var(--bg-secondary);
          border: 1px solid var(--glass-border);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
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
