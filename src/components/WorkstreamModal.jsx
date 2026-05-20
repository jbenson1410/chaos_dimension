import { useState } from 'react';
import { MAC, FONT } from '../styles/mac';

const PALETTE = [
  '#CC0066', '#FF6600', '#FFAA00', '#66AA00',
  '#0099CC', '#6633CC', '#999999', '#000000',
];

const inputStyle = {
  width: '100%',
  padding: '3px 4px',
  fontSize: 12,
  fontFamily: FONT,
  border: `2px inset ${MAC.chromeDark}`,
  background: '#fff',
};

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 'bold',
  color: MAC.textDim,
  marginBottom: 3,
};

function WorkstreamRow({ id, ws, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(ws.label);
  const [color, setColor] = useState(ws.color);
  const [icon, setIcon] = useState(ws.icon);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onUpdate(id, { label, color, icon });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onDelete(id);
    } catch {
      // alert shown by App; restore busy
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div style={{ padding: 8, borderBottom: `1px solid ${MAC.chromeDark}`, background: '#FFFFCC' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} style={{ ...inputStyle, width: 40, textAlign: 'center' }} />
          <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 20, height: 20, background: c, cursor: 'pointer',
                border: color === c ? '2px solid #000' : '1px solid #666',
              }}
              aria-label={c}
            />
          ))}
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ ...inputStyle, width: 80, marginLeft: 8 }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button type="button" className="mac-btn" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          <button type="button" className="mac-btn mac-btn-primary" onClick={save} disabled={busy || !label.trim()}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: `1px solid ${MAC.chromeDark}` }}>
      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{ws.icon}</span>
      <span style={{ flex: 1, fontSize: 12 }}>{ws.label}</span>
      <span style={{ width: 16, height: 16, background: ws.color, border: '1px solid #666' }} title={ws.color} />
      <span style={{ fontSize: 10, color: MAC.textDim, fontFamily: 'Courier New, monospace' }}>{id}</span>
      <button type="button" className="mac-btn" onClick={() => setEditing(true)} disabled={busy} style={{ fontSize: 10, padding: '1px 8px' }}>
        Edit
      </button>
      <button type="button" className="mac-btn" onClick={remove} disabled={busy} style={{ fontSize: 10, padding: '1px 8px', color: '#990000' }}>
        Delete
      </button>
    </div>
  );
}

function NewWorkstreamForm({ onCreate, defaultColor }) {
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('•');
  const [color, setColor] = useState(defaultColor);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onCreate({ label: label.trim(), icon: icon.trim() || '•', color });
      setLabel('');
      setIcon('•');
    } catch (err) {
      alert(err.message || 'Could not create workstream');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ padding: 12, background: MAC.chromeLight, borderTop: `1px solid ${MAC.chromeDark}` }}>
      <label style={labelStyle}>Add a new workstream</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="Icon"
          style={{ ...inputStyle, width: 40, textAlign: 'center' }}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Workstream name"
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            style={{
              width: 20, height: 20, background: c, cursor: 'pointer',
              border: color === c ? '2px solid #000' : '1px solid #666',
            }}
            aria-label={c}
          />
        ))}
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ ...inputStyle, width: 80, marginLeft: 8 }}
        />
      </div>
      <div style={{ textAlign: 'right' }}>
        <button type="submit" className="mac-btn mac-btn-primary" disabled={busy || !label.trim()}>
          {busy ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function WorkstreamModal({ workstreams, onCreate, onUpdate, onDelete, onClose }) {
  const entries = Object.entries(workstreams);
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: MAC.chrome, border: `2px solid ${MAC.border}`,
          width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: `1px solid ${MAC.border}`, fontWeight: 'bold', fontSize: 12,
          backgroundImage: `repeating-linear-gradient(
            transparent 0px, transparent 1px,
            ${MAC.titleStripes} 1px, ${MAC.titleStripes} 2px,
            transparent 2px, transparent 3px
          )`,
        }}>
          <span style={{ background: MAC.chrome, padding: '0 10px' }}>Workstreams</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#fff', minHeight: 100 }}>
          {entries.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: MAC.textDim, fontSize: 11 }}>
              No workstreams yet. Add one below.
            </div>
          ) : (
            entries.map(([id, ws]) => (
              <WorkstreamRow key={id} id={id} ws={ws} onUpdate={onUpdate} onDelete={onDelete} />
            ))
          )}
        </div>
        <NewWorkstreamForm onCreate={onCreate} defaultColor={PALETTE[0]} />
        <div style={{ padding: 8, textAlign: 'right', background: MAC.chrome, borderTop: `1px solid ${MAC.chromeDark}` }}>
          <button type="button" className="mac-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
