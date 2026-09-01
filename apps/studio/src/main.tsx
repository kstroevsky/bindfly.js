import { createRoot } from 'react-dom/client'

import { StudioApp } from './studio-app.tsx'
import './styles.css'

const app = document.getElementById('app')
if (!app) throw new Error("Studio element '#app' is missing.")

const route = '#/lab/flying-lines'
if (!window.location.hash) window.location.hash = route

createRoot(app).render(window.location.hash === route
	? <StudioApp />
	: <main className="error"><h1>Unknown route</h1><p>Use <code>{route}</code>.</p></main>)
