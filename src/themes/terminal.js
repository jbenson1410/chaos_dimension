const FONT = `'Courier New', 'Menlo', monospace`;

const colors = {
  bg: '#0A0A0A',
  windowBg: '#000000',
  chrome: '#000000',
  chromeDark: '#00FF00',
  chromeLight: '#0F1F0F',
  border: '#00FF00',
  text: '#00FF00',
  textDim: '#008800',
  highlight: '#00FF00',
  highlightText: '#000000',
  scrollbar: '#00FF00',
  titleStripes: '#00FF00',
};

const GLOBAL_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${FONT};
    font-size: 13px;
    overflow: hidden;
    background: #000;
    color: #00FF00;
  }
  ::-webkit-scrollbar { width: 12px; }
  ::-webkit-scrollbar-track { background: #000; border-left: 1px solid #00FF00; }
  ::-webkit-scrollbar-thumb { background: #00FF00; border: 2px solid #000; }
  .mac-btn {
    font-family: ${FONT};
    font-size: 13px;
    padding: 3px 12px;
    border-radius: 0;
    border: 1px solid #00FF00;
    background: #000;
    color: #00FF00;
    cursor: pointer;
  }
  .mac-btn::before { content: '['; margin-right: 4px; }
  .mac-btn::after { content: ']'; margin-left: 4px; }
  .mac-btn:hover { background: #002200; }
  .mac-btn:active { background: #00FF00; color: #000; }
  .mac-btn-primary { background: #00FF00; color: #000; }
  .mac-btn-primary:hover { background: #00DD00; }
  .task-card { color: #00FF00 !important; }
  .task-card:hover { background: #001A00 !important; }
  .col-drop-active { background: #001A00 !important; outline: 1px dashed #00FF00; }
  @keyframes blink { 50% { opacity: 0; } }
`;

const theme = {
  id: 'terminal',
  label: 'Terminal',
  FONT,
  ...colors,
  desktopBgImage: 'none',
  desktopBgSize: 'auto',
  titleBarBgImage: 'none',
  titleBarBg: '#001100',
  titleTextBg: 'transparent',
  titleTextColor: '#00FF00',
  windowBorder: '1px solid #00FF00',
  windowShadow: '0 0 8px rgba(0,255,0,0.2)',
  cardBorder: '1px dashed #00FF00',
  cardBg: '#000000',
  cardHoverBg: '#001A00',
  desktop: {
    minHeight: '100vh',
    background: '#000',
    fontFamily: FONT,
    fontSize: 13,
    color: '#00FF00',
  },
  window: {
    background: '#000',
    border: '1px solid #00FF00',
    boxShadow: '0 0 8px rgba(0,255,0,0.2)',
  },
  titleBar: {
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 8,
    borderBottom: '1px dashed #00FF00',
    fontWeight: 'bold',
    fontSize: 12,
    background: '#001100',
    color: '#00FF00',
  },
  input: {
    width: '100%',
    padding: '4px 6px',
    fontSize: 13,
    fontFamily: FONT,
    border: '1px solid #00FF00',
    background: '#000',
    color: '#00FF00',
  },
  button: {
    fontFamily: FONT,
    fontSize: 13,
    padding: '3px 12px',
    borderRadius: 0,
    border: '1px solid #00FF00',
    background: '#000',
    color: '#00FF00',
    cursor: 'pointer',
  },
  link: {
    color: '#00FF00',
    textDecoration: 'underline',
    fontFamily: FONT,
    fontSize: 13,
    cursor: 'pointer',
  },
  GLOBAL_CSS,
};

export default theme;
