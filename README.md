# PDF to Markdown Converter

A powerful, privacy-first web application that converts PDF documents to clean, formatted Markdown. Built with 100% client-side technology - no data ever leaves your device.

![PDF to Markdown Converter](https://img.shields.io/badge/PDF-to-Markdown-blue?style=for-the-badge)
![Client-Side](https://img.shields.io/badge/100%25-Client--Side-green?style=for-the-badge)
![Privacy First](https://img.shields.io/badge/Privacy-First-orange?style=for-the-badge)

## ✨ Features

### 🔒 Privacy & Security
- **100% Client-Side Processing** - No data transmission to servers
- **Complete Privacy** - All processing happens locally in your browser
- **No Account Required** - Start converting immediately
- **Secure by Design** - Built with security best practices

### 🚀 Powerful Conversion
- **Smart Structure Recognition** - Automatically detects headings, lists, tables, and code blocks
- **Multiple Markdown Flavors** - Support for GitHub, CommonMark, and Pandoc formats
- **Image Preservation** - Extract and preserve images from PDF documents
- **Table Conversion** - Convert PDF tables to clean Markdown tables
- **Link Preservation** - Maintain hyperlinks from original documents

### 🎯 User Experience
- **Drag & Drop Interface** - Simply drag PDF files to convert
- **Batch Processing** - Convert multiple files simultaneously
- **Real-time Progress** - Live progress tracking with detailed status
- **Preview & Edit** - Preview generated Markdown before download
- **Multiple Export Options** - Download individual files or ZIP archives

### ⚙️ Customization
- **Flexible Settings** - Customize conversion behavior
- **Template System** - Configure output filename patterns
- **Quality Control** - Validation and error handling
- **Responsive Design** - Works on desktop, tablet, and mobile

## 🚀 Quick Start

1. **Open the Application**
   - Simply open `index.html` in your web browser
   - No installation or setup required

2. **Add PDF Files**
   - Drag and drop PDF files onto the upload area
   - Or click to browse and select files
   - Multiple files supported (up to 50MB each)

3. **Configure Settings** (Optional)
   - Click the settings button to customize conversion options
   - Choose Markdown flavor, enable/disable features
   - Set filename templates and processing options

4. **Start Conversion**
   - Click "Start Processing" to begin conversion
   - Monitor progress in real-time
   - Preview results before downloading

5. **Download Results**
   - Download individual Markdown files
   - Or export all files as a ZIP archive
   - Copy content directly to clipboard

## 📁 Project Structure

```
pdf-to-markdown-converter/
├── index.html                 # Main application HTML
├── css/
│   ├── main.css              # Core styles and variables
│   ├── components.css        # Component-specific styles
│   └── responsive.css        # Responsive design rules
├── js/
│   ├── app.js               # Main application controller
│   ├── pdf-processor.js     # PDF parsing and text extraction
│   ├── structure-analyzer.js # Document structure analysis
│   ├── markdown-generator.js # Markdown generation engine
│   ├── export-manager.js    # File export and download handling
│   └── utils.js             # Utility functions and helpers
├── README.md                # This file
└── docs/                    # Additional documentation
    ├── Conceptual_PDFToMarkdownConverter_PRD.md
    ├── Integration.md
    ├── llms.md
    └── Omni-Guide.md
```

## 🛠️ Technical Architecture

### Core Technologies
- **PDF.js** - PDF parsing and text extraction
- **Turndown.js** - HTML to Markdown conversion
- **JSZip** - ZIP archive creation
- **FileSaver.js** - File download handling
- **DOMPurify** - HTML sanitization

### Key Components

#### PDF Processor (`js/pdf-processor.js`)
- Handles PDF document loading and parsing
- Extracts text content with positioning information
- Identifies document structure (headings, paragraphs, lists)
- Processes images and embedded content

#### Structure Analyzer (`js/structure-analyzer.js`)
- Analyzes document layout and hierarchy
- Detects headings, lists, tables, and code blocks
- Generates document outline and cross-references
- Determines optimal reading order

#### Markdown Generator (`js/markdown-generator.js`)
- Converts structured content to Markdown
- Supports multiple Markdown flavors
- Handles formatting, links, and embedded content
- Generates clean, readable output

#### Export Manager (`js/export-manager.js`)
- Manages file downloads and exports
- Creates ZIP archives for batch downloads
- Handles clipboard operations
- Tracks export history and statistics

### Browser Compatibility
- **Modern Browsers** - Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Mobile Support** - iOS Safari 13+, Chrome Mobile 80+
- **Required Features** - ES6, File API, Web Workers, Canvas API

## ⚙️ Configuration Options

### Conversion Settings
- **Markdown Flavor** - Choose between GitHub, CommonMark, or Pandoc
- **Image Handling** - Extract and preserve images from PDFs
- **Table Conversion** - Convert PDF tables to Markdown format
- **Link Preservation** - Maintain hyperlinks from original documents
- **Smart Headings** - Intelligent heading level detection

### Output Options
- **Filename Templates** - Customize output filenames with variables
- **Metadata Inclusion** - Add document metadata to output
- **Table of Contents** - Generate automatic TOC from headings
- **Quality Validation** - Validate output before download

### Performance Settings
- **Concurrent Processing** - Control number of simultaneous conversions
- **Chunk Size** - Optimize processing for different file sizes
- **Memory Management** - Efficient handling of large documents

## 🔧 Advanced Usage

### Custom Filename Templates
Use variables in filename templates:
- `{name}` - Original filename without extension
- `{date}` - Current date (YYYY-MM-DD)
- `{timestamp}` - Unix timestamp
- `{datetime}` - Full datetime string

Example: `{name}_{date}.md` → `document_2024-01-15.md`

### Batch Processing
1. Add multiple PDF files to the queue
2. Configure settings for all files
3. Start batch processing
4. Monitor individual file progress
5. Download all results as ZIP archive

### Quality Control
- **Validation** - Automatic output validation
- **Error Handling** - Comprehensive error reporting
- **Retry Logic** - Automatic retry for failed conversions
- **Progress Tracking** - Detailed progress information

## 🐛 Troubleshooting

### Common Issues

**Files not processing:**
- Ensure PDF files are not password-protected
- Check file size (50MB limit per file)
- Verify browser compatibility

**Poor conversion quality:**
- Try different Markdown flavors
- Enable smart heading detection
- Check if PDF contains selectable text (not scanned images)

**Performance issues:**
- Reduce concurrent processing limit
- Use smaller chunk sizes for large files
- Close other browser tabs to free memory

**Download problems:**
- Check browser download settings
- Ensure popup blockers are disabled
- Try downloading individual files instead of ZIP

### Browser-Specific Notes

**Chrome/Edge:**
- Best overall performance and compatibility
- Full feature support including ZIP downloads

**Firefox:**
- Good performance with occasional memory warnings
- All features supported

**Safari:**
- May require user interaction for downloads
- Some performance limitations on older versions

**Mobile Browsers:**
- Limited by device memory for large files
- Touch-optimized interface available

## 🤝 Contributing

This is a client-side application with no backend dependencies. To contribute:

1. Fork the repository
2. Make your changes to the appropriate files
3. Test thoroughly across different browsers
4. Submit a pull request with detailed description

### Development Guidelines
- Follow existing code style and patterns
- Add comments for complex logic
- Test with various PDF types and sizes
- Ensure accessibility compliance
- Maintain responsive design principles

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **PDF.js** - Mozilla's PDF parsing library
- **Turndown** - HTML to Markdown conversion
- **JSZip** - Client-side ZIP creation
- **FileSaver.js** - File download utilities

## 📞 Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review existing issues in the repository
3. Create a new issue with detailed information
4. Include browser version and PDF sample (if possible)

---

**Made with ❤️ for the open source community**

*Privacy-first • Client-side • No data transmission • Always free*
