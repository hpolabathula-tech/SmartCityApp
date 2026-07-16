import React, { useState } from 'react';

export default function FeedbackModal({ messageId, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/citizen/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          message_id: messageId,
          rating,
          feedback,
        }),
      });

      if (response.ok) {
        onSubmit?.();
        onClose();
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Rate This Answer</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={styles.content}>
          <p style={styles.question}>How helpful was this answer?</p>
          
          <div style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                style={{
                  ...styles.starBtn,
                  color: star <= rating ? 'var(--color-primary)' : 'var(--color-outline)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
                  {star <= rating ? 'star' : 'star_outline'}
                </span>
              </button>
            ))}
          </div>

          <div style={styles.feedbackSection}>
            <label style={styles.label}>Additional Feedback (Optional)</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what could be improved..."
              style={styles.textarea}
              rows={4}
            />
          </div>

          <div style={styles.sentimentHint}>
            {rating <= 2 && <span style={styles.hint}>😞 We're sorry this wasn't helpful. Your feedback helps us improve!</span>}
            {rating === 3 && <span style={styles.hint}>😐 Thanks for the feedback. We'll work on improving.</span>}
            {rating >= 4 && <span style={styles.hint}>😊 Great! We're glad we could help!</span>}
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn} disabled={submitting}>
            Cancel
          </button>
          <button onClick={handleSubmit} style={styles.submitBtn} disabled={submitting || rating === 0}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
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
    maxWidth: '450px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--color-outline-variant)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: 'var(--spacing-md)',
    borderBottom: '1px solid var(--color-outline-variant)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '16px',
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
    padding: 'var(--spacing-md)',
  },
  question: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--color-on-surface)',
    marginBottom: 'var(--spacing-sm)',
    margin: 0,
  },
  ratingContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    marginBottom: 'var(--spacing-md)',
  },
  starBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    padding: '4px',
  },
  feedbackSection: {
    marginBottom: 'var(--spacing-md)',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--color-on-surface)',
    marginBottom: 'var(--spacing-xs)',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--rounded-md)',
    border: '1px solid var(--color-outline-variant)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-on-surface)',
    fontSize: '13px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  sentimentHint: {
    textAlign: 'center',
    marginBottom: 'var(--spacing-sm)',
  },
  hint: {
    fontSize: '13px',
    color: 'var(--color-outline)',
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
  submitBtn: {
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
