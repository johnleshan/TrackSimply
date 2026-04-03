import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import DashboardOverview from './components/tools/DashboardOverview';
import DebtTracker from './components/tools/DebtTracker';
import Bookkeeping from './components/tools/Bookkeeping';
import BudgetPlanner from './components/tools/BudgetPlanner';
import InventoryTracker from './components/tools/InventoryTracker';

function App() {
  const [activeTool, setActiveTool] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
      <Sidebar 
        activeTool={activeTool} 
        onSelectTool={setActiveTool} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="main-content">
        {renderTool()}
      </main>
    </div>
  );
}

export default App;
