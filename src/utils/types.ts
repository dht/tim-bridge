export type PrintTextDirection = 'auto' | 'ltr' | 'rtl';
export type PrintTextVariant = 'normal' | 'compact';

// Reference-only types for thermal printer text rendering options.
export interface PrintTextOptions {
  direction?: PrintTextDirection;
  variant?: PrintTextVariant;
  lineGap?: number;
  intensity?: number;
  mode?: number;
  minDataLines?: number;
  feedLinesBeforePrint?: number;
  feedLinesAfterPrint?: number;
  dataWriteDelayMs?: number;
  printTimeoutMs?: number;
}

export interface ThermalPrinterOptions {
  targetAddress?: string;
  controlUuid?: string;
  notifyUuid?: string;
  dataUuid?: string;
  printerWidth?: number;
  minDataLines?: number;
  intensity?: number;
  threshold?: number;
  dataWriteDelayMs?: number;
  connectTimeoutMs?: number;
  responseTimeoutMs?: number;
  printTimeoutMs?: number;
  textVariant?: PrintTextVariant;
  lineGap?: number;
  feedLinesBeforePrint?: number;
  feedLinesAfterPrint?: number;
}
