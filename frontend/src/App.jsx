import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ChatAssistant from './components/ChatAssistantEnhanced';
import AdminDashboard from './components/AdminDashboard';
import RagFlowMonitor from './components/RagFlowMonitor';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'admin', 'flow'
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const cachedUser = localStorage.getItem('user');
    if (token && cachedUser) {
      setUser(JSON.parse(cachedUser));
    }
  }, [token]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleLoginSuccess = (userToken, userData) => {
    setToken(userToken);
    setUser(userData);
    if (userData.role === 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('chat');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setActiveTab('chat');
    setIsMobileMenuOpen(false);
  };

  // If not authenticated, render Login
  if (!token || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const selectTab = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div style={styles.appLayout}>
      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.logoGroup}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="mobile-hamburger-btn hover-lift active-scale"
            aria-label="Toggle Navigation Menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="material-symbols-outlined">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
          <span className="material-symbols-outlined" style={styles.logoIcon}>hub</span>
          <span style={styles.logoText}>Smart City Knowledge Portal</span>
        </div>
        <div style={styles.headerActions}>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={styles.themeBtn}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="hover-lift active-scale"
          >
            <span className="material-symbols-outlined">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <div style={styles.badge} className="header-badge hover-lift">
            <span style={styles.badgeDot}></span>
            <span style={styles.badgeLabel}>
              {user.role === 'admin' ? 'Administrator' : 'Citizen Access'}
            </span>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn} className="logout-btn hover-lift active-scale">
            <span className="material-symbols-outlined">logout</span>
            <span className="logout-btn-text">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Navigation Sidebar & Content Workspace */}
      <div style={styles.mainContainer}>
        {/* Semi-transparent dark overlay for mobile menu */}
        {isMobileMenuOpen && (
          <div
            className="mobile-overlay"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Nav Drawer */}
        <aside style={styles.sidebar} className={`sidebar-drawer ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>
              {user.role === 'admin' ? 'AD' : 'CI'}
            </div>
            <div style={styles.userInfo}>
              <strong style={styles.userName}>{user.name}</strong>
              <span style={styles.userRole}>
                {user.role === 'admin' ? 'Public Works Dept.' : 'Resident User'}
              </span>
            </div>
          </div>

          <nav style={styles.navMenu}>
            <button
              onClick={() => selectTab('chat')}
              style={{
                ...styles.navBtn,
                backgroundColor: activeTab === 'chat' ? 'var(--color-primary-container)' : 'transparent',
                color: activeTab === 'chat' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
              }}
              className="hover-lift"
            >
              <span className="material-symbols-outlined">forum</span>
              <span>AI Chatbot</span>
            </button>

            <button
              onClick={() => selectTab('flow')}
              style={{
                ...styles.navBtn,
                backgroundColor: activeTab === 'flow' ? 'var(--color-primary-container)' : 'transparent',
                color: activeTab === 'flow' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
              }}
              className="hover-lift"
            >
              <span className="material-symbols-outlined">route</span>
              <span>RAG Flow Map</span>
            </button>

            {user.role === 'admin' && (
              <button
                onClick={() => selectTab('admin')}
                style={{
                  ...styles.navBtn,
                  backgroundColor: activeTab === 'admin' ? 'var(--color-primary-container)' : 'transparent',
                  color: activeTab === 'admin' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                }}
                className="hover-lift"
              >
                <span className="material-symbols-outlined">admin_panel_settings</span>
                <span>Admin Panel</span>
              </button>
            )}
          </nav>

          <div style={styles.sidebarFooter}>
            <span style={styles.footerText}>© 2026 Smart City Authority</span>
          </div>
        </aside>

        {/* Content Panel */}
        <main style={{
          ...styles.contentArea,
          overflowY: activeTab === 'chat' ? 'hidden' : 'auto'
        }}>
          <div style={{
            ...styles.contentWrapper,
            height: activeTab === 'chat' ? '100%' : 'auto',
            padding: activeTab === 'chat' ? '0' : 'var(--spacing-md)'
          }}>
            {activeTab === 'chat' && <ChatAssistant />}
            {activeTab === 'flow' && <RagFlowMonitor />}
            {activeTab === 'admin' && user.role === 'admin' && <AdminDashboard />}
          </div>
        </main>

      </div>
    </div>
  );
}

const styles = {
  appLayout: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    height: '64px',
    backgroundColor: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-outline-variant)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 var(--spacing-md)',
    zIndex: 10,
    boxShadow: 'var(--shadow-sm)',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  logoIcon: {
    fontSize: '28px',
    color: 'var(--color-primary)',
  },
  logoText: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--color-on-surface)',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--color-surface-container-low)',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-full)',
    padding: '4px 12px',
  },
  badgeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-secondary)',
  },
  badgeLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-on-surface-variant)',
  },
  themeBtn: {
    background: 'none',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-md)',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--color-on-surface)',
    transition: 'all 0.2s',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-md)',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--color-on-surface-variant)',
    cursor: 'pointer',
    backgroundColor: 'var(--color-surface)',
    transition: 'all 0.2s',
  },
  mainContainer: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '260px',
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderRight: '1px solid var(--color-outline-variant)',
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--spacing-md)',
    zIndex: 9,
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    paddingBottom: 'var(--spacing-md)',
    borderBottom: '1px solid var(--color-outline-variant)',
    marginBottom: 'var(--spacing-md)',
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--rounded-full)',
    backgroundColor: 'var(--color-primary-container)',
    color: 'var(--color-on-primary)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: '700',
    fontSize: '14px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userName: {
    fontSize: '14px',
    color: 'var(--color-on-surface)',
  },
  userRole: {
    fontSize: '11px',
    color: 'var(--color-outline)',
  },
  navMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
    flex: 1,
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    border: 'none',
    borderRadius: 'var(--rounded-md)',
    padding: '12px var(--spacing-sm)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  sidebarFooter: {
    paddingTop: 'var(--spacing-md)',
    borderTop: '1px solid var(--color-outline-variant)',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '11px',
    color: 'var(--color-outline)',
  },
  contentArea: {
    flex: 1,
    overflowY: 'auto',
    backgroundColor: 'var(--color-background)',
  },
  contentWrapper: {
    padding: 'var(--spacing-md)',
    minHeight: '100%',
  },
};
