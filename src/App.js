import React from "react";
import './App.css';
const Animation = React.lazy(() => import('./components/Animation'));

function App() {

  return (
      <div className="App">
        <Animation />
      </div>
  );
}

export default App;
