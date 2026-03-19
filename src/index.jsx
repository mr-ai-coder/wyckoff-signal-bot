import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './main.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

6. **"Commit changes"** klicken

---

**Datei 2 — `index.html` aktualisieren:**

1. Geh zurück zum Hauptordner
2. Klick auf `index.html`
3. Klick das **Stift-Symbol** (Edit)
4. Ändere diese eine Zeile:

**Alt:**
```
<script type="module" src="/src/main.jsx"></script>
```
**Neu:**
```
<script type="module" src="/src/index.jsx"></script>
