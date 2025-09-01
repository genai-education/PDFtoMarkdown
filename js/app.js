/**
 * PDF to Markdown Converter - Main Application
 * Coordinates all components and manages the user interface
 */

class PDFToMarkdownApp {
  constructor() {
    this.pdfProcessor = new PDFProcessor();
    this.structureAnalyzer = new StructureAnalyzer();
    this.markdownGenerator = new MarkdownGenerator();
    this.exportManager = new ExportManager();
    
    this.fileQueue = [];
    this.conversionResults = [];
    this.isProcessing = false;
    this.isPaused = false;
    this.currentFileIndex = 0;
    
    this.settings = this.loadSettings();
    this.statistics = {
      totalFiles: 0,
      successfulConversions: 0,
      failedConversions: 0,
      totalProcessingTime: 0
    };

    this.initializeEventListeners();
    this.initializeUI();
    this.updateUI();
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // File upload events
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('file-drop-zone');

    fileInput?.addEventListener('change', (e) => this.handleFileSelection(e.target.files));
    
    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', (e) => this.handleDragOver(e));
    dropZone?.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    dropZone?.addEventListener('drop', (e) => this.handleFileDrop(e));

    // Keyboard navigation for drop zone
    dropZone?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput?.click();
      }
    });

    // Processing controls
    document.getElementById('start-processing')?.addEventListener('click', () => this.startProcessing());
    document.getElementById('pause-processing')?.addEventListener('click', () => this.pauseProcessing());
    document.getElementById('cancel-processing')?.addEventListener('click', () => this.cancelProcessing());

    // Queue management
    document.getElementById('clear-completed')?.addEventListener('click', () => this.clearCompletedFiles());
    document.getElementById('retry-failed')?.addEventListener('click', () => this.retryFailedFiles());

    // Results management
    document.getElementById('download-all')?.addEventListener('click', () => this.downloadAllResults());
    document.getElementById('download-zip')?.addEventListener('click', () => this.downloadResultsAsZip());
    document.getElementById('clear-results')?.addEventListener('click', () => this.clearResults());

    // Settings and help
    document.getElementById('settings-btn')?.addEventListener('click', () => this.openSettings());
    document.getElementById('help-btn')?.addEventListener('click', () => this.openHelp());
    document.getElementById('close-settings')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('close-help-modal')?.addEventListener('click', () => this.closeHelp());

    // Modal close events
    document.getElementById('close-error-modal')?.addEventListener('click', () => this.closeErrorModal());
    document.getElementById('error-dismiss')?.addEventListener('click', () => this.closeErrorModal());
    document.getElementById('error-retry')?.addEventListener('click', () => this.retryLastOperation());

    // Settings form events
    this.initializeSettingsEvents();

    // Preview events
    this.initializePreviewEvents();

    // Window events
    window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
    window.addEventListener('resize', () => this.handleWindowResize());
  }

  /**
   * Initialize settings form events
   */
  initializeSettingsEvents() {
    // Markdown flavor
    document.getElementById('markdown-flavor')?.addEventListener('change', (e) => {
      this.settings.markdownFlavor = e.target.value;
      this.saveSettings();
      this.markdownGenerator.updateOptions({ flavor: e.target.value });
    });

    // Conversion options
    const checkboxSettings = [
      'preserve-images', 'preserve-tables', 'preserve-links', 
      'smart-headings', 'add-metadata', 'add-toc'
    ];

    checkboxSettings.forEach(id => {
      const element = document.getElementById(id);
      element?.addEventListener('change', (e) => {
        const settingKey = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        this.settings[settingKey] = e.target.checked;
        this.saveSettings();
        this.updateMarkdownGeneratorOptions();
      });
    });

    // Filename template
    document.getElementById('filename-template')?.addEventListener('change', (e) => {
      this.settings.filenameTemplate = e.target.value;
      this.saveSettings();
    });

    // Performance settings
    document.getElementById('max-concurrent')?.addEventListener('input', (e) => {
      this.settings.maxConcurrent = parseInt(e.target.value);
      document.getElementById('max-concurrent-value').textContent = e.target.value;
      this.saveSettings();
    });

    document.getElementById('chunk-size')?.addEventListener('change', (e) => {
      this.settings.chunkSize = e.target.value;
      this.saveSettings();
    });
  }

  /**
   * Initialize preview events
   */
  initializePreviewEvents() {
    document.getElementById('preview-tab-markdown')?.addEventListener('click', () => {
      this.switchPreviewTab('markdown');
    });

    document.getElementById('preview-tab-rendered')?.addEventListener('click', () => {
      this.switchPreviewTab('rendered');
    });

    document.getElementById('close-preview')?.addEventListener('click', () => {
      this.closePreview();
    });
  }

  /**
   * Initialize UI components
   */
  initializeUI() {
    // Load settings into UI
    this.loadSettingsIntoUI();
    
    // Initialize tooltips and accessibility
    this.initializeAccessibility();
    
    // Check for required dependencies
    this.checkDependencies();
  }

  /**
   * Load settings into UI elements
   */
  loadSettingsIntoUI() {
    // Markdown flavor
    const flavorSelect = document.getElementById('markdown-flavor');
    if (flavorSelect) flavorSelect.value = this.settings.markdownFlavor;

    // Checkboxes
    const checkboxMappings = {
      'preserve-images': 'preserveImages',
      'preserve-tables': 'preserveTables',
      'preserve-links': 'preserveLinks',
      'smart-headings': 'smartHeadings',
      'add-metadata': 'addMetadata',
      'add-toc': 'addToc'
    };

    Object.entries(checkboxMappings).forEach(([id, setting]) => {
      const element = document.getElementById(id);
      if (element) element.checked = this.settings[setting];
    });

    // Filename template
    const filenameTemplate = document.getElementById('filename-template');
    if (filenameTemplate) filenameTemplate.value = this.settings.filenameTemplate;

    // Performance settings
    const maxConcurrent = document.getElementById('max-concurrent');
    const maxConcurrentValue = document.getElementById('max-concurrent-value');
    if (maxConcurrent) {
      maxConcurrent.value = this.settings.maxConcurrent;
      if (maxConcurrentValue) maxConcurrentValue.textContent = this.settings.maxConcurrent;
    }

    const chunkSize = document.getElementById('chunk-size');
    if (chunkSize) chunkSize.value = this.settings.chunkSize;
  }

  /**
   * Initialize accessibility features
   */
  initializeAccessibility() {
    // Add ARIA labels and descriptions
    const elements = document.querySelectorAll('[data-tooltip]');
    elements.forEach(element => {
      const tooltip = element.getAttribute('data-tooltip');
      element.setAttribute('title', tooltip);
      element.setAttribute('aria-label', tooltip);
    });

    // Ensure proper focus management
    this.setupFocusManagement();
  }

  /**
   * Setup focus management for modals and panels
   */
  setupFocusManagement() {
    // Focus trap for modals
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeModal(modal);
        }
        if (e.key === 'Tab') {
          this.trapFocus(e, modal);
        }
      });
    });
  }

  /**
   * Trap focus within a container
   * @param {Event} e - Keyboard event
   * @param {HTMLElement} container - Container element
   */
  trapFocus(e, container) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Check for required dependencies
   */
  checkDependencies() {
    const dependencies = [
      { name: 'PDF.js', check: () => window.pdfjsLib, required: true },
      { name: 'Turndown', check: () => window.TurndownService, required: true },
      { name: 'DOMPurify', check: () => window.DOMPurify, required: false },
      { name: 'FileSaver', check: () => window.saveAs, required: false }
    ];

    const missing = dependencies.filter(dep => !dep.check());
    const requiredMissing = missing.filter(dep => dep.required);

    if (requiredMissing.length > 0) {
      const missingNames = requiredMissing.map(dep => dep.name).join(', ');
      this.showError('Missing Dependencies', 
        `Required libraries not loaded: ${missingNames}. Please refresh the page.`);
      return false;
    }

    if (missing.length > 0) {
      const missingNames = missing.map(dep => dep.name).join(', ');
      Utils.showNotification('warning', 'Optional Dependencies Missing', 
        `Some features may be limited: ${missingNames}`);
    }

    return true;
  }

  /**
   * Handle file selection
   * @param {FileList} files - Selected files
   */
  handleFileSelection(files) {
    if (!files || files.length === 0) return;

    const validFiles = [];
    const invalidFiles = [];

    Array.from(files).forEach(file => {
      const validation = Utils.validatePdfFile(file);
      if (validation.valid) {
        validFiles.push(file);
        if (validation.warnings.length > 0) {
          Utils.showNotification('warning', 'File Warning', 
            `${file.name}: ${validation.warnings.join(', ')}`);
        }
      } else {
        invalidFiles.push({ file, errors: validation.errors });
      }
    });

    // Show errors for invalid files
    invalidFiles.forEach(({ file, errors }) => {
      Utils.showNotification('error', 'Invalid File', 
        `${file.name}: ${errors.join(', ')}`);
    });

    // Add valid files to queue
    if (validFiles.length > 0) {
      this.addFilesToQueue(validFiles);
      Utils.showNotification('success', 'Files Added', 
        `Added ${validFiles.length} file(s) to queue`);
    }
  }

  /**
   * Handle drag over event
   * @param {DragEvent} e - Drag event
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('file-drop-zone');
    dropZone?.classList.add('drag-over');
  }

  /**
   * Handle drag leave event
   * @param {DragEvent} e - Drag event
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('file-drop-zone');
    dropZone?.classList.remove('drag-over');
  }

  /**
   * Handle file drop event
   * @param {DragEvent} e - Drop event
   */
  handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const dropZone = document.getElementById('file-drop-zone');
    dropZone?.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    this.handleFileSelection(files);
  }

  /**
   * Add files to processing queue
   * @param {Array} files - Files to add
   */
  addFilesToQueue(files) {
    files.forEach(file => {
      const queueItem = {
        id: Utils.generateId(),
        file,
        filename: file.name,
        size: file.size,
        status: 'pending',
        progress: 0,
        error: null,
        result: null,
        addedAt: new Date()
      };
      
      this.fileQueue.push(queueItem);
    });

    this.updateUI();
    this.renderFileQueue();
  }

  /**
   * Start processing files in queue
   */
  async startProcessing() {
    if (this.isProcessing || this.fileQueue.length === 0) return;

    this.isProcessing = true;
    this.isPaused = false;
    this.currentFileIndex = 0;

    this.updateProcessingUI();
    
    try {
      const pendingFiles = this.fileQueue.filter(item => item.status === 'pending');
      
      for (let i = 0; i < pendingFiles.length && !this.isPaused; i++) {
        this.currentFileIndex = i;
        const fileItem = pendingFiles[i];
        
        await this.processFile(fileItem);
        
        // Update overall progress
        const overallProgress = Math.round(((i + 1) / pendingFiles.length) * 100);
        this.updateOverallProgress(overallProgress, i + 1, pendingFiles.length);
      }

      if (!this.isPaused) {
        this.completeProcessing();
      }

    } catch (error) {
      Utils.logError(error, 'PDFToMarkdownApp.startProcessing');
      this.showError('Processing Error', error.message);
    } finally {
      this.isProcessing = false;
      this.updateProcessingUI();
    }
  }

  /**
   * Process a single file
   * @param {Object} fileItem - File queue item
   */
  async processFile(fileItem) {
    try {
      fileItem.status = 'processing';
      fileItem.startTime = Date.now();
      
      this.updateFileItemUI(fileItem);
      this.updateCurrentFileProgress(fileItem.filename, 0, 'Starting...');

      // Process PDF
      const progressCallback = (progress, status) => {
        fileItem.progress = progress;
        this.updateFileItemUI(fileItem);
        this.updateCurrentFileProgress(fileItem.filename, progress, status);
      };

      const extractedContent = await this.pdfProcessor.processPDF(
        fileItem.file, 
        this.getProcessingOptions(), 
        progressCallback
      );

      // Analyze structure
      progressCallback(85, 'Analyzing structure...');
      const structureAnalysis = this.structureAnalyzer.analyzeStructure(extractedContent, this.settings);

      // Generate markdown
      progressCallback(95, 'Generating markdown...');
      const markdown = this.markdownGenerator.generateMarkdown({
        ...extractedContent,
        structure: { ...extractedContent.structure, ...structureAnalysis }
      }, this.getMarkdownOptions());

      // Complete processing
      fileItem.status = 'completed';
      fileItem.progress = 100;
      fileItem.endTime = Date.now();
      fileItem.processingTime = fileItem.endTime - fileItem.startTime;
      fileItem.result = {
        originalFilename: fileItem.filename,
        originalSize: fileItem.size,
        markdown,
        metadata: extractedContent.metadata,
        pageCount: extractedContent.pageCount,
        images: extractedContent.images,
        processingTime: fileItem.processingTime
      };

      this.conversionResults.push(fileItem.result);
      this.statistics.successfulConversions++;

      progressCallback(100, 'Complete');
      this.updateFileItemUI(fileItem);

    } catch (error) {
      fileItem.status = 'failed';
      fileItem.error = error.message;
      fileItem.endTime = Date.now();
      fileItem.processingTime = fileItem.endTime - (fileItem.startTime || Date.now());
      
      this.statistics.failedConversions++;
      this.updateFileItemUI(fileItem);
      
      Utils.logError(error, 'PDFToMarkdownApp.processFile', { filename: fileItem.filename });
    }

    this.statistics.totalFiles++;
    this.statistics.totalProcessingTime += fileItem.processingTime || 0;
    this.updateStatistics();
  }

  /**
   * Get processing options from settings
   * @returns {Object} Processing options
   */
  getProcessingOptions() {
    return {
      preserveImages: this.settings.preserveImages,
      chunkSize: this.settings.chunkSize,
      maxConcurrent: this.settings.maxConcurrent
    };
  }

  /**
   * Get markdown generation options from settings
   * @returns {Object} Markdown options
   */
  getMarkdownOptions() {
    return {
      flavor: this.settings.markdownFlavor,
      preserveImages: this.settings.preserveImages,
      preserveTables: this.settings.preserveTables,
      preserveLinks: this.settings.preserveLinks,
      smartHeadings: this.settings.smartHeadings,
      addMetadata: this.settings.addMetadata,
      addToc: this.settings.addToc
    };
  }

  /**
   * Update markdown generator options
   */
  updateMarkdownGeneratorOptions() {
    this.markdownGenerator.updateOptions(this.getMarkdownOptions());
  }

  /**
   * Pause processing
   */
  pauseProcessing() {
    this.isPaused = true;
    this.updateProcessingUI();
    Utils.showNotification('info', 'Processing Paused', 'Processing has been paused');
  }

  /**
   * Cancel processing
   */
  cancelProcessing() {
    this.isPaused = true;
    this.isProcessing = false;
    
    // Cancel current PDF processing
    this.pdfProcessor.cancelProcessing();
    
    // Reset pending files
    this.fileQueue.forEach(item => {
      if (item.status === 'processing') {
        item.status = 'pending';
        item.progress = 0;
        item.error = null;
      }
    });

    this.updateProcessingUI();
    this.renderFileQueue();
    Utils.showNotification('info', 'Processing Cancelled', 'Processing has been cancelled');
  }

  /**
   * Complete processing
   */
  completeProcessing() {
    const completedCount = this.fileQueue.filter(item => item.status === 'completed').length;
    const failedCount = this.fileQueue.filter(item => item.status === 'failed').length;
    
    let message = `Processing complete: ${completedCount} successful`;
    if (failedCount > 0) {
      message += `, ${failedCount} failed`;
    }

    Utils.showNotification('success', 'Processing Complete', message);
    
    // Auto-download if enabled
    if (this.settings.autoDownload && completedCount > 0) {
      setTimeout(() => this.downloadAllResults(), 1000);
    }

    this.updateUI();
  }

  /**
   * Load settings from localStorage
   * @returns {Object} Settings object
   */
  loadSettings() {
    const defaultSettings = {
      markdownFlavor: 'github',
      preserveImages: true,
      preserveTables: true,
      preserveLinks: true,
      smartHeadings: true,
      addMetadata: true,
      addToc: false,
      filenameTemplate: '{name}.md',
      maxConcurrent: 2,
      chunkSize: 'medium',
      autoDownload: true
    };

    try {
      const saved = localStorage.getItem('pdfToMarkdownSettings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch (error) {
      Utils.logError(error, 'PDFToMarkdownApp.loadSettings');
      return defaultSettings;
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem('pdfToMarkdownSettings', JSON.stringify(this.settings));
    } catch (error) {
      Utils.logError(error, 'PDFToMarkdownApp.saveSettings');
    }
  }

  /**
   * Update UI elements
   */
  updateUI() {
    this.updateStatusBar();
    this.updateProcessingSection();
    this.updateQueueSection();
    this.updateResultsSection();
  }

  /**
   * Update status bar
   */
  updateStatusBar() {
    const statusElement = document.getElementById('app-status');
    const filesProcessedElement = document.getElementById('files-processed');
    const successRateElement = document.getElementById('success-rate');

    if (statusElement) {
      if (this.isProcessing) {
        statusElement.textContent = 'Processing';
        statusElement.className = 'status-value processing';
      } else if (this.fileQueue.some(item => item.status === 'failed')) {
        statusElement.textContent = 'Error';
        statusElement.className = 'status-value error';
      } else {
        statusElement.textContent = 'Ready';
        statusElement.className = 'status-value ready';
      }
    }

    if (filesProcessedElement) {
      filesProcessedElement.textContent = this.statistics.totalFiles;
    }

    if (successRateElement) {
      const total = this.statistics.successfulConversions + this.statistics.failedConversions;
      const rate = total > 0 ? Math.round((this.statistics.successfulConversions / total) * 100) : 100;
      successRateElement.textContent = `${rate}%`;
    }
  }

  /**
   * Update processing section visibility and controls
   */
  updateProcessingSection() {
    const section = document.getElementById('processing-section');
    const startBtn = document.getElementById('start-processing');
    const pauseBtn = document.getElementById('pause-processing');
    const cancelBtn = document.getElementById('cancel-processing');

    const hasPendingFiles = this.fileQueue.some(item => item.status === 'pending');

    if (section) {
      section.classList.toggle('hidden', this.fileQueue.length === 0);
    }

    if (startBtn) {
      startBtn.disabled = !hasPendingFiles || this.isProcessing;
      startBtn.classList.toggle('hidden', this.isProcessing);
    }

    if (pauseBtn) {
      pauseBtn.classList.toggle('hidden', !this.isProcessing);
    }

    if (cancelBtn) {
      cancelBtn.classList.toggle('hidden', !this.isProcessing);
    }
  }

  /**
   * Update processing UI elements
   */
  updateProcessingUI() {
    this.updateProcessingSection();
    this.updateStatusBar();
  }

  /**
   * Update overall progress
   * @param {number} progress - Progress percentage
   * @param {number} current - Current file number
   * @param {number} total - Total files
   */
  updateOverallProgress(progress, current, total) {
    const progressBar = document.getElementById('overall-progress-bar');
    const progressText = document.getElementById('overall-progress-text');

    if (progressBar) {
      const fill = progressBar.querySelector('.progress-fill');
      if (fill) fill.style.width = `${progress}%`;
      progressBar.setAttribute('aria-valuenow', progress);
    }

    if (progressText) {
      progressText.textContent = `${current} / ${total} files`;
    }
  }

  /**
   * Update current file progress
   * @param {string} filename - Current filename
   * @param {number} progress - Progress percentage
   * @param {string} status - Status message
   */
  updateCurrentFileProgress(filename, progress, status) {
    const progressBar = document.getElementById('current-progress-bar');
    const filenameElement = document.getElementById('current-file-name');
    const statusElement = document.getElementById('processing-status');

    if (progressBar) {
      const fill = progressBar.querySelector('.progress-fill');
      if (fill) fill.style.width = `${progress}%`;
      progressBar.setAttribute('aria-valuenow', progress);
    }

    if (filenameElement) {
      filenameElement.textContent = filename;
    }

    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  /**
   * Update queue section
   */
  updateQueueSection() {
    const section = document.getElementById('file-queue-section');
    const totalElement = document.getElementById('total-files');
    const pendingElement = document.getElementById('pending-files');
    const completedElement = document.getElementById('completed-files');
    const failedElement = document.getElementById('failed-files');

    if (section) {
      section.classList.toggle('hidden', this.fileQueue.length === 0);
    }

    const stats = {
      total: this.fileQueue.length,
      pending: this.fileQueue.filter(item => item.status === 'pending').length,
      completed: this.fileQueue.filter(item => item.status === 'completed').length,
      failed: this.fileQueue.filter(item => item.status === 'failed').length
    };

    if (totalElement) totalElement.textContent = stats.total;
    if (pendingElement) pendingElement.textContent = stats.pending;
    if (completedElement) completedElement.textContent = stats.completed;
    if (failedElement) failedElement.textContent = stats.failed;
  }

  /**
   * Update results section
   */
  updateResultsSection() {
    const section = document.getElementById('results-section');
    const downloadAllBtn = document.getElementById('download-all');
    const downloadZipBtn = document.getElementById('download-zip');

    if (section) {
      section.classList.toggle('hidden', this.conversionResults.length === 0);
    }

    const hasResults = this.conversionResults.length > 0;
    if (downloadAllBtn) downloadAllBtn.disabled = !hasResults;
    if (downloadZipBtn) downloadZipBtn.disabled = !hasResults;

    this.updateResultsStats();
    this.renderResults();
  }

  /**
   * Update results statistics
   */
  updateResultsStats() {
    const successRateElement = document.getElementById('conversion-success-rate');
    const totalSizeElement = document.getElementById('total-output-size');
    const processingTimeElement = document.getElementById('total-processing-time');

    if (successRateElement) {
      const rate = this.statistics.totalFiles > 0 ? 
        Math.round((this.statistics.successfulConversions / this.statistics.totalFiles) * 100) : 100;
      successRateElement.textContent = `${rate}%`;
    }

    if (totalSizeElement) {
      const totalSize = this.conversionResults.reduce((sum, result) => 
        sum + (result.markdown ? result.markdown.length : 0), 0);
      totalSizeElement.textContent = Utils.formatFileSize(totalSize);
    }

    if (processingTimeElement) {
      processingTimeElement.textContent = Utils.formatDuration(this.statistics.totalProcessingTime);
    }
  }

  /**
   * Update statistics display
   */
  updateStatistics() {
    this.updateResultsStats();
    this.updateStatusBar();
  }

  /**
   * Render file queue
   */
  renderFileQueue() {
    const container = document.getElementById('file-queue');
    if (!container) return;

    container.innerHTML = '';

    this.fileQueue.forEach(item => {
      const element = this.createQueueItemElement(item);
      container.appendChild(element);
    });
  }

  /**
   * Create queue item element
   * @param {Object} item - Queue item
   * @returns {HTMLElement} Queue item element
   */
  createQueueItemElement(item) {
    const div = document.createElement('div');
    div.className = 'queue-item';
    div.setAttribute('role', 'listitem');

    const statusIcons = {
      pending: '⏳',
      processing: '⚙️',
      completed: '✅',
      failed: '❌'
    };

    div.innerHTML = `
      <div class="queue-item-icon">${statusIcons[item.status] || '📄'}</div>
      <div class="queue-item-info">
        <div class="queue-item-name">${Utils.escapeHtml(item.filename)}</div>
        <div class="queue-item-details">
          <span>Size: ${Utils.formatFileSize(item.size)}</span>
          ${item.processingTime ? `<span>Time: ${Utils.formatDuration(item.processingTime)}</span>` : ''}
          ${item.error ? `<span>Error: ${Utils.escapeHtml(item.error)}</span>` : ''}
        </div>
      </div>
      <div class="queue-item-status ${item.status}">
        ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        ${item.status === 'processing' ? `(${item.progress}%)` : ''}
      </div>
      <div class="queue-item-actions">
        ${item.status === 'completed' ? 
          `<button class="queue-item-button" onclick="app.previewResult('${item.id}')" title="Preview">👁️</button>
           <button class="queue-item-button" onclick="app.downloadResult('${item.id}')" title="Download">📥</button>` : ''}
        ${item.status === 'failed' ? 
          `<button class="queue-item-button" onclick="app.retryFile('${item.id}')" title="Retry">🔄</button>` : ''}
        <button class="queue-item-button" onclick="app.removeFromQueue('${item.id}')" title="Remove">🗑️</button>
      </div>
    `;

    return div;
  }

  /**
   * Update file item UI
   * @param {Object} item - File item
   */
  updateFileItemUI(item) {
    this.renderFileQueue();
    this.updateQueueSection();
  }

  /**
   * Render results
   */
  renderResults() {
    const container = document.getElementById('results-list');
    if (!container) return;

    container.innerHTML = '';

    this.conversionResults.forEach((result, index) => {
      const element = this.createResultItemElement(result, index);
      container.appendChild(element);
    });
  }

  /**
   * Create result item element
   * @param {Object} result - Conversion result
   * @param {number} index - Result index
   * @returns {HTMLElement} Result item element
   */
  createResultItemElement(result, index) {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.setAttribute('role', 'listitem');

    div.innerHTML = `
      <div class="result-item-icon">📄</div>
      <div class="result-item-info">
        <div class="result-item-name">${Utils.escapeHtml(result.originalFilename)}</div>
        <div class="result-item-details">
          <span>Original: ${Utils.formatFileSize(result.originalSize)}</span>
          <span>Markdown: ${Utils.formatFileSize(result.markdown.length)}</span>
          <span>Pages: ${result.pageCount}</span>
          <span>Time: ${Utils.formatDuration(result.processingTime)}</span>
        </div>
      </div>
      <div class="result-item-actions">
        <button class="result-item-button" onclick="app.previewResultByIndex(${index})" title="Preview">👁️</button>
        <button class="result-item-button" onclick="app.copyResultToClipboard(${index})" title="Copy">📋</button>
        <button class="result-item-button primary" onclick="app.downloadResultByIndex(${index})" title="Download">📥</button>
      </div>
    `;

    return div;
  }

  /**
   * Handle window resize
   */
  handleWindowResize() {
    // Adjust UI for different screen sizes
    const sidebar = document.getElementById('sidebar');
    const appContainer = document.getElementById('app');
    
    if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('hidden')) {
      // On mobile, make sidebar full screen
      sidebar.style.width = '100%';
      sidebar.style.height = '100vh';
      sidebar.style.position = 'fixed';
      sidebar.style.top = '0';
      sidebar.style.left = '0';
      sidebar.style.zIndex = '1050';
    }
  }

  /**
   * Handle before unload
   * @param {Event} e - Before unload event
   */
  handleBeforeUnload(e) {
    if (this.isProcessing) {
      e.preventDefault();
      e.returnValue = 'Processing is in progress. Are you sure you want to leave?';
      return e.returnValue;
    }
  }

  // UI Action Methods

  /**
   * Open settings panel
   */
  openSettings() {
    const sidebar = document.getElementById('sidebar');
    const settingsPanel = document.getElementById('settings-panel');
    const previewPanel = document.getElementById('preview-panel');
    const appContainer = document.getElementById('app');

    if (sidebar && settingsPanel) {
      sidebar.classList.remove('hidden');
      settingsPanel.classList.remove('hidden');
      previewPanel?.classList.add('hidden');
      appContainer?.classList.add('sidebar-open');
      
      // Focus first input in settings
      const firstInput = settingsPanel.querySelector('input, select, button');
      firstInput?.focus();
    }
  }

  /**
   * Close settings panel
   */
  closeSettings() {
    const sidebar = document.getElementById('sidebar');
    const appContainer = document.getElementById('app');

    if (sidebar) {
      sidebar.classList.add('hidden');
      appContainer?.classList.remove('sidebar-open');
    }
  }

  /**
   * Open help modal
   */
  openHelp() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.classList.remove('hidden');
      
      // Focus first focusable element
      const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      firstFocusable?.focus();
    }
  }

  /**
   * Close help modal
   */
  closeHelp() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * Show error modal
   * @param {string} title - Error title
   * @param {string} message - Error message
   * @param {Error} error - Error object (optional)
   */
  showError(title, message, error = null) {
    const modal = document.getElementById('error-modal');
    const titleElement = document.getElementById('error-title');
    const messageElement = document.getElementById('error-message');
    const stackElement = document.getElementById('error-stack');

    if (modal && titleElement && messageElement) {
      titleElement.textContent = title;
      messageElement.textContent = message;
      
      if (error && stackElement) {
        stackElement.textContent = error.stack || error.toString();
      }
      
      modal.classList.remove('hidden');
      
      // Focus dismiss button
      const dismissBtn = document.getElementById('error-dismiss');
      dismissBtn?.focus();
    }
  }

  /**
   * Close error modal
   */
  closeErrorModal() {
    const modal = document.getElementById('error-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * Close any modal
   * @param {HTMLElement} modal - Modal element
   */
  closeModal(modal) {
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * Retry last operation
   */
  retryLastOperation() {
    this.closeErrorModal();
    // Implementation depends on what the last operation was
    // For now, just retry processing if there are pending files
    if (this.fileQueue.some(item => item.status === 'pending')) {
      this.startProcessing();
    }
  }

  /**
   * Clear completed files from queue
   */
  clearCompletedFiles() {
    this.fileQueue = this.fileQueue.filter(item => item.status !== 'completed');
    this.renderFileQueue();
    this.updateUI();
    Utils.showNotification('info', 'Queue Cleared', 'Completed files removed from queue');
  }

  /**
   * Retry failed files
   */
  retryFailedFiles() {
    const failedFiles = this.fileQueue.filter(item => item.status === 'failed');
    
    failedFiles.forEach(item => {
      item.status = 'pending';
      item.progress = 0;
      item.error = null;
    });

    this.renderFileQueue();
    this.updateUI();
    
    if (failedFiles.length > 0) {
      Utils.showNotification('info', 'Files Reset', `${failedFiles.length} failed files reset for retry`);
    }
  }

  /**
   * Download all results
   */
  async downloadAllResults() {
    if (this.conversionResults.length === 0) return;

    try {
      await this.exportManager.exportMultipleFiles(this.conversionResults, {
        filenameTemplate: this.settings.filenameTemplate
      });
    } catch (error) {
      this.showError('Download Error', 'Failed to download files', error);
    }
  }

  /**
   * Download results as ZIP
   */
  async downloadResultsAsZip() {
    if (this.conversionResults.length === 0) return;

    try {
      await this.exportManager.exportAsZip(this.conversionResults, {
        filenameTemplate: this.settings.filenameTemplate,
        includeMetadata: true,
        includeImages: this.settings.preserveImages
      });
    } catch (error) {
      this.showError('ZIP Export Error', 'Failed to create ZIP archive', error);
    }
  }

  /**
   * Clear all results
   */
  clearResults() {
    this.conversionResults = [];
    this.renderResults();
    this.updateUI();
    Utils.showNotification('info', 'Results Cleared', 'All conversion results have been cleared');
  }

  /**
   * Preview result by queue item ID
   * @param {string} itemId - Queue item ID
   */
  previewResult(itemId) {
    const item = this.fileQueue.find(i => i.id === itemId);
    if (item && item.result) {
      this.showPreview(item.result.markdown, item.filename);
    }
  }

  /**
   * Preview result by index
   * @param {number} index - Result index
   */
  previewResultByIndex(index) {
    const result = this.conversionResults[index];
    if (result) {
      this.showPreview(result.markdown, result.originalFilename);
    }
  }

  /**
   * Show preview panel
   * @param {string} markdown - Markdown content
   * @param {string} filename - Filename
   */
  showPreview(markdown, filename) {
    const sidebar = document.getElementById('sidebar');
    const previewPanel = document.getElementById('preview-panel');
    const settingsPanel = document.getElementById('settings-panel');
    const appContainer = document.getElementById('app');
    const markdownOutput = document.getElementById('markdown-output');
    const renderedOutput = document.getElementById('rendered-output');

    if (sidebar && previewPanel && markdownOutput) {
      sidebar.classList.remove('hidden');
      previewPanel.classList.remove('hidden');
      settingsPanel?.classList.add('hidden');
      appContainer?.classList.add('sidebar-open');

      // Update preview content
      markdownOutput.textContent = markdown;
      
      // Render markdown to HTML (basic implementation)
      if (renderedOutput) {
        try {
          const html = this.markdownGenerator.turndownService ? 
            markdown : // If we had a markdown-to-HTML converter, we'd use it here
            `<pre>${Utils.escapeHtml(markdown)}</pre>`;
          renderedOutput.innerHTML = html;
        } catch (error) {
          renderedOutput.innerHTML = `<pre>${Utils.escapeHtml(markdown)}</pre>`;
        }
      }

      // Update panel title
      const panelTitle = previewPanel.querySelector('.panel-title');
      if (panelTitle) {
        panelTitle.textContent = `Preview: ${filename}`;
      }
    }
  }

  /**
   * Close preview panel
   */
  closePreview() {
    const sidebar = document.getElementById('sidebar');
    const appContainer = document.getElementById('app');

    if (sidebar) {
      sidebar.classList.add('hidden');
      appContainer?.classList.remove('sidebar-open');
    }
  }

  /**
   * Switch preview tab
   * @param {string} tab - Tab name ('markdown' or 'rendered')
   */
  switchPreviewTab(tab) {
    const markdownTab = document.getElementById('preview-tab-markdown');
    const renderedTab = document.getElementById('preview-tab-rendered');
    const markdownPane = document.getElementById('preview-markdown');
    const renderedPane = document.getElementById('preview-rendered');

    // Update tab buttons
    markdownTab?.classList.toggle('active', tab === 'markdown');
    renderedTab?.classList.toggle('active', tab === 'rendered');

    // Update panes
    markdownPane?.classList.toggle('active', tab === 'markdown');
    renderedPane?.classList.toggle('active', tab === 'rendered');
  }

  /**
   * Download result by queue item ID
   * @param {string} itemId - Queue item ID
   */
  async downloadResult(itemId) {
    const item = this.fileQueue.find(i => i.id === itemId);
    if (item && item.result) {
      try {
        await this.exportManager.exportSingleFile(item.result, {
          filenameTemplate: this.settings.filenameTemplate
        });
      } catch (error) {
        this.showError('Download Error', 'Failed to download file', error);
      }
    }
  }

  /**
   * Download result by index
   * @param {number} index - Result index
   */
  async downloadResultByIndex(index) {
    const result = this.conversionResults[index];
    if (result) {
      try {
        await this.exportManager.exportSingleFile(result, {
          filenameTemplate: this.settings.filenameTemplate
        });
      } catch (error) {
        this.showError('Download Error', 'Failed to download file', error);
      }
    }
  }

  /**
   * Copy result to clipboard by index
   * @param {number} index - Result index
   */
  async copyResultToClipboard(index) {
    const result = this.conversionResults[index];
    if (result) {
      await this.exportManager.copyToClipboard(result.markdown);
    }
  }

  /**
   * Retry specific file
   * @param {string} itemId - Queue item ID
   */
  retryFile(itemId) {
    const item = this.fileQueue.find(i => i.id === itemId);
    if (item) {
      item.status = 'pending';
      item.progress = 0;
      item.error = null;
      this.updateFileItemUI(item);
      Utils.showNotification('info', 'File Reset', `${item.filename} reset for retry`);
    }
  }

  /**
   * Remove file from queue
   * @param {string} itemId - Queue item ID
   */
  removeFromQueue(itemId) {
    const index = this.fileQueue.findIndex(i => i.id === itemId);
    if (index !== -1) {
      const item = this.fileQueue[index];
      this.fileQueue.splice(index, 1);
      
      // Also remove from results if it was completed
      if (item.result) {
        const resultIndex = this.conversionResults.findIndex(r => r.originalFilename === item.filename);
        if (resultIndex !== -1) {
          this.conversionResults.splice(resultIndex, 1);
        }
      }
      
      this.renderFileQueue();
      this.renderResults();
      this.updateUI();
      Utils.showNotification('info', 'File Removed', `${item.filename} removed from queue`);
    }
  }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new PDFToMarkdownApp();
});

// Export for global access
window.PDFToMarkdownApp = PDFToMarkdownApp;
