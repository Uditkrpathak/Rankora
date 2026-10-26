import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useCreateWorkspaceMutation } from '../../store/api/workspaceApi';
import { setActiveWorkspace } from '../../store/slices/authSlice';
import { X, Building2, Loader2, Sparkles } from 'lucide-react';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Dental & Healthcare');
  const [targetCity, setTargetCity] = useState('');
  const [createWorkspace, { isLoading }] = useCreateWorkspaceMutation();
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    try {
      setError('');
      const res = await createWorkspace({
        name: name.trim(),
      }).unwrap();

      const created = res.data?.workspace || res.workspace || res.data || res;
      if (created) {
        dispatch(setActiveWorkspace(created));
      }
      onClose();
      setName('');
    } catch (err: any) {
      setError(err?.data?.error?.message || err?.data?.message || 'Failed to create workspace');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.5)',
      backdropFilter: 'blur(4px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Building2 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Create workspace</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Group profiles and invite dedicated team members</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Workspace Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Marketing, Downtown Branch"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Business Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none',
                background: '#ffffff',
                boxSizing: 'border-box',
              }}
            >
              <option value="Dental & Healthcare">Dental & Healthcare</option>
              <option value="Restaurant & Hospitality">Restaurant & Hospitality</option>
              <option value="Real Estate & Property">Real Estate & Property</option>
              <option value="Legal & Financial Services">Legal & Financial Services</option>
              <option value="Home Services & Contractors">Home Services & Contractors</option>
              <option value="Digital Agency / Marketing">Digital Agency / Marketing</option>
              <option value="Retail & Shopping">Retail & Shopping</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Primary Target City (Optional)
            </label>
            <input
              type="text"
              value={targetCity}
              onChange={(e) => setTargetCity(e.target.value)}
              placeholder="e.g. New York, London, Toronto"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <Sparkles size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#475569' }}>
              Each workspace maintains dedicated Google accounts, audit history, and team members.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#475569',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: '#2563eb',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: isLoading || !name.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !name.trim() ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isLoading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Create workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
