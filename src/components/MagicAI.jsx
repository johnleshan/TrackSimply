import React, { useState, useEffect, useRef } from 'react';
import { chatWithAI } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchAllRows } from '../lib/pagedFetch';

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
        const { data: inventory } = await fetchAllRows('inventory', {
          columns: 'name, stock, reorder',
          eq: { user_id: userId },
        });

        const { data: budgets } = await fetchAllRows('budgets', {
          columns: 'budget, actual',
          eq: { user_id: userId },
        });

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

    // Without try/finally, any rejection here leaves the composer permanently
    // disabled — the business could not ask the assistant anything again
    // without reloading.
    try {
      const response = await chatWithAI([...messages, userMessage], user.id);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('AI request failed:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong reaching the assistant. Please try again.' },
      ]);
    } finally {
      setIsThinking(false);
    }
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
                <p style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>AI Assistant</p>
                <p style={{ fontSize: '0.7rem', opacity: 0.75, color: '#fff' }}>Groq Intelligence</p>
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
          width: 52px;
          height: 52px;
          border-radius: var(--radius-lg);
          background: var(--primary);
          color: #fff;
          border: none;
          font-family: inherit;
          font-size: 1.35rem;
          cursor: pointer;
          box-shadow: 0 0.125rem 0.625rem rgba(63, 106, 216, 0.4);
          z-index: 10000;
          transition: var(--transition);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ai-toggle:hover { background: var(--primary-hover); transform: translateY(-2px); }
        .ai-toggle.active { background: var(--bg-secondary); color: var(--primary); border: 1px solid var(--primary); }

        .ai-chat-window {
          position: fixed;
          bottom: 96px;
          right: 30px;
          width: 380px;
          max-height: 520px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          background: var(--ai-window-bg);
          color: var(--ai-window-text);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-raised);
          border: 1px solid var(--gray-200);
          overflow: hidden;
          animation: slideUp 0.2s ease-out;
        }

        .chat-header {
          padding: 12px 16px;
          background: var(--primary);
          color: #fff;
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .ai-logo-box {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
          width: 30px;
          height: 30px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.75rem;
          flex: 0 0 30px;
        }

        .minimize-btn {
          background: none;
          border: none;
          color: #fff;
          font-size: 1.1rem;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .minimize-btn:hover { opacity: 1; }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 300px;
        }

        .msg { display: flex; flex-direction: column; }
        .msg.user { align-items: flex-end; }
        .msg-content {
          max-width: 85%;
          padding: 9px 13px;
          border-radius: var(--radius-lg);
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .user .msg-content {
          background: var(--primary);
          color: #fff;
          border-bottom-right-radius: 2px;
        }
        .assistant .msg-content {
          background: var(--gray-100);
          color: var(--text-body);
          border-bottom-left-radius: 2px;
        }
        [data-theme="dark"] .assistant .msg-content { background: rgba(255, 255, 255, 0.07); }

        .chat-input-area {
          padding: 12px;
          border-top: 1px solid var(--gray-200);
          display: flex;
          gap: 8px;
          background: var(--bg-secondary);
        }
        .chat-input-area input {
          flex: 1;
          font-size: 0.85rem;
          padding: 9px 13px;
          background: var(--bg-primary);
          border: 1px solid var(--gray-300);
          color: var(--text-main);
        }
        .chat-input-area input::placeholder { color: var(--text-dim); }
        .chat-input-area .btn { padding: 8px 14px; min-height: auto; }

        .proactive-bubble {
          position: fixed;
          bottom: 110px;
          right: 30px;
          background: var(--bg-secondary);
          border: 1px solid var(--primary);
          padding: 11px 18px;
          border-radius: var(--radius-pill);
          z-index: 10001;
          display: flex;
          gap: 10px;
          align-items: center;
          box-shadow: var(--shadow-raised);
          animation: slideLeft 0.3s ease-out;
        }

        @keyframes slideLeft {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .insight-icon { font-size: 1.1rem; }
        .insight-text { font-size: 0.84rem; font-weight: 600; color: var(--text-main); }

        .thinking { display: flex; align-items: center; padding: 10px 0; }
        .dot-pulse {
          position: relative;
          left: -9999px;
          width: 6px;
          height: 6px;
          border-radius: 3px;
          background-color: var(--primary);
          color: var(--primary);
          box-shadow: 9999px 0 0 -5px var(--primary);
          animation: dotPulse 1.5s infinite linear;
          animation-delay: 0.25s;
        }

        @keyframes dotPulse {
          0% { box-shadow: 9999px 0 0 -5px var(--primary); }
          30% { box-shadow: 9999px 0 0 2px var(--primary); }
          60%, 100% { box-shadow: 9999px 0 0 -5px var(--primary); }
        }

        @media (max-width: 768px) {
          .ai-chat-window { width: calc(100% - 40px); right: 20px; bottom: 85px; }
          .ai-toggle { bottom: 85px; right: 20px; width: 46px; height: 46px; }
          .proactive-bubble { bottom: 142px; right: 20px; }
        }
      `}</style>
    </>
  );
};

export default MagicAI;
