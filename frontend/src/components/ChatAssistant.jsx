import React, { useState, useRef, useEffect } from 'react';

export default function ChatAssistant() {
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'history'
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: 'Hello! I am your Smart City Knowledge Assistant. I can help answer questions about waste management schedules, public transport rules, city zoning, and utility regulations based on official documents. What would you like to know?',
      confidence: 100,
      citations: [],
    }
  ]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/citizen/history?limit=50`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSend = async (textToSend) => {
    const promptText = textToSend || query.trim();
    if (!promptText) return;

    if (!textToSend) {
      setQuery('');
    }

    const userMsg = { id: Date.now(), sender: 'user', text: promptText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      // Build conversation context (last 10 messages for short-term memory)
      const conversationContext = messages.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
      
      const response = await fetch(`${API_URL}/citizen/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ 
          query: promptText,
          conversation_history: conversationContext
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Query failed');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: data.answer,
          confidence: data.confidence,
          citations: data.citations || [],
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `Sorry, I encountered an error connecting to the intelligence server: ${err.message}`,
          confidence: 0,
          citations: [],
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };



  return (
    <div style={styles.container}>
      {/* Tab Navigation */}
      <div style={styles.tabNav}>
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            ...styles.tabBtn,
            borderBottomColor: activeTab === 'chat' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'chat' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}
        >
          <span className="material-symbols-outlined">forum</span>
          Chat
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            ...styles.tabBtn,
            borderBottomColor: activeTab === 'history' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'history' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}
        >
          <span className="material-symbols-outlined">history</span>
          History
        </button>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <>
          <div style={styles.chatArea}>
            <div style={styles.messagesContainer}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.sender === 'assistant' && (
                    <div style={styles.avatar}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>smart_toy</span>
                    </div>
                  )}
                  
                  <div
                    style={{
                      ...styles.bubble,
                      backgroundColor: msg.sender === 'user' ? 'var(--color-primary-container)' : 'var(--color-surface-container)',
                      color: msg.sender === 'user' ? 'var(--color-on-primary)' : 'var(--color-on-surface)',
                      border: msg.sender === 'user' ? 'none' : '1px solid var(--color-outline-variant)',
                      borderRadius: msg.sender === 'user' ? '12px 12px 0px 12px' : '12px 12px 12px 0px',
                    }}
                  >
                    <p style={styles.bubbleText}>{msg.text}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div style={styles.messageRow}>
                  <div style={styles.avatar}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>smart_toy</span>
                  </div>
                  <div style={styles.typingIndicator}>
                    <div style={styles.dot}></div>
                    <div style={{ ...styles.dot, animationDelay: '0.2s' }}></div>
                    <div style={{ ...styles.dot, animationDelay: '0.4s' }}></div>
                    <span style={styles.typingText}>Searching knowledge index...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div style={styles.inputArea}>
            <div style={styles.inputBar}>
              <div style={styles.inputWrapper}>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask a question about city regulations, waste collection, public utility rules..."
                  style={styles.textarea}
                  rows={1}
                />

                <div style={styles.inputActions}>
                  <button onClick={() => handleSend()} style={styles.sendBtn} className="active-scale">
                    <span className="material-symbols-outlined" style={{ color: '#fff' }}>send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={styles.historyArea}>
          {historyLoading ? (
            <div style={styles.loadingState}>
              <span className="material-symbols-outlined" style={styles.loadingIcon}>hourglass_empty</span>
              <p>Loading your query history...</p>
            </div>
          ) : history.length === 0 ? (
            <div style={styles.emptyState}>
              <span className="material-symbols-outlined" style={styles.emptyIcon}>inbox</span>
              <p>No queries yet. Start asking questions in the Chat tab!</p>
            </div>
          ) : (
            <div style={styles.historyList}>
              <p style={styles.historyTitle}>Your Query History</p>
              {history.map((item, idx) => (
                <div key={idx} style={styles.historyItem} className="hover-lift">
                  <div style={styles.historyItemLeft}>
                    <p style={styles.historyQuery}>{item.query}</p>
                    <span style={styles.historyTime}>{item.timestamp}</span>
                  </div>
                  <div style={styles.historyItemRight}>
                    <span style={styles.confidenceBadge}>{item.confidence}%</span>
                    <button
                      onClick={() => handleSend(item.query)}
                      style={styles.reaskBtn}
                      title="Ask this question again"
                      className="active-scale"
                    >
                      <span className="material-symbols-outlined">refresh</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Citation Detail Modal */}
      {selectedCitation && (
        <div style={styles.modalOverlay} onClick={() => setSelectedCitation(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>description</span>
                <strong style={styles.modalTitle}>{selectedCitation.filename}</strong>
                <span style={styles.modalBadge}>{selectedCitation.meta}</span>
              </div>
              <button style={styles.closeBtn} onClick={() => setSelectedCitation(null)} className="hover-lift">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.modalSectionLabel}>Retrieved Document Excerpt:</p>
              <blockquote style={styles.modalExcerpt}>{selectedCitation.text_excerpt}</blockquote>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.primaryBtn} onClick={() => setSelectedCitation(null)} className="hover-lift active-scale">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative',
  },
  tabNav: {
    display: 'flex',
    borderBottom: '1px solid var(--color-outline-variant)',
    backgroundColor: 'var(--color-surface)',
    padding: '0 var(--spacing-md)',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: 'none',
    background: 'none',
    borderBottom: '3px solid transparent',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-md)',
  },
  historyArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-md)',
  },
  messagesContainer: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  },
  messageRow: {
    display: 'flex',
    gap: 'var(--spacing-sm)',
    maxWidth: '85%',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--rounded-full)',
    backgroundColor: 'var(--color-surface-container-high)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bubble: {
    padding: 'var(--spacing-md)',
    boxShadow: 'var(--shadow-sm)',
    lineHeight: '1.6',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
    borderRadius: '12px',
  },
  bubbleText: {
    fontSize: '15px',
    whiteSpace: 'pre-wrap',
    margin: 0,
  },
  metricsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--spacing-md)',
    paddingTop: 'var(--spacing-xs)',
    borderTop: '1px solid rgba(94, 234, 212, 0.3)',
    alignItems: 'center',
  },
  metricItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  metricLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--color-outline)',
    textTransform: 'uppercase',
  },
  confidenceBarContainer: {
    width: '80px',
    height: '6px',
    borderRadius: 'var(--rounded-full)',
    backgroundColor: 'var(--color-outline-variant)',
    overflow: 'hidden',
  },
  confidenceBar: {
    height: '100%',
    backgroundColor: 'var(--color-secondary)',
    borderRadius: 'var(--rounded-full)',
  },
  metricVal: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--color-secondary)',
  },
  sourceBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-secondary)',
  },
  badgeIcon: {
    fontSize: '16px',
  },
  citationsSection: {
    borderTop: '1px solid rgba(94, 234, 212, 0.3)',
    paddingTop: 'var(--spacing-xs)',
  },
  citationsTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--color-outline)',
    textTransform: 'uppercase',
    marginBottom: 'var(--spacing-xs)',
    letterSpacing: '0.05em',
    margin: 0,
  },
  citationChipsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--spacing-xs)',
  },
  citationChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--color-surface-container-high)',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-full)',
    padding: '4px 12px',
    cursor: 'help',
    transition: 'background-color 0.2s',
  },
  citeIcon: {
    fontSize: '14px',
    color: 'var(--color-primary)',
  },
  citeText: {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--color-on-surface)',
  },
  citeMeta: {
    fontSize: '11px',
    color: 'var(--color-outline)',
    marginLeft: '4px',
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: 'var(--spacing-sm)',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--rounded-lg)',
    border: '1px solid var(--color-outline-variant)',
    boxShadow: 'var(--shadow-sm)',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-primary)',
    animation: 'bounce 1.4s infinite ease-in-out both',
  },
  typingText: {
    fontSize: '13px',
    color: 'var(--color-outline)',
    marginLeft: 'var(--spacing-xs)',
  },
  inputArea: {
    padding: 'var(--spacing-md)',
    backgroundColor: 'var(--color-background)',
    borderTop: '1px solid var(--color-outline-variant)',
  },
  suggestions: {
    maxWidth: '800px',
    margin: '0 auto var(--spacing-sm) auto',
    display: 'flex',
    gap: 'var(--spacing-xs)',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  suggestionChip: {
    whiteSpace: 'nowrap',
    padding: '6px 14px',
    borderRadius: 'var(--rounded-full)',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-outline-variant)',
    fontSize: '13px',
    color: 'var(--color-on-surface-variant)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.2s',
  },
  inputBar: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-lg)',
    padding: '6px var(--spacing-sm)',
    boxShadow: 'var(--shadow-lg)',
  },
  textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    resize: 'none',
    padding: '8px',
    fontSize: '14px',
    maxHeight: '120px',
    color: 'var(--color-on-surface)',
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  sendBtn: {
    backgroundColor: 'var(--color-primary)',
    border: 'none',
    borderRadius: 'var(--rounded-md)',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    transition: 'opacity 0.2s',
  },
  historyList: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  historyTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--color-on-surface)',
    marginBottom: 'var(--spacing-md)',
    margin: 0,
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-md)',
    padding: 'var(--spacing-sm)',
    marginBottom: 'var(--spacing-xs)',
    transition: 'all 0.2s',
  },
  historyItemLeft: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  historyQuery: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--color-on-surface)',
    margin: 0,
  },
  historyTime: {
    fontSize: '12px',
    color: 'var(--color-outline)',
  },
  historyItemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
  },
  confidenceBadge: {
    fontSize: '12px',
    fontWeight: '700',
    backgroundColor: 'var(--color-secondary-container)',
    color: 'var(--color-on-secondary-container)',
    padding: '4px 10px',
    borderRadius: 'var(--rounded-full)',
  },
  reaskBtn: {
    background: 'none',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-md)',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--color-primary)',
    transition: 'all 0.2s',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    gap: 'var(--spacing-sm)',
  },
  loadingIcon: {
    fontSize: '48px',
    color: 'var(--color-primary)',
    animation: 'spin 2s linear infinite',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    gap: 'var(--spacing-sm)',
  },
  emptyIcon: {
    fontSize: '48px',
    color: 'var(--color-outline)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease-out',
  },
  modalContent: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--rounded-lg)',
    width: '90%',
    maxWidth: '500px',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    border: '1px solid var(--color-outline-variant)',
  },
  modalHeader: {
    padding: 'var(--spacing-md)',
    borderBottom: '1px solid var(--color-outline-variant)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface-container-low)',
  },
  modalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  modalTitle: {
    fontSize: '15px',
    color: 'var(--color-on-surface)',
    margin: 0,
  },
  modalBadge: {
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'var(--color-primary-container)',
    color: 'var(--color-on-primary)',
    padding: '2px 8px',
    borderRadius: 'var(--rounded-full)',
    textTransform: 'uppercase',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--rounded-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-on-surface)',
  },
  modalBody: {
    padding: 'var(--spacing-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
  },
  modalSectionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--color-outline)',
    textTransform: 'uppercase',
    margin: '0 0 var(--spacing-xs) 0',
  },
  modalExcerpt: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: 'var(--color-on-surface-variant)',
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderLeft: '4px solid var(--color-primary)',
    padding: 'var(--spacing-sm)',
    margin: 0,
    borderRadius: '0 var(--rounded-md) var(--rounded-md) 0',
    whiteSpace: 'pre-wrap',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  modalFooter: {
    padding: 'var(--spacing-md)',
    borderTop: '1px solid var(--color-outline-variant)',
    display: 'flex',
    justifyContent: 'flex-end',
    backgroundColor: 'var(--color-surface-container-low)',
  },
  primaryBtn: {
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--rounded-md)',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
};

// Inject missing keyframe animations
const styleSheet = document.styleSheets[0];
try {
  styleSheet.insertRule(`
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1.0); }
    }
  `, styleSheet.cssRules.length);
} catch (e) {}

try {
  styleSheet.insertRule(`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `, styleSheet.cssRules.length);
} catch (e) {}

try {
  styleSheet.insertRule(`
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `, styleSheet.cssRules.length);
} catch (e) {}

try {
  styleSheet.insertRule(`
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `, styleSheet.cssRules.length);
} catch (e) {}
