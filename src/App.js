import React from "react";
import './App.css';
const Animation = React.lazy(() => import('./components/Animation'));

function App() {
    const properties = {
        bgColor: 'rgba(0, 0, 0, 0.7)',
        particleColors: ['rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
        particleRadius: 3,
        particleCount: 100,
        particleMaxVelocity: 2,
        lineLength: 520,
        particleLife: 30,
        margin: 20,
        isMonochrome: false,
        isCountStable: false,
        isImmortal: true,
        addByClick: true,
        switchByClick: true,
        // randomXByClick: false,
        // randomYByClick: false,
        // isAutoGenerate: false,
        // autoGenerateTimeOut: 10,
        // autoGeneratePosition: 'random'
    };
  return (
      <div className="App">
        <Animation properties={properties}/>
      </div>
  );
}

export default App;
