import {
  PRINTER_CONFIG,
  AgentReceiptData,
} from "../constants/printer.constants";

interface PrintResponse {
  success: boolean;
  message: string;
}

interface StatusResponse {
  status: string;
  storeName?: string;
  version?: string;
}

interface ConfigResponse {
  storeName: string;
  address?: string;
  phone?: string;
  email?: string;
  logoPath?: string;
  printerName?: string;
}

/**
 * Client-side API for communicating directly with the printing agent
 * This runs on the client side and communicates with the local agent
 */
class PrintingAgentAPI {
  private baseUrl: string;
  private timeout: number;

  constructor(agentUrl?: string) {
    this.baseUrl = agentUrl || PRINTER_CONFIG.DEFAULT_AGENT_URL;
    this.timeout = PRINTER_CONFIG.AGENT_TIMEOUT;
  }

  /**
   * Update the agent URL
   */
  setAgentUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get current agent URL
   */
  getAgentUrl(): string {
    return this.baseUrl;
  }

  /**
   * Make a request to the agent with timeout
   */
  private async makeRequest(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Print a receipt using the agent
   */
  async printReceipt(receiptData: AgentReceiptData): Promise<PrintResponse> {
    try {
      console.log("=== SENDING TO PRINTING AGENT ===");
      console.log("Agent URL:", this.baseUrl);
      console.log("Receipt Data:", receiptData);

      const response = await this.makeRequest(
        `${this.baseUrl}${PRINTER_CONFIG.AGENT_ENDPOINTS.PRINT}`,
        {
          method: "POST",
          body: JSON.stringify(receiptData),
        },
      );

      if (!response.ok) {
        throw new Error(`Agent responded with status: ${response.status}`);
      }

      const result = await response.json();

      console.log("=== AGENT RESPONSE ===");
      console.log("Response:", result);

      return {
        success: result.success || false,
        message: result.message || result.error || "Unknown response",
      };
    } catch (error: any) {
      console.error("Failed to communicate with printing agent:", error);

      if (
        error.message?.includes("fetch") ||
        error.message?.includes("NetworkError") ||
        error.message?.includes("timeout")
      ) {
        return {
          success: false,
          message:
            "Printing agent is not running. Please start the printing agent and try again.",
        };
      }

      return {
        success: false,
        message: `Failed to print: ${error.message}`,
      };
    }
  }

  /**
   * Test connection to the agent
   */
  async testConnection(): Promise<PrintResponse> {
    try {
      console.log("=== TESTING AGENT CONNECTION ===");
      console.log("Agent URL:", this.baseUrl);

      const response = await this.makeRequest(
        `${this.baseUrl}${PRINTER_CONFIG.AGENT_ENDPOINTS.STATUS}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        throw new Error(`Agent responded with status: ${response.status}`);
      }

      const result: StatusResponse = await response.json();

      console.log("=== AGENT STATUS ===");
      console.log("Status:", result);

      return {
        success: true,
        message: `Connected to printing agent: ${result.storeName || "Unknown Store"}`,
      };
    } catch (error: any) {
      console.error("Failed to test agent connection:", error);

      if (
        error.message?.includes("fetch") ||
        error.message?.includes("NetworkError") ||
        error.message?.includes("timeout")
      ) {
        return {
          success: false,
          message:
            "Printing agent is not running. Please start the printing agent.",
        };
      }

      return {
        success: false,
        message: `Failed to connect: ${error.message}`,
      };
    }
  }

  /**
   * Test print with sample data
   */
  async testPrint(): Promise<PrintResponse> {
    const testData: AgentReceiptData = {
      orderId: "TEST-001",
      sale_number: "TEST-001",
      sale_date: new Date().toISOString(),
      customer_name:
        PRINTER_CONFIG.DEFAULT_RECEIPT_SETTINGS.defaultCustomerName,
      customer_phone: "555-0123",
      branch: {
        name: "Test Branch",
        address: "123 Test Street",
        phone: "555-0100",
        email: "test@example.com",
      },
      user: {
        name: "Test Cashier",
        id: "1",
      },
      items: [
        {
          name: "Test Item",
          quantity: 1,
          unit_price: 10.0,
          line_total: 10.0,
          discount_amount: 0,
        },
      ],
      subtotal: 10.0,
      tax_amount: 0.8,
      discount_amount: 0,
      shipping_cost: 0,
      total_amount: 10.8,
      received_amount: 20.0,
      change_amount: 9.2,
      payments: [
        {
          payment_method: "Cash",
          amount: 20.0,
        },
      ],
      payment_status: "PAID",
      notes: PRINTER_CONFIG.DEFAULT_RECEIPT_SETTINGS.thankYouMessage,
      openCashDrawer: false, // Don't open drawer for test
    };

    return this.printReceipt(testData);
  }

  /**
   * Get agent configuration
   */
  async getConfig(): Promise<ConfigResponse | null> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}${PRINTER_CONFIG.AGENT_ENDPOINTS.CONFIG}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        throw new Error(`Agent responded with status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error("Failed to get agent config:", error);
      return null;
    }
  }

  /**
   * Update agent configuration
   */
  async updateConfig(config: Partial<ConfigResponse>): Promise<PrintResponse> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}${PRINTER_CONFIG.AGENT_ENDPOINTS.CONFIG}`,
        {
          method: "POST",
          body: JSON.stringify(config),
        },
      );

      if (!response.ok) {
        throw new Error(`Agent responded with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success || false,
        message: result.message || "Configuration updated successfully",
      };
    } catch (error: any) {
      console.error("Failed to update agent config:", error);
      return {
        success: false,
        message: `Failed to update configuration: ${error.message}`,
      };
    }
  }
}

// Export a singleton instance
export const printingAgentAPI = new PrintingAgentAPI();

// Export the class for creating custom instances
export { PrintingAgentAPI };

// Export types
export type { PrintResponse, StatusResponse, ConfigResponse };
