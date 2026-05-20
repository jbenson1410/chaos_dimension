import { useState } from 'react';
import { COLUMNS, COL_LABELS } from '../data/workstreams';
import { MAC, FONT } from '../styles/mac';

export default function TaskModal({ task, workstreams = {}, onSave, onClose, onDelete }) {
  const wsKeys = Object.keys(workstreams);
  const defaultWs = task?.workstream || wsKeys[0] || 'general';
  const [title, setTitle] = useState(task?.title || "");
  const [workstream, setWorkstream] = useState(defaultWs);
  const [priority, setPriority] = useState(task?.priority || "med");
  const [notes, setNotes] = useState(task?.notes || "");
  const [agentDispatchable, setAgentDispatchable] = useState(task?.agentDispatchable ?? true);
  const [column, setColumn] = useState(task?.column || "backlog");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title, workstream, priority, notes, agentDispatchable, column });
  };

  const inputStyle = {
    width: "100%", padding: "3px 4px", fontSize: 12,
    fontFamily: FONT, border: `2px inset ${MAC.chromeDark}`, background: "#fff",
  };

  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: "bold",
    color: MAC.textDim, marginBottom: 3, marginTop: 10,
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: MAC.chrome, border: `2px solid ${MAC.border}`,
        width: 420, boxShadow: "4px 4px 0 rgba(0,0,0,0.3)",
      }}>
        {/* Dialog Title Bar */}
        <div style={{
          height: 20, display: "flex", alignItems: "center", justifyContent: "center",
          borderBottom: `1px solid ${MAC.border}`, fontWeight: "bold", fontSize: 12,
          backgroundImage: `repeating-linear-gradient(
            transparent 0px, transparent 1px,
            ${MAC.titleStripes} 1px, ${MAC.titleStripes} 2px,
            transparent 2px, transparent 3px
          )`,
        }}>
          <span style={{ background: MAC.chrome, padding: "0 10px" }}>
            {task ? "Edit Task" : "New Task"}
          </span>
        </div>

        <div style={{ padding: 16 }}>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} autoFocus />

          <label style={labelStyle}>Workstream</label>
          <select value={workstream} onChange={e => setWorkstream(e.target.value)} style={inputStyle}>
            {Object.entries(workstreams).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={inputStyle}>
                <option value="high">● High</option>
                <option value="med">◐ Medium</option>
                <option value="low">○ Low</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Status</label>
              <select value={column} onChange={e => setColumn(e.target.value)} style={inputStyle}>
                {COLUMNS.map(c => <option key={c} value={c}>{COL_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ ...inputStyle, height: 60, resize: "vertical" }}
          />

          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={agentDispatchable}
              onChange={e => setAgentDispatchable(e.target.checked)}
            />
            ⚡ Agent-dispatchable
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <div>
              {onDelete && (
                <button className="mac-btn" onClick={onDelete} style={{ color: "#990000" }}>
                  Delete
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="mac-btn" onClick={onClose}>Cancel</button>
              <button className="mac-btn mac-btn-primary" onClick={handleSave}>
                {task ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
