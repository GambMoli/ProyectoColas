import React from 'react'

export const hudStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  color: '#f8fafc',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  background: 'rgba(15, 23, 42, 0.94)',
  padding: '16px',
  borderRadius: 12,
  lineHeight: 1.5,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  backdropFilter: 'blur(12px)',
  pointerEvents: 'none',
  minWidth: '300px',
  border: '1px solid rgba(148, 163, 184, 0.2)'
}
export const headerStyle: React.CSSProperties = {
  borderBottom: '2px solid #3b82f6',
  paddingBottom: '10px',
  marginBottom: '12px'
}
export const sectionStyle: React.CSSProperties = {
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: '1px solid rgba(148, 163, 184, 0.2)',
  fontSize: '14px'
}
export const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '13px',
  fontWeight: '600',
  color: '#60a5fa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
}
export const alertStyle: React.CSSProperties = {
  marginTop: '12px',
  padding: '10px',
  background: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid #ef4444',
  borderRadius: 8
}
