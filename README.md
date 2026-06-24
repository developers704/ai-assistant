# Executive AI Assistant

A full-stack AI personal assistant for business owners. Chat and voice-driven interface for managing emails, calendar, reminders, documents, sales reports, WhatsApp, calls, and business automation.

## Features (MVP)

- **Voice Assistant** — Tap-to-speak with speech-to-text and text-to-speech
- **AI Chat** — Natural language commands with intent detection
- **Dashboard** — Today's schedule, tasks, sales, alerts, and quick voice
- **Email Assistant** — Inbox summary, draft replies with confirmation
- **Calendar** — View and create meetings (confirmation required via voice)
- **Reminders & Tasks** — Priority tasks, recurring reminders
- **Documents** — Upload and analyze PDF, Excel, Word, CSV
- **Sales Reports** — Store and product performance with recommendations
- **Image Analysis** — Screenshot and dashboard understanding
- **WhatsApp & Calls** — Draft messages and prepare calls with confirmation
- **Memory & Profile** — Business context, priorities, and preferences
- **Approval System** — All sensitive actions require user confirmation

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** — Premium executive UI
- **Web Speech API** — Voice input and TTS
- **In-memory store** with mock data (ready for real API integrations)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo login:** `kash@vallianijewelers.com` / `demo123`

## Voice Commands

Try these in Voice or Chat mode:

- "What do I need to focus on today?"
- "Show me today's sales report"
- "Summarize my important emails"
- "Schedule a meeting with Ali tomorrow at 4 PM"
- "Draft an email to the supplier"
- "Send WhatsApp to the store manager: Please send today's closing report"
- "Remind me to call the client tomorrow"
- "Call Ahmed and ask if the shipment has arrived"

## Project Structure

```
src/
├── app/                  # Pages and API routes
│   ├── (app)/            # Authenticated app screens
│   ├── api/              # Backend API endpoints
│   └── login/            # Login screen
├── components/
│   ├── layout/           # Sidebar, navigation
│   └── ui/               # Reusable UI components
├── lib/
│   ├── ai/               # Assistant engine (intent detection)
│   ├── mock-data/        # Demo business data
│   └── store/            # State management
└── types/                # TypeScript definitions
```

## Connecting Real Integrations

The app is built with mock data and a built-in AI engine. To connect real services:

1. Add API keys to `.env.local` (OpenAI, Gmail, Google Calendar, Twilio, etc.)
2. Replace mock handlers in `src/app/api/` with real service calls
3. Update integration status in Settings

## License

Private — Executive AI Assistant
