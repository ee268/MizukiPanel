import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { PanelThemeProvider } from "./theme";
import "./fonts.css";
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PanelThemeProvider>
      <RouterProvider router={router} />
    </PanelThemeProvider>
  </React.StrictMode>,
);
