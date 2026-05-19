import { WORKSTREAMS } from '../data/workstreams';
import { MAC } from '../styles/mac';

export default function TaskCard({ task, agents, setDragState, onEdit, onDispatch }) {
  const ws = WORKSTREAMS[task.workstream];
  const agentAssigned = agents.find(a => a.taskId === task.id);
  const priorityMark = { high: "●", med: "◐", low: "○" };

  return (
    <div
      className="task-card"
      draggable
      onDragStart={() => setDragState({ taskId: task.id, overCol: null })}
      onDragEnd={() => setDragState({ taskId: null, overCol: null })}
      onClick={onEdit}
      style={{
        background: "#FFFFFF",
        border: `1px solid ${MAC.chromeDark}`,
        padding: "5px 7px",
        marginBottom: 3,
        cursor: "grab",
        borderLeft: `3px solid ${ws.color}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
        <span style={{ fontSize: 11, lineHeight: 1.3, flex: 1 }}>{task.title}</span>
        <span style={{ fontSize: 10, flexShrink: 0 }} title={`Priority: ${task.priority}`}>
          {priorityMark[task.priority]}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
        <span style={{ fontSize: 9, color: ws.color, fontWeight: "bold" }}>
          {ws.icon} {ws.label}
        </span>
        {task.agentDispatchable && <span title="Agent-dispatchable" style={{ fontSize: 10 }}>⚡</span>}
        {agentAssigned && (
          <span style={{ fontSize: 9, color: "#006600" }}>▸ {agentAssigned.name}</span>
        )}
      </div>
      {task.agentDispatchable && task.column === "backlog" && !agentAssigned && (
        <button
          className="mac-btn"
          onClick={(e) => { e.stopPropagation(); onDispatch(); }}
          style={{ marginTop: 4, fontSize: 9, padding: "1px 8px", width: "100%" }}
        >
          ▶ Dispatch
        </button>
      )}
    </div>
  );
}
