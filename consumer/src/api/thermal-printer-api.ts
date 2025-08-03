import { AgentReceiptData, PrinterSettings } from '../constants/printer.constants';
import { get, post } from './crud-api';
import { endpoints } from './endpoints';

export interface PrintResponse {
  success: boolean;
  message: string;
  receiptData?: AgentReceiptData;
}

export interface TestAgentResponse {
  success: boolean;
  message: string;
}

export const thermalPrinterApi = {
  // Prepare receipt data (backend will format, frontend will print)
  prepareReceipt: async (saleId: number, settings?: PrinterSettings): Promise<PrintResponse> => {
    return await post(endpoints.prepareReceipt(saleId), settings || {});
  },

  // Preview a receipt (get data without printing)
  previewReceipt: async (saleId: number, settings?: PrinterSettings): Promise<PrintResponse> => {
    const queryParams = new URLSearchParams();
    if (settings?.printerName) queryParams.append('printerName', settings.printerName);
    if (settings?.paperWidth) queryParams.append('paperWidth', settings.paperWidth.toString());
    if (settings?.encoding) queryParams.append('encoding', settings.encoding);
    if (settings?.autocut !== undefined) queryParams.append('autocut', settings.autocut.toString());
    if (settings?.buzzer !== undefined) queryParams.append('buzzer', settings.buzzer.toString());
    if (settings?.agentUrl) queryParams.append('agentUrl', settings.agentUrl);

    const url = queryParams.toString() 
      ? `${endpoints.previewReceipt(saleId)}?${queryParams.toString()}`
      : endpoints.previewReceipt(saleId);
      
    return await get(url);
  },

  // Get test receipt data from backend
  getTestData: async (): Promise<{ receiptData: AgentReceiptData }> => {
    return await get(endpoints.getTestReceiptData);
  },

  // Get current printer settings
  getPrinterSettings: async (): Promise<{ success: boolean; data: PrinterSettings }> => {
    return await get(endpoints.getPrinterSettings);
  },

  // Update printer settings
  updatePrinterSettings: async (settings: PrinterSettings): Promise<{ 
    success: boolean; 
    message: string; 
    data: PrinterSettings 
  }> => {
    return await post(endpoints.updatePrinterSettings, settings);
  },
};
