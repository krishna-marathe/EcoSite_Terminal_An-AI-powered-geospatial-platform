import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { retireLegacyGeminiCredential } from './services/mitigation'
import { setWorkerUrl } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// Let Vite resolve the worker outside its optimized dependency bundle.
setWorkerUrl(mapWorkerUrl)

retireLegacyGeminiCredential()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
