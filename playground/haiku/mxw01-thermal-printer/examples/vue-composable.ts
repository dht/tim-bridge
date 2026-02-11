/**
 * Example: Vue 3 Composable for MXW01 Thermal Printer
 * 
 * This is a reference implementation showing how to integrate
 * the mxw01-thermal-printer core library with Vue 3 Composition API.
 * 
 * Usage:
 * ```vue
 * <script setup lang="ts">
 * import { useThermalPrinter } from './vue-composable';
 * 
 * const {
 *   isConnected,
 *   isPrinting,
 *   statusMessage,
 *   connectPrinter,
 *   printCanvas
 * } = useThermalPrinter();
 * 
 * const handlePrint = async () => {
 *   const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
 *   await printCanvas(canvas);
 * };
 * </script>
 * 
 * <template>
 *   <div>
 *     <button @click="connectPrinter">Connect</button>
 *     <button v-if="isConnected" @click="handlePrint">Print</button>
 *     <p>{{ statusMessage }}</p>
 *   </div>
 * </template>
 * ```
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import {
  ThermalPrinterClient,
  WebBluetoothAdapter,
  type PrinterState,
  type DitherMethod
} from 'mxw01-thermal-printer';

export interface ThermalPrinterComposable {
  isConnected: Ref<boolean>;
  isPrinting: Ref<boolean>;
  printerState: Ref<PrinterState | null>;
  statusMessage: Ref<string>;
  ditherMethod: Ref<DitherMethod>;
  printIntensity: Ref<number>;
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
 * Vue 3 composable for thermal printer
 */
export function useThermalPrinter(): ThermalPrinterComposable {
  // Reactive state
  const isConnected = ref(false);
  const isPrinting = ref(false);
  const printerState = ref<PrinterState | null>(null);
  const statusMessage = ref('Ready to connect printer');
  const ditherMethod = ref<DitherMethod>('steinberg');
  const printIntensity = ref(0x5d);

  // Client instance (non-reactive)
  let client: ThermalPrinterClient | null = null;
  let syncInterval: ReturnType<typeof setInterval> | null = null;

  // Initialize client and setup event listeners
  onMounted(() => {
    try {
      const adapter = new WebBluetoothAdapter();
      client = new ThermalPrinterClient(adapter);

      // Subscribe to client events
      client.on('connected', () => {
        isConnected.value = true;
      });

      client.on('disconnected', () => {
        isConnected.value = false;
        printerState.value = null;
      });

      client.on('stateChange', (event) => {
        printerState.value = event.state;
      });

      client.on('error', (event) => {
        console.error('Printer error:', event.error);
      });

      // Sync state from client periodically
      syncInterval = setInterval(() => {
        if (client) {
          statusMessage.value = client.statusMessage;
          isPrinting.value = client.isPrinting;
        }
      }, 100);
    } catch (error) {
      console.error('Failed to initialize printer client:', error);
      statusMessage.value = `Initialization error: ${(error as Error).message}`;
    }
  });

  // Cleanup on unmount
  onUnmounted(() => {
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    if (client) {
      client.dispose();
    }
  });

  const connectPrinter = async () => {
    if (!client) {
      throw new Error('Printer client not initialized');
    }

    try {
      await client.connect();
      statusMessage.value = client.statusMessage;
    } catch (error) {
      statusMessage.value = `Connection error: ${(error as Error).message}`;
      throw error;
    }
  };

  const getPrinterStatus = async () => {
    if (!client) {
      return null;
    }

    const state = await client.getStatus();
    if (state) {
      printerState.value = state;
    }
    statusMessage.value = client.statusMessage;
    return state;
  };

  const printCanvas = async (
    canvas: HTMLCanvasElement,
    options: Partial<{
      dither: DitherMethod;
      brightness: number;
      intensity: number;
    }> = {}
  ) => {
    if (!client) {
      throw new Error('Printer client not initialized');
    }

    try {
      isPrinting.value = true;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      await client.print(imageData, options);

      statusMessage.value = client.statusMessage;
    } catch (error) {
      statusMessage.value = `Print error: ${(error as Error).message}`;
      throw error;
    } finally {
      isPrinting.value = false;
    }
  };

  const disconnect = async () => {
    if (!client) {
      return;
    }

    await client.disconnect();
    statusMessage.value = client.statusMessage;
  };

  const setDitherMethod = (method: DitherMethod) => {
    ditherMethod.value = method;
    client?.setDitherMethod(method);
  };

  const setPrintIntensity = (intensity: number) => {
    printIntensity.value = intensity;
    client?.setPrintIntensity(intensity);
  };

  return {
    isConnected,
    isPrinting,
    printerState,
    statusMessage,
    ditherMethod,
    printIntensity,
    connectPrinter,
    printCanvas,
    getPrinterStatus,
    disconnect,
    setDitherMethod,
    setPrintIntensity,
  };
}

export default useThermalPrinter;
