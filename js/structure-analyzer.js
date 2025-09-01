/**
 * PDF to Markdown Converter - Structure Analyzer
 * Analyzes document structure and enhances content organization
 */

class StructureAnalyzer {
  constructor() {
    this.headingPatterns = [
      /^(Chapter|Section|Part)\s+\d+/i,
      /^\d+\.\s/,
      /^\d+\.\d+\s/,
      /^\d+\.\d+\.\d+\s/,
      /^[A-Z][A-Z\s]+$/,
      /^[IVX]+\.\s/i
    ];

    this.listPatterns = {
      bullet: /^[\s]*[•·▪▫‣⁃\-\*\+]\s/,
      numbered: /^[\s]*\d+[.)]\s/,
      lettered: /^[\s]*[a-zA-Z][.)]\s/,
      roman: /^[\s]*[ivxlcdm]+[.)]\s/i
    };

    this.tablePatterns = {
      separator: /^[\s]*[|\-\+\=]{3,}[\s]*$/,
      aligned: /\s{3,}/,
      tabular: /\t+/
    };
  }

  /**
   * Analyze and enhance document structure
   * @param {Object} extractedContent - Content from PDF processor
   * @param {Object} options - Analysis options
   * @returns {Object} Enhanced structure analysis
   */
  analyzeStructure(extractedContent, options = {}) {
    const analysis = {
      documentType: this.detectDocumentType(extractedContent),
      outline: this.generateOutline(extractedContent),
      sections: this.identifySections(extractedContent),
      enhancedHeadings: this.enhanceHeadings(extractedContent.structure.headings),
      enhancedLists: this.enhanceLists(extractedContent.structure.lists),
      enhancedTables: this.enhanceTables(extractedContent.structure.tables),
      crossReferences: this.findCrossReferences(extractedContent),
      readingOrder: this.determineReadingOrder(extractedContent),
      metadata: this.analyzeMetadata(extractedContent.metadata)
    };

    return analysis;
  }

  /**
   * Detect document type based on content patterns
   * @param {Object} content - Extracted content
   * @returns {string} Detected document type
   */
  detectDocumentType(content) {
    const allText = content.pages.map(p => p.rawText).join(' ').toLowerCase();
    
    const patterns = {
      academic: /\b(abstract|introduction|methodology|results|conclusion|references|bibliography)\b/g,
      technical: /\b(api|function|class|method|parameter|return|example|code)\b/g,
      legal: /\b(whereas|therefore|hereby|pursuant|agreement|contract|terms)\b/g,
      financial: /\b(revenue|profit|loss|balance|assets|liabilities|income)\b/g,
      manual: /\b(step|procedure|instruction|guide|how to|tutorial)\b/g,
      report: /\b(summary|findings|recommendations|analysis|data|statistics)\b/g
    };

    let maxMatches = 0;
    let detectedType = 'general';

    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = (allText.match(pattern) || []).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedType = type;
      }
    }

    return detectedType;
  }

  /**
   * Generate document outline from headings
   * @param {Object} content - Extracted content
   * @returns {Array} Hierarchical outline
   */
  generateOutline(content) {
    const headings = content.structure.headings.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      return b.y - a.y; // Higher Y values first (PDF coordinates)
    });

    const outline = [];
    const stack = [];

    for (const heading of headings) {
      const item = {
        text: heading.text,
        level: heading.level,
        pageNumber: heading.pageNumber,
        children: []
      };

      // Find the correct parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        outline.push(item);
      } else {
        stack[stack.length - 1].children.push(item);
      }

      stack.push(item);
    }

    return outline;
  }

  /**
   * Identify document sections
   * @param {Object} content - Extracted content
   * @returns {Array} Array of section objects
   */
  identifySections(content) {
    const sections = [];
    const headings = content.structure.headings.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      return b.y - a.y;
    });

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const nextHeading = headings[i + 1];

      // Collect content between this heading and the next
      const sectionContent = this.extractSectionContent(
        content.pages,
        heading,
        nextHeading
      );

      sections.push({
        title: heading.text,
        level: heading.level,
        pageNumber: heading.pageNumber,
        startY: heading.y,
        endY: nextHeading ? nextHeading.y : 0,
        content: sectionContent,
        wordCount: sectionContent.split(/\s+/).length,
        hasSubsections: headings.some(h => 
          h.level > heading.level && 
          h.pageNumber >= heading.pageNumber &&
          (!nextHeading || h.pageNumber < nextHeading.pageNumber || 
           (h.pageNumber === nextHeading.pageNumber && h.y > nextHeading.y))
        )
      });
    }

    return sections;
  }

  /**
   * Extract content for a specific section
   * @param {Array} pages - Document pages
   * @param {Object} startHeading - Section start heading
   * @param {Object} endHeading - Section end heading (optional)
   * @returns {string} Section content
   */
  extractSectionContent(pages, startHeading, endHeading = null) {
    let content = '';
    let collecting = false;

    for (const page of pages) {
      if (page.pageNumber < startHeading.pageNumber) continue;
      if (endHeading && page.pageNumber > endHeading.pageNumber) break;

      for (const paragraph of page.content.paragraphs || []) {
        const isStartHeading = paragraph.y === startHeading.y && 
                              paragraph.text === startHeading.text;
        const isEndHeading = endHeading && 
                            paragraph.y === endHeading.y && 
                            paragraph.text === endHeading.text;

        if (isStartHeading) {
          collecting = true;
          continue;
        }

        if (isEndHeading) {
          collecting = false;
          break;
        }

        if (collecting) {
          content += paragraph.text + '\n\n';
        }
      }

      if (!collecting && endHeading) break;
    }

    return content.trim();
  }

  /**
   * Enhance heading analysis
   * @param {Array} headings - Raw headings from PDF processor
   * @returns {Array} Enhanced heading objects
   */
  enhanceHeadings(headings) {
    return headings.map(heading => {
      const enhanced = { ...heading };

      // Detect heading type
      enhanced.type = this.detectHeadingType(heading.text);
      
      // Clean heading text
      enhanced.cleanText = this.cleanHeadingText(heading.text);
      
      // Generate anchor
      enhanced.anchor = this.generateAnchor(enhanced.cleanText);
      
      // Detect numbering
      enhanced.numbering = this.extractNumbering(heading.text);
      
      return enhanced;
    });
  }

  /**
   * Detect heading type
   * @param {string} text - Heading text
   * @returns {string} Heading type
   */
  detectHeadingType(text) {
    const types = {
      chapter: /^(Chapter|Ch\.)\s+\d+/i,
      section: /^(Section|Sec\.)\s+\d+/i,
      appendix: /^(Appendix|App\.)\s+[A-Z]/i,
      numbered: /^\d+(\.\d+)*\s/,
      title: /^[A-Z][A-Z\s]+$/,
      subtitle: /^[A-Z][a-z\s]+$/
    };

    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return 'generic';
  }

  /**
   * Clean heading text by removing numbering and formatting
   * @param {string} text - Raw heading text
   * @returns {string} Cleaned text
   */
  cleanHeadingText(text) {
    return text
      .replace(/^\d+(\.\d+)*\s*/, '') // Remove numbering
      .replace(/^(Chapter|Section|Part|Appendix)\s+\d+\s*/i, '') // Remove prefixes
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Generate URL-friendly anchor from heading text
   * @param {string} text - Heading text
   * @returns {string} URL anchor
   */
  generateAnchor(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove duplicate hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Extract numbering from heading text
   * @param {string} text - Heading text
   * @returns {Object} Numbering information
   */
  extractNumbering(text) {
    const patterns = {
      decimal: /^(\d+(?:\.\d+)*)/,
      roman: /^([IVXLCDMivxlcdm]+)/,
      letter: /^([A-Za-z])/,
      chapter: /^(?:Chapter|Ch\.)\s+(\d+)/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        return {
          type,
          value: match[1],
          full: match[0]
        };
      }
    }

    return null;
  }

  /**
   * Enhance list analysis
   * @param {Array} lists - Raw lists from PDF processor
   * @returns {Array} Enhanced list objects
   */
  enhanceLists(lists) {
    return lists.map(list => {
      const enhanced = { ...list };
      
      // Detect list style
      enhanced.style = this.detectListStyle(list);
      
      // Analyze nesting
      enhanced.nesting = this.analyzeListNesting(list);
      
      // Clean list items
      enhanced.cleanItems = list.items.map(item => ({
        ...item,
        cleanText: item.text.trim(),
        level: this.detectItemLevel(item.text)
      }));

      return enhanced;
    });
  }

  /**
   * Detect list style
   * @param {Object} list - List object
   * @returns {string} List style
   */
  detectListStyle(list) {
    if (list.type === 'unordered') {
      const markers = list.items.map(item => item.marker);
      const uniqueMarkers = [...new Set(markers)];
      
      if (uniqueMarkers.length === 1) {
        const marker = uniqueMarkers[0];
        if (['•', '·', '▪'].includes(marker)) return 'bullet';
        if (['-', '*', '+'].includes(marker)) return 'dash';
      }
      
      return 'mixed';
    } else {
      // Check if it's numeric, alphabetic, or roman
      const firstMarker = list.items[0]?.marker || '';
      if (/^\d+/.test(firstMarker)) return 'numeric';
      if (/^[a-zA-Z]/.test(firstMarker)) return 'alphabetic';
      if (/^[ivxlcdm]/i.test(firstMarker)) return 'roman';
    }

    return 'unknown';
  }

  /**
   * Analyze list nesting levels
   * @param {Object} list - List object
   * @returns {Object} Nesting analysis
   */
  analyzeListNesting(list) {
    const levels = list.items.map(item => this.detectItemLevel(item.text));
    const maxLevel = Math.max(...levels);
    const minLevel = Math.min(...levels);
    
    return {
      hasNesting: maxLevel > minLevel,
      maxLevel,
      minLevel,
      levelCount: new Set(levels).size
    };
  }

  /**
   * Detect indentation level of list item
   * @param {string} text - Item text
   * @returns {number} Indentation level
   */
  detectItemLevel(text) {
    const leadingSpaces = text.match(/^\s*/)[0].length;
    return Math.floor(leadingSpaces / 4) + 1; // Assume 4 spaces per level
  }

  /**
   * Enhance table analysis
   * @param {Array} tables - Raw tables from PDF processor
   * @returns {Array} Enhanced table objects
   */
  enhanceTables(tables) {
    return tables.map(table => {
      const enhanced = { ...table };
      
      // Detect table type
      enhanced.type = this.detectTableType(table);
      
      // Analyze structure
      enhanced.structure = this.analyzeTableStructure(table);
      
      // Clean table data
      enhanced.cleanData = this.cleanTableData(table);
      
      // Detect headers
      enhanced.headers = this.detectTableHeaders(table);

      return enhanced;
    });
  }

  /**
   * Detect table type
   * @param {Object} table - Table object
   * @returns {string} Table type
   */
  detectTableType(table) {
    const firstRow = table.rows[0]?.text || '';
    
    if (/\b(name|title|description|value|amount|date|time)\b/i.test(firstRow)) {
      return 'data';
    }
    
    if (table.rows.length <= 3 && table.columnCount <= 3) {
      return 'simple';
    }
    
    if (table.columnCount > 5) {
      return 'complex';
    }
    
    return 'generic';
  }

  /**
   * Analyze table structure
   * @param {Object} table - Table object
   * @returns {Object} Structure analysis
   */
  analyzeTableStructure(table) {
    return {
      rowCount: table.rows.length,
      columnCount: table.columnCount,
      hasHeaders: this.detectTableHeaders(table).length > 0,
      isEmpty: table.rows.every(row => !row.text.trim()),
      isRegular: table.rows.every(row => row.segments.length === table.columnCount)
    };
  }

  /**
   * Clean table data
   * @param {Object} table - Table object
   * @returns {Array} Cleaned table data
   */
  cleanTableData(table) {
    return table.rows.map(row => ({
      ...row,
      cleanSegments: row.segments.map(segment => segment.trim()),
      cleanText: row.text.trim()
    }));
  }

  /**
   * Detect table headers
   * @param {Object} table - Table object
   * @returns {Array} Detected headers
   */
  detectTableHeaders(table) {
    if (table.rows.length === 0) return [];
    
    const firstRow = table.rows[0];
    const segments = firstRow.segments || [];
    
    // Check if first row looks like headers
    const hasHeaderWords = segments.some(segment => 
      /\b(name|title|type|date|value|amount|description|id|number)\b/i.test(segment)
    );
    
    const isAllCaps = segments.every(segment => 
      segment === segment.toUpperCase() && segment.length > 1
    );
    
    if (hasHeaderWords || isAllCaps) {
      return segments.map(segment => segment.trim());
    }
    
    return [];
  }

  /**
   * Find cross-references in the document
   * @param {Object} content - Extracted content
   * @returns {Array} Cross-reference objects
   */
  findCrossReferences(content) {
    const references = [];
    const patterns = {
      page: /(?:page|p\.)\s*(\d+)/gi,
      section: /(?:section|sec\.)\s*(\d+(?:\.\d+)*)/gi,
      figure: /(?:figure|fig\.)\s*(\d+)/gi,
      table: /(?:table|tbl\.)\s*(\d+)/gi,
      chapter: /(?:chapter|ch\.)\s*(\d+)/gi,
      appendix: /(?:appendix|app\.)\s*([A-Z])/gi
    };

    for (const page of content.pages) {
      const text = page.rawText;
      
      for (const [type, pattern] of Object.entries(patterns)) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          references.push({
            type,
            reference: match[1],
            fullMatch: match[0],
            pageNumber: page.pageNumber,
            context: this.extractContext(text, match.index, 50)
          });
        }
      }
    }

    return references;
  }

  /**
   * Extract context around a match
   * @param {string} text - Full text
   * @param {number} index - Match index
   * @param {number} contextLength - Context length
   * @returns {string} Context string
   */
  extractContext(text, index, contextLength) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + contextLength);
    return text.slice(start, end).trim();
  }

  /**
   * Determine reading order for the document
   * @param {Object} content - Extracted content
   * @returns {Array} Reading order array
   */
  determineReadingOrder(content) {
    const elements = [];

    // Collect all elements with their positions
    for (const page of content.pages) {
      // Add headings
      for (const heading of content.structure.headings.filter(h => h.pageNumber === page.pageNumber)) {
        elements.push({
          type: 'heading',
          content: heading,
          pageNumber: page.pageNumber,
          y: heading.y,
          order: this.calculateReadingOrder(page.pageNumber, heading.y)
        });
      }

      // Add paragraphs
      for (const paragraph of page.content.paragraphs || []) {
        elements.push({
          type: 'paragraph',
          content: paragraph,
          pageNumber: page.pageNumber,
          y: paragraph.y,
          order: this.calculateReadingOrder(page.pageNumber, paragraph.y)
        });
      }

      // Add lists
      for (const list of content.structure.lists.filter(l => l.pageNumber === page.pageNumber)) {
        elements.push({
          type: 'list',
          content: list,
          pageNumber: page.pageNumber,
          y: list.y,
          order: this.calculateReadingOrder(page.pageNumber, list.y)
        });
      }

      // Add tables
      for (const table of content.structure.tables.filter(t => t.pageNumber === page.pageNumber)) {
        elements.push({
          type: 'table',
          content: table,
          pageNumber: page.pageNumber,
          y: table.y,
          order: this.calculateReadingOrder(page.pageNumber, table.y)
        });
      }
    }

    // Sort by reading order
    return elements.sort((a, b) => a.order - b.order);
  }

  /**
   * Calculate reading order value
   * @param {number} pageNumber - Page number
   * @param {number} y - Y coordinate
   * @returns {number} Reading order value
   */
  calculateReadingOrder(pageNumber, y) {
    // Higher Y values come first in PDF coordinates (inverted)
    return pageNumber * 10000 + (10000 - y);
  }

  /**
   * Analyze document metadata
   * @param {Object} metadata - Raw metadata
   * @returns {Object} Enhanced metadata analysis
   */
  analyzeMetadata(metadata) {
    return {
      ...metadata,
      hasTitle: !Utils.isEmpty(metadata.title),
      hasAuthor: !Utils.isEmpty(metadata.author),
      hasSubject: !Utils.isEmpty(metadata.subject),
      hasKeywords: !Utils.isEmpty(metadata.keywords),
      isRecent: metadata.creationDate && 
                new Date(metadata.creationDate) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      estimatedReadingTime: this.estimateReadingTime(metadata.pageCount),
      complexity: this.assessComplexity(metadata)
    };
  }

  /**
   * Estimate reading time based on page count
   * @param {number} pageCount - Number of pages
   * @returns {number} Estimated reading time in minutes
   */
  estimateReadingTime(pageCount) {
    // Assume 250 words per page and 200 words per minute reading speed
    const wordsPerPage = 250;
    const wordsPerMinute = 200;
    return Math.ceil((pageCount * wordsPerPage) / wordsPerMinute);
  }

  /**
   * Assess document complexity
   * @param {Object} metadata - Document metadata
   * @returns {string} Complexity level
   */
  assessComplexity(metadata) {
    const pageCount = metadata.pageCount || 0;
    
    if (pageCount < 5) return 'simple';
    if (pageCount < 20) return 'moderate';
    if (pageCount < 50) return 'complex';
    return 'very-complex';
  }
}

// Export for use in other modules
window.StructureAnalyzer = StructureAnalyzer;
