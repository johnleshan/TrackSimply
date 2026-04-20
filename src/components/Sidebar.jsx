import React from 'react';
import './Sidebar.css';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTool, onSelectTool, isCollapsed, onToggleCollapse, isMobile }) => {
  const { user } = useAuth();
  
  const allTools = [
    { id: 'overview', name: 'Dashboard', icon: '💎', roles: ['superadmin', 'admin', 'user'] },
    { id: 'debt', name: 'Debt Tracker', icon: '📈', roles: ['superadmin', 'admin', 'user'] },
    { id: 'bookkeeping', name: 'Bookkeeping', icon: '📝', roles: ['superadmin', 'admin', 'user'] },
    { id: 'budget', name: 'Budget Planner', icon: '⚖️', roles: ['superadmin', 'admin', 'user'] },
    { id: 'inventory', name: 'Inventory', icon: '📦', roles: ['superadmin', 'admin', 'user'] },
    { id: 'accounts', name: 'Account Mgmt', icon: '🛡️', roles: ['superadmin', 'admin'] }
  ];

  const tools = allTools.filter(tool => tool.roles.includes(user?.role));

  if (isMobile) {
    return (
      <nav className="bottom-nav">
        {tools.map(tool => (
          <button 
            key={tool.id} 
            className={`bottom-nav-link ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onSelectTool(tool.id)}
          >
            <span className="nav-icon">{tool.icon}</span>
            <span className="bottom-nav-label">{tool.name.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-logo">TS</div>
          {!isCollapsed && <span className="brand-name">TrackSimply</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {tools.map(tool => (
          <button 
            key={tool.id} 
            className={`nav-link ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onSelectTool(tool.id)}
          >
            <span className="nav-icon">{tool.icon}</span>
            {!isCollapsed && <span className="nav-label">{tool.name}</span>}
          </button>
        ))}
      </nav>

      <button 
        className="floating-toggle-btn" 
        onClick={onToggleCollapse} 
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? '⟩' : '⟨'}
      </button>

      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="profile-card">
            <div className="avatar">👤</div>
            <div className="profile-info">
              <p className="profile-name" style={{ textTransform: 'capitalize' }}>{user?.username || 'Guest'}</p>
              <p className="profile-status">Active</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
