import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activeTool, onSelectTool }) => {
  const tools = [
    { id: 'debt', name: 'Debt Tracker', icon: '💸' },
    { id: 'bookkeeping', name: 'Bookkeeping', icon: '📊' },
    { id: 'budget', name: 'Budget Planner', icon: '💰' },
    { id: 'inventory', name: 'Inventory', icon: '📦' }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">⚡</span>
        TrackSimply
      </div>
      <nav className="sidebar-nav">
        {tools.map(tool => (
          <button 
            key={tool.id} 
            className={`nav-item ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onSelectTool(tool.id)}
          >
            <span className="nav-icon">{tool.icon}</span>
            <span className="nav-label">{tool.name}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-badge">
          Personal Workspace
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
