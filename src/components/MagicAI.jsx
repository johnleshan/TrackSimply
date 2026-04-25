import React, { useState, useEffect, useRef } from 'react';
import { chatWithAI } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const MagicAI = ({ activeTool }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm your TrackSimply AI. I can help you log transactions, analyze your budget, and track your debts. How can I assist you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [proactiveInsight, setProactiveInsight] = useState(null);
  const chatEndRef = useRef(null);
  const chatWindowRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Click outside to minimize
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chatWindowRef.current && !chatWindowRef.current.contains(event.target)) {
        // Also check if the toggle button itself was clicked to avoid double-toggling
        if (!event.target.closest('.ai-toggle')) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Proactive Logic: Check for insights when the tool changes
  useEffect(() => {
    const runProactiveCheck = async () => {
      if (!user) return;
      
      try {
        const userId = user.id;
        const isAdmin = ['admin', 'superadmin'].includes(user?.role);

        // Snapshots for analysis
        let invQuery = supabase.from('inventory').select('name, stock, reorder').eq('user_id', user.id);
        const { data: inventory } = await invQuery;

        let budQuery = supabase.from('budgets').select('budget, actual').eq('user_id', user.id);
        const { data: budgets } = await budQuery;

        let insight = null;
        
        // Proactive rules
        if (budgets) {
          const totalBudget = budgets.reduce((sum, b) => sum + Number(b.budget), 0);
          const totalActual = budgets.reduce((sum, b) => sum + Number(b.actual), 0);
          if (totalBudget > 0 && totalActual > totalBudget * 0.9) {
            insight = `⚠️ Budget Alert: You've used over 90% of your total monthly budget.`;
          }
        }

        if (inventory) {
          const lowStock = inventory.filter(i => i.stock <= i.reorder);
          if (lowStock.length > 0) {
            insight = `📦 Inventory Alert: ${lowStock.length} items are low on stock. Check ${lowStock[0].name}.`;
          }
        }

        if (insight) {
          setProactiveInsight(insight);
          setTimeout(() => setProactiveInsight(null), 8000); // Clear after 8s
        }
      } catch (err) {
        console.error('Proactive Insight Error:', err);
      }
    };

    runProactiveCheck();
  }, [activeTool, user]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    const response = await chatWithAI([...messages, userMessage], user.id);
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsThinking(false);
  };

  // Improved Message Formatter (strips extra MD chars and adds basic formatting)
  const formatMessage = (text) => {
    if (!text) return '';
    
    // Convert bold **text** or __text__
    let formatted = text.replace(/\*\*(.*?)\*\*|__(.*?)\__/g, '<strong>$1$2</strong>');
    
    // Convert italic *text* or _text_
    formatted = formatted.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');
    
    // Convert new lines to <br/>
    formatted = formatted.replace(/\n/g, '<br/>');
    
    // Convert list items starting with * or -
    formatted = formatted.replace(/^(?:\s*[*|-]\s+)(.*)/gm, '• $1');

    return { __html: formatted };
  };

  return (
    <>
      {/* Proactive Notification Bubble */}
      {proactiveInsight && (
        <div className="proactive-bubble">
          <div className="insight-icon">✨</div>
          <div className="insight-text">{proactiveInsight}</div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button className={`ai-toggle ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : '✨'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-chat-window" ref={chatWindowRef}>
          <div className="chat-header">
             <div className="ai-logo-box">AI</div>
             <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ai-window-text)' }}>AI Assistant</p>
                <p style={{ fontSize: '0.7rem', opacity: 0.7, color: 'var(--ai-window-text)' }}>Groq Intelligence</p>
             </div>
             <button className="minimize-btn" onClick={() => setIsOpen(false)}>—</button>
          </div>
          
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className="msg-content" dangerouslySetInnerHTML={formatMessage(m.content)} />
              </div>
            ))}
            {isThinking && (
              <div className="msg assistant thinking">
                <div className="dot-pulse"></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSend} className="chat-input-area">
            <input 
              type="text" 
              placeholder="Ask me anything..." 
              value={input} 
              onChange={e => setInput(e.target.value)}
              disabled={isThinking}
            />
            <button type="submit" className="btn btn-primary" disabled={isThinking}>→</button>
          </form>
        </div>
      )}

      <style>{`
        .ai-toggle {
          position: fixed;
          bottom: 30px;
          right: 30px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--accent-teal);
          color: #fff;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          box-shadow: var(--shadow-lg);
          z-index: 10000;
          transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ai-toggle:hover { transform: scale(1.1); }
        .ai-toggle.active { background: var(--bg-secondary); color: var(--accent-teal); }

        .ai-chat-window {
          position: fixed;
          bottom: 100px;
          right: 30px;
          width: 380px;
          max-height: 500px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          background: var(--ai-window-bg);
          color: var(--ai-window-text);
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 40px rgba(0,0,0,0.25);
          border: 1px solid var(--glass-border);
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }

        .chat-header {
          padding: 15px 20px;
          background: rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ai-logo-box {
          background: var(--accent-teal);
          color: #fff;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.8rem;
        }

        .minimize-btn {
          background: none;
          border: none;
          color: var(--ai-window-text);
          font-size: 1.2rem;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
        }
        .minimize-btn:hover { opacity: 1; }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 300px;
        }

        .msg { display: flex; flex-direction: column; }
        .msg.user { align-items: flex-end; }
        .msg-content {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .user .msg-content { 
          background: var(--ai-msg-user); 
          color: inherit; 
          border-bottom-right-radius: 2px; 
        }
        .assistant .msg-content { 
          background: var(--ai-msg-assistant); 
          color: inherit; 
          border-bottom-left-radius: 2px; 
        }

        .chat-input-area {
          padding: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          gap: 10px;
          background: rgba(0, 0, 0, 0.05);
        }
        .chat-input-area input { 
          flex: 1; 
          font-size: 0.85rem; 
          padding: 10px 15px; 
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: inherit;
        }
        .chat-input-area input::placeholder { color: inherit; opacity: 0.5; }
        .chat-input-area .btn { padding: 8px 15px; min-height: auto; }

        .proactive-bubble {
          position: fixed;
          bottom: 110px;
          right: 30px;
          background: var(--bg-secondary);
          border: 1px solid var(--accent-teal);
          padding: 12px 20px;
          border-radius: 30px;
          z-index: 10001;
          display: flex;
          gap: 12px;
          align-items: center;
          box-shadow: var(--shadow-lg);
          animation: slideLeft 0.5s cubic-bezier(0.23, 1, 0.32, 1);
        }

        @keyframes slideLeft {
          from { transform: translateX(50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .insight-icon { font-size: 1.2rem; }
        .insight-text { font-size: 0.85rem; font-weight: 600; color: var(--text-main); }

        .thinking { display: flex; align-items: center; padding: 10px 0; }
        .dot-pulse {
          position: relative;
          left: -9999px;
          width: 6px;
          height: 6px;
          border-radius: 3px;
          background-color: var(--accent-teal);
          color: var(--accent-teal);
          box-shadow: 9999px 0 0 -5px var(--accent-teal);
          animation: dotPulse 1.5s infinite linear;
          animation-delay: 0.25s;
        }

        @keyframes dotPulse {
          0% { box-shadow: 9999px 0 0 -5px var(--accent-teal); }
          30% { box-shadow: 9999px 0 0 2px var(--accent-teal); }
          60%, 100% { box-shadow: 9999px 0 0 -5px var(--accent-teal); }
        }

        @media (max-width: 768px) {
          .ai-chat-window { width: calc(100% - 40px); right: 20px; bottom: 85px; }
          .ai-toggle { bottom: 85px; right: 20px; width: 50px; height: 50px; }
          .proactive-bubble { bottom: 145px; right: 20px; }
        }
      `}</style>
    </>
  );
};

export default MagicAI;
