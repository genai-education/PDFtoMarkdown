/**
 * PDF to Markdown Converter - Markdown Generation Engine
 * Converts structured PDF content to clean, formatted Markdown
 */

class MarkdownGenerator {
  constructor(options = {}) {
    this.options = {
      flavor: options.flavor || 'github', // github, commonmark, pandoc
      preserveImages: options.preserveImages !== false,
      preserveTables: options.preserveTables !== false,
      preserveLinks: options.preserveLinks !== false,
      smartHeadings: options.smartHeadings !== false,
      addMetadata: options.addMetadata !== false,
      addToc: options.addToc || false,
      maxHeadingLevel: options.maxHeadingLevel || 6,
      ...options
    };

    this.turndownService = this.initializeTurndown();
  }

  /**
   * Initialize Turndown service for HTML to Markdown conversion
   * @returns {Object} Configured Turndown service
   */
  initializeTurndown() {
    if (!window.TurndownService) {
      throw new Error('Turndown library not available');
    }

    const turndown = new window.TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    });

    // Add custom rules based on flavor
    this.addFlavorSpecificRules(turndown);

    return turndown;
  }

  /**
   * Add flavor-specific rules to Turndown
   * @param {Object} turndown - Turndown service instance
   */
  addFlavorSpecificRules(turndown) {
    if (this.options.flavor === 'github') {
      // GitHub Flavored Markdown rules
      turndown.addRule('strikethrough', {
        filter: ['del', 's', 'strike'],
        replacement: (content) => `~~${content}~~`
      });

      turndown.addRule('taskList', {
        filter: (node) => {
          return node.nodeName === 'LI' && 
                 node.parentNode.nodeName === 'UL' &&
                 /^\s*\[[ x]\]\s/.test(node.textContent);
        },
        replacement: (content) => {
          const checked = /^\s*\[x\]\s/i.test(content);
          const cleanContent = content.replace(/^\s*\[[ x]\]\s/i, '');
          return `- [${checked ? 'x' : ' '}] ${cleanContent}`;
        }
      });
    }

    if (this.options.flavor === 'pandoc') {
      // Pandoc-specific rules
      turndown.addRule('definition', {
        filter: ['dl'],
        replacement: (content) => `\n${content}\n`
      });

      turndown.addRule('definitionTerm', {
        filter: ['dt'],
        replacement: (content) => `${content}\n`
      });

      turndown.addRule('definitionDescription', {
        filter: ['dd'],
        replacement: (content) => `:   ${content}\n\n`
      });
    }
  }

  /**
   * Generate Markdown from processed PDF content
   * @param {Object} processedContent - Content from PDF processor and structure analyzer
   * @param {Object} options - Generation options
   * @returns {string} Generated Markdown content
   */
  generateMarkdown(processedContent, options = {}) {
    const mergedOptions = { ...this.options, ...options };
    let markdown = '';

    try {
      // Add document metadata if requested
      if (mergedOptions.addMetadata) {
        markdown += this.generateMetadata(processedContent.metadata);
      }

      // Add table of contents if requested
      if (mergedOptions.addToc) {
        markdown += this.generateTableOfContents(processedContent.structure);
      }

      // Generate main content
      markdown += this.generateMainContent(processedContent, mergedOptions);

      // Post-process the markdown
      markdown = this.postProcessMarkdown(markdown, mergedOptions);

      return markdown;

    } catch (error) {
      Utils.logError(error, 'MarkdownGenerator.generateMarkdown');
      throw new Error(`Failed to generate Markdown: ${error.message}`);
    }
  }

  /**
   * Generate metadata section
   * @param {Object} metadata - Document metadata
   * @returns {string} Metadata in YAML front matter format
   */
  generateMetadata(metadata) {
    if (!metadata || Utils.isEmpty(metadata)) {
      return '';
    }

    let yaml = '---\n';
    
    if (metadata.title) yaml += `title: "${this.escapeYaml(metadata.title)}"\n`;
    if (metadata.author) yaml += `author: "${this.escapeYaml(metadata.author)}"\n`;
    if (metadata.subject) yaml += `subject: "${this.escapeYaml(metadata.subject)}"\n`;
    if (metadata.keywords) yaml += `keywords: "${this.escapeYaml(metadata.keywords)}"\n`;
    if (metadata.creationDate) yaml += `date: "${metadata.creationDate}"\n`;
    if (metadata.pageCount) yaml += `pages: ${metadata.pageCount}\n`;
    
    yaml += `generated: "${new Date().toISOString()}"\n`;
    yaml += `generator: "PDF to Markdown Converter"\n`;
    yaml += '---\n\n';

    return yaml;
  }

  /**
   * Escape YAML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeYaml(text) {
    return text.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Generate table of contents
   * @param {Object} structure - Document structure
   * @returns {string} Table of contents in Markdown
   */
  generateTableOfContents(structure) {
    if (!structure.enhancedHeadings || structure.enhancedHeadings.length === 0) {
      return '';
    }

    let toc = '## Table of Contents\n\n';
    
    for (const heading of structure.enhancedHeadings) {
      const indent = '  '.repeat(Math.max(0, heading.level - 1));
      const anchor = heading.anchor || this.generateAnchor(heading.cleanText || heading.text);
      const text = heading.cleanText || heading.text;
      
      toc += `${indent}- [${text}](#${anchor})\n`;
    }
    
    toc += '\n';
    return toc;
  }

  /**
   * Generate main document content
   * @param {Object} content - Processed content
   * @param {Object} options - Generation options
   * @returns {string} Main content in Markdown
   */
  generateMainContent(content, options) {
    let markdown = '';

    // Use reading order if available, otherwise process by pages
    const readingOrder = content.structure?.readingOrder || this.createDefaultReadingOrder(content);

    for (const element of readingOrder) {
      switch (element.type) {
        case 'heading':
          markdown += this.generateHeading(element.content, options);
          break;
        case 'paragraph':
          markdown += this.generateParagraph(element.content, options);
          break;
        case 'list':
          markdown += this.generateList(element.content, options);
          break;
        case 'table':
          if (options.preserveTables) {
            markdown += this.generateTable(element.content, options);
          }
          break;
        case 'codeBlock':
          markdown += this.generateCodeBlock(element.content, options);
          break;
        case 'image':
          if (options.preserveImages) {
            markdown += this.generateImage(element.content, options);
          }
          break;
        default:
          // Handle unknown elements as paragraphs
          if (element.content && element.content.text) {
            markdown += this.generateParagraph(element.content, options);
          }
      }
    }

    return markdown;
  }

  /**
   * Create default reading order when structure analysis is not available
   * @param {Object} content - Processed content
   * @returns {Array} Default reading order
   */
  createDefaultReadingOrder(content) {
    const elements = [];

    for (const page of content.pages) {
      // Add paragraphs in order
      for (const paragraph of page.content.paragraphs || []) {
        elements.push({
          type: 'paragraph',
          content: paragraph,
          pageNumber: page.pageNumber,
          y: paragraph.y
        });
      }
    }

    // Sort by page and position
    return elements.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      return b.y - a.y; // Higher Y values first (PDF coordinates)
    });
  }

  /**
   * Generate heading markdown
   * @param {Object} heading - Heading object
   * @param {Object} options - Generation options
   * @returns {string} Heading in Markdown
   */
  generateHeading(heading, options) {
    const level = Math.min(heading.level, options.maxHeadingLevel);
    const hashes = '#'.repeat(level);
    const text = heading.cleanText || heading.text;
    const cleanText = this.cleanText(text);

    return `${hashes} ${cleanText}\n\n`;
  }

  /**
   * Generate paragraph markdown
   * @param {Object} paragraph - Paragraph object
   * @param {Object} options - Generation options
   * @returns {string} Paragraph in Markdown
   */
  generateParagraph(paragraph, options) {
    if (!paragraph.text || !paragraph.text.trim()) {
      return '';
    }

    let text = this.cleanText(paragraph.text);
    
    // Apply formatting based on paragraph properties
    if (paragraph.bold) {
      text = `**${text}**`;
    }
    
    if (paragraph.italic) {
      text = `*${text}*`;
    }

    // Handle links if preserveLinks is enabled
    if (options.preserveLinks) {
      text = this.processLinks(text);
    }

    return `${text}\n\n`;
  }

  /**
   * Generate list markdown
   * @param {Object} list - List object
   * @param {Object} options - Generation options
   * @returns {string} List in Markdown
   */
  generateList(list, options) {
    if (!list.items || list.items.length === 0) {
      return '';
    }

    let markdown = '';
    const isOrdered = list.type === 'ordered';

    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i];
      const cleanText = this.cleanText(item.text || item.cleanText || '');
      
      if (isOrdered) {
        markdown += `${i + 1}. ${cleanText}\n`;
      } else {
        markdown += `- ${cleanText}\n`;
      }
    }

    return `${markdown}\n`;
  }

  /**
   * Generate table markdown
   * @param {Object} table - Table object
   * @param {Object} options - Generation options
   * @returns {string} Table in Markdown
   */
  generateTable(table, options) {
    if (!table.rows || table.rows.length === 0) {
      return '';
    }

    let markdown = '';
    const rows = table.cleanData || table.rows;
    
    // Process first row as headers if detected
    const hasHeaders = table.headers && table.headers.length > 0;
    let startRow = 0;

    if (hasHeaders) {
      // Generate header row
      const headerRow = table.headers.map(header => this.cleanText(header)).join(' | ');
      markdown += `| ${headerRow} |\n`;
      
      // Generate separator row
      const separator = table.headers.map(() => '---').join(' | ');
      markdown += `| ${separator} |\n`;
      
      startRow = 1; // Skip first data row if it was used as headers
    }

    // Generate data rows
    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      const segments = row.cleanSegments || row.segments || [row.cleanText || row.text];
      
      const cleanSegments = segments.map(segment => this.cleanText(segment || ''));
      const rowMarkdown = cleanSegments.join(' | ');
      markdown += `| ${rowMarkdown} |\n`;
    }

    return `${markdown}\n`;
  }

  /**
   * Generate code block markdown
   * @param {Object} codeBlock - Code block object
   * @param {Object} options - Generation options
   * @returns {string} Code block in Markdown
   */
  generateCodeBlock(codeBlock, options) {
    const language = codeBlock.language || '';
    const code = codeBlock.text || '';
    
    return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  }

  /**
   * Generate image markdown
   * @param {Object} image - Image object
   * @param {Object} options - Generation options
   * @returns {string} Image in Markdown
   */
  generateImage(image, options) {
    const alt = image.alt || image.name || 'Image';
    const src = image.src || image.placeholder || `image-${image.name}`;
    
    return `![${alt}](${src})\n\n`;
  }

  /**
   * Clean and normalize text
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
      .replace(/[\u2018\u2019]/g, "'") // Replace smart quotes
      .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
      .replace(/\u2013/g, '-') // Replace en dash
      .replace(/\u2014/g, '--') // Replace em dash
      .replace(/\u2026/g, '...') // Replace ellipsis
      .trim();
  }

  /**
   * Process links in text
   * @param {string} text - Text containing potential links
   * @returns {string} Text with processed links
   */
  processLinks(text) {
    // Simple URL detection and conversion
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '[$1]($1)');
  }

  /**
   * Generate URL-friendly anchor
   * @param {string} text - Heading text
   * @returns {string} URL anchor
   */
  generateAnchor(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Post-process generated markdown
   * @param {string} markdown - Raw markdown
   * @param {Object} options - Processing options
   * @returns {string} Post-processed markdown
   */
  postProcessMarkdown(markdown, options) {
    let processed = markdown;

    // Remove excessive blank lines
    processed = processed.replace(/\n{4,}/g, '\n\n\n');

    // Ensure proper spacing around headings
    processed = processed.replace(/\n(#{1,6}\s[^\n]+)\n(?!\n)/g, '\n$1\n\n');

    // Ensure proper spacing around lists
    processed = processed.replace(/\n([-*+]|\d+\.)\s[^\n]+(?:\n([-*+]|\d+\.)\s[^\n]+)*\n(?!\n)/g, (match) => {
      return match + '\n';
    });

    // Clean up table formatting
    if (options.preserveTables) {
      processed = this.cleanTableFormatting(processed);
    }

    // Final cleanup
    processed = processed.trim() + '\n';

    return processed;
  }

  /**
   * Clean up table formatting
   * @param {string} markdown - Markdown with tables
   * @returns {string} Cleaned markdown
   */
  cleanTableFormatting(markdown) {
    // Ensure tables have proper spacing
    return markdown.replace(/(\|[^\n]+\|\n)+/g, (match) => {
      return '\n' + match + '\n';
    });
  }

  /**
   * Update generation options
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Reinitialize Turndown if flavor changed
    if (newOptions.flavor && newOptions.flavor !== this.options.flavor) {
      this.turndownService = this.initializeTurndown();
    }
  }

  /**
   * Get current options
   * @returns {Object} Current options
   */
  getOptions() {
    return { ...this.options };
  }

  /**
   * Validate markdown output
   * @param {string} markdown - Generated markdown
   * @returns {Object} Validation result
   */
  validateMarkdown(markdown) {
    const result = {
      valid: true,
      warnings: [],
      errors: [],
      stats: {
        lines: 0,
        headings: 0,
        lists: 0,
        tables: 0,
        codeBlocks: 0,
        links: 0,
        images: 0
      }
    };

    if (!markdown || typeof markdown !== 'string') {
      result.valid = false;
      result.errors.push('Invalid markdown content');
      return result;
    }

    const lines = markdown.split('\n');
    result.stats.lines = lines.length;

    // Count elements
    result.stats.headings = (markdown.match(/^#{1,6}\s/gm) || []).length;
    result.stats.lists = (markdown.match(/^[-*+]\s|^\d+\.\s/gm) || []).length;
    result.stats.tables = (markdown.match(/^\|.*\|$/gm) || []).length;
    result.stats.codeBlocks = (markdown.match(/```/g) || []).length / 2;
    result.stats.links = (markdown.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
    result.stats.images = (markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;

    // Check for common issues
    if (result.stats.codeBlocks % 1 !== 0) {
      result.warnings.push('Unmatched code block fences detected');
    }

    if (markdown.includes('undefined') || markdown.includes('null')) {
      result.warnings.push('Undefined or null values found in output');
    }

    return result;
  }
}

// Export for use in other modules
window.MarkdownGenerator = MarkdownGenerator;
