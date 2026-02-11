/**
 * Example: React Hook for MXW01 Thermal Printer
 * 
 * This is a reference implementation showing how to integrate
 * the mxw01-thermal-printer core library with React.
 * 
 * Usage:
 * ```tsx
 * import { useThermalPrinter } from './react-hook';
 * 
 * function PrinterComponent() {
 *   const {
 *     isConnected,
 *     isPrinting,
 *     connectPrinter,
 *     printCanvas
 *   } = useThermalPrinter();
 * 
 *   return (
 *     <div>
 *       <button onClick={connectPrinter}>Connect</button>
 *       {isConnected && <button onClick={() => printCanvas(myCanvas)}>Print</button>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useEffect, useRef, useCallback, useReducer } from "react";
import { 
  ThermalPrinterClient,
  WebBluetoothAdapter,
  type PrinterState,
  type DitherMethod
} from "mxw01-thermal-printer";

/**
 * Hook state interface
 */
interface HookState {
  isConnected: boolean;
  isPrinting: boolean;
  printerState: PrinterState | null;
  statusMessage: string;
  ditherMethod: DitherMethod;
  printIntensity: number;
}

/**
 * Hook state actions
 */
type HookAction =
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_PRINTING"; payload: boolean }
  | { type: "SET_PRINTER_STATE"; payload: PrinterState | null }
  | { type: "SET_STATUS"; payload: string }
  | { type: "SET_DITHER"; payload: DitherMethod }
  | { type: "SET_INTENSITY"; payload: number }
  | { type: "SYNC_CLIENT"; payload: Partial<HookState> };

/**
 * State reducer
 */
function hookReducer(state: HookState, action: HookAction): HookState {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload };
    case "SET_PRINTING":
      return { ...state, isPrinting: action.payload };
    case "SET_PRINTER_STATE":
      return { ...state, printerState: action.payload };
    case "SET_STATUS":
      return { ...state, statusMessage: action.payload };
    case "SET_DITHER":
      return { ...state, ditherMethod: action.payload };
    case "SET_INTENSITY":
      return { ...state, printIntensity: action.payload };
    case "SYNC_CLIENT":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

/**
 * Initial state
 */
const initialState: HookState = {
  isConnected: false,
  isPrinting: false,
  printerState: null,
  statusMessage: "Ready to connect printer",
  ditherMethod: "steinberg",
  printIntensity: 0x5d,
};

export interface ThermalPrinterHook {
  isConnected: boolean;
  isPrinting: boolean;
  printerState: PrinterState | null;
  statusMessage: string;
  ditherMethod: DitherMethod;
  printIntensity: number;
  connectPrinter: () => Promise<void>;
  printCanvas: (
    canvas: HTMLCanvasElement,
    options?: Partial<{
      dither: DitherMethod;
      brightness: number;
      intensity: number;
    }>
  ) => Promise<void>;
  getPrinterStatus: () => Promise<PrinterState | null>;
  disconnect: () => Promise<void>;
  setDitherMethod: (method: DitherMethod) => void;
  setPrintIntensity: (intensity: number) => void;
}

/**
 * React hook for thermal printer
 * Optimized with useReducer and single useEffect
 */
export function useThermalPrinter(): ThermalPrinterHook {
  const clientRef = useRef<ThermalPrinterClient | null>(null);
  const [state, dispatch] = useReducer(hookReducer, initialState);

  // Initialize client and setup event listeners
  useEffect(() => {
    try {
      const adapter = new WebBluetoothAdapter();
      const client = new ThermalPrinterClient(adapter);
      clientRef.current = client;

      // Subscribe to all client events
      const unsubscribeConnected = client.on("connected", () => {
        dispatch({ type: "SET_CONNECTED", payload: true });
      });

      const unsubscribeDisconnected = client.on("disconnected", () => {
        dispatch({ type: "SET_CONNECTED", payload: false });
        dispatch({ type: "SET_PRINTER_STATE", payload: null });
      });

      const unsubscribeStateChange = client.on("stateChange", (event) => {
        dispatch({ type: "SET_PRINTER_STATE", payload: event.state });
      });

      const unsubscribeError = client.on("error", (event) => {
        console.error("Printer error:", event.error);
      });

      // Sync state from client periodically
      const syncInterval = setInterval(() => {
        dispatch({
          type: "SYNC_CLIENT",
          payload: {
            statusMessage: client.statusMessage,
            isPrinting: client.isPrinting,
          },
        });
      }, 100);

      // Cleanup on unmount
      return () => {
        unsubscribeConnected();
        unsubscribeDisconnected();
        unsubscribeStateChange();
        unsubscribeError();
        clearInterval(syncInterval);
        client.dispose();
      };
    } catch (error) {
      console.error("Failed to initialize printer client:", error);
      dispatch({
        type: "SET_STATUS",
        payload: `Initialization error: ${(error as Error).message}`,
      });
    }
  }, []);

  const connectPrinter = useCallback(async () => {
    if (!clientRef.current) {
      throw new Error("Printer client not initialized");
    }

    try {
      await clientRef.current.connect();
      dispatch({ type: "SET_STATUS", payload: clientRef.current.statusMessage });
    } catch (error) {
      dispatch({
        type: "SET_STATUS",
        payload: `Connection error: ${(error as Error).message}`,
      });
      throw error;
    }
  }, []);

  const getPrinterStatus = useCallback(async () => {
    if (!clientRef.current) {
      return null;
    }

    const printerState = await clientRef.current.getStatus();
    if (printerState) {
      dispatch({ type: "SET_PRINTER_STATE", payload: printerState });
    }
    dispatch({ type: "SET_STATUS", payload: clientRef.current.statusMessage });
    return printerState;
  }, []);

  const printCanvas = useCallback(
    async (
      canvas: HTMLCanvasElement,
      options: Partial<{
        dither: DitherMethod;
        brightness: number;
        intensity: number;
      }> = {}
    ) => {
      if (!clientRef.current) {
        throw new Error("Printer client not initialized");
      }

      try {
        dispatch({ type: "SET_PRINTING", payload: true });

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        await clientRef.current.print(imageData, options);

        dispatch({ type: "SET_STATUS", payload: clientRef.current.statusMessage });
      } catch (error) {
        dispatch({
          type: "SET_STATUS",
          payload: `Print error: ${(error as Error).message}`,
        });
        throw error;
      } finally {
        dispatch({ type: "SET_PRINTING", payload: false });
      }
    },
    []
  );

  const disconnect = useCallback(async () => {
    if (!clientRef.current) {
      return;
    }

    await clientRef.current.disconnect();
    dispatch({ type: "SET_STATUS", payload: clientRef.current.statusMessage });
  }, []);

  const setDitherMethod = useCallback((method: DitherMethod) => {
    dispatch({ type: "SET_DITHER", payload: method });
    clientRef.current?.setDitherMethod(method);
  }, []);

  const setPrintIntensity = useCallback((intensity: number) => {
    dispatch({ type: "SET_INTENSITY", payload: intensity });
    clientRef.current?.setPrintIntensity(intensity);
  }, []);

  return {
    isConnected: state.isConnected,
    isPrinting: state.isPrinting,
    printerState: state.printerState,
    statusMessage: state.statusMessage,
    ditherMethod: state.ditherMethod,
    printIntensity: state.printIntensity,
    connectPrinter,
    printCanvas,
    getPrinterStatus,
    disconnect,
    setDitherMethod,
    setPrintIntensity,
  };
}

export default useThermalPrinter;
