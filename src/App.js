import React from "react";
import './App.css';
const Animation = React.lazy(() => import('./components/Animation'));

function App() {
    const properties = {
        bgColor: 'rgb(17,17,19)',
        particleColor: 'rgb(255,40,40)',
        particleRadius: 3,
        particleCount: 80,
        particleMaxVelocity: 0.35,
        lineLength: 150,
        particleLife: 20
    };
  return (
      <div className="App">
        <Animation properties={properties}/>
      </div>
  );
}

export default App;
