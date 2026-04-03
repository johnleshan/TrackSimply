import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import DebtTracker from './components/tools/DebtTracker';
import Bookkeeping from './components/tools/Bookkeeping';
import BudgetPlanner from './components/tools/BudgetPlanner';
import InventoryTracker from './components/tools/InventoryTracker';

function App() {
  const [activeTool, setActiveTool] = useState('debt');

  const renderTool = () => {
    switch (activeTool) {
      case 'debt':
        return <DebtTracker />;
      case 'bookkeeping':
        return <Bookkeeping />;
      case 'budget':
        return <BudgetPlanner />;
      case 'inventory':
        return <InventoryTracker />;
      default:
        return <DebtTracker />;
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeTool={activeTool} onSelectTool={setActiveTool} />
      <main className="main-content">
        {renderTool()}
      </main>
    </div>
  );
}

export default App;
