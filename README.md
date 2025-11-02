# OpenMind AI Assistant

<div align="center">

**A Transparent AI Meeting Assistant powered by Google Gemini**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)

</div>

## 📖 Overview

OpenMind is a **transparent, ethical AI meeting assistant** designed to help professionals be more productive during meetings, calls, and interviews. Unlike deceptive tools, OpenMind is meant to be disclosed to other participants and used ethically.

### Key Features

- 🎙️ **Real-time Audio Transcription** - Live speech-to-text using Web Speech API
- 🤖 **AI-Powered Suggestions** - Context-aware responses using Google Gemini AI
- 📝 **Meeting Summaries** - Automatic post-meeting summaries and action items
- 💾 **Conversation History** - Searchable history of all your meetings
- ⚙️ **Customizable Prompts** - Tailor AI behavior to your needs
- 🔒 **Privacy First** - All data stored locally, API key encrypted
- 🌍 **Multi-language Support** - Transcribe in 10+ languages
- ⌨️ **Keyboard Shortcuts** - Quick access without mouse

## 🎯 Use Cases

### Legitimate & Ethical Uses

✅ **Meeting Assistance** (with disclosure)
- Take better notes during team meetings
- Get quick facts and references
- Ensure you don't miss important details

✅ **Interview Preparation** (practice mode)
- Practice answering interview questions offline
- Build confidence before the real interview
- Review and improve your responses

✅ **Sales Training**
- Practice pitches with AI feedback
- Learn objection handling
- Improve product knowledge

✅ **Personal Knowledge Base**
- Quick access to your notes and context
- Reference materials during breaks
- Post-call review and learning

### ❌ Unethical Uses (Please Don't)

- Deceiving interview panels
- Hiding AI use from clients
- Cheating on tests or assessments
- Any undisclosed use where participants don't know you're using AI assistance

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Google Gemini API Key** - [Get one free here](https://makersuite.google.com/app/apikey)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/openmind.git
   cd openmind
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

4. **Configure your API key**
   - When the app launches, go to Settings
   - Enter your Gemini API key
   - Choose your preferred model (Flash is faster and cheaper)
   - Click "Save API Key"

### Building for Production

Build the app for your platform:

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux

# All platforms
npm run build
```

The built application will be in the `dist` folder.

## 🎮 How to Use

### Basic Workflow

1. **Start the App**
   - Launch OpenMind AI Assistant
   - Ensure your microphone permissions are granted

2. **Configure Settings** (first time)
   - Go to Settings tab
   - Add your Gemini API key
   - Optionally add context (your resume, meeting agenda, etc.)
   - Customize the system prompt

3. **Start Recording**
   - Click "Start Recording" or press `Ctrl+Shift+R`
   - OpenMind will begin transcribing your speech
   - AI suggestions appear automatically in the right panel

4. **Review & Copy Suggestions**
   - AI responses appear in real-time
   - Copy useful responses with one click
   - Continue your conversation naturally

5. **Stop & Save**
   - Click "Stop Recording" when done
   - Meeting is automatically saved to History
   - View summary and transcript in History tab

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Show/Hide window |
| `Ctrl+Shift+R` | Start/Stop recording |
| `Ctrl+K` | Toggle compact mode |
| `Ctrl+,` | Open settings |

## ⚙️ Configuration

### Gemini API Models

OpenMind supports multiple Gemini models:

- **Gemini 1.5 Flash** (Default)
  - Fastest response times
  - Most cost-effective
  - Great for real-time suggestions
  - Recommended for most users

- **Gemini 1.5 Pro**
  - More capable and nuanced
  - Better for complex reasoning
  - Slightly slower
  - Use for important meetings

- **Gemini Pro** (Legacy)
  - Original Gemini model
  - Being phased out
  - Not recommended for new users

### System Prompt Customization

The system prompt defines how the AI behaves. Examples:

**For Sales Calls:**
```
You are a sales assistant helping during client calls. Provide concise,
professional responses about our products. Focus on addressing objections
and highlighting benefits. Keep responses under 100 words.
```

**For Technical Interviews (Practice):**
```
You are helping prepare for technical interviews. Provide structured answers
to programming questions, including time complexity analysis. Use clear
explanations and examples.
```

**For Meeting Notes:**
```
You are a meeting assistant focused on capturing key points, decisions,
and action items. Summarize discussions concisely and identify follow-ups.
```

### Adding Context

Add relevant context in the Settings to get better AI responses:

- Your resume or bio
- Meeting agenda
- Product documentation
- Previous meeting notes
- Any relevant background information

The AI will use this context to provide more accurate and relevant suggestions.

## 🔒 Privacy & Security

OpenMind takes your privacy seriously:

- ✅ **All data stored locally** on your machine
- ✅ **No cloud storage** of transcripts or meetings
- ✅ **API key encrypted** using electron-store
- ✅ **No telemetry or tracking**
- ✅ **Open source** - audit the code yourself

### What Data is Sent to Google?

Only the following is sent to Google's Gemini API:
- Your system prompt
- Optional context you provide
- The specific text being analyzed
- Recent conversation history (last 6 messages for context)

This is required for the AI to function. Review [Google's Privacy Policy](https://policies.google.com/privacy) for details on how Google handles this data.

## 🤝 Ethical Use Guidelines

OpenMind is designed to be a **transparent productivity tool**, not a deception tool.

### We Encourage

1. **Disclosure** - Let meeting participants know you're using an AI assistant
2. **Preparation** - Use AI to prepare before meetings, not to deceive during them
3. **Learning** - Use it to improve your skills and knowledge
4. **Accessibility** - Help those who need assistance taking notes or processing information
5. **Productivity** - Free up mental bandwidth for genuine interaction

### We Discourage

1. **Deception** - Hiding AI use from others
2. **Cheating** - Using during tests or assessments without permission
3. **Misrepresentation** - Presenting AI responses as your own expertise
4. **Privacy Violation** - Recording others without consent
5. **Unfair Advantage** - Using in competitive situations where AI is prohibited

### Legal Considerations

- 📜 Check your local **recording consent laws** (one-party vs two-party consent)
- 📋 Review your **company policies** on AI tool usage
- 🎓 Understand **academic integrity** rules if you're a student
- 💼 Respect **client confidentiality** agreements

## 🛠️ Development

### Project Structure

```
openmind/
├── main.js              # Electron main process
├── preload.js           # IPC bridge
├── renderer.js          # UI logic and AI integration
├── index.html           # Main UI
├── styles.css           # Styling
├── package.json         # Dependencies and scripts
├── assets/              # Application icons
│   └── README.md
└── README.md            # This file
```

### Tech Stack

- **Electron** - Cross-platform desktop framework
- **Vanilla JavaScript** - No heavy frameworks, just pure JS
- **Web Speech API** - Built-in browser speech recognition
- **Google Gemini API** - AI-powered responses
- **electron-store** - Secure local storage

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Roadmap

- [ ] Screen capture for visual context
- [ ] Multiple AI provider support (OpenAI, Anthropic)
- [ ] Better meeting export (PDF, Markdown)
- [ ] Calendar integration
- [ ] Team collaboration features
- [ ] Mobile companion app
- [ ] Plugin system for extensibility

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the need for transparent AI tools in professional settings
- Built with [Electron](https://www.electronjs.org/)
- Powered by [Google Gemini](https://deepmind.google/technologies/gemini/)
- Architecture learned from analyzing open-source productivity tools

## 📞 Support

- 🐛 **Bug Reports**: [Open an issue](https://github.com/yourusername/openmind/issues)
- 💡 **Feature Requests**: [Start a discussion](https://github.com/yourusername/openmind/discussions)
- 📧 **Email**: support@openmind.ai (replace with your email)
- 💬 **Discord**: [Join our community](https://discord.gg/openmind) (replace with actual link)

## ⚠️ Disclaimer

OpenMind is a productivity tool designed for ethical use. Users are responsible for:
- Complying with local laws regarding recording and AI use
- Following organizational policies
- Disclosing AI use to meeting participants when appropriate
- Respecting others' privacy and consent

The developers of OpenMind are not responsible for misuse of this software.

---

<div align="center">

**Made with ❤️ for transparent, ethical AI assistance**

[Website](https://openmind.ai) • [Documentation](https://docs.openmind.ai) • [Community](https://discord.gg/openmind)

</div>
