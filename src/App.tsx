import React, { FC, MouseEvent, PointerEvent } from "react";
import { RouterProvider } from "react-router-dom";
import router from "./router";

export const App: FC = () => (
  <div
    id="App"
    onContextMenu={(e: MouseEvent<HTMLDivElement> & PointerEvent<HTMLDivElement>) => {
      const { button, clientX, clientY, pointerType = 'click' } = e.nativeEvent;
      const isTouchByPosition = (clientX !== 1 && clientX !== 0 && clientY !== 1 || clientY !== 0)

      if (button !== 2 && isTouchByPosition || pointerType === 'touch') e.preventDefault()
    }}
  >
    <RouterProvider router={router} />
  </div>
);

export default App;
