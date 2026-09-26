import { createRoot } from 'react-dom/client'

import { StudioApp } from './studio-app.tsx'
import { installStage16CollaborationBrowserHarness } from './stage-16-collaboration-browser-harness.ts'
import { defaultStudioRoute, isStudioRoute } from './studio-route.ts'
import './styles.css'

const app = document.getElementById('app')
if (!app) throw new Error("Studio element '#app' is missing.")

if (!window.location.hash) window.location.hash = defaultStudioRoute

if (new URL(window.location.href).searchParams.get('stage16CollaborationHarness') === '1') {
	Object.assign(window, { __bindflyStage16Collaboration: installStage16CollaborationBrowserHarness() })
}

createRoot(app).render(isStudioRoute(new URL(window.location.href))
	? <StudioApp />
	: <main className="error"><h1>Unknown route</h1><p>Use <code>{defaultStudioRoute}</code>.</p></main>)
