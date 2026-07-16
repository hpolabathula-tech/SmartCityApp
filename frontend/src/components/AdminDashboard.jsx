import React, { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({
    doc_count: 0,
    query_count: 0,
    avg_confidence: 95,
    accuracy_trend: [84, 88, 91, 89, 94, 96, 98]
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

  useEffect(() => {
    fetchStats();
    fetchDocuments();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setSuccess('');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to upload document');
      }

      setSuccess('Document uploaded and indexed successfully!');
      setFile(null);
      
      const fileInput = document.getElementById('file-upload-input');
      if (fileInput) fileInput.value = '';

      setTimeout(() => {
        fetchStats();
        fetchDocuments();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document and all its indexed vector chunks?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete document');
      }

      setSuccess('Document deleted successfully.');
      fetchStats();
      fetchDocuments();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.container}>
      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard} className="hover-lift">
          <div style={styles.kpiHeader}>
            <div style={{ ...styles.kpiIconBox, backgroundColor: 'var(--color-primary-container)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>description</span>
            </div>
            <span style={styles.trendBadge}>+12%</span>
          </div>
          <span style={styles.kpiLabel}>Total Documents</span>
          <h3 style={styles.kpiValue}>{stats.doc_count} Files</h3>
          <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: '75%', backgroundColor: 'var(--color-primary)' }}></div></div>
        </div>

        <div style={styles.kpiCard} className="hover-lift">
          <div style={styles.kpiHeader}>
            <div style={{ ...styles.kpiIconBox, backgroundColor: 'var(--color-secondary-container)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)' }}>forum</span>
            </div>
            <span style={styles.trendBadge}>+24%</span>
          </div>
          <span style={styles.kpiLabel}>Queries Answered</span>
          <h3 style={styles.kpiValue}>{stats.query_count} Answers</h3>
          <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: '85%', backgroundColor: 'var(--color-secondary)' }}></div></div>
        </div>

        <div style={styles.kpiCard} className="hover-lift">
          <div style={styles.kpiHeader}>
            <div style={{ ...styles.kpiIconBox, backgroundColor: 'var(--color-on-tertiary-container)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-tertiary)' }}>star</span>
            </div>
            <span style={{ ...styles.trendBadge, color: 'var(--color-outline)' }}>Target: 95%</span>
          </div>
          <span style={styles.kpiLabel}>Retrieval Confidence</span>
          <h3 style={styles.kpiValue}>{stats.avg_confidence}% Avg</h3>
          <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${stats.avg_confidence}%`, backgroundColor: 'var(--color-tertiary)' }}></div></div>
        </div>
      </div>

      <div style={styles.bentoLayout}>
        {/* Left Column: Upload and Document sync table */}
        <div style={styles.leftCol}>
          {/* Upload Card */}
          <div style={styles.panel}>
            <h4 style={styles.panelTitle}>Ingest New Knowledge Document</h4>
            <p style={styles.panelSubtitle}>Add city rules, zoning policies, transport regulations (PDF, Word, TXT/CSV)</p>
            
            {error && <div style={styles.errorAlert}>{error}</div>}
            {success && <div style={styles.successAlert}>{success}</div>}

            <form onSubmit={handleUpload} style={styles.uploadForm}>
              <div style={styles.dropZone}>
                <span className="material-symbols-outlined" style={styles.uploadCloudIcon}>upload_file</span>
                <p style={styles.uploadText}>
                  {file ? `Selected file: ${file.name}` : 'Drag and drop your document here, or click to browse'}
                </p>
                <input
                  id="file-upload-input"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc,.txt,.csv"
                  style={styles.fileInput}
                />
              </div>

              <div style={styles.formActions}>
                {file && <span style={styles.fileName}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>}
                <button
                  type="submit"
                  disabled={uploading || !file}
                  style={{
                    ...styles.uploadBtn,
                    opacity: uploading || !file ? 0.7 : 1,
                  }}
                  className="active-scale"
                >
                  <span className="material-symbols-outlined">sync</span>
                  {uploading ? 'Processing & Indexing...' : 'Upload & Parse'}
                </button>
              </div>
            </form>
          </div>

          {/* Sync list table */}
          <div style={styles.panel}>
            <h4 style={styles.panelTitle}>Ingested Document Activity</h4>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.theadRow}>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Size</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Chunks</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={styles.emptyTd}>No documents indexed yet. Upload files to process them into vector space.</td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc._id} style={styles.tbodyRow} className="hover-tr">
                        <td style={styles.td}>
                          <div style={styles.docNameWrapper}>
                            <span className="material-symbols-outlined" style={styles.docIcon}>description</span>
                            <div>
                              <strong>{doc.name}</strong>
                              <span style={styles.docDate}>{doc.date}</span>
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>{(doc.size / 1024).toFixed(1)} KB</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              backgroundColor: doc.status === 'Indexed' ? 'var(--color-secondary-container)' : (doc.status === 'Processing' ? 'var(--color-primary-container)' : 'var(--color-error-container)'),
                              color: doc.status === 'Indexed' ? 'var(--color-on-secondary-container)' : (doc.status === 'Processing' ? 'var(--color-on-primary-container)' : 'var(--color-on-error-container)'),
                            }}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td style={styles.td}>{doc.vectorCount} vectors</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <button
                            onClick={() => handleDelete(doc._id)}
                            style={styles.deleteBtn}
                            title="Delete file & vectors"
                            className="active-scale"
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Graphs / Activity */}
        <div style={styles.rightCol}>
          <div style={styles.panel}>
            <h4 style={styles.panelTitle}>Knowledge Growth Accuracy</h4>
            <p style={styles.panelSubtitle}>Retrieval validation rates over recent queries</p>
            
            <div style={styles.chartWrapper}>
              <div style={styles.chartBars}>
                {stats.accuracy_trend.map((val, idx) => (
                  <div key={idx} style={styles.chartBarCol}>
                    <div style={styles.chartTooltip}>{val}%</div>
                    <div
                      style={{
                        ...styles.chartBar,
                        height: `${val}%`,
                        backgroundColor: idx === stats.accuracy_trend.length - 1 ? 'var(--color-primary)' : 'var(--color-primary-container)',
                        opacity: idx === stats.accuracy_trend.length - 1 ? 1 : 0.4
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={styles.chartLabels}>
                <span>Q-7</span>
                <span>Q-6</span>
                <span>Q-5</span>
                <span>Q-4</span>
                <span>Q-3</span>
                <span>Q-2</span>
                <span>Current</span>
              </div>
            </div>
          </div>

          <div style={styles.panel}>
            <h4 style={styles.panelTitle}>System Security Check</h4>
            <div style={styles.securityCheck}>
              <div style={styles.securityItem}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)' }}>shield</span>
                <div>
                  <strong>Role Isolation</strong>
                  <span>Standard citizens cannot access upload actions</span>
                </div>
              </div>
              <div style={styles.securityItem}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)' }}>lock</span>
                <div>
                  <strong>API Authorization</strong>
                  <span>JWT tokens verified dynamically in Flask routing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 'var(--spacing-md)',
  },
  kpiCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-lg)',
    padding: 'var(--spacing-md)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
    transition: 'all 0.2s',
  },
  kpiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--spacing-xs)',
  },
  kpiIconBox: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--rounded-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--color-secondary)',
    backgroundColor: 'var(--color-secondary-container)',
    padding: '4px 10px',
    borderRadius: 'var(--rounded-full)',
  },
  kpiLabel: {
    fontSize: '13px',
    color: 'var(--color-on-surface-variant)',
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--color-on-surface)',
  },
  progressBar: {
    width: '100%',
    height: '4px',
    backgroundColor: 'var(--color-surface-container-highest)',
    borderRadius: 'var(--rounded-full)',
    overflow: 'hidden',
    marginTop: 'var(--spacing-base)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 'var(--rounded-full)',
  },
  bentoLayout: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 'var(--spacing-md)',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  },
  panel: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--rounded-lg)',
    padding: 'var(--spacing-md)',
    boxShadow: 'var(--shadow-sm)',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--color-on-surface)',
    marginBottom: 'var(--spacing-base)',
  },
  panelSubtitle: {
    fontSize: '13px',
    color: 'var(--color-on-surface-variant)',
    marginBottom: 'var(--spacing-md)',
  },
  errorAlert: {
    backgroundColor: 'var(--color-error-container)',
    color: 'var(--color-on-error-container)',
    padding: 'var(--spacing-sm)',
    borderRadius: 'var(--rounded-md)',
    fontSize: '14px',
    marginBottom: 'var(--spacing-md)',
    border: '1px solid var(--color-outline-variant)',
  },
  successAlert: {
    backgroundColor: 'var(--color-secondary-container)',
    color: 'var(--color-on-secondary-container)',
    padding: 'var(--spacing-sm)',
    borderRadius: 'var(--rounded-md)',
    fontSize: '14px',
    marginBottom: 'var(--spacing-md)',
    border: '1px solid var(--color-outline-variant)',
  },
  uploadForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  },
  dropZone: {
    border: '2px dashed var(--color-outline-variant)',
    borderRadius: 'var(--rounded-md)',
    padding: 'var(--spacing-lg) var(--spacing-md)',
    textAlign: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'border-color 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  uploadCloudIcon: {
    fontSize: '44px',
    color: 'var(--color-primary)',
  },
  uploadText: {
    fontSize: '14px',
    color: 'var(--color-on-surface-variant)',
  },
  fileInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileName: {
    fontSize: '13px',
    color: 'var(--color-on-surface)',
    fontWeight: '600',
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-on-primary)',
    border: 'none',
    borderRadius: 'var(--rounded-md)',
    padding: '10px 20px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: 'var(--shadow-sm)',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  theadRow: {
    borderBottom: '2px solid var(--color-outline-variant)',
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-outline)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tbodyRow: {
    borderBottom: '1px solid var(--color-outline-variant)',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: 'var(--color-on-surface)',
  },
  emptyTd: {
    padding: 'var(--spacing-lg)',
    textAlign: 'center',
    color: 'var(--color-outline)',
    fontSize: '14px',
  },
  docNameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  docIcon: {
    fontSize: '20px',
    color: 'var(--color-primary)',
  },
  docDate: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--color-outline)',
    fontWeight: '400',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: 'var(--rounded-full)',
    textTransform: 'uppercase',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-outline)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 'var(--rounded-sm)',
    transition: 'color 0.2s',
  },
  chartWrapper: {
    marginTop: 'var(--spacing-sm)',
  },
  chartBars: {
    display: 'flex',
    alignItems: 'end',
    justifyContent: 'space-between',
    height: '180px',
    borderBottom: '1px solid var(--color-outline-variant)',
    paddingBottom: '8px',
    gap: '6px',
  },
  chartBarCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    height: '100%',
    justifyContent: 'end',
  },
  chartBar: {
    width: '100%',
    borderRadius: '2px 2px 0 0',
    transition: 'height 0.5s ease',
  },
  chartTooltip: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--color-on-surface)',
    marginBottom: '4px',
  },
  chartLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: 'var(--color-outline)',
    paddingTop: 'var(--spacing-xs)',
  },
  securityCheck: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  },
  securityItem: {
    display: 'flex',
    alignItems: 'start',
    gap: 'var(--spacing-xs)',
  },
};
