/**
 * Downloads a billing history PDF for a specific consumer
 * 
 * @param {number} consumerId - The ID of the consumer
 * @param {object} options - Additional options
 * @param {string} options.baseUrl - The base URL of the API (default: '/api')
 * @param {boolean} options.openInNewTab - Whether to open the PDF in a new tab (default: false)
 * @returns {Promise<void>} - A promise that resolves when the download is initiated
 */
export async function downloadBillingHistoryPdf(
    consumerId,
    { baseUrl = '/api', openInNewTab = false } = {}
  ) {
    try {
      // Form the URL
      const url = `${baseUrl}/billing/${consumerId}/history/pdf`;
      
      if (openInNewTab) {
        // Open in a new tab - this won't trigger a download but will open the PDF in the browser
        window.open(url, '_blank');
        return;
      }
      
      // Initiate download
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          // Add any authentication headers if needed
          // 'Authorization': `Bearer ${token}`,
        },
      });
      
      // Check if the request was successful
      if (!response.ok) {
        // Handle error based on status code
        if (response.status === 404) {
          throw new Error(`Consumer with ID ${consumerId} not found`);
        }
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Get the filename from the Content-Disposition header if available
      let filename = `Consumer-${consumerId}-Billing-History.pdf`;
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Create a temporary anchor element and trigger the download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      console.log(`Billing history PDF for consumer ${consumerId} downloaded successfully`);
    } catch (error) {
      console.error('Error downloading billing history PDF:', error);
      throw error;
    }
  }
  
  // Example usage (client-side):
  // downloadBillingHistoryPdf(1);
  // downloadBillingHistoryPdf(1, { openInNewTab: true });