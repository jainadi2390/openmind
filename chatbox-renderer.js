// Chatbox Renderer - Handles chat functionality

// State
const chatState = {
  messages: [],
  isWaiting: false,
  geminiApiKey: null,
  selectedModel: 'gemini-2.0-flash-exp',
  systemPrompt: '',
  context: ''
};

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const captureBtn = document.getElementById('capture-screen-btn');
const closeBtn = document.getElementById('close-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const typingIndicator = document.getElementById('typing-indicator');
const emptyState = document.getElementById('empty-state');
const warningBanner = document.getElementById('warning-banner');
const quickActions = document.querySelectorAll('.quick-action');

// Initialize
async function init() {
  await loadSettings();
  setupEventListeners();
  checkInvisibleMode();
  loadChatHistory();
}

// Load settings
async function loadSettings() {
  try {
    chatState.geminiApiKey = await window.chatboxAPI.getStoreValue('geminiApiKey');
    let model = await window.chatboxAPI.getStoreValue('model') || 'gemini-2.0-flash-exp';

    // Map old model names to new ones
    const modelMapping = {
      'gemini-pro': 'gemini-1.5-flash',
      'gemini-1.0-pro': 'gemini-1.5-flash'
    };

    if (modelMapping[model]) {
      model = modelMapping[model];
      // Update stored model
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

// Send message
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

  // Add user message
  addMessage('user', message);

  // Show typing indicator
  showTyping(true);
  chatState.isWaiting = true;
  sendBtn.disabled = true;

  try {
    // Call Gemini API
    const response = await callGeminiAPI(message);

    // Add assistant response
    addMessage('assistant', response);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    addSystemMessage('Error: ' + error.message);
  } finally {
    showTyping(false);
    chatState.isWaiting = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// Call Gemini API
async function callGeminiAPI(userMessage, imageData = null) {
  const apiKey = chatState.geminiApiKey;
  let model = chatState.selectedModel;
  const systemPrompt = chatState.systemPrompt;
  const context = chatState.context;

  // Map old model names to new ones
  const modelMapping = {
    'gemini-pro': 'gemini-1.5-flash',
    'gemini-1.0-pro': 'gemini-1.5-flash'
  };

  if (modelMapping[model]) {
    model = modelMapping[model];
    // Update stored model
    chatState.selectedModel = model;
    await window.chatboxAPI.setStoreValue('model', model);
  }

  // Use flash or pro models for vision (they support multimodal)
  // Experimental models also support vision
  const apiVersion = 'v1beta';

  // Build conversation context
  let systemContext = systemPrompt;
  if (context) {
    systemContext += `\n\nAdditional Context:\n${context}`;
  }

  // Add recent messages for context (last 10 messages)
  const recentMessages = chatState.messages.slice(-10);
  let conversationText = systemContext + '\n\nConversation:\n';

  recentMessages.forEach(msg => {
    if (msg.role === 'user' || msg.role === 'assistant') {
      conversationText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }
  });

  conversationText += `User: ${userMessage}\nAssistant:`;

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

  // Build parts array for the request
  const parts = [{ text: conversationText }];

  // Add image if provided
  if (imageData) {
    parts.push({
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
        parts: parts
      }],
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.candidates[0].content.parts[0].text;
}

// Capture screen and ask AI
async function captureScreen() {
  if (chatState.isWaiting) return;

  if (!chatState.geminiApiKey) {
    addSystemMessage('Please configure your Gemini API key in Settings first.');
    return;
  }

  try {
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

    // Get user's question or use default
    let question = chatInput.value.trim();
    if (!question) {
      question = "What do you see on this screen? Please describe what's visible and provide any relevant insights.";
    }

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Add user message with image indicator
    addMessage('user', `📷 ${question}`);

    // Show typing indicator
    showTyping(true);
    chatState.isWaiting = true;
    sendBtn.disabled = true;
    captureBtn.disabled = true;

    // Call Gemini API with image
    const response = await callGeminiAPI(question, base64Image);

    // Add assistant response
    addMessage('assistant', response);

  } catch (error) {
    console.error('Error capturing screen:', error);
    addSystemMessage('Error capturing screen: ' + error.message);
  } finally {
    showTyping(false);
    chatState.isWaiting = false;
    sendBtn.disabled = false;
    captureBtn.disabled = false;
    chatInput.focus();
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
