/**
 * OpenMind AI Assistant - Renderer Process
 * This handles all UI interactions and AI functionality
 * @module renderer
 */

/**
 * Application state object
 * @typedef {Object} AppState
 * @property {boolean} isRecording - Whether recording is active
 * @property {boolean} isTranscribing - Whether AI is processing
 * @property {string} currentTranscript - Current transcript text
 * @property {Array} conversationHistory - History of user/AI exchanges
 * @property {string|null} geminiApiKey - User's Gemini API key
 * @property {string} selectedModel - Selected Gemini model
 * @property {string} systemPrompt - System prompt for AI
 * @property {string} context - User-provided context
 * @property {Object|null} recognition - Web Speech API instance
 * @property {Date|null} meetingStartTime - When recording started
 * @property {boolean} alwaysOnTop - Window always-on-top state
 */
const state = {
  isRecording: false,
  isTranscribing: false,
  currentTranscript: '',
  conversationHistory: [],
  geminiApiKey: null,
  selectedModel: 'gemini-2.0-flash-exp',
  systemPrompt: '',
  context: '',
  recognition: null,
  meetingStartTime: null,
  alwaysOnTop: false
};

/**
 * Initialize the application
 * Loads settings, sets up navigation, recording, and event listeners
 * @async
 * @returns {Promise<void>}
 */
async function init() {
  await loadSettings();
  setupNavigation();
  setupRecording();
  setupSettings();
  setupEventListeners();
  updateGreeting();
  checkApiKey();
}

/**
 * Update greeting based on time of day
 * Shows "Good morning", "Good afternoon", or "Good evening"
 * Updates every minute
 * @returns {void}
 */
function updateGreeting() {
  const greetingElement = document.getElementById('greeting-text');
  if (!greetingElement) return;

  const hour = new Date().getHours();
  let greeting;

  if (hour < 12) {
    greeting = 'Good morning';
  } else if (hour < 18) {
    greeting = 'Good afternoon';
  } else {
    greeting = 'Good evening';
  }

  greetingElement.textContent = greeting;

  // Update every minute
  setTimeout(updateGreeting, 60000);
}

/**
 * Load settings from storage
 * Retrieves API key, model, prompts, and preferences from electron-store
 * @async
 * @returns {Promise<void>}
 */
async function loadSettings() {
  try {
    const apiKey = await window.electronAPI.getStoreValue('geminiApiKey');
    let model = await window.electronAPI.getStoreValue('model') || 'gemini-2.0-flash-exp';
    const systemPrompt = await window.electronAPI.getStoreValue('systemPrompt');
    const context = await window.electronAPI.getStoreValue('context');
    const language = await window.electronAPI.getStoreValue('language') || 'en-US';

    // Map old model names to working v1beta models
    const modelMapping = {
      'gemini-pro': 'gemini-2.0-flash-exp',
      'gemini-1.0-pro': 'gemini-2.0-flash-exp',
      'gemini-1.5-flash': 'gemini-1.5-flash-latest',
      'gemini-1.5-pro': 'gemini-1.5-pro-latest'
    };

    if (modelMapping[model]) {
      model = modelMapping[model];
      // Update stored model
      await window.electronAPI.setStoreValue('model', model);
    }

    // Ensure we have a valid model (fallback to 2.0-flash-exp)
    const validModels = ['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
    if (!validModels.includes(model)) {
      model = 'gemini-2.0-flash-exp';
      await window.electronAPI.setStoreValue('model', model);
    }

    state.geminiApiKey = apiKey;
    state.selectedModel = model;

    const apiKeyInput = document.getElementById('gemini-api-key');
    const modelSelect = document.getElementById('model-select');
    const systemPromptTextarea = document.getElementById('system-prompt');
    const contextInput = document.getElementById('context-input');
    const languageSelect = document.getElementById('language-select');

    if (apiKey) apiKeyInput.value = apiKey;
    modelSelect.value = model;
    if (systemPrompt) {
      systemPromptTextarea.value = systemPrompt;
      state.systemPrompt = systemPrompt;
    } else {
      state.systemPrompt = systemPromptTextarea.value;
    }
    if (context) {
      contextInput.value = context;
      state.context = context;
    }
    languageSelect.value = language;

    // Load conversation history
    const history = await window.electronAPI.getStoreValue('meetingHistory') || [];
    renderHistory(history);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Setup navigation between views
 * Handles clicks on navigation items and switches between Assistant, History, Settings
 * @returns {void}
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;

      // Update active nav item
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Show corresponding view
      views.forEach(view => view.classList.remove('active'));
      document.getElementById(`${viewName}-view`).classList.add('active');
    });
  });
}

/**
 * Setup recording and transcription
 * Initializes Web Speech API and sets up event handlers for voice recognition
 * @returns {void}
 */
function setupRecording() {
  const recordBtn = document.getElementById('record-btn');
  const transcriptContent = document.getElementById('transcript-content');

  // Check if browser supports Web Speech API
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('Speech recognition not supported');
    recordBtn.disabled = true;
    recordBtn.title = 'Speech recognition not supported in this browser';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SpeechRecognition();

  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = document.getElementById('language-select')?.value || 'en-US';

  state.recognition.onstart = () => {
    state.isRecording = true;
    state.meetingStartTime = new Date();
    updateRecordButton();
    updateStatusBadge('recording');
    transcriptContent.innerHTML = '<p class="transcript-item">Listening...</p>';
  };

  state.recognition.onresult = async (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      state.currentTranscript += finalTranscript;
      addTranscriptItem(finalTranscript);

      // Auto-suggest if enabled
      const autoSuggest = document.getElementById('auto-suggest-checkbox')?.checked;
      if (autoSuggest && finalTranscript.trim().length > 20) {
        await getAISuggestion(finalTranscript);
      }

      // Add to conversation history
      state.conversationHistory.push({
        role: 'user',
        content: finalTranscript,
        timestamp: new Date().toISOString()
      });
    }

    // Show interim results
    if (interimTranscript) {
      const lastItem = transcriptContent.lastElementChild;
      if (lastItem && lastItem.classList.contains('interim')) {
        lastItem.textContent = interimTranscript;
      } else {
        const interim = document.createElement('p');
        interim.className = 'transcript-item interim';
        interim.style.opacity = '0.6';
        interim.textContent = interimTranscript;
        transcriptContent.appendChild(interim);
      }
    }
  };

  state.recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    setStatus(`Error: ${event.error}`, 'error');
  };

  state.recognition.onend = () => {
    if (state.isRecording) {
      // Auto-restart if still recording
      try {
        state.recognition.start();
      } catch (error) {
        console.error('Error restarting recognition:', error);
        stopRecording();
      }
    }
  };

  recordBtn.addEventListener('click', toggleRecording);

  // Listen for global shortcut
  window.electronAPI.onToggleRecording(() => {
    toggleRecording();
  });
}

/**
 * Toggle recording on/off
 * @returns {void}
 */
function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

/**
 * Start recording audio and transcription
 * Checks for API key before starting
 * @returns {void}
 */
function startRecording() {
  if (!state.geminiApiKey) {
    alert('Please enter your Gemini API key in Settings first.');
    // Switch to settings view
    document.querySelector('.nav-item[data-view="settings"]').click();
    return;
  }

  try {
    state.recognition.lang = document.getElementById('language-select')?.value || 'en-US';
    state.recognition.start();
    state.currentTranscript = '';
    state.conversationHistory = [];
  } catch (error) {
    console.error('Error starting recording:', error);
    setStatus('Failed to start recording', 'error');
  }
}

/**
 * Stop recording and save meeting to history
 * @returns {void}
 */
function stopRecording() {
  if (state.recognition && state.isRecording) {
    state.isRecording = false;
    state.recognition.stop();
    updateRecordButton();
    updateStatusBadge('ready');

    // Save meeting to history
    saveMeetingToHistory();
  }
}

function updateRecordButton() {
  const recordBtn = document.getElementById('record-btn');
  const btnText = recordBtn.querySelector('.btn-text');

  if (state.isRecording) {
    recordBtn.classList.add('recording');
    btnText.textContent = 'Stop Recording';
  } else {
    recordBtn.classList.remove('recording');
    btnText.textContent = 'Start Recording';
  }
}

function updateStatusBadge(status) {
  // Update both status badges (nav and view header)
  const navBadge = document.getElementById('nav-status-badge');
  const viewBadge = document.getElementById('view-status-badge');

  const badges = [navBadge, viewBadge].filter(badge => badge !== null);

  badges.forEach(badge => {
    badge.className = 'status-badge';

    switch (status) {
      case 'recording':
        badge.classList.add('recording');
        badge.textContent = 'Recording';
        break;
      case 'ready':
        badge.classList.add('ready');
        badge.textContent = 'Ready';
        break;
      default:
        badge.textContent = 'Ready';
    }
  });
}

function addTranscriptItem(text) {
  const transcriptContent = document.getElementById('transcript-content');

  // Remove empty state
  const emptyState = transcriptContent.querySelector('.empty-state');
  if (emptyState) {
    transcriptContent.innerHTML = '';
  }

  // Remove interim results
  const interim = transcriptContent.querySelector('.interim');
  if (interim) {
    interim.remove();
  }

  const item = document.createElement('div');
  item.className = 'transcript-item fade-in';

  const time = document.createElement('div');
  time.className = 'transcript-time';
  time.textContent = new Date().toLocaleTimeString();

  const content = document.createElement('p');
  content.textContent = text;

  item.appendChild(time);
  item.appendChild(content);
  transcriptContent.appendChild(item);

  // Auto-scroll to bottom
  transcriptContent.scrollTop = transcriptContent.scrollHeight;
}

/**
 * Get AI suggestion for transcribed text
 * @async
 * @param {string} text - The transcribed text to analyze
 * @returns {Promise<void>}
 */
async function getAISuggestion(text) {
  if (state.isTranscribing || !state.geminiApiKey) {
    return;
  }

  state.isTranscribing = true;
  setStatus('Getting AI suggestion...', 'processing');

  try {
    const response = await callGeminiAPI(text);
    displayAIResponse(response);

    // Add to conversation history
    state.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting AI suggestion:', error);
    setStatus('Error: ' + error.message, 'error');
  } finally {
    state.isTranscribing = false;
    if (state.isRecording) {
      updateStatusBadge('recording');
    }
  }
}

/**
 * Call Gemini API with user message and context
 * @async
 * @param {string} userMessage - The user's message or question
 * @returns {Promise<string>} The AI's response text
 * @throws {Error} If API call fails
 */
async function callGeminiAPI(userMessage) {
  const apiKey = state.geminiApiKey;
  let model = state.selectedModel;
  const systemPrompt = state.systemPrompt || document.getElementById('system-prompt').value;
  const context = state.context || document.getElementById('context-input').value;

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
    state.selectedModel = model;
    await window.electronAPI.setStoreValue('model', model);
  }

  // Ensure we have a valid model (fallback to 2.0-flash-exp)
  const validModels = ['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
  if (!validModels.includes(model)) {
    model = 'gemini-2.0-flash-exp';
    state.selectedModel = model;
  }

  // Use v1beta API version (required for these models)
  const apiVersion = 'v1beta';

  // Build the prompt
  let fullPrompt = systemPrompt + '\n\n';

  if (context) {
    fullPrompt += `Context/Background Information:\n${context}\n\n`;
  }

  // Add recent conversation history for context
  if (state.conversationHistory.length > 0) {
    fullPrompt += 'Recent conversation:\n';
    const recentHistory = state.conversationHistory.slice(-6); // Last 6 messages
    recentHistory.forEach(msg => {
      fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
    fullPrompt += '\n';
  }

  fullPrompt += `Current question/statement: ${userMessage}\n\nProvide a helpful, concise response:`;

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: fullPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
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

function displayAIResponse(text) {
  const responseContent = document.getElementById('response-content');

  // Remove empty state
  const emptyState = responseContent.querySelector('.empty-state');
  if (emptyState) {
    responseContent.innerHTML = '';
  }

  const response = document.createElement('div');
  response.className = 'transcript-item fade-in';
  response.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
  response.style.borderLeft = '3px solid var(--primary-color)';

  const time = document.createElement('div');
  time.className = 'transcript-time';
  time.textContent = new Date().toLocaleTimeString();

  const content = document.createElement('p');
  content.textContent = text;

  response.appendChild(time);
  response.appendChild(content);
  responseContent.appendChild(response);

  // Auto-scroll to bottom
  responseContent.scrollTop = responseContent.scrollHeight;
}

function setStatus(message, type) {
  // You can add a status indicator if needed
  console.log(`[${type}] ${message}`);
}

// Meeting History
async function saveMeetingToHistory() {
  if (state.conversationHistory.length === 0) {
    return;
  }

  const meeting = {
    id: Date.now(),
    date: new Date().toISOString(),
    startTime: state.meetingStartTime,
    endTime: new Date(),
    transcript: state.currentTranscript,
    conversationHistory: state.conversationHistory,
    summary: await generateMeetingSummary()
  };

  try {
    const history = await window.electronAPI.getStoreValue('meetingHistory') || [];
    history.unshift(meeting);

    // Keep only last 50 meetings
    const trimmedHistory = history.slice(0, 50);

    await window.electronAPI.setStoreValue('meetingHistory', trimmedHistory);
    renderHistory(trimmedHistory);
  } catch (error) {
    console.error('Error saving meeting history:', error);
  }
}

async function generateMeetingSummary() {
  if (!state.geminiApiKey || state.conversationHistory.length === 0) {
    return 'No summary available';
  }

  try {
    const summaryPrompt = `Please provide a concise summary of this conversation/meeting. Include:
1. Main topics discussed
2. Key points and decisions
3. Action items (if any)

Conversation:
${state.conversationHistory.map(msg => `${msg.role === 'user' ? 'Speaker' : 'AI'}: ${msg.content}`).join('\n')}

Provide a brief summary:`;

    const summary = await callGeminiAPI(summaryPrompt);
    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Summary generation failed';
  }
}

function renderHistory(history) {
  const historyList = document.getElementById('history-list');

  if (!history || history.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No meeting history yet...</p>';
    return;
  }

  historyList.innerHTML = history.map(meeting => {
    const date = new Date(meeting.date);
    const duration = meeting.endTime ?
      Math.round((new Date(meeting.endTime) - new Date(meeting.startTime)) / 1000 / 60) :
      0;

    return `
      <div class="history-item" data-id="${meeting.id}">
        <div class="history-header">
          <div>
            <div class="history-title">Meeting on ${date.toLocaleDateString()}</div>
            <div class="history-date">${date.toLocaleTimeString()} • ${duration} minutes</div>
          </div>
        </div>
        <div class="history-summary">${meeting.summary.substring(0, 200)}${meeting.summary.length > 200 ? '...' : ''}</div>
      </div>
    `;
  }).join('');

  // Add click handlers
  document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const meetingId = parseInt(item.dataset.id);
      showMeetingDetail(history.find(m => m.id === meetingId));
    });
  });
}

function showMeetingDetail(meeting) {
  // Create a modal or detailed view
  alert(`Meeting Summary:\n\n${meeting.summary}\n\nFull transcript:\n${meeting.transcript}`);
}

// Settings
function setupSettings() {
  const saveApiKeyBtn = document.getElementById('save-api-key-btn');
  const apiKeyInput = document.getElementById('gemini-api-key');
  const modelSelect = document.getElementById('model-select');
  const systemPromptTextarea = document.getElementById('system-prompt');
  const contextInput = document.getElementById('context-input');
  const languageSelect = document.getElementById('language-select');
  const toggleApiKeyBtn = document.getElementById('toggle-api-key-visibility');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  saveApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const systemPrompt = systemPromptTextarea.value;
    const context = contextInput.value;
    const language = languageSelect.value;

    if (!apiKey) {
      alert('Please enter a valid API key');
      return;
    }

    try {
      await window.electronAPI.setStoreValue('geminiApiKey', apiKey);
      await window.electronAPI.setStoreValue('model', model);
      await window.electronAPI.setStoreValue('systemPrompt', systemPrompt);
      await window.electronAPI.setStoreValue('context', context);
      await window.electronAPI.setStoreValue('language', language);

      state.geminiApiKey = apiKey;
      state.selectedModel = model;
      state.systemPrompt = systemPrompt;
      state.context = context;

      if (state.recognition) {
        state.recognition.lang = language;
      }

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    }
  });

  toggleApiKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
    } else {
      apiKeyInput.type = 'password';
    }
  });

  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all meeting history?')) {
      try {
        await window.electronAPI.setStoreValue('meetingHistory', []);
        renderHistory([]);
        alert('History cleared successfully');
      } catch (error) {
        console.error('Error clearing history:', error);
        alert('Failed to clear history');
      }
    }
  });

  // Auto-save context
  contextInput.addEventListener('blur', async () => {
    state.context = contextInput.value;
    try {
      await window.electronAPI.setStoreValue('context', contextInput.value);
    } catch (error) {
      console.error('Error saving context:', error);
    }
  });

  // Chatbox visibility settings
  const hideFromScreenShareCheckbox = document.getElementById('hide-from-screen-share-checkbox');
  const applyVisibilityBtn = document.getElementById('apply-visibility-settings-btn');

  // Load current setting
  window.electronAPI.getStoreValue('hideFromScreenShare').then(value => {
    if (hideFromScreenShareCheckbox) {
      hideFromScreenShareCheckbox.checked = value || false;
    }
  });

  if (applyVisibilityBtn) {
    applyVisibilityBtn.addEventListener('click', async () => {
      const hideFromScreenShare = hideFromScreenShareCheckbox.checked;

      if (hideFromScreenShare) {
        const confirmed = confirm(
          '⚠️ WARNING: You are about to enable Invisible Mode.\n\n' +
          'This will hide the chat assistant from screen sharing.\n\n' +
          'IMPORTANT:\n' +
          '• Only use this with full disclosure to meeting participants\n' +
          '• Deceptive use may violate policies or laws\n' +
          '• You are responsible for ethical use\n\n' +
          'Do you understand and agree to use this feature ethically?'
        );

        if (!confirmed) {
          hideFromScreenShareCheckbox.checked = false;
          return;
        }
      }

      try {
        await window.electronAPI.setStoreValue('hideFromScreenShare', hideFromScreenShare);
        window.electronAPI.updateChatboxVisibility();

        alert(
          hideFromScreenShare
            ? '⚠️ Invisible Mode enabled. The chatbox will be hidden from screen sharing.\n\nPlease use ethically!'
            : 'Invisible Mode disabled. The chatbox will be visible normally.'
        );
      } catch (error) {
        console.error('Error applying visibility settings:', error);
        alert('Failed to apply visibility settings');
      }
    });
  }
}

// Event Listeners
function setupEventListeners() {
  // Open chatbox
  const openChatboxBtn = document.getElementById('open-chatbox-btn');
  if (openChatboxBtn) {
    openChatboxBtn.addEventListener('click', () => {
      window.electronAPI.openChatbox();
    });
  }

  // Always on top toggle
  const alwaysOnTopBtn = document.getElementById('always-on-top-btn');
  alwaysOnTopBtn.addEventListener('click', () => {
    state.alwaysOnTop = !state.alwaysOnTop;
    window.electronAPI.setAlwaysOnTop(state.alwaysOnTop);
    alwaysOnTopBtn.style.color = state.alwaysOnTop ? 'var(--primary-color)' : 'var(--text-primary)';
  });

  // Copy response
  const copyResponseBtn = document.getElementById('copy-response-btn');
  copyResponseBtn.addEventListener('click', () => {
    const responseContent = document.getElementById('response-content');
    const text = responseContent.innerText;
    navigator.clipboard.writeText(text).then(() => {
      // Show feedback
      const originalHTML = copyResponseBtn.innerHTML;
      copyResponseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        copyResponseBtn.innerHTML = originalHTML;
      }, 2000);
    });
  });

  // Clear response
  const clearResponseBtn = document.getElementById('clear-response-btn');
  clearResponseBtn.addEventListener('click', () => {
    const responseContent = document.getElementById('response-content');
    responseContent.innerHTML = '<p class="empty-state">AI responses will appear here...</p>';
  });

  // Listen for IPC events
  window.electronAPI.onShowSettings(() => {
    document.querySelector('.nav-item[data-view="settings"]').click();
  });

  window.electronAPI.onToggleCompactMode(() => {
    // Implement compact mode if needed
    console.log('Toggle compact mode');
  });

  window.electronAPI.onShowAbout(() => {
    document.querySelector('.nav-item[data-view="settings"]').click();
    // Scroll to about section
    setTimeout(() => {
      const aboutSection = document.querySelector('.settings-container').lastElementChild;
      aboutSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  });
}

function checkApiKey() {
  if (!state.geminiApiKey) {
    // Show a notification to set up API key
    setTimeout(() => {
      const shouldSetup = confirm('Welcome to OpenMind! Would you like to set up your Gemini API key now?');
      if (shouldSetup) {
        document.querySelector('.nav-item[data-view="settings"]').click();
      }
    }, 1000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
