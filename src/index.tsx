import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import reportWebVitals from './reportWebVitals';

import './index.css';

const root: HTMLElement = document.getElementById('root') || document.body;

ReactDOM.createRoot(root).render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

if (typeof importScripts === 'function') {
	importScripts(
		new URL(`${window.location.origin}/canvasWorker.js`, import.meta.url)
	);
}

export default root;
