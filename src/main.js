import { createRoot } from "react-dom/client";
import App from "./components/App";
import "@geotab/zenith/dist/index.css";
import "./styles/addin.css";

/**
 * Fleet Utilization & Exception Tracker — MyGeotab Add-In (React + Zenith)
 *
 * Lifecycle bridge: translates MyGeotab add-in lifecycle (initialize/focus/blur)
 * into React component method calls via a ref.
 */
geotab.addin.fleetUtilization = function () {
  "use strict";

  let root = null;
  let appRef = null;

  return {
    initialize(api, state, callback) {
      const container = document.getElementById("fleetUtilization");
      root = createRoot(container);

      root.render(
        <App
          ref={(ref) => { appRef = ref; }}
          api={api}
          state={state}
        />
      );

      // Give React a tick to mount, then signal ready
      setTimeout(() => callback(), 0);
    },

    focus(api) {
      if (appRef && appRef.onFocus) {
        appRef.onFocus(api);
      }
    },

    blur() {
      if (appRef && appRef.onBlur) {
        appRef.onBlur();
      }
    },
  };
};
