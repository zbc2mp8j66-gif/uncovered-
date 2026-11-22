import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Decor from './Decor.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Decor />
    <App />
  </StrictMode>,
)
