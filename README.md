# Bindfly.js

## About the Project

Bindfly.js is a TypeScript project that focuses on creating an optimization canvas-based animations. This project is designed to handle multiple parameters dynamically to control the animation. It uses various strategies for performance optimization. You can try it [here](https://bindfly.onrender.com/#/FlyingLines-AddByClick).

## Technical Details

The project uses modern web technologies including React, WebGL, three.js, and WebWorkers API to manage and display animations efficiently. The use of TypeScript ensures type safety and enhances code maintainability. It employs a combination of both 2D and WebGL animations to provide a visually appealing experience.

Significant technical components include:
- **WebGL and Canvas Integration**: Leveraging WebGL for rendering complex 2D and 3D graphics.
- **three.js**: Several test animations based on three.js library. 
- **Web Workers and OffScreen**: Utilizing web workers to handle offscreen-provided intensive calculations off the main thread, ensuring smooth UI interactions.
- **React and Router Integration**: Employing React for UI components along with React Router for app navigation.
- **Custom Hooks**: Implementing custom React hooks to manage canvas context, resizing, and re-rendering based on interactions and animations.

## How to Run

First, clone the repository and install the dependencies:
```bash
git clone https://github.com/kstroevsky/bindfly.js.git
cd bindfly.js
```

Secondly, install the dependencies and build the project.
```bash
npm install
npm run build
```

Then you need to run the project. For the production mode you need to use `start` command. Development mode has the its own run-script (`start:dev`).
```bash
npm run start
```

## Example

https://github.com/kstroevsky/bindfly.js/assets/38957112/1adb7e5c-52c0-4f34-b495-5e7bdd8cbabc
