import { MAC } from '../styles/mac';

export function MenuBar({ children, clock }) {
  return (
    <div style={{
      height: 20, background: MAC.chrome, borderBottom: `1px solid ${MAC.border}`,
      display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0, zIndex: 100,
      backgroundImage: `linear-gradient(to bottom, ${MAC.chromeLight} 0%, ${MAC.chrome} 100%)`,
    }}>
      {children}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, paddingRight: 4 }}>
        {clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
    </div>
  );
}

export function MenuBarItem({ label, active, onClick, children }) {
  return (
    <div style={{ position: "relative" }}>
      <div onClick={onClick} style={{
        padding: "1px 10px", fontWeight: "bold", fontSize: 12, cursor: "default",
        background: active ? MAC.border : "transparent",
        color: active ? "#fff" : MAC.text,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function MenuDropdown({ items }) {
  return (
    <div style={{
      position: "absolute", top: "100%", left: 0, minWidth: 220,
      background: MAC.chrome, border: `2px solid ${MAC.border}`,
      boxShadow: "3px 3px 0 rgba(0,0,0,0.25)", zIndex: 200, padding: "2px 0",
    }}>
      {items.map((item, i) => item.divider ? (
        <div key={i} style={{ height: 1, background: MAC.chromeDark, margin: "3px 0" }} />
      ) : (
        <div key={i} onClick={item.disabled ? undefined : item.action} style={{
          padding: "3px 20px", fontSize: 12, cursor: item.disabled ? "default" : "pointer",
          color: item.disabled ? MAC.textDim : MAC.text, display: "flex", justifyContent: "space-between",
        }}
          onMouseEnter={e => { if (!item.disabled) { e.currentTarget.style.background = MAC.highlight; e.currentTarget.style.color = MAC.highlightText; } }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = item.disabled ? MAC.textDim : MAC.text; }}
        >
          <span>{item.checked ? "✓ " : "    "}{item.label}</span>
          {item.shortcut && <span style={{ color: "inherit", fontSize: 11 }}>{item.shortcut}</span>}
        </div>
      ))}
    </div>
  );
}

export function FilterPill({ label, title, active, onClick }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: "1px 6px", border: `1px solid ${active ? MAC.border : MAC.chromeDark}`,
      background: active ? MAC.border : MAC.chromeLight, color: active ? "#fff" : MAC.text,
      fontSize: 11, cursor: "pointer", borderRadius: 3, fontFamily: "inherit",
    }}>{label}</button>
  );
}
