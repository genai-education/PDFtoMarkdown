/**
 * PDF to Markdown Converter - Utility Functions
 * Provides common utility functions used throughout the application
 */

class Utils {
  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format duration in human readable format
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  static formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Generate a unique ID
   * @returns {string} Unique identifier
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Sanitize filename for safe usage
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(filename) {
    return filename
      .replace(/[^a-z0-9.-]/gi, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Get file extension from filename
   * @param {string} filename - Filename
   * @returns {string} File extension
   */
  static getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }

  /**
   * Remove file extension from filename
   * @param {string} filename - Filename
   * @returns {string} Filename without extension
   */
  static removeFileExtension(filename) {
    return filename.replace(/\.[^/.]+$/, '');
  }

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Deep clone an object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = Utils.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  /**
   * Check if a value is empty
   * @param {*} value - Value to check
   * @returns {boolean} True if empty
   */
  static isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create a download link for a file
   * @param {Blob} blob - File blob
   * @param {string} filename - Filename
   */
  static downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Read file as text
   * @param {File} file - File to read
   * @returns {Promise<string>} File content as text
   */
  static readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Read file as array buffer
   * @param {File} file - File to read
   * @returns {Promise<ArrayBuffer>} File content as array buffer
   */
  static readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Validate PDF file
   * @param {File} file - File to validate
   * @returns {Object} Validation result
   */
  static validatePdfFile(file) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check file type
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      result.valid = false;
      result.errors.push('File must be a PDF document');
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      result.valid = false;
      result.errors.push(`File size exceeds 50MB limit (${Utils.formatFileSize(file.size)})`);
    }

    // Check for empty file
    if (file.size === 0) {
      result.valid = false;
      result.errors.push('File is empty');
    }

    // Warnings for large files
    const warningSize = 10 * 1024 * 1024; // 10MB
    if (file.size > warningSize) {
      result.warnings.push('Large file may take longer to process');
    }

    return result;
  }

  /**
   * Calculate processing statistics
   * @param {Array} files - Array of processed files
   * @returns {Object} Statistics object
   */
  static calculateStats(files) {
    const total = files.length;
    const completed = files.filter(f => f.status === 'completed').length;
    const failed = files.filter(f => f.status === 'failed').length;
    const pending = files.filter(f => f.status === 'pending').length;
    const processing = files.filter(f => f.status === 'processing').length;

    const successRate = total > 0 ? Math.round((completed / total) * 100) : 100;
    
    const totalSize = files.reduce((sum, f) => sum + (f.outputSize || 0), 0);
    const totalTime = files.reduce((sum, f) => sum + (f.processingTime || 0), 0);

    return {
      total,
      completed,
      failed,
      pending,
      processing,
      successRate,
      totalSize,
      totalTime,
      averageTime: total > 0 ? totalTime / total : 0
    };
  }

  /**
   * Create a notification element
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {number} duration - Auto-hide duration in milliseconds
   * @returns {HTMLElement} Notification element
   */
  static createNotification(type, title, message, duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    notification.innerHTML = `
      <div class="notification-icon">${icons[type] || icons.info}</div>
      <div class="notification-content">
        <div class="notification-title">${Utils.escapeHtml(title)}</div>
        <div class="notification-message">${Utils.escapeHtml(message)}</div>
      </div>
      <button class="notification-close" aria-label="Close notification">×</button>
      <div class="notification-progress"></div>
    `;

    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, duration);
    }

    return notification;
  }

  /**
   * Show notification
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {number} duration - Auto-hide duration
   */
  static showNotification(type, title, message, duration = 5000) {
    const container = document.getElementById('notifications');
    if (container) {
      const notification = Utils.createNotification(type, title, message, duration);
      container.appendChild(notification);
    }
  }

  /**
   * Clear all notifications
   */
  static clearNotifications() {
    const container = document.getElementById('notifications');
    if (container) {
      container.innerHTML = '';
    }
  }

  /**
   * Log error with context
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {Object} data - Additional data
   */
  static logError(error, context = '', data = {}) {
    console.error(`[${context}]`, error, data);
    
    // In production, you might want to send this to an error tracking service
    if (window.errorTracker) {
      window.errorTracker.captureException(error, {
        context,
        data,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export for use in other modules
window.Utils = Utils;
