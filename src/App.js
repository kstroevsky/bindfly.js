import { RouterProvider } from "react-router-dom";
import router from "./router";

function App() {
  return (
    <div id="App">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
