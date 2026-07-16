import React, { useState, useEffect } from 'react';

export default function UserPreferences({ onClose, onSave }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('userLanguage') || 'en');
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('userNotifications');
    return saved ? JSON.parse(saved) : { enabled: true, email: true, push: false };
  });
  const [savedQueries, setSavedQueries] = useState([]);
  const [loading, setLoading] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

  useEffect(() => {
    fetchSavedQueries();
  }, []);

  const fetchSavedQueries = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/citizen/saved-queries`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedQueries(data);
      }
    } catch (err) {
      console.error('Error fetching saved queries:', err);
    }
  };

  const handleSave = () => {
    localStorage.setItem('userLanguage', language);
    localStorage.setItem('userNotifications', JSON.stringify(notifications));
    onSave?.({ language, notifications });
  };

  const handleDeleteSavedQuery = async (queryId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/citizen/saved-queries/${queryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
      setSavedQueries(savedQueries.filter(q => q._id !== queryId));
    } catch (err) {
      console.error('Error deleting saved query:', err);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>User Preferences</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={styles.content}>
          {/* Language Selection */}
          <div style={styles.section}>
            <label style={styles.label}>Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={styles.select}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
            </select>
          </div>

          {/* Notifications */}
          <div style={styles.section}>
            <label style={styles.label}>Notifications</label>
            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={notifications.enabled}
                  onChange={(e) => setNotifications({ ...notifications, enabled: e.target.checked })}
                />
                Enable Notifications
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                  disabled={!notifications.enabled}
                />
                Email Alerts
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={notifications.push}
                  onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
                  disabled={!notifications.enabled}
                />
                Push Notifications
              </label>
            </div>
          </div>

          {/* Saved Queries */}
          <div style={styles.section}>
            <label style={styles.label}>Saved Queries ({savedQueries.length})</label>
            {savedQueries.length === 0 ? (
              <p style={styles.emptyText}>No saved queries yet</p>
            ) : (
              <div style={styles.savedQueriesList}>
                {savedQueries.map((query) => (
                  <div key={query._id} style={styles.savedQueryItem}>
                    <div style={styles.queryText}>{query.query}</div>
                    <button
                      onClick={() => handleDeleteSavedQuery(query._id)}
                      style={styles.deleteBtn}
                      title="Delete"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleSave} style={styles.saveBtn}>Save Preferences</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--rounded-lg)',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--color-outline-variant)',
  },
  header: {
    padding: 'var(--spacing-md)',
    borderBottom: '1px solid var(--color-outline-variant)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--color-on-surface)',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-on-surface)',
    fontSize: '24px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-md)',
  },
  section: {
    marginBottom: 'var(--spacing-md)',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--color-on-surface)',
    marginBottom: 'var(--spacing-xs)',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--rounded-md)',
    border: '1px solid var(--color-outline-variant)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-on-surface)',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: 'var(--color-on-surface)',
    cursor: 'pointer',
  },
  emptyText: {
    fontSize: '13px',
    color: 'var(--color-outline)',
    fontStyle: 'italic',
  },
  savedQueriesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
  },
  savedQueryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--spacing-sm)',
    backgroundColor: 'var(--color-surface-container)',
    borderRadius: 'var(--rounded-md)',
    border: '1px solid var(--color-outline-variant)',
  },
  queryText: {
    fontSize: '13px',
    color: 'var(--color-on-surface)',
    flex: 1,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-error)',
    fontSize: '18px',
  },
  footer: {
    padding: 'var(--spacing-md)',
    borderTop: '1px solid var(--color-outline-variant)',
    display: 'flex',
    gap: 'var(--spacing-sm)',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--rounded-md)',
    border: '1px solid var(--color-outline-variant)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-on-surface)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
  saveBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--rounded-md)',
    border: 'none',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
};
