import React, { FC, MouseEvent, PointerEvent, Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import Loader from './components/Loader';
import router from './router';

export const App: FC = () => (
  <div
    id="App"
    onContextMenu={(
      e: MouseEvent<HTMLDivElement> & PointerEvent<HTMLDivElement>
    ) => {
      const { button, clientX, clientY, pointerType = 'click' } = e.nativeEvent;
      const isTouchByPosition =
        (clientX !== 1 && clientX !== 0 && clientY !== 1) || clientY !== 0;

      if ((button !== 2 && isTouchByPosition) || pointerType === 'touch')
        e.preventDefault();
    }}>
    <Suspense fallback={<Loader size={200} />}>
      <RouterProvider router={router} />
    </Suspense>
  </div>
);

export default App;
