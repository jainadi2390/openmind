/**
 * Chatbox Renderer - Handles chat functionality
 * @module chatbox-renderer
 */

/**
 * Chat state object
 * @typedef {Object} ChatState
 * @property {Array} messages - Array of chat messages
 * @property {boolean} isWaiting - Whether waiting for AI response
 * @property {string|null} geminiApiKey - User's Gemini API key
 * @property {string} selectedModel - Selected Gemini model
 * @property {string} systemPrompt - System prompt for AI
 * @property {string} context - User-provided context
 * @property {string|null} capturedScreenData - Base64 image data of captured screen
 * @property {boolean} screenCaptureMode - Whether in screen capture mode
 */
const chatState = {
  messages: [],
  isWaiting: false,
  geminiApiKey: null,
  selectedModel: 'gemini-2.0-flash-exp', // Latest Gemini 2.0 experimental model
  systemPrompt: '',
  context: '',
  capturedScreenData: null,
  screenCaptureMode: false
};

// DOM Elements - will be initialized when DOM is ready
let chatMessages;
let chatInput;
let sendBtn;
let captureBtn;
let closeBtn;
let minimizeBtn;
let typingIndicator;
let emptyState;
let warningBanner;
let quickActions;

/**
 * Initialize DOM element references
 * Must be called after DOM is ready
 * @returns {void}
 */
function initDOMElements() {
  chatMessages = document.getElementById('chat-messages');
  chatInput = document.getElementById('chat-input');
  sendBtn = document.getElementById('send-btn');
  captureBtn = document.getElementById('capture-screen-btn');
  closeBtn = document.getElementById('close-btn');
  minimizeBtn = document.getElementById('minimize-btn');
  typingIndicator = document.getElementById('typing-indicator');
  emptyState = document.getElementById('empty-state');
  warningBanner = document.getElementById('warning-banner');
  quickActions = document.querySelectorAll('.quick-action');
}

/**
 * Initialize chatbox
 * Loads settings, sets up event listeners, checks invisible mode, and loads history
 * @async
 * @returns {Promise<void>}
 */
async function init() {
  initDOMElements();
  await loadSettings();
  setupEventListeners();
  checkInvisibleMode();
  loadChatHistory();
}

/**
 * Load settings from storage
 * Retrieves API key, model, and prompts
 * @async
 * @returns {Promise<void>}
 */
async function loadSettings() {
  try {
    chatState.geminiApiKey = await window.chatboxAPI.getStoreValue('geminiApiKey');
    let model = await window.chatboxAPI.getStoreValue('model') || 'gemini-2.0-flash-exp';

    // Map old/incorrect model names to working v1beta models
    const modelMapping = {
      'gemini-pro': 'gemini-2.0-flash-exp',
      'gemini-1.0-pro': 'gemini-2.0-flash-exp',
      'gemini-1.5-flash': 'gemini-1.5-flash-latest',
      'gemini-1.5-pro': 'gemini-1.5-pro-latest'
    };

    // Apply mapping if needed
    if (modelMapping[model]) {
      model = modelMapping[model];
      await window.chatboxAPI.setStoreValue('model', model);
    }

    // Ensure we have a valid model (fallback to 2.0-flash-exp)
    const validModels = ['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
    if (!validModels.includes(model)) {
      model = 'gemini-2.0-flash-exp';
      await window.chatboxAPI.setStoreValue('model', model);
    }

    chatState.selectedModel = model;
    chatState.systemPrompt = await window.chatboxAPI.getStoreValue('systemPrompt') ||
      'You are a helpful AI assistant. Provide concise, accurate responses.';
    chatState.context = await window.chatboxAPI.getStoreValue('context') || '';
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Check if invisible mode is enabled
async function checkInvisibleMode() {
  try {
    const hideFromScreenShare = await window.chatboxAPI.getStoreValue('hideFromScreenShare');
    if (hideFromScreenShare) {
      warningBanner.classList.add('show');
    }
  } catch (error) {
    console.error('Error checking invisible mode:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Send message
  sendBtn.addEventListener('click', sendMessage);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Window controls
  closeBtn.addEventListener('click', () => {
    window.chatboxAPI.closeChatbox();
  });

  minimizeBtn.addEventListener('click', () => {
    window.chatboxAPI.minimizeChatbox();
  });

  // Quick actions
  quickActions.forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt === 'Clear chat history') {
        clearChat();
      } else {
        chatInput.value = prompt;
        chatInput.focus();
      }
    });
  });

  // Screen capture
  captureBtn.addEventListener('click', captureScreen);
}

/**
 * Send user message to AI
 * Validates API key, shows typing indicator, calls Gemini API
 * Includes captured screen if in screen capture mode
 * @async
 * @returns {Promise<void>}
 */
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || chatState.isWaiting) return;

  if (!chatState.geminiApiKey) {
    addSystemMessage('Please configure your Gemini API key in Settings first.');
    return;
  }

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Check if we have a captured screen
  const hasScreen = chatState.screenCaptureMode && chatState.capturedScreenData;

  // Add user message with screen indicator if applicable
  addMessage('user', hasScreen ? `📷 ${message}` : message);

  // Show typing indicator
  showTyping(true);
  chatState.isWaiting = true;
  sendBtn.disabled = true;
  captureBtn.disabled = true;

  try {
    // Call Gemini API with or without image
    const response = await callGeminiAPI(
      message,
      hasScreen ? chatState.capturedScreenData : null
    );

    // Add assistant response
    addMessage('assistant', response);

    // Clear captured screen after using it
    if (hasScreen) {
      clearCapturedScreen();
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    addSystemMessage('Error: ' + error.message);
  } finally {
    showTyping(false);
    chatState.isWaiting = false;
    sendBtn.disabled = false;
    captureBtn.disabled = false;
    chatInput.focus();
  }
}

/**
 * Call Gemini API with user message and optional image
 * Supports text-only and multimodal (vision) requests
 * @async
 * @param {string} userMessage - The user's message or question
 * @param {string|null} imageData - Optional base64 image data for vision
 * @returns {Promise<string>} The AI's response text
 * @throws {Error} If API call fails
 */
async function callGeminiAPI(userMessage, imageData = null) {
  const apiKey = chatState.geminiApiKey;
  if (!apiKey) {
    throw new Error('API key is not configured. Please add your Gemini API key in Settings.');
  }

  let model = chatState.selectedModel;
  const systemPrompt = chatState.systemPrompt;
  const context = chatState.context;

  // Map old/incorrect model names to working v1beta models
  const modelMapping = {
    'gemini-pro': 'gemini-2.0-flash-exp',
    'gemini-1.0-pro': 'gemini-2.0-flash-exp',
    'gemini-1.5-flash': 'gemini-1.5-flash-latest',
    'gemini-1.5-pro': 'gemini-1.5-pro-latest'
  };

  // Apply mapping if needed
  if (modelMapping[model]) {
    model = modelMapping[model];
    chatState.selectedModel = model;
    await window.chatboxAPI.setStoreValue('model', model);
  }

  // Ensure we have a valid model (fallback to 2.0-flash-exp)
  const validModels = ['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
  if (!validModels.includes(model)) {
    model = 'gemini-2.0-flash-exp';
    chatState.selectedModel = model;
  }

  // Use v1beta API version (required for these models)
  const apiVersion = 'v1beta';

  console.log(`[Gemini API] Using model: ${model}, API version: ${apiVersion}, Has image: ${!!imageData}`);

  // Build conversation context with specialized prompt for screen analysis
  let systemContext = systemPrompt;

  // Add screen analysis context if image is provided
  if (imageData) {
    systemContext += `\n\nYou are an expert assistant analyzing content on the user's screen. `;
    systemContext += `The user has captured their screen and will ask you specific questions about it. `;
    systemContext += `CRITICAL INSTRUCTIONS:`;
    systemContext += `\n1. Focus ONLY on answering their specific question - ignore everything else on screen`;
    systemContext += `\n2. Do NOT describe the entire screen unless explicitly asked`;
    systemContext += `\n3. If asked to solve a problem: Provide detailed step-by-step solution with clear explanations`;
    systemContext += `\n4. If asked about specific content: Focus exclusively on that content`;
    systemContext += `\n5. For math/science problems: Show ALL working steps, formulas, and reasoning`;
    systemContext += `\n6. Be precise, thorough, and task-oriented`;
    systemContext += `\n7. If you see exam questions, help solve the SPECIFIC question they ask about`;
  }

  if (context) {
    systemContext += `\n\nAdditional Context:\n${context}`;
  }

  // Add recent messages for context (last 10 messages)
  const recentMessages = chatState.messages.slice(-10);
  let conversationText = systemContext + '\n\nConversation:\n';

  recentMessages.forEach(msg => {
    if (msg.role === 'user' || msg.role === 'assistant') {
      // Strip emoji indicators from history to keep it clean
      const cleanContent = msg.content.replace(/^📷\s*/, '');
      conversationText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${cleanContent}\n`;
    }
  });

  conversationText += `User: ${userMessage}\nAssistant:`;

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

  // Build parts array for the request
  const requestParts = [{ text: conversationText }];

  // Add image if provided
  if (imageData) {
    requestParts.push({
      inlineData: {
        mimeType: 'image/png',
        data: imageData
      }
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: requestParts
      }],
      generationConfig: {
        temperature: 0.7, // Lower temperature for more focused, accurate responses
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096, // Increased for detailed solutions
      }
    })
  });

  if (!response.ok) {
    let errorMessage = `Gemini API error (${response.status})`;
    try {
      const error = await response.json();
      errorMessage = error.error?.message || errorMessage;
    } catch (e) {
      // If JSON parsing fails, use the status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Invalid response from Gemini API');
  }

  const parts = data.candidates[0].content.parts;
  if (!parts || parts.length === 0 || !parts[0].text) {
    throw new Error('No text content in API response');
  }

  return parts[0].text;
}

/**
 * Capture screen and enter "Use Screen" mode
 * Stores screenshot for use with next user message
 * Does not automatically send - waits for user to type their question
 * @async
 * @returns {Promise<void>}
 */
async function captureScreen() {
  if (chatState.isWaiting) return;

  if (!chatState.geminiApiKey) {
    addSystemMessage('Please configure your Gemini API key in Settings first.');
    return;
  }

  try {
    // If already in screen capture mode, clear it
    if (chatState.screenCaptureMode) {
      clearCapturedScreen();
      return;
    }

    // Get screen sources
    const sources = await window.chatboxAPI.getScreenSources();

    if (!sources || sources.length === 0) {
      addSystemMessage('No screen sources available for capture.');
      return;
    }

    // Use the first screen source (primary display)
    const primaryScreen = sources[0];

    // The thumbnail is already a data URL string from the main process
    const thumbnailDataUrl = primaryScreen.thumbnail;

    // Convert data URL to base64 (remove the data:image/png;base64, prefix)
    const base64Image = thumbnailDataUrl.split(',')[1];

    // Store the captured screen
    chatState.capturedScreenData = base64Image;
    chatState.screenCaptureMode = true;

    // Update UI to show screen is captured
    updateCaptureButtonState(true);
    chatInput.placeholder = '📷 Screen captured! Ask me anything about what you see...';
    chatInput.focus();

    // Show feedback message
    addSystemMessage('📷 Screen captured! Now type your question about what you see on screen.');

  } catch (error) {
    console.error('Error capturing screen:', error);
    addSystemMessage('Error capturing screen: ' + error.message);
  }
}

/**
 * Clear captured screen and exit screen capture mode
 * @returns {void}
 */
function clearCapturedScreen() {
  chatState.capturedScreenData = null;
  chatState.screenCaptureMode = false;
  updateCaptureButtonState(false);
  chatInput.placeholder = 'Ask me anything or capture screen...';
}

/**
 * Update capture button visual state
 * @param {boolean} isActive - Whether screen capture mode is active
 * @returns {void}
 */
function updateCaptureButtonState(isActive) {
  if (isActive) {
    captureBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    captureBtn.style.boxShadow = '0 0 15px rgba(102, 126, 234, 0.6)';
    captureBtn.title = 'Clear captured screen';
  } else {
    captureBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    captureBtn.style.boxShadow = 'none';
    captureBtn.title = 'Capture Screen (Ask AI about what\'s on screen)';
  }
}

// Add message to chat
function addMessage(role, content) {
  // Hide empty state
  if (emptyState) {
    emptyState.style.display = 'none';
  }

  const message = {
    role,
    content,
    timestamp: new Date().toISOString()
  };

  chatState.messages.push(message);

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const contentP = document.createElement('p');
  contentP.textContent = content;
  messageDiv.appendChild(contentP);

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  messageDiv.appendChild(time);

  chatMessages.insertBefore(messageDiv, typingIndicator);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Save to storage
  saveChatHistory();
}

// Add system message
function addSystemMessage(content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message system';
  messageDiv.textContent = content;

  chatMessages.insertBefore(messageDiv, typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show/hide typing indicator
function showTyping(show) {
  if (show) {
    typingIndicator.classList.add('active');
  } else {
    typingIndicator.classList.remove('active');
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Clear chat
async function clearChat() {
  if (confirm('Clear all chat messages?')) {
    chatState.messages = [];

    // Remove all message elements
    const messages = chatMessages.querySelectorAll('.message:not(.system)');
    messages.forEach(msg => msg.remove());

    // Show empty state
    if (emptyState) {
      emptyState.style.display = 'flex';
    }

    // Clear storage
    try {
      await window.chatboxAPI.setStoreValue('chatHistory', []);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }

    addSystemMessage('Chat cleared');
  }
}

// Save chat history
async function saveChatHistory() {
  try {
    // Keep only last 50 messages
    const historyToSave = chatState.messages.slice(-50);
    await window.chatboxAPI.setStoreValue('chatHistory', historyToSave);
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
}

// Load chat history
async function loadChatHistory() {
  try {
    const history = await window.chatboxAPI.getStoreValue('chatHistory') || [];

    if (history.length > 0) {
      emptyState.style.display = 'none';

      history.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const messageDiv = document.createElement('div');
          messageDiv.className = `message ${msg.role}`;

          const contentP = document.createElement('p');
          contentP.textContent = msg.content;
          messageDiv.appendChild(contentP);

          const time = document.createElement('div');
          time.className = 'message-time';
          const msgDate = new Date(msg.timestamp);
          time.textContent = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          messageDiv.appendChild(time);

          chatMessages.insertBefore(messageDiv, typingIndicator);
        }
      });

      chatState.messages = history;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
