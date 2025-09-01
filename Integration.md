# MeetingNoteConverter - Technical Integration Guide

## Table of Contents
1. [Web-LLM Integration Architecture](#web-llm-integration-architecture)
2. [Self-Contained Deployment](#self-contained-deployment)
3. [Local LLM Processing Pipeline](#local-llm-processing-pipeline)
4. [Technical Implementation Details](#technical-implementation-details)

## Web-LLM Integration Architecture

### Core Library Integration

The MeetingNoteConverter leverages the Web-LLM library for client-side LLM processing. The integration follows the established patterns from the Web-LLM examples.

#### Basic Engine Initialization

```javascript
import * as webllm from "@mlc-ai/web-llm";

class MeetingNoteProcessor {
  constructor() {
    this.engine = null;
    this.isInitialized = false;
    this.currentModel = null;
  }

  async initializeEngine(modelId = "Llama-3.2-3B-Instruct-q4f32_1-MLC") {
    const initProgressCallback = (report) => {
      this.updateProgress(report.progress, report.text);
    };

    // Create engine with optimized configuration for meeting processing
    this.engine = await webllm.CreateMLCEngine(
      modelId,
      {
        initProgressCallback: initProgressCallback,
        logLevel: "INFO",
        useIndexedDBCache: false // Use Cache API for better compatibility
      },
      {
        context_window_size: 4096, // Sufficient for most meeting notes
        temperature: 0.1, // Low temperature for consistent structured output
        max_tokens: 2048
      }
    );

    this.currentModel = modelId;
    this.isInitialized = true;
    return this.engine;
  }

  updateProgress(progress, text) {
    const progressBar = document.getElementById('model-progress');
    const statusText = document.getElementById('model-status');
    
    if (progressBar) progressBar.value = progress;
    if (statusText) statusText.textContent = text;
  }
}
```

#### Model Configuration Options

Based on the Web-LLM prebuilt configurations, the recommended models for MeetingNoteConverter:

```javascript
const RECOMMENDED_MODELS = {
  lightweight: {
    model_id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    vram_required_MB: 1128.82,
    description: "Best for basic devices, good performance for simple meeting analysis"
  },
  balanced: {
    model_id: "Llama-3.2-3B-Instruct-q4f32_1-MLC", 
    vram_required_MB: 2951.51,
    description: "Optimal balance of performance and resource usage"
  },
  performance: {
    model_id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    vram_required_MB: 5106.67,
    description: "Higher performance for complex meeting analysis"
  }
};

// Model selection based on available resources
async function selectOptimalModel() {
  const gpu = navigator.gpu;
  if (!gpu) {
    throw new Error("WebGPU not supported");
  }

  const adapter = await gpu.requestAdapter();
  const device = await adapter.requestDevice();
  
  // Estimate available VRAM (simplified heuristic)
  const limits = device.limits;
  const estimatedVRAM = limits.maxBufferSize / (1024 * 1024); // Convert to MB
  
  if (estimatedVRAM > 6000) return RECOMMENDED_MODELS.performance;
  if (estimatedVRAM > 3000) return RECOMMENDED_MODELS.balanced;
  return RECOMMENDED_MODELS.lightweight;
}
```

#### Advanced Engine Configuration

```javascript
// Custom app configuration for specialized models
const customAppConfig = {
  model_list: [
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f32_1-MLC",
      model_id: "MeetingProcessor-3B-Custom",
      model_lib: webllm.modelLibURLPrefix + webllm.modelVersion + 
                "/Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
      overrides: {
        context_window_size: 4096,
        temperature: 0.1,
        top_p: 0.9
      }
    }
  ]
};

// Initialize with custom configuration
const engine = await webllm.CreateMLCEngine(
  "MeetingProcessor-3B-Custom",
  { 
    appConfig: customAppConfig,
    initProgressCallback: progressCallback 
  }
);
```

### Web Worker Integration

For optimal performance and UI responsiveness, implement Web Worker pattern:

```javascript
// worker.js
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => {
  handler.onmessage(msg);
};

// main.js
import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";

class MeetingNoteProcessorWorker {
  async initialize() {
    this.engine = await CreateWebWorkerMLCEngine(
      new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
      "Llama-3.2-3B-Instruct-q4f32_1-MLC",
      { initProgressCallback: this.updateProgress.bind(this) }
    );
  }

  async processMeetingNotes(content) {
    return await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: this.getSystemPrompt() },
        { role: "user", content: content }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2048
    });
  }
}
```

## Self-Contained Deployment

### Static File Structure

The application requires no build process and can be served as static files:

```
meeting-note-converter/
├── index.html              # Main application entry point
├── css/
│   ├── main.css            # Core styles
│   ├── components.css      # Component-specific styles
│   └── responsive.css      # Responsive design rules
├── js/
│   ├── app.js              # Main application logic
│   ├── meeting-processor.js # LLM processing logic
│   ├── export-handlers.js  # Export functionality
│   └── utils.js            # Utility functions
├── assets/
│   ├── icons/              # Application icons
│   └── fonts/              # Web fonts (optional)
└── README.md               # Setup and usage instructions
```

### HTML Entry Point

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MeetingNoteConverter</title>
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/components.css">
    <link rel="stylesheet" href="css/responsive.css">
</head>
<body>
    <div id="app">
        <header class="app-header">
            <h1>MeetingNoteConverter</h1>
            <div id="model-status" class="status-indicator">Ready</div>
        </header>
        
        <main class="app-main">
            <section id="input-section" class="input-section">
                <div class="tab-container">
                    <button class="tab-button active" data-tab="text">Text Input</button>
                    <button class="tab-button" data-tab="file">File Upload</button>
                </div>
                
                <div id="text-input" class="tab-content active">
                    <textarea id="meeting-text" placeholder="Paste your meeting notes here..."></textarea>
                    <div class="char-counter">
                        <span id="char-count">0</span> / 50,000 characters
                    </div>
                </div>
                
                <div id="file-input" class="tab-content">
                    <div class="file-drop-zone" id="file-drop">
                        <input type="file" id="file-upload" accept=".txt" hidden>
                        <p>Drop .txt file here or click to browse</p>
                    </div>
                </div>
                
                <button id="process-button" class="process-button" disabled>
                    Process Meeting Notes
                </button>
            </section>
            
            <section id="progress-section" class="progress-section hidden">
                <div class="progress-container">
                    <progress id="model-progress" max="1" value="0"></progress>
                    <p id="progress-text">Initializing...</p>
                </div>
            </section>
            
            <section id="output-section" class="output-section hidden">
                <!-- Output content will be dynamically generated -->
            </section>
        </main>
    </div>
    
    <script type="module" src="js/app.js"></script>
</body>
</html>
```

### Browser Compatibility Requirements

```javascript
// Feature detection and compatibility checks
class CompatibilityChecker {
  static async checkWebGPUSupport() {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported. Please use a compatible browser.");
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("WebGPU adapter not available.");
      }
      return true;
    } catch (error) {
      throw new Error(`WebGPU initialization failed: ${error.message}`);
    }
  }
  
  static checkRequiredAPIs() {
    const required = [
      'fetch',
      'Promise',
      'async',
      'WebAssembly',
      'Worker',
      'Cache'
    ];
    
    const missing = required.filter(api => {
      switch(api) {
        case 'fetch': return !window.fetch;
        case 'Promise': return !window.Promise;
        case 'async': return !window.Symbol || !window.Symbol.asyncIterator;
        case 'WebAssembly': return !window.WebAssembly;
        case 'Worker': return !window.Worker;
        case 'Cache': return !window.caches;
        default: return false;
      }
    });
    
    if (missing.length > 0) {
      throw new Error(`Missing required APIs: ${missing.join(', ')}`);
    }
    
    return true;
  }
  
  static getSupportedBrowsers() {
    return {
      chrome: "113+",
      firefox: "110+", 
      safari: "16.4+",
      edge: "113+"
    };
  }
}
```

### Model Caching Strategy

```javascript
class ModelCacheManager {
  constructor() {
    this.cachePrefix = 'webllm-meeting-converter';
  }
  
  async getCacheSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage,
        available: estimate.quota,
        usedMB: Math.round(estimate.usage / (1024 * 1024)),
        availableMB: Math.round(estimate.quota / (1024 * 1024))
      };
    }
    return null;
  }
  
  async clearModelCache() {
    try {
      const cacheNames = await caches.keys();
      const webllmCaches = cacheNames.filter(name => 
        name.includes('webllm') || name.includes(this.cachePrefix)
      );
      
      await Promise.all(
        webllmCaches.map(cacheName => caches.delete(cacheName))
      );
      
      return true;
    } catch (error) {
      console.error('Failed to clear model cache:', error);
      return false;
    }
  }
  
  async getModelCacheInfo(modelId) {
    try {
      const cache = await caches.open(`${this.cachePrefix}-${modelId}`);
      const keys = await cache.keys();
      
      let totalSize = 0;
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
      
      return {
        modelId,
        files: keys.length,
        sizeMB: Math.round(totalSize / (1024 * 1024)),
        cached: keys.length > 0
      };
    } catch (error) {
      return { modelId, cached: false, error: error.message };
    }
  }
}
```

### Offline Functionality

```javascript
class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateUI();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateUI();
    });
  }
  
  updateUI() {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.textContent = this.isOnline ? 'Online' : 'Offline';
      statusElement.className = this.isOnline ? 'status-online' : 'status-offline';
    }
    
    // Show offline capabilities message
    if (!this.isOnline) {
      this.showOfflineMessage();
    }
  }
  
  showOfflineMessage() {
    const message = document.createElement('div');
    message.className = 'offline-message';
    message.innerHTML = `
      <p>You're currently offline. MeetingNoteConverter continues to work with:</p>
      <ul>
        <li>Previously downloaded models</li>
        <li>All processing capabilities</li>
        <li>Export functionality</li>
      </ul>
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
      message.remove();
    }, 5000);
  }
  
  canProcessOffline(modelId) {
    // Check if model is cached locally
    return this.isModelCached(modelId);
  }
  
  async isModelCached(modelId) {
    try {
      const cacheManager = new ModelCacheManager();
      const cacheInfo = await cacheManager.getModelCacheInfo(modelId);
      return cacheInfo.cached;
    } catch (error) {
      return false;
    }
  }
}
```

## Local LLM Processing Pipeline

### Text Preprocessing and Chunking

The preprocessing pipeline prepares meeting content for optimal LLM processing:

```javascript
class MeetingTextPreprocessor {
  constructor() {
    this.maxChunkSize = 3000; // Characters per chunk
    this.overlapSize = 200;   // Overlap between chunks
  }

  preprocess(rawText) {
    // Clean and normalize text
    let cleanText = this.cleanText(rawText);

    // Detect content type
    const contentType = this.detectContentType(cleanText);

    // Extract metadata
    const metadata = this.extractMetadata(cleanText, contentType);

    // Chunk if necessary
    const chunks = this.chunkText(cleanText);

    return {
      originalText: rawText,
      cleanText,
      contentType,
      metadata,
      chunks,
      totalLength: cleanText.length
    };
  }

  cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')       // Reduce excessive line breaks
      .replace(/\s+/g, ' ')             // Normalize whitespace
      .replace(/[^\x20-\x7E\n]/g, '')   // Remove non-printable characters
      .trim();
  }

  detectContentType(text) {
    const transcriptIndicators = [
      /\d{1,2}:\d{2}:\d{2}/,           // Timestamps
      /Speaker \d+:/,                   // Speaker labels
      /\[SPEAKER_\d+\]/,               // Bracketed speakers
      /^\w+:\s/m                       // Name: format
    ];

    const summaryIndicators = [
      /action items?:/i,
      /next steps:/i,
      /decisions made:/i,
      /meeting summary/i
    ];

    const transcriptScore = transcriptIndicators.reduce((score, pattern) =>
      score + (pattern.test(text) ? 1 : 0), 0);
    const summaryScore = summaryIndicators.reduce((score, pattern) =>
      score + (pattern.test(text) ? 1 : 0), 0);

    if (transcriptScore > summaryScore) return 'transcript';
    if (summaryScore > 0) return 'summary';
    return 'unknown';
  }

  extractMetadata(text, contentType) {
    const metadata = {
      contentType,
      estimatedDuration: null,
      participantCount: 0,
      hasTimestamps: false,
      language: 'en' // Default to English
    };

    // Extract timestamps for duration estimation
    const timestamps = text.match(/\d{1,2}:\d{2}:\d{2}/g);
    if (timestamps && timestamps.length > 1) {
      metadata.hasTimestamps = true;
      metadata.estimatedDuration = this.calculateDuration(timestamps);
    }

    // Count unique speakers/participants
    const speakers = new Set();
    const speakerPatterns = [
      /(\w+):/g,
      /Speaker (\d+):/g,
      /\[SPEAKER_(\d+)\]/g
    ];

    speakerPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        speakers.add(match[1]);
      }
    });

    metadata.participantCount = speakers.size;

    return metadata;
  }

  chunkText(text) {
    if (text.length <= this.maxChunkSize) {
      return [{ text, index: 0, start: 0, end: text.length }];
    }

    const chunks = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      let end = Math.min(start + this.maxChunkSize, text.length);

      // Try to break at sentence boundaries
      if (end < text.length) {
        const sentenceEnd = text.lastIndexOf('.', end);
        const paragraphEnd = text.lastIndexOf('\n\n', end);
        const breakPoint = Math.max(sentenceEnd, paragraphEnd);

        if (breakPoint > start + this.maxChunkSize * 0.7) {
          end = breakPoint + 1;
        }
      }

      chunks.push({
        text: text.slice(start, end),
        index: chunkIndex++,
        start,
        end
      });

      start = Math.max(end - this.overlapSize, end);
    }

    return chunks;
  }

  calculateDuration(timestamps) {
    const first = timestamps[0];
    const last = timestamps[timestamps.length - 1];

    const parseTime = (timeStr) => {
      const [hours, minutes, seconds] = timeStr.split(':').map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    };

    return parseTime(last) - parseTime(first);
  }
}
```

### Prompt Engineering for Meeting Analysis

```javascript
class MeetingPromptEngine {
  constructor() {
    this.systemPrompts = {
      transcript: this.getTranscriptSystemPrompt(),
      summary: this.getSummarySystemPrompt(),
      unknown: this.getGenericSystemPrompt()
    };
  }

  generatePrompt(preprocessedData) {
    const { contentType, metadata, chunks } = preprocessedData;
    const systemPrompt = this.systemPrompts[contentType] || this.systemPrompts.unknown;

    // For chunked content, process each chunk separately
    if (chunks.length > 1) {
      return this.generateChunkedPrompts(chunks, systemPrompt, metadata);
    }

    return {
      system: systemPrompt,
      user: this.formatUserPrompt(preprocessedData.cleanText, metadata),
      metadata
    };
  }

  getTranscriptSystemPrompt() {
    return `You are an expert meeting analyst specializing in processing meeting transcripts. Your task is to analyze meeting transcripts and extract structured information.

IMPORTANT: You must respond with valid JSON only, using this exact schema:

{
  "actionItems": [
    {
      "task": "Clear, actionable task description",
      "assignee": "Person or entity responsible (if mentioned)",
      "priority": "High|Medium|Low",
      "dueDate": "Date if mentioned, null otherwise",
      "context": "Brief context from the meeting"
    }
  ],
  "keyNotes": [
    {
      "topic": "Discussion topic or decision point",
      "content": "Detailed description of the discussion or decision",
      "participants": ["List of people involved in this discussion"],
      "importance": "High|Medium|Low"
    }
  ],
  "nextSteps": [
    {
      "step": "Follow-up action or next step",
      "owner": "Person or team responsible",
      "timeline": "When this should happen",
      "dependencies": ["Any dependencies mentioned"]
    }
  ],
  "meetingSynopsis": {
    "summary": "Comprehensive meeting summary",
    "participants": ["List of meeting participants"],
    "duration": "Meeting duration if determinable",
    "mainTopics": ["Key topics discussed"],
    "decisions": ["Major decisions made"],
    "outcomes": ["Meeting outcomes and results"]
  }
}

Focus on extracting concrete, actionable information. If information is not explicitly mentioned, use null rather than making assumptions.`;
  }

  getSummarySystemPrompt() {
    return `You are an expert meeting analyst specializing in processing meeting summaries. Your task is to analyze existing meeting summaries and enhance their structure.

IMPORTANT: You must respond with valid JSON only, using this exact schema:

{
  "actionItems": [
    {
      "task": "Clear, actionable task description",
      "assignee": "Person or entity responsible (if mentioned)",
      "priority": "High|Medium|Low",
      "dueDate": "Date if mentioned, null otherwise",
      "context": "Brief context from the meeting"
    }
  ],
  "keyNotes": [
    {
      "topic": "Discussion topic or decision point",
      "content": "Detailed description of the discussion or decision",
      "participants": ["List of people involved in this discussion"],
      "importance": "High|Medium|Low"
    }
  ],
  "nextSteps": [
    {
      "step": "Follow-up action or next step",
      "owner": "Person or team responsible",
      "timeline": "When this should happen",
      "dependencies": ["Any dependencies mentioned"]
    }
  ],
  "meetingSynopsis": {
    "summary": "Comprehensive meeting summary",
    "participants": ["List of meeting participants"],
    "duration": "Meeting duration if determinable",
    "mainTopics": ["Key topics discussed"],
    "decisions": ["Major decisions made"],
    "outcomes": ["Meeting outcomes and results"]
  }
}

Extract and organize the existing information while maintaining accuracy. Do not add information not present in the original summary.`;
  }

  getGenericSystemPrompt() {
    return `You are an expert meeting analyst. Analyze the provided meeting content and extract structured information.

IMPORTANT: You must respond with valid JSON only, using this exact schema:

{
  "actionItems": [
    {
      "task": "Clear, actionable task description",
      "assignee": "Person or entity responsible (if mentioned)",
      "priority": "High|Medium|Low",
      "dueDate": "Date if mentioned, null otherwise",
      "context": "Brief context from the meeting"
    }
  ],
  "keyNotes": [
    {
      "topic": "Discussion topic or decision point",
      "content": "Detailed description of the discussion or decision",
      "participants": ["List of people involved in this discussion"],
      "importance": "High|Medium|Low"
    }
  ],
  "nextSteps": [
    {
      "step": "Follow-up action or next step",
      "owner": "Person or team responsible",
      "timeline": "When this should happen",
      "dependencies": ["Any dependencies mentioned"]
    }
  ],
  "meetingSynopsis": {
    "summary": "Comprehensive meeting summary",
    "participants": ["List of meeting participants"],
    "duration": "Meeting duration if determinable",
    "mainTopics": ["Key topics discussed"],
    "decisions": ["Major decisions made"],
    "outcomes": ["Meeting outcomes and results"]
  }
}

Analyze the content carefully and extract relevant information. Use null for missing information rather than making assumptions.`;
  }

  formatUserPrompt(text, metadata) {
    let prompt = `Please analyze the following meeting content:\n\n${text}`;

    if (metadata.participantCount > 0) {
      prompt += `\n\nDetected ${metadata.participantCount} participants in this meeting.`;
    }

    if (metadata.estimatedDuration) {
      const minutes = Math.round(metadata.estimatedDuration / 60);
      prompt += `\n\nEstimated meeting duration: ${minutes} minutes.`;
    }

    return prompt;
  }

  generateChunkedPrompts(chunks, systemPrompt, metadata) {
    return chunks.map((chunk, index) => ({
      system: systemPrompt + `\n\nNote: This is chunk ${index + 1} of ${chunks.length}. Focus on extracting information from this specific section.`,
      user: this.formatUserPrompt(chunk.text, metadata),
      chunkIndex: index,
      totalChunks: chunks.length,
      metadata
    }));
  }
}
```

### Response Parsing and Structured Data Extraction

```javascript
class ResponseParser {
  constructor() {
    this.schema = this.getExpectedSchema();
  }

  parseResponse(response, metadata = {}) {
    try {
      // Handle streaming response
      if (typeof response === 'object' && response.choices) {
        const content = response.choices[0]?.message?.content || '';
        return this.parseJSONContent(content, metadata);
      }

      // Handle direct string response
      if (typeof response === 'string') {
        return this.parseJSONContent(response, metadata);
      }

      throw new Error('Invalid response format');
    } catch (error) {
      console.error('Response parsing error:', error);
      return this.createFallbackResponse(response, error, metadata);
    }
  }

  parseJSONContent(content, metadata) {
    // Clean the content to extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Validate against schema
    const validated = this.validateAndClean(parsed);

    // Add metadata
    validated._metadata = {
      ...metadata,
      parsedAt: new Date().toISOString(),
      originalLength: content.length
    };

    return validated;
  }

  validateAndClean(data) {
    const cleaned = {
      actionItems: this.validateActionItems(data.actionItems || []),
      keyNotes: this.validateKeyNotes(data.keyNotes || []),
      nextSteps: this.validateNextSteps(data.nextSteps || []),
      meetingSynopsis: this.validateMeetingSynopsis(data.meetingSynopsis || {})
    };

    return cleaned;
  }

  validateActionItems(items) {
    return items.filter(item => item && item.task).map(item => ({
      task: String(item.task).trim(),
      assignee: item.assignee ? String(item.assignee).trim() : null,
      priority: this.validatePriority(item.priority),
      dueDate: item.dueDate ? String(item.dueDate).trim() : null,
      context: item.context ? String(item.context).trim() : null,
      id: this.generateId()
    }));
  }

  validateKeyNotes(notes) {
    return notes.filter(note => note && note.topic).map(note => ({
      topic: String(note.topic).trim(),
      content: String(note.content || '').trim(),
      participants: Array.isArray(note.participants) ?
        note.participants.map(p => String(p).trim()) : [],
      importance: this.validatePriority(note.importance),
      id: this.generateId()
    }));
  }

  validateNextSteps(steps) {
    return steps.filter(step => step && step.step).map(step => ({
      step: String(step.step).trim(),
      owner: step.owner ? String(step.owner).trim() : null,
      timeline: step.timeline ? String(step.timeline).trim() : null,
      dependencies: Array.isArray(step.dependencies) ?
        step.dependencies.map(d => String(d).trim()) : [],
      id: this.generateId()
    }));
  }

  validateMeetingSynopsis(synopsis) {
    return {
      summary: synopsis.summary ? String(synopsis.summary).trim() : '',
      participants: Array.isArray(synopsis.participants) ?
        synopsis.participants.map(p => String(p).trim()) : [],
      duration: synopsis.duration ? String(synopsis.duration).trim() : null,
      mainTopics: Array.isArray(synopsis.mainTopics) ?
        synopsis.mainTopics.map(t => String(t).trim()) : [],
      decisions: Array.isArray(synopsis.decisions) ?
        synopsis.decisions.map(d => String(d).trim()) : [],
      outcomes: Array.isArray(synopsis.outcomes) ?
        synopsis.outcomes.map(o => String(o).trim()) : []
    };
  }

  validatePriority(priority) {
    const validPriorities = ['High', 'Medium', 'Low'];
    return validPriorities.includes(priority) ? priority : 'Medium';
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  createFallbackResponse(originalResponse, error, metadata) {
    console.warn('Creating fallback response due to parsing error:', error);

    // Attempt basic text extraction
    const text = typeof originalResponse === 'string' ?
      originalResponse :
      (originalResponse.choices?.[0]?.message?.content || '');

    return {
      actionItems: this.extractBasicActionItems(text),
      keyNotes: this.extractBasicNotes(text),
      nextSteps: [],
      meetingSynopsis: {
        summary: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
        participants: [],
        duration: null,
        mainTopics: [],
        decisions: [],
        outcomes: []
      },
      _metadata: {
        ...metadata,
        fallback: true,
        error: error.message,
        parsedAt: new Date().toISOString()
      }
    };
  }

  extractBasicActionItems(text) {
    const actionPatterns = [
      /(?:action|task|todo|follow.?up):\s*(.+)/gi,
      /(?:need to|should|must|will)\s+(.+)/gi
    ];

    const items = [];
    actionPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10) {
          items.push({
            task: match[1].trim(),
            assignee: null,
            priority: 'Medium',
            dueDate: null,
            context: null,
            id: this.generateId()
          });
        }
      }
    });

    return items.slice(0, 10); // Limit to 10 items
  }

  extractBasicNotes(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 5).map(sentence => ({
      topic: 'Discussion Point',
      content: sentence.trim(),
      participants: [],
      importance: 'Medium',
      id: this.generateId()
    }));
  }

  getExpectedSchema() {
    return {
      actionItems: 'array',
      keyNotes: 'array',
      nextSteps: 'array',
      meetingSynopsis: 'object'
    };
  }
}
```

### Error Handling and Fallback Mechanisms

```javascript
class ErrorHandler {
  constructor() {
    this.errorTypes = {
      MODEL_LOAD_FAILED: 'model_load_failed',
      PROCESSING_FAILED: 'processing_failed',
      MEMORY_ERROR: 'memory_error',
      WEBGPU_ERROR: 'webgpu_error',
      NETWORK_ERROR: 'network_error'
    };
  }

  async handleError(error, context = {}) {
    const errorInfo = this.categorizeError(error);

    console.error(`[${errorInfo.type}] ${errorInfo.message}`, {
      error,
      context,
      timestamp: new Date().toISOString()
    });

    // Show user-friendly error message
    this.displayUserError(errorInfo);

    // Attempt recovery if possible
    const recovered = await this.attemptRecovery(errorInfo, context);

    return {
      error: errorInfo,
      recovered,
      context
    };
  }

  categorizeError(error) {
    const message = error.message || error.toString();

    if (message.includes('WebGPU') || message.includes('gpu')) {
      return {
        type: this.errorTypes.WEBGPU_ERROR,
        message: 'WebGPU initialization or processing failed',
        userMessage: 'Graphics acceleration is not available. Please ensure WebGPU is enabled in your browser.',
        recoverable: false
      };
    }

    if (message.includes('memory') || message.includes('allocation')) {
      return {
        type: this.errorTypes.MEMORY_ERROR,
        message: 'Insufficient memory for model operation',
        userMessage: 'Not enough memory available. Try closing other tabs or using a smaller model.',
        recoverable: true
      };
    }

    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: this.errorTypes.NETWORK_ERROR,
        message: 'Network error during model download',
        userMessage: 'Network connection failed. Please check your internet connection.',
        recoverable: true
      };
    }

    if (message.includes('model') || message.includes('load')) {
      return {
        type: this.errorTypes.MODEL_LOAD_FAILED,
        message: 'Model loading failed',
        userMessage: 'Failed to load the AI model. Please try again or select a different model.',
        recoverable: true
      };
    }

    return {
      type: this.errorTypes.PROCESSING_FAILED,
      message: message,
      userMessage: 'Processing failed. Please try again with different content.',
      recoverable: true
    };
  }

  displayUserError(errorInfo) {
    const errorContainer = document.getElementById('error-container') ||
      this.createErrorContainer();

    errorContainer.innerHTML = `
      <div class="error-message ${errorInfo.type}">
        <h3>⚠️ ${this.getErrorTitle(errorInfo.type)}</h3>
        <p>${errorInfo.userMessage}</p>
        ${errorInfo.recoverable ? '<button onclick="this.parentElement.remove()">Dismiss</button>' : ''}
      </div>
    `;

    errorContainer.style.display = 'block';

    // Auto-hide after 10 seconds for recoverable errors
    if (errorInfo.recoverable) {
      setTimeout(() => {
        errorContainer.style.display = 'none';
      }, 10000);
    }
  }

  createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'error-container';
    container.className = 'error-container';
    document.body.appendChild(container);
    return container;
  }

  getErrorTitle(errorType) {
    const titles = {
      [this.errorTypes.MODEL_LOAD_FAILED]: 'Model Loading Error',
      [this.errorTypes.PROCESSING_FAILED]: 'Processing Error',
      [this.errorTypes.MEMORY_ERROR]: 'Memory Error',
      [this.errorTypes.WEBGPU_ERROR]: 'Graphics Error',
      [this.errorTypes.NETWORK_ERROR]: 'Network Error'
    };

    return titles[errorType] || 'Unknown Error';
  }

  async attemptRecovery(errorInfo, context) {
    switch (errorInfo.type) {
      case this.errorTypes.MEMORY_ERROR:
        return await this.recoverFromMemoryError(context);

      case this.errorTypes.MODEL_LOAD_FAILED:
        return await this.recoverFromModelError(context);

      case this.errorTypes.NETWORK_ERROR:
        return await this.recoverFromNetworkError(context);

      default:
        return false;
    }
  }

  async recoverFromMemoryError(context) {
    try {
      // Clear any cached data
      if (window.gc) window.gc(); // Force garbage collection if available

      // Suggest smaller model
      const smallerModel = this.getSmallerModel(context.currentModel);
      if (smallerModel) {
        this.suggestModelDowngrade(smallerModel);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async recoverFromModelError(context) {
    try {
      // Clear model cache and retry
      const cacheManager = new ModelCacheManager();
      await cacheManager.clearModelCache();

      // Suggest retry
      this.suggestRetry();
      return true;
    } catch (error) {
      return false;
    }
  }

  async recoverFromNetworkError(context) {
    // Check if model is already cached
    const offlineManager = new OfflineManager();
    const canWorkOffline = await offlineManager.canProcessOffline(context.currentModel);

    if (canWorkOffline) {
      this.showOfflineMode();
      return true;
    }

    return false;
  }

  getSmallerModel(currentModel) {
    const modelHierarchy = [
      'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC'
    ];

    const currentIndex = modelHierarchy.indexOf(currentModel);
    return currentIndex > 0 ? modelHierarchy[currentIndex - 1] : null;
  }

  suggestModelDowngrade(smallerModel) {
    const suggestion = document.createElement('div');
    suggestion.className = 'model-suggestion';
    suggestion.innerHTML = `
      <p>💡 Try using a smaller model: <strong>${smallerModel}</strong></p>
      <button onclick="switchToModel('${smallerModel}')">Switch Model</button>
    `;

    document.body.appendChild(suggestion);
  }

  suggestRetry() {
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry Loading Model';
    retryButton.onclick = () => window.location.reload();

    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.appendChild(retryButton);
    }
  }

  showOfflineMode() {
    const offlineNotice = document.createElement('div');
    offlineNotice.className = 'offline-notice';
    offlineNotice.innerHTML = `
      <p>✅ Continuing in offline mode with cached model</p>
    `;

    document.body.appendChild(offlineNotice);
  }
}
```

## Technical Implementation Details

### JavaScript Module Architecture

The application follows a modular architecture for maintainability and scalability:

```javascript
// app.js - Main application controller
class MeetingNoteConverterApp {
  constructor() {
    this.processor = new MeetingNoteProcessor();
    this.preprocessor = new MeetingTextPreprocessor();
    this.promptEngine = new MeetingPromptEngine();
    this.responseParser = new ResponseParser();
    this.errorHandler = new ErrorHandler();
    this.exportManager = new ExportManager();

    this.state = {
      initialized: false,
      processing: false,
      currentModel: null,
      lastResult: null
    };

    this.initializeApp();
  }

  async initializeApp() {
    try {
      // Check browser compatibility
      await CompatibilityChecker.checkWebGPUSupport();
      CompatibilityChecker.checkRequiredAPIs();

      // Initialize UI
      this.setupEventListeners();
      this.setupFileHandling();

      // Show model selection
      this.showModelSelection();

      console.log('MeetingNoteConverter initialized successfully');
    } catch (error) {
      await this.errorHandler.handleError(error, { phase: 'initialization' });
    }
  }

  setupEventListeners() {
    // Process button
    document.getElementById('process-button').addEventListener('click',
      () => this.processContent());

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Text input character counter
    const textArea = document.getElementById('meeting-text');
    textArea.addEventListener('input', () => this.updateCharCounter());

    // Model selection
    document.getElementById('model-select').addEventListener('change',
      (e) => this.selectModel(e.target.value));
  }

  async processContent() {
    if (this.state.processing) return;

    try {
      this.state.processing = true;
      this.updateProcessingUI(true);

      // Get input content
      const content = this.getInputContent();
      if (!content.trim()) {
        throw new Error('Please provide meeting content to process');
      }

      // Preprocess content
      const preprocessed = this.preprocessor.preprocess(content);

      // Generate prompts
      const prompts = this.promptEngine.generatePrompt(preprocessed);

      // Process with LLM
      const response = await this.processor.processMeetingNotes(prompts);

      // Parse response
      const result = this.responseParser.parseResponse(response, preprocessed.metadata);

      // Display results
      this.displayResults(result);

      this.state.lastResult = result;

    } catch (error) {
      await this.errorHandler.handleError(error, {
        phase: 'processing',
        currentModel: this.state.currentModel
      });
    } finally {
      this.state.processing = false;
      this.updateProcessingUI(false);
    }
  }

  getInputContent() {
    const activeTab = document.querySelector('.tab-content.active');

    if (activeTab.id === 'text-input') {
      return document.getElementById('meeting-text').value;
    } else {
      const fileInput = document.getElementById('file-upload');
      return fileInput.files[0] ? this.readFileContent(fileInput.files[0]) : '';
    }
  }

  async readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.meetingApp = new MeetingNoteConverterApp();
});
```

### Memory Management for Large Models

```javascript
class MemoryManager {
  constructor() {
    this.memoryThreshold = 0.8; // 80% memory usage threshold
    this.monitoringInterval = 5000; // 5 seconds
    this.isMonitoring = false;
  }

  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.monitoringInterval);
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.isMonitoring = false;
    }
  }

  async checkMemoryUsage() {
    try {
      if ('memory' in performance) {
        const memInfo = performance.memory;
        const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;

        if (usageRatio > this.memoryThreshold) {
          console.warn(`High memory usage detected: ${(usageRatio * 100).toFixed(1)}%`);
          await this.performMemoryCleanup();
        }
      }
    } catch (error) {
      console.error('Memory monitoring error:', error);
    }
  }

  async performMemoryCleanup() {
    // Clear any cached responses
    if (window.meetingApp && window.meetingApp.state.lastResult) {
      window.meetingApp.state.lastResult = null;
    }

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    // Clear any temporary DOM elements
    this.clearTemporaryElements();

    console.log('Memory cleanup performed');
  }

  clearTemporaryElements() {
    const tempElements = document.querySelectorAll('.temp-element, .cached-content');
    tempElements.forEach(element => element.remove());
  }

  getMemoryInfo() {
    if ('memory' in performance) {
      const memInfo = performance.memory;
      return {
        used: Math.round(memInfo.usedJSHeapSize / (1024 * 1024)),
        total: Math.round(memInfo.totalJSHeapSize / (1024 * 1024)),
        limit: Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024)),
        usagePercent: Math.round((memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100)
      };
    }
    return null;
  }
}
```

### Performance Optimization Techniques

```javascript
class PerformanceOptimizer {
  constructor() {
    this.performanceMetrics = {
      modelLoadTime: 0,
      processingTime: 0,
      renderTime: 0,
      memoryUsage: 0
    };
  }

  // Optimize model loading with progressive enhancement
  async optimizeModelLoading(modelId) {
    const startTime = performance.now();

    try {
      // Pre-warm WebGPU context
      await this.preWarmWebGPU();

      // Load model with optimized settings
      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: this.trackLoadingProgress.bind(this),
        logLevel: "ERROR", // Reduce logging overhead
        useIndexedDBCache: false // Use faster Cache API
      }, {
        // Optimize for meeting processing workload
        context_window_size: 4096,
        temperature: 0.1,
        max_tokens: 2048,
        // Enable optimizations
        use_cache: true,
        batch_size: 1
      });

      this.performanceMetrics.modelLoadTime = performance.now() - startTime;
      return engine;

    } catch (error) {
      console.error('Model loading optimization failed:', error);
      throw error;
    }
  }

  async preWarmWebGPU() {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter.requestDevice();

      // Create a small buffer to initialize the GPU context
      const buffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      buffer.destroy();
    } catch (error) {
      console.warn('WebGPU pre-warming failed:', error);
    }
  }

  trackLoadingProgress(report) {
    // Update UI with loading progress
    const progressBar = document.getElementById('model-progress');
    const statusText = document.getElementById('progress-text');

    if (progressBar) progressBar.value = report.progress;
    if (statusText) statusText.textContent = report.text;

    // Log performance metrics
    if (report.progress === 1) {
      console.log(`Model loaded in ${this.performanceMetrics.modelLoadTime}ms`);
    }
  }

  // Optimize text processing with chunking and batching
  optimizeTextProcessing(text) {
    const startTime = performance.now();

    // Use Web Workers for CPU-intensive preprocessing
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./preprocessing-worker.js', import.meta.url));

      worker.postMessage({ text, action: 'preprocess' });

      worker.onmessage = (e) => {
        const processingTime = performance.now() - startTime;
        this.performanceMetrics.processingTime = processingTime;

        worker.terminate();
        resolve(e.data);
      };

      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };
    });
  }

  // Optimize DOM rendering with virtual scrolling
  optimizeResultsRendering(results) {
    const startTime = performance.now();

    // Use document fragments for efficient DOM manipulation
    const fragment = document.createDocumentFragment();

    // Render results in batches to avoid blocking the UI
    this.renderInBatches(results, fragment, () => {
      const container = document.getElementById('results-container');
      container.appendChild(fragment);

      this.performanceMetrics.renderTime = performance.now() - startTime;
      console.log(`Results rendered in ${this.performanceMetrics.renderTime}ms`);
    });
  }

  renderInBatches(items, container, callback, batchSize = 10) {
    let index = 0;

    const renderBatch = () => {
      const endIndex = Math.min(index + batchSize, items.length);

      for (let i = index; i < endIndex; i++) {
        const element = this.createResultElement(items[i]);
        container.appendChild(element);
      }

      index = endIndex;

      if (index < items.length) {
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(renderBatch);
      } else {
        callback();
      }
    };

    renderBatch();
  }

  createResultElement(item) {
    const element = document.createElement('div');
    element.className = 'result-item';
    element.innerHTML = `
      <h3>${item.title || item.task || item.topic}</h3>
      <p>${item.content || item.description}</p>
    `;
    return element;
  }

  // Monitor and report performance metrics
  getPerformanceReport() {
    return {
      ...this.performanceMetrics,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      webgpuSupported: !!navigator.gpu
    };
  }
}
```

### Security Considerations for Client-Side Processing

```javascript
class SecurityManager {
  constructor() {
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.maxTextLength = 50000; // 50k characters
    this.allowedFileTypes = ['.txt'];
    this.sanitizationRules = this.initializeSanitizationRules();
  }

  // Validate and sanitize file uploads
  validateFileUpload(file) {
    const validationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check file size
    if (file.size > this.maxFileSize) {
      validationResult.valid = false;
      validationResult.errors.push(`File size exceeds ${this.maxFileSize / (1024 * 1024)}MB limit`);
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!this.allowedFileTypes.includes(fileExtension)) {
      validationResult.valid = false;
      validationResult.errors.push(`File type ${fileExtension} not allowed`);
    }

    // Check for suspicious file names
    if (this.containsSuspiciousPatterns(file.name)) {
      validationResult.valid = false;
      validationResult.errors.push('Suspicious file name detected');
    }

    return validationResult;
  }

  // Sanitize text input to prevent XSS and injection attacks
  sanitizeTextInput(text) {
    if (typeof text !== 'string') {
      throw new Error('Input must be a string');
    }

    if (text.length > this.maxTextLength) {
      throw new Error(`Text length exceeds ${this.maxTextLength} character limit`);
    }

    // Apply sanitization rules
    let sanitized = text;

    this.sanitizationRules.forEach(rule => {
      sanitized = sanitized.replace(rule.pattern, rule.replacement);
    });

    // Remove potentially dangerous patterns
    sanitized = this.removeDangerousPatterns(sanitized);

    return sanitized;
  }

  initializeSanitizationRules() {
    return [
      // Remove HTML tags
      { pattern: /<[^>]*>/g, replacement: '' },
      // Remove script tags and content
      { pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, replacement: '' },
      // Remove event handlers
      { pattern: /on\w+\s*=\s*["'][^"']*["']/gi, replacement: '' },
      // Remove javascript: URLs
      { pattern: /javascript:/gi, replacement: '' },
      // Remove data: URLs
      { pattern: /data:/gi, replacement: '' }
    ];
  }

  removeDangerousPatterns(text) {
    const dangerousPatterns = [
      // SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      // Command injection patterns
      /(\b(eval|exec|system|shell_exec|passthru)\b)/gi,
      // Path traversal patterns
      /(\.\.\/|\.\.\\)/g
    ];

    dangerousPatterns.forEach(pattern => {
      text = text.replace(pattern, '');
    });

    return text;
  }

  containsSuspiciousPatterns(filename) {
    const suspiciousPatterns = [
      /\.(exe|bat|cmd|scr|pif|com)$/i,
      /\.(php|asp|jsp|js|vbs)$/i,
      /(script|eval|exec)/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(filename));
  }

  // Implement Content Security Policy
  setupContentSecurityPolicy() {
    const cspMeta = document.createElement('meta');
    cspMeta.httpEquiv = 'Content-Security-Policy';
    cspMeta.content = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://esm.run",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self' https://huggingface.co https://raw.githubusercontent.com",
      "worker-src 'self' blob:",
      "wasm-src 'self' https://raw.githubusercontent.com"
    ].join('; ');

    document.head.appendChild(cspMeta);
  }

  // Secure memory cleanup
  secureCleanup(sensitiveData) {
    if (typeof sensitiveData === 'string') {
      // Overwrite string memory (limited effectiveness in JS)
      sensitiveData = null;
    } else if (typeof sensitiveData === 'object') {
      // Clear object properties
      Object.keys(sensitiveData).forEach(key => {
        sensitiveData[key] = null;
      });
    }

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  // Generate security report
  generateSecurityReport() {
    return {
      timestamp: new Date().toISOString(),
      cspEnabled: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
      httpsEnabled: location.protocol === 'https:',
      webgpuSecure: this.checkWebGPUSecurity(),
      storageSecure: this.checkStorageSecurity()
    };
  }

  checkWebGPUSecurity() {
    return {
      available: !!navigator.gpu,
      secureContext: window.isSecureContext,
      origin: location.origin
    };
  }

  checkStorageSecurity() {
    return {
      cacheAPI: !!window.caches,
      indexedDB: !!window.indexedDB,
      localStorage: !!window.localStorage,
      secureContext: window.isSecureContext
    };
  }
}

// Initialize security measures on page load
document.addEventListener('DOMContentLoaded', () => {
  const securityManager = new SecurityManager();
  securityManager.setupContentSecurityPolicy();

  // Log security status
  console.log('Security Report:', securityManager.generateSecurityReport());
});
```

## Deployment Checklist

### Pre-Deployment Verification

1. **Browser Compatibility Testing**
   - Test on Chrome 113+, Firefox 110+, Safari 16.4+, Edge 113+
   - Verify WebGPU support and fallback handling
   - Test responsive design on various screen sizes

2. **Performance Validation**
   - Model loading time < 60 seconds on average connection
   - Processing time < 30 seconds for typical meeting notes
   - Memory usage stays within browser limits

3. **Security Verification**
   - Content Security Policy properly configured
   - Input sanitization working correctly
   - No sensitive data persistence beyond session

4. **Functionality Testing**
   - File upload and text input working
   - All export formats generating correctly
   - Error handling and recovery mechanisms functional

### Production Deployment

The application can be deployed to any static hosting service:

- **GitHub Pages**: Simple deployment from repository
- **Netlify**: Automatic deployment with CDN
- **Vercel**: Zero-configuration deployment
- **AWS S3 + CloudFront**: Enterprise-grade hosting
- **Any web server**: Apache, Nginx, or simple HTTP server

No server-side configuration required - just serve the static files with proper MIME types for WebAssembly (.wasm) files.

This completes the comprehensive technical integration guide for the MeetingNoteConverter application.
