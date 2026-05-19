import { Link } from 'react-router-dom';
import App from './App';
import { MAC } from '../styles/mac';

export default function Landing() {
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'fixed',
          top: 28,
          right: 8,
          zIndex: 9999,
          background: MAC.chrome,
          border: '2px solid #000',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
          minWidth: 220,
        }}
      >
        <div style={{ ...MAC.titleBar, height: 18 }}>
          <span style={{ background: MAC.chrome, padding: '0 8px', fontSize: 11 }}>Demo</span>
        </div>
        <div
          style={{
            padding: '8px 10px',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
          }}
        >
          <a
            href="https://github.com/gabelev/chaos_dimension"
            target="_blank"
            rel="noreferrer"
            style={MAC.link}
          >
            → View source on GitHub
          </a>
          <Link to="/about" style={MAC.link}>
            → About this project
          </Link>
          <Link to="/login" style={MAC.link}>
            → Owner login
          </Link>
        </div>
      </div>
      <App mode="demo" />
    </div>
  );
}
