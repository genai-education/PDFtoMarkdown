/**
 * PDF to Markdown Converter - PDF Processing Engine
 * Handles PDF parsing, text extraction, and structure recognition using PDF.js
 */

class PDFProcessor {
  constructor() {
    this.pdfjsLib = window.pdfjsLib;
    this.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    // Configure PDF.js
    if (this.pdfjsLib) {
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = this.workerSrc;
    }

    this.processingQueue = [];
    this.isProcessing = false;
    this.currentDocument = null;
    this.abortController = null;
  }

  /**
   * Process a PDF file and extract structured content
   * @param {File} file - PDF file to process
   * @param {Object} options - Processing options
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} Extracted content and metadata
   */
  async processPDF(file, options = {}, progressCallback = null) {
    try {
      // Validate file
      const validation = Utils.validatePdfFile(file);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Create abort controller for cancellation
      this.abortController = new AbortController();

      // Read file as array buffer
      progressCallback?.(0, 'Reading file...');
      const arrayBuffer = await Utils.readFileAsArrayBuffer(file);

      // Load PDF document
      progressCallback?.(10, 'Loading PDF document...');
      const loadingTask = this.pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      this.currentDocument = await loadingTask.promise;

      // Extract document metadata
      progressCallback?.(20, 'Extracting metadata...');
      const metadata = await this.extractMetadata(this.currentDocument);

      // Extract text content from all pages
      progressCallback?.(30, 'Extracting text content...');
      const pages = await this.extractAllPages(this.currentDocument, progressCallback);

      // Analyze document structure
      progressCallback?.(80, 'Analyzing document structure...');
      const structure = await this.analyzeStructure(pages, options);

      // Extract images if requested
      let images = [];
      if (options.preserveImages) {
        progressCallback?.(90, 'Extracting images...');
        images = await this.extractImages(this.currentDocument);
      }

      progressCallback?.(100, 'Processing complete');

      return {
        metadata,
        pages,
        structure,
        images,
        pageCount: this.currentDocument.numPages,
        processingTime: Date.now(),
        originalSize: file.size,
        filename: file.name
      };

    } catch (error) {
      Utils.logError(error, 'PDFProcessor.processPDF', { filename: file.name });
      throw error;
    } finally {
      // Clean up
      if (this.currentDocument) {
        this.currentDocument.destroy();
        this.currentDocument = null;
      }
      this.abortController = null;
    }
  }

  /**
   * Extract metadata from PDF document
   * @param {Object} pdfDocument - PDF.js document object
   * @returns {Promise<Object>} Document metadata
   */
  async extractMetadata(pdfDocument) {
    try {
      const metadata = await pdfDocument.getMetadata();
      const info = metadata.info || {};
      
      return {
        title: info.Title || '',
        author: info.Author || '',
        subject: info.Subject || '',
        creator: info.Creator || '',
        producer: info.Producer || '',
        creationDate: info.CreationDate || null,
        modificationDate: info.ModDate || null,
        keywords: info.Keywords || '',
        pageCount: pdfDocument.numPages,
        pdfVersion: metadata.metadata?.get('pdf:PDFVersion') || '',
        encrypted: info.IsEncrypted || false
      };
    } catch (error) {
      Utils.logError(error, 'PDFProcessor.extractMetadata');
      return {
        title: '',
        author: '',
        subject: '',
        creator: '',
        producer: '',
        creationDate: null,
        modificationDate: null,
        keywords: '',
        pageCount: pdfDocument.numPages,
        pdfVersion: '',
        encrypted: false
      };
    }
  }

  /**
   * Extract text content from all pages
   * @param {Object} pdfDocument - PDF.js document object
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Array>} Array of page objects with text content
   */
  async extractAllPages(pdfDocument, progressCallback = null) {
    const pages = [];
    const totalPages = pdfDocument.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Processing cancelled');
      }

      const progress = 30 + Math.round((pageNum / totalPages) * 40);
      progressCallback?.(progress, `Processing page ${pageNum} of ${totalPages}...`);

      try {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        // Process text items and maintain positioning
        const textItems = textContent.items.map(item => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          fontName: item.fontName,
          fontSize: item.transform[0],
          bold: item.fontName?.toLowerCase().includes('bold') || false,
          italic: item.fontName?.toLowerCase().includes('italic') || false
        }));

        // Group text items into lines and paragraphs
        const processedContent = this.processTextItems(textItems, viewport);

        pages.push({
          pageNumber: pageNum,
          viewport: {
            width: viewport.width,
            height: viewport.height
          },
          textItems,
          content: processedContent,
          rawText: textContent.items.map(item => item.str).join(' ')
        });

        // Clean up page resources
        page.cleanup();

      } catch (error) {
        Utils.logError(error, 'PDFProcessor.extractAllPages', { pageNum });
        // Continue with other pages even if one fails
        pages.push({
          pageNumber: pageNum,
          viewport: { width: 0, height: 0 },
          textItems: [],
          content: { lines: [], paragraphs: [] },
          rawText: '',
          error: error.message
        });
      }
    }

    return pages;
  }

  /**
   * Process text items into structured content
   * @param {Array} textItems - Raw text items from PDF.js
   * @param {Object} viewport - Page viewport information
   * @returns {Object} Structured content with lines and paragraphs
   */
  processTextItems(textItems, viewport) {
    if (!textItems.length) {
      return { lines: [], paragraphs: [] };
    }

    // Sort items by position (top to bottom, left to right)
    const sortedItems = textItems.sort((a, b) => {
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff < 5) { // Same line threshold
        return a.x - b.x; // Left to right
      }
      return b.y - a.y; // Top to bottom (PDF coordinates are inverted)
    });

    // Group items into lines
    const lines = [];
    let currentLine = [];
    let currentY = null;

    for (const item of sortedItems) {
      if (currentY === null || Math.abs(item.y - currentY) < 5) {
        // Same line
        currentLine.push(item);
        currentY = item.y;
      } else {
        // New line
        if (currentLine.length > 0) {
          lines.push({
            y: currentY,
            items: currentLine,
            text: currentLine.map(i => i.text).join(' ').trim(),
            fontSize: Math.max(...currentLine.map(i => i.fontSize)),
            bold: currentLine.some(i => i.bold),
            italic: currentLine.some(i => i.italic)
          });
        }
        currentLine = [item];
        currentY = item.y;
      }
    }

    // Add the last line
    if (currentLine.length > 0) {
      lines.push({
        y: currentY,
        items: currentLine,
        text: currentLine.map(i => i.text).join(' ').trim(),
        fontSize: Math.max(...currentLine.map(i => i.fontSize)),
        bold: currentLine.some(i => i.bold),
        italic: currentLine.some(i => i.italic)
      });
    }

    // Group lines into paragraphs
    const paragraphs = this.groupLinesIntoParagraphs(lines);

    return { lines, paragraphs };
  }

  /**
   * Group lines into paragraphs based on spacing and formatting
   * @param {Array} lines - Array of line objects
   * @returns {Array} Array of paragraph objects
   */
  groupLinesIntoParagraphs(lines) {
    if (!lines.length) return [];

    const paragraphs = [];
    let currentParagraph = [];
    let lastY = null;

    for (const line of lines) {
      const lineSpacing = lastY !== null ? Math.abs(lastY - line.y) : 0;
      const isNewParagraph = lineSpacing > 20 || // Large vertical gap
                            line.text.trim() === '' || // Empty line
                            (currentParagraph.length > 0 && 
                             Math.abs(line.fontSize - currentParagraph[0].fontSize) > 2); // Font size change

      if (isNewParagraph && currentParagraph.length > 0) {
        paragraphs.push({
          lines: currentParagraph,
          text: currentParagraph.map(l => l.text).join(' ').trim(),
          fontSize: currentParagraph[0].fontSize,
          bold: currentParagraph[0].bold,
          italic: currentParagraph[0].italic,
          y: currentParagraph[0].y
        });
        currentParagraph = [];
      }

      if (line.text.trim() !== '') {
        currentParagraph.push(line);
      }

      lastY = line.y;
    }

    // Add the last paragraph
    if (currentParagraph.length > 0) {
      paragraphs.push({
        lines: currentParagraph,
        text: currentParagraph.map(l => l.text).join(' ').trim(),
        fontSize: currentParagraph[0].fontSize,
        bold: currentParagraph[0].bold,
        italic: currentParagraph[0].italic,
        y: currentParagraph[0].y
      });
    }

    return paragraphs;
  }

  /**
   * Analyze document structure and identify elements
   * @param {Array} pages - Array of page objects
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Document structure analysis
   */
  async analyzeStructure(pages, options = {}) {
    const structure = {
      headings: [],
      tables: [],
      lists: [],
      codeBlocks: [],
      links: [],
      footnotes: []
    };

    // Analyze each page
    for (const page of pages) {
      if (!page.content || page.error) continue;

      // Identify headings based on font size and formatting
      const headings = this.identifyHeadings(page.content.paragraphs);
      structure.headings.push(...headings.map(h => ({ ...h, pageNumber: page.pageNumber })));

      // Identify lists
      const lists = this.identifyLists(page.content.paragraphs);
      structure.lists.push(...lists.map(l => ({ ...l, pageNumber: page.pageNumber })));

      // Identify potential tables (basic implementation)
      const tables = this.identifyTables(page.content.lines);
      structure.tables.push(...tables.map(t => ({ ...t, pageNumber: page.pageNumber })));

      // Identify code blocks (monospace font detection)
      const codeBlocks = this.identifyCodeBlocks(page.content.paragraphs);
      structure.codeBlocks.push(...codeBlocks.map(c => ({ ...c, pageNumber: page.pageNumber })));
    }

    return structure;
  }

  /**
   * Identify headings based on font size and formatting
   * @param {Array} paragraphs - Array of paragraph objects
   * @returns {Array} Array of heading objects
   */
  identifyHeadings(paragraphs) {
    if (!paragraphs.length) return [];

    // Calculate average font size
    const fontSizes = paragraphs.map(p => p.fontSize).filter(s => s > 0);
    const avgFontSize = fontSizes.reduce((sum, size) => sum + size, 0) / fontSizes.length;

    const headings = [];

    for (const paragraph of paragraphs) {
      const isLargerFont = paragraph.fontSize > avgFontSize * 1.2;
      const isBold = paragraph.bold;
      const isShort = paragraph.text.length < 100;
      const hasHeadingPattern = /^(Chapter|Section|\d+\.|\d+\.\d+)/.test(paragraph.text.trim());

      if ((isLargerFont || isBold || hasHeadingPattern) && isShort) {
        let level = 1;
        
        // Determine heading level based on font size
        if (paragraph.fontSize > avgFontSize * 1.8) level = 1;
        else if (paragraph.fontSize > avgFontSize * 1.5) level = 2;
        else if (paragraph.fontSize > avgFontSize * 1.3) level = 3;
        else if (paragraph.fontSize > avgFontSize * 1.1) level = 4;
        else level = 5;

        headings.push({
          text: paragraph.text.trim(),
          level,
          fontSize: paragraph.fontSize,
          bold: paragraph.bold,
          y: paragraph.y
        });
      }
    }

    return headings;
  }

  /**
   * Identify lists in the document
   * @param {Array} paragraphs - Array of paragraph objects
   * @returns {Array} Array of list objects
   */
  identifyLists(paragraphs) {
    const lists = [];
    let currentList = null;

    for (const paragraph of paragraphs) {
      const text = paragraph.text.trim();
      const isBulletPoint = /^[•·▪▫‣⁃]\s/.test(text) || /^[-*+]\s/.test(text);
      const isNumberedItem = /^\d+[.)]\s/.test(text);
      const isLetterItem = /^[a-zA-Z][.)]\s/.test(text);

      if (isBulletPoint || isNumberedItem || isLetterItem) {
        const listType = isBulletPoint ? 'unordered' : 'ordered';
        
        if (!currentList || currentList.type !== listType) {
          // Start new list
          if (currentList) {
            lists.push(currentList);
          }
          currentList = {
            type: listType,
            items: [],
            y: paragraph.y
          };
        }

        currentList.items.push({
          text: text.replace(/^([•·▪▫‣⁃\-*+]|\d+[.)]|[a-zA-Z][.)])\s/, '').trim(),
          marker: text.match(/^([•·▪▫‣⁃\-*+]|\d+[.)]|[a-zA-Z][.)])/)?.[1] || '',
          y: paragraph.y
        });
      } else if (currentList) {
        // End current list
        lists.push(currentList);
        currentList = null;
      }
    }

    // Add the last list if exists
    if (currentList) {
      lists.push(currentList);
    }

    return lists;
  }

  /**
   * Identify tables based on text alignment and spacing
   * @param {Array} lines - Array of line objects
   * @returns {Array} Array of table objects
   */
  identifyTables(lines) {
    // Basic table detection - look for lines with multiple aligned columns
    const tables = [];
    const potentialTableLines = [];

    for (const line of lines) {
      // Check if line has multiple spaced segments (potential table row)
      const segments = line.text.split(/\s{3,}/); // Split on 3+ spaces
      if (segments.length >= 3) {
        potentialTableLines.push({
          line,
          segments,
          segmentCount: segments.length
        });
      }
    }

    // Group consecutive potential table lines
    if (potentialTableLines.length >= 2) {
      let currentTable = [];
      
      for (let i = 0; i < potentialTableLines.length; i++) {
        const current = potentialTableLines[i];
        const next = potentialTableLines[i + 1];
        
        if (currentTable.length === 0) {
          currentTable.push(current);
        } else {
          const lastY = currentTable[currentTable.length - 1].line.y;
          const yDiff = Math.abs(current.line.y - lastY);
          
          if (yDiff < 30 && Math.abs(current.segmentCount - currentTable[0].segmentCount) <= 1) {
            currentTable.push(current);
          } else {
            // End current table
            if (currentTable.length >= 2) {
              tables.push({
                rows: currentTable.map(row => ({
                  text: row.line.text,
                  segments: row.segments,
                  y: row.line.y
                })),
                columnCount: currentTable[0].segmentCount,
                y: currentTable[0].line.y
              });
            }
            currentTable = [current];
          }
        }
      }
      
      // Add the last table
      if (currentTable.length >= 2) {
        tables.push({
          rows: currentTable.map(row => ({
            text: row.line.text,
            segments: row.segments,
            y: row.line.y
          })),
          columnCount: currentTable[0].segmentCount,
          y: currentTable[0].line.y
        });
      }
    }

    return tables;
  }

  /**
   * Identify code blocks based on monospace fonts and formatting
   * @param {Array} paragraphs - Array of paragraph objects
   * @returns {Array} Array of code block objects
   */
  identifyCodeBlocks(paragraphs) {
    const codeBlocks = [];
    
    for (const paragraph of paragraphs) {
      // Check for monospace font indicators
      const hasMonospaceFont = paragraph.lines.some(line => 
        line.items.some(item => 
          item.fontName && (
            item.fontName.toLowerCase().includes('mono') ||
            item.fontName.toLowerCase().includes('courier') ||
            item.fontName.toLowerCase().includes('consolas')
          )
        )
      );

      // Check for code-like patterns
      const hasCodePatterns = /^[\s]*[{}();,\[\]<>]|^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=:({]/.test(paragraph.text);
      const hasIndentation = /^\s{4,}/.test(paragraph.text);

      if (hasMonospaceFont || (hasCodePatterns && hasIndentation)) {
        codeBlocks.push({
          text: paragraph.text,
          language: this.detectCodeLanguage(paragraph.text),
          y: paragraph.y
        });
      }
    }

    return codeBlocks;
  }

  /**
   * Detect programming language from code text
   * @param {string} text - Code text
   * @returns {string} Detected language or 'text'
   */
  detectCodeLanguage(text) {
    const patterns = {
      javascript: /\b(function|var|let|const|=>|console\.log)\b/,
      python: /\b(def|import|from|print|if __name__)\b/,
      java: /\b(public|private|class|import|System\.out)\b/,
      css: /\{[^}]*:[^}]*\}|@media|@import/,
      html: /<[^>]+>|&[a-zA-Z]+;/,
      sql: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\b/i,
      json: /^\s*[\{\[].*[\}\]]\s*$/s,
      xml: /<\?xml|<[a-zA-Z][^>]*>/
    };

    for (const [language, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return language;
      }
    }

    return 'text';
  }

  /**
   * Extract images from PDF document
   * @param {Object} pdfDocument - PDF.js document object
   * @returns {Promise<Array>} Array of image objects
   */
  async extractImages(pdfDocument) {
    const images = [];
    
    try {
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const operatorList = await page.getOperatorList();
        
        // Look for image operations
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          if (operatorList.fnArray[i] === this.pdfjsLib.OPS.paintImageXObject) {
            const imageName = operatorList.argsArray[i][0];
            
            try {
              // This is a simplified approach - full image extraction is complex
              images.push({
                name: imageName,
                pageNumber: pageNum,
                type: 'image',
                // Note: Actual image data extraction would require more complex implementation
                placeholder: `[Image: ${imageName} on page ${pageNum}]`
              });
            } catch (imageError) {
              Utils.logError(imageError, 'PDFProcessor.extractImages', { imageName, pageNum });
            }
          }
        }
        
        page.cleanup();
      }
    } catch (error) {
      Utils.logError(error, 'PDFProcessor.extractImages');
    }

    return images;
  }

  /**
   * Cancel current processing
   */
  cancelProcessing() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Check if PDF.js is available and properly configured
   * @returns {boolean} True if PDF.js is available
   */
  isAvailable() {
    return !!(this.pdfjsLib && this.pdfjsLib.getDocument);
  }
}

// Export for use in other modules
window.PDFProcessor = PDFProcessor;
