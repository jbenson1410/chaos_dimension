import { MAC } from '../styles/mac';

export default function MacWindow({ title, children, x, y, w, h }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: w, height: h,
      display: "flex", flexDirection: "column",
      border: `2px solid ${MAC.border}`,
      boxShadow: "2px 2px 0 rgba(0,0,0,0.3)",
      background: MAC.windowBg,
    }}>
      {/* Title Bar */}
      <div style={{
        height: 20, display: "flex", alignItems: "center", padding: "0 4px",
        background: MAC.chrome, borderBottom: `1px solid ${MAC.border}`, flexShrink: 0,
        backgroundImage: `repeating-linear-gradient(
          transparent 0px, transparent 1px,
          ${MAC.titleStripes} 1px, ${MAC.titleStripes} 2px,
          transparent 2px, transparent 3px
        )`,
      }}>
        <div style={{
          width: 12, height: 12, border: `1px solid ${MAC.border}`, background: MAC.chrome,
          marginRight: 6, flexShrink: 0,
        }} />
        <div style={{
          flex: 1, textAlign: "center", fontWeight: "bold", fontSize: 11,
          background: MAC.chrome, padding: "0 8px", whiteSpace: "nowrap",
        }}>
          {title}
        </div>
        <div style={{ width: 12, flexShrink: 0 }} />
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
      {/* Resize Handle */}
      <div style={{
        position: "absolute", bottom: 0, right: 0, width: 16, height: 16,
        backgroundImage: `linear-gradient(135deg, transparent 50%, ${MAC.chromeDark} 50%, ${MAC.chromeDark} 55%, transparent 55%, transparent 65%, ${MAC.chromeDark} 65%, ${MAC.chromeDark} 70%, transparent 70%, transparent 80%, ${MAC.chromeDark} 80%, ${MAC.chromeDark} 85%, transparent 85%)`,
      }} />
    </div>
  );
}
