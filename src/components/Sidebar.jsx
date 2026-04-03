import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activeTool, onSelectTool, isCollapsed, onToggleCollapse }) => {
  const tools = [
    { id: 'overview', name: 'Dashboard', icon: '💎' },
    { id: 'debt', name: 'Debt Tracker', icon: '📈' },
    { id: 'bookkeeping', name: 'Bookkeeping', icon: '📝' },
    { id: 'budget', name: 'Budget Planner', icon: '⚖️' },
    { id: 'inventory', name: 'Inventory', icon: '📦' }
  ];

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

      {/* Floating Toggle Button - Perfectly Positioned */}
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
              <p className="profile-name">Personal Space</p>
              <p className="profile-status">Active</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
