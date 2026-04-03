import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activeTool, onSelectTool, isCollapsed, onToggleCollapse }) => {
  const tools = [
    { id: 'overview', name: 'Overview', icon: '🏠' },
    { id: 'debt', name: 'Debt Tracker', icon: '💸' },
    { id: 'bookkeeping', name: 'Bookkeeping', icon: '📊' },
    { id: 'budget', name: 'Budget Planner', icon: '💰' },
    { id: 'inventory', name: 'Inventory', icon: '📦' }
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-icon">⚡</span>
        {!isCollapsed && <span className="brand-name">TrackSimply</span>}
        <button className="collapse-btn" onClick={onToggleCollapse}>
          {isCollapsed ? '⟩' : '⟨'}
        </button>
      </div>
      <nav className="sidebar-nav">
        {tools.map(tool => (
          <button 
            key={tool.id} 
            className={`nav-item ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onSelectTool(tool.id)}
          >
            <span className="nav-icon" title={isCollapsed ? tool.name : ''}>{tool.icon}</span>
            {!isCollapsed && <span className="nav-label">{tool.name}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        {!isCollapsed ? (
          <div className="user-badge">Personal Workspace</div>
        ) : (
          <div className="user-badge" title="Personal Workspace">👤</div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
