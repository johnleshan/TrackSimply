import React from 'react';
import './Sidebar.css';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTool, onSelectTool, isCollapsed, onToggleCollapse, isMobile }) => {
  const { user } = useAuth();

  const allTools = [
    { id: 'overview', name: 'Dashboard', icon: '💎', section: 'Main', roles: ['superadmin', 'admin', 'user'] },
    { id: 'bookkeeping', name: 'Bookkeeping', icon: '📝', section: 'Main', roles: ['superadmin', 'admin', 'user'] },
    { id: 'analytics', name: 'Analytics', icon: '📈', section: 'Insights', roles: ['superadmin', 'admin', 'user'] },
    { id: 'budget', name: 'Budget Planner', icon: '⚖️', section: 'Insights', roles: ['superadmin', 'admin', 'user'] },
    { id: 'inventory', name: 'Inventory', icon: '📦', section: 'Insights', roles: ['superadmin', 'admin', 'user'] },
    { id: 'debt', name: 'Debt Tracker', icon: '🏦', section: 'Insights', roles: ['superadmin', 'admin', 'user'] },
    { id: 'vehicles', name: 'Fleet Registry', icon: '🚛', section: 'Insights', roles: ['superadmin', 'admin', 'user'] },
    { id: 'accounts', name: 'Account Mgmt', icon: '🛡️', section: 'Admin', roles: ['superadmin', 'admin'] },
  ];

  const tools = allTools.filter(tool => tool.roles.includes(user?.role));

  // Preserve declaration order while grouping by section, and drop sections the
  // signed-in role has no access to.
  const sections = tools.reduce((acc, tool) => {
    const last = acc[acc.length - 1];
    if (last && last.label === tool.section) last.items.push(tool);
    else acc.push({ label: tool.section, items: [tool] });
    return acc;
  }, []);

  const initials = (user?.username || 'Guest').slice(0, 2);

  if (isMobile) {
    return (
      <nav className="bottom-nav">
        {tools.map(tool => (
          <button
            key={tool.id}
            className={`bottom-nav-link ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onSelectTool(tool.id)}
            aria-current={activeTool === tool.id ? 'page' : undefined}
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
      <nav className="sidebar-nav">
        {sections.map(section => (
          <React.Fragment key={section.label}>
            {/* A lone item reads better without a heading above it. */}
            {section.items.length > 1 && (
              <p className="sidebar-section-label" title={section.label}>
                {section.label}
              </p>
            )}
            {section.items.map(tool => (
              <button
                key={tool.id}
                className={`nav-link ${activeTool === tool.id ? 'active' : ''}`}
                onClick={() => onSelectTool(tool.id)}
                aria-current={activeTool === tool.id ? 'page' : undefined}
                title={isCollapsed ? tool.name : undefined}
              >
                <span className="nav-icon">{tool.icon}</span>
                {!isCollapsed && <span className="nav-label">{tool.name}</span>}
              </button>
            ))}
          </React.Fragment>
        ))}
      </nav>

      <button
        className="floating-toggle-btn"
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? '⟩' : '⟨'}
      </button>

      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="profile-card">
            <div className="avatar">{initials}</div>
            <div className="profile-info">
              <p className="profile-name">{user?.username || 'Guest'}</p>
              <p className="profile-status">Active</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;