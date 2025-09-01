/**
 * PDF to Markdown Converter - Export Manager
 * Handles file downloads, ZIP creation, and export functionality
 */

class ExportManager {
  constructor() {
    this.exportQueue = [];
    this.isExporting = false;
    this.zipLibrary = null;
    this.initializeZipLibrary();
  }

  /**
   * Initialize ZIP library (using JSZip if available)
   */
  async initializeZipLibrary() {
    try {
      // Try to load JSZip dynamically if not already loaded
      if (!window.JSZip) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => {
          this.zipLibrary = window.JSZip;
        };
        document.head.appendChild(script);
      } else {
        this.zipLibrary = window.JSZip;
      }
    } catch (error) {
      Utils.logError(error, 'ExportManager.initializeZipLibrary');
    }
  }

  /**
   * Export a single file as Markdown
   * @param {Object} result - Conversion result
   * @param {Object} options - Export options
   * @returns {Promise<void>}
   */
  async exportSingleFile(result, options = {}) {
    try {
      const filename = this.generateFilename(result.originalFilename, options);
      const content = result.markdown;
      
      // Create blob and download
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      
      if (window.saveAs && typeof window.saveAs === 'function') {
        // Use FileSaver.js if available
        window.saveAs(blob, filename);
      } else {
        // Fallback to manual download
        Utils.downloadFile(blob, filename);
      }

      // Track export
      this.trackExport({
        type: 'single',
        filename,
        size: blob.size,
        timestamp: new Date()
      });

      Utils.showNotification('success', 'Export Complete', `File exported as ${filename}`);

    } catch (error) {
      Utils.logError(error, 'ExportManager.exportSingleFile', { filename: result.originalFilename });
      Utils.showNotification('error', 'Export Failed', `Failed to export ${result.originalFilename}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export multiple files as individual downloads
   * @param {Array} results - Array of conversion results
   * @param {Object} options - Export options
   * @returns {Promise<void>}
   */
  async exportMultipleFiles(results, options = {}) {
    try {
      this.isExporting = true;
      const exportedFiles = [];
      const failedFiles = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        
        try {
          await this.exportSingleFile(result, options);
          exportedFiles.push(result.originalFilename);
          
          // Add delay between downloads to avoid browser blocking
          if (i < results.length - 1) {
            await this.delay(500);
          }
        } catch (error) {
          failedFiles.push({
            filename: result.originalFilename,
            error: error.message
          });
        }
      }

      // Show summary notification
      if (failedFiles.length === 0) {
        Utils.showNotification('success', 'Batch Export Complete', 
          `Successfully exported ${exportedFiles.length} files`);
      } else {
        Utils.showNotification('warning', 'Batch Export Completed with Errors', 
          `Exported ${exportedFiles.length} files, ${failedFiles.length} failed`);
      }

      return {
        exported: exportedFiles,
        failed: failedFiles
      };

    } catch (error) {
      Utils.logError(error, 'ExportManager.exportMultipleFiles');
      throw error;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export multiple files as a ZIP archive
   * @param {Array} results - Array of conversion results
   * @param {Object} options - Export options
   * @returns {Promise<void>}
   */
  async exportAsZip(results, options = {}) {
    try {
      if (!this.zipLibrary) {
        throw new Error('ZIP library not available');
      }

      this.isExporting = true;
      const zip = new this.zipLibrary();
      const zipFilename = options.zipFilename || this.generateZipFilename();
      
      // Add files to ZIP
      for (const result of results) {
        const filename = this.generateFilename(result.originalFilename, options);
        const content = result.markdown;
        
        zip.file(filename, content);
        
        // Add images if available and requested
        if (options.includeImages && result.images && result.images.length > 0) {
          const imagesFolder = zip.folder(`${Utils.removeFileExtension(filename)}_images`);
          
          for (const image of result.images) {
            if (image.data) {
              imagesFolder.file(image.name, image.data, { base64: true });
            }
          }
        }
      }

      // Add metadata file if requested
      if (options.includeMetadata) {
        const metadata = this.generateMetadataFile(results);
        zip.file('conversion_metadata.json', JSON.stringify(metadata, null, 2));
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      });

      // Download ZIP file
      if (window.saveAs && typeof window.saveAs === 'function') {
        window.saveAs(zipBlob, zipFilename);
      } else {
        Utils.downloadFile(zipBlob, zipFilename);
      }

      // Track export
      this.trackExport({
        type: 'zip',
        filename: zipFilename,
        fileCount: results.length,
        size: zipBlob.size,
        timestamp: new Date()
      });

      Utils.showNotification('success', 'ZIP Export Complete', 
        `Created ${zipFilename} with ${results.length} files`);

    } catch (error) {
      Utils.logError(error, 'ExportManager.exportAsZip');
      Utils.showNotification('error', 'ZIP Export Failed', `Failed to create ZIP archive: ${error.message}`);
      throw error;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Generate filename for exported file
   * @param {string} originalFilename - Original PDF filename
   * @param {Object} options - Export options
   * @returns {string} Generated filename
   */
  generateFilename(originalFilename, options = {}) {
    const template = options.filenameTemplate || '{name}.md';
    const baseName = Utils.removeFileExtension(originalFilename);
    const sanitizedName = Utils.sanitizeFilename(baseName);
    
    const replacements = {
      name: sanitizedName,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      datetime: new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
    };

    let filename = template;
    for (const [key, value] of Object.entries(replacements)) {
      filename = filename.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    // Ensure .md extension
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    return filename;
  }

  /**
   * Generate ZIP filename
   * @returns {string} ZIP filename
   */
  generateZipFilename() {
    const date = new Date().toISOString().split('T')[0];
    return `pdf-to-markdown-export-${date}.zip`;
  }

  /**
   * Generate metadata file content
   * @param {Array} results - Conversion results
   * @returns {Object} Metadata object
   */
  generateMetadataFile(results) {
    return {
      exportInfo: {
        timestamp: new Date().toISOString(),
        generator: 'PDF to Markdown Converter',
        version: '1.0.0',
        fileCount: results.length
      },
      files: results.map(result => ({
        originalFilename: result.originalFilename,
        exportedFilename: this.generateFilename(result.originalFilename),
        originalSize: result.originalSize,
        markdownSize: result.markdown ? result.markdown.length : 0,
        pageCount: result.pageCount,
        processingTime: result.processingTime,
        metadata: result.metadata,
        hasImages: result.images && result.images.length > 0,
        imageCount: result.images ? result.images.length : 0
      })),
      statistics: this.calculateExportStatistics(results)
    };
  }

  /**
   * Calculate export statistics
   * @param {Array} results - Conversion results
   * @returns {Object} Statistics object
   */
  calculateExportStatistics(results) {
    const totalOriginalSize = results.reduce((sum, r) => sum + (r.originalSize || 0), 0);
    const totalMarkdownSize = results.reduce((sum, r) => sum + (r.markdown ? r.markdown.length : 0), 0);
    const totalPages = results.reduce((sum, r) => sum + (r.pageCount || 0), 0);
    const totalProcessingTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0);
    const totalImages = results.reduce((sum, r) => sum + (r.images ? r.images.length : 0), 0);

    return {
      totalFiles: results.length,
      totalOriginalSize,
      totalMarkdownSize,
      totalPages,
      totalProcessingTime,
      totalImages,
      averageProcessingTime: results.length > 0 ? totalProcessingTime / results.length : 0,
      compressionRatio: totalOriginalSize > 0 ? totalMarkdownSize / totalOriginalSize : 0
    };
  }

  /**
   * Export conversion results as JSON
   * @param {Array} results - Conversion results
   * @param {Object} options - Export options
   * @returns {Promise<void>}
   */
  async exportAsJson(results, options = {}) {
    try {
      const filename = options.filename || `conversion-results-${Date.now()}.json`;
      const exportData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          generator: 'PDF to Markdown Converter',
          version: '1.0.0'
        },
        results: results.map(result => ({
          ...result,
          // Remove large binary data to keep JSON manageable
          images: result.images ? result.images.map(img => ({
            ...img,
            data: img.data ? '[Binary Data Removed]' : undefined
          })) : undefined
        }))
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      
      if (window.saveAs && typeof window.saveAs === 'function') {
        window.saveAs(blob, filename);
      } else {
        Utils.downloadFile(blob, filename);
      }

      Utils.showNotification('success', 'JSON Export Complete', `Exported data as ${filename}`);

    } catch (error) {
      Utils.logError(error, 'ExportManager.exportAsJson');
      Utils.showNotification('error', 'JSON Export Failed', `Failed to export JSON: ${error.message}`);
      throw error;
    }
  }

  /**
   * Copy markdown content to clipboard
   * @param {string} markdown - Markdown content
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(markdown) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(markdown);
        Utils.showNotification('success', 'Copied to Clipboard', 'Markdown content copied successfully');
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = markdown;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (success) {
          Utils.showNotification('success', 'Copied to Clipboard', 'Markdown content copied successfully');
          return true;
        } else {
          throw new Error('Copy command failed');
        }
      }
    } catch (error) {
      Utils.logError(error, 'ExportManager.copyToClipboard');
      Utils.showNotification('error', 'Copy Failed', 'Failed to copy content to clipboard');
      return false;
    }
  }

  /**
   * Track export operation
   * @param {Object} exportInfo - Export information
   */
  trackExport(exportInfo) {
    try {
      // Store in localStorage for analytics
      const exports = JSON.parse(localStorage.getItem('pdfToMarkdownExports') || '[]');
      exports.push(exportInfo);
      
      // Keep only last 100 exports
      if (exports.length > 100) {
        exports.splice(0, exports.length - 100);
      }
      
      localStorage.setItem('pdfToMarkdownExports', JSON.stringify(exports));
    } catch (error) {
      Utils.logError(error, 'ExportManager.trackExport');
    }
  }

  /**
   * Get export history
   * @returns {Array} Export history
   */
  getExportHistory() {
    try {
      return JSON.parse(localStorage.getItem('pdfToMarkdownExports') || '[]');
    } catch (error) {
      Utils.logError(error, 'ExportManager.getExportHistory');
      return [];
    }
  }

  /**
   * Clear export history
   */
  clearExportHistory() {
    try {
      localStorage.removeItem('pdfToMarkdownExports');
      Utils.showNotification('info', 'History Cleared', 'Export history has been cleared');
    } catch (error) {
      Utils.logError(error, 'ExportManager.clearExportHistory');
    }
  }

  /**
   * Check if currently exporting
   * @returns {boolean} Export status
   */
  isCurrentlyExporting() {
    return this.isExporting;
  }

  /**
   * Cancel current export operation
   */
  cancelExport() {
    this.isExporting = false;
    Utils.showNotification('info', 'Export Cancelled', 'Export operation has been cancelled');
  }

  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate export options
   * @param {Object} options - Export options
   * @returns {Object} Validation result
   */
  validateExportOptions(options) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (options.filenameTemplate && typeof options.filenameTemplate !== 'string') {
      result.valid = false;
      result.errors.push('Filename template must be a string');
    }

    if (options.zipFilename && typeof options.zipFilename !== 'string') {
      result.valid = false;
      result.errors.push('ZIP filename must be a string');
    }

    if (options.includeImages && !this.zipLibrary) {
      result.warnings.push('Image inclusion requires ZIP library');
    }

    return result;
  }

  /**
   * Get supported export formats
   * @returns {Array} Supported formats
   */
  getSupportedFormats() {
    const formats = [
      {
        name: 'Markdown',
        extension: '.md',
        mimeType: 'text/markdown',
        description: 'Individual Markdown files'
      },
      {
        name: 'JSON',
        extension: '.json',
        mimeType: 'application/json',
        description: 'Conversion results as JSON'
      }
    ];

    if (this.zipLibrary) {
      formats.push({
        name: 'ZIP Archive',
        extension: '.zip',
        mimeType: 'application/zip',
        description: 'Multiple files in ZIP archive'
      });
    }

    return formats;
  }
}

// Export for use in other modules
window.ExportManager = ExportManager;
