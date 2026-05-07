import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'

// StrictMode disabled because MapLibre GL doesn't tolerate the synthetic
// double-mount (it removes the WebGL context on cleanup, then re-init fails).
createRoot(document.getElementById('root')).render(<App />)
