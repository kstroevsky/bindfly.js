import React from "react";
import ReactDOM from "react-dom/client";

import reportWebVitals from "./reportWebVitals";

import App from "./App";

import "./index.css";

export const root = document.getElementById("root")

ReactDOM.createRoot(root).render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
