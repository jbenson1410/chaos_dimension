export const MAC = {
  bg: "#5A7DC8",
  windowBg: "#FFFFFF",
  chrome: "#DDDDDD",
  chromeDark: "#999999",
  chromeLight: "#EEEEEE",
  border: "#000000",
  text: "#000000",
  textDim: "#555555",
  highlight: "#000080",
  highlightText: "#FFFFFF",
  scrollbar: "#CCCCCC",
  titleStripes: "#BBBBBB",
};

export const FONT = `'Geneva', 'Lucida Grande', 'Helvetica Neue', sans-serif`;

export const GLOBAL_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${FONT};
    font-size: 12px;
    overflow: hidden;
  }
  ::-webkit-scrollbar { width: 16px; }
  ::-webkit-scrollbar-track { background: ${MAC.chrome}; border-left: 1px solid ${MAC.border}; }
  ::-webkit-scrollbar-thumb { background: ${MAC.scrollbar}; border: 1px solid ${MAC.border}; }
  .mac-btn {
    font-family: ${FONT};
    font-size: 12px;
    padding: 3px 16px;
    border-radius: 6px;
    border: 2px solid ${MAC.border};
    background: ${MAC.chrome};
    cursor: pointer;
  }
  .mac-btn:active { background: ${MAC.border}; color: #fff; }
  .mac-btn-primary { background: ${MAC.border}; color: #fff; }
  .mac-btn-primary:active { background: ${MAC.chromeDark}; }
  .task-card:hover { background: #E8E8FF !important; }
  .col-drop-active { background: #D0D0FF !important; }
  @keyframes blink { 50% { opacity: 0; } }
`;
