# Documentation - OWLCMS Tracker System

This folder contains the permanent documentation for developing and extending the OWLCMS Tracker scoreboard system.

## 📚 Core Documents

### Scoreboard System
- **[SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md)** - Complete system architecture
  - Multi-FOP, multi-scoreboard design
  - Plugin system patterns
  - Data flow and caching strategy
  - **Start here** for understanding the system

### WebSocket & Integration
- **[WEBSOCKET_MESSAGE_SPEC.md](./WEBSOCKET_MESSAGE_SPEC.md)** - WebSocket API specification
  - OWLCMS message formats (UPDATE, TIMER, DECISION, DATABASE, Binary)
  - Message type documentation
  - Integration requirements
  - **Also see:** [PROTOCOL_REPLICATION_SPEC.md](./PROTOCOL_REPLICATION_SPEC.md) - Protocol implementation details

- **[WEBSOCKET_CONFIGURATION.md](./WEBSOCKET_CONFIGURATION.md)** - OWLCMS configuration guide
  - Setting up WebSocket connection
  - URL configuration

### Data & Features
- **[OWLCMS_TRANSLATIONS_SPEC.md](./OWLCMS_TRANSLATIONS_SPEC.md)** - Translation system documentation
  - Translation structure
  - displayInfo fields
  - Localization support

- **[USING_LOGOS_IN_SCOREBOARDS.md](./USING_LOGOS_IN_SCOREBOARDS.md)** - Logo handling guide
  - ZIP extraction
  - Logo access in templates

- **[HUB_UPDATE_FLOW.md](./HUB_UPDATE_FLOW.md)** - Competition hub update flow
  - Message processing
  - State management

## 🚀 Quick Start

### For New Developers
1. Read **[SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md)** - Understand the system
2. Review **[WEBSOCKET_MESSAGE_SPEC.md](./WEBSOCKET_MESSAGE_SPEC.md)** - Learn about data sources
3. See **[CREATE_YOUR_OWN.md](../CREATE_YOUR_OWN.md)** - Create your first scoreboard

### Creating Custom Scoreboards
- See **[CREATE_YOUR_OWN.md](../CREATE_YOUR_OWN.md)** in project root
- Follow plugin patterns in **[SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md)**
- Use **[WEBSOCKET_MESSAGE_SPEC.md](./WEBSOCKET_MESSAGE_SPEC.md)** for data field reference

### Understanding Data Flow
```
OWLCMS WebSocket → Competition Hub → Plugin Processing → Browser Display
      ↓                   ↓                  ↓                  ↓
  See WEBSOCKET_    See SCOREBOARD_    See OWLCMS_        See Plugin
  MESSAGE_SPEC.md   ARCHITECTURE.md    TRANSLATIONS_SPEC  READMEs
```

## 📖 Document Organization

### Data Source Priority (Session Athletes First)
The system follows the **"Session Athletes First"** principle:

1. **Primary source:** Session athletes from `groupAthletes` key (WebSocket type="update")
   - Contains current session data with highlighting
   - Precomputed by OWLCMS with display-ready values
   - See: [OWLCMS_TRANSLATIONS_SPEC.md](./OWLCMS_TRANSLATIONS_SPEC.md)

2. **Secondary source:** Database athletes (WebSocket type="database")
   - ONLY for athletes NOT in current session
   - Requires field transformation
   - See: [WEBSOCKET_MESSAGE_SPEC.md](./WEBSOCKET_MESSAGE_SPEC.md)

See [SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md) for implementation details.

### Document Categories

| Category | Purpose | Files |
|----------|---------|-------|
| **Scoreboards** | Building display components | SCOREBOARD_ARCHITECTURE.md, CREATE_YOUR_OWN.md |
| **Integration** | WebSocket & OWLCMS setup | WEBSOCKET_MESSAGE_SPEC.md, WEBSOCKET_CONFIGURATION.md |
| **Translations** | UI text & display fields | OWLCMS_TRANSLATIONS_SPEC.md |
| **Assets** | Logos, flags, pictures | USING_LOGOS_IN_SCOREBOARDS.md |
| **Architecture** | Internal system docs | HUB_UPDATE_FLOW.md, PROTOCOL_REPLICATION_SPEC.md |

## 🔧 Change Tracking

Temporary change logs and compliance documents are kept in the **[/compliance](../compliance/)** folder:
- ⚠️ **Working files are gitignored** - Only README.md is committed
- Use for temporary refactoring notes and change logs
- Each developer maintains their own local files
- Can be deleted when work is complete
- Examples: Terminology updates, refactoring notes, compliance verification

## 🆘 Need Help?

### Common Tasks
| Task | Document |
|------|----------|
| Create new scoreboard | [SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md) + [CREATE_YOUR_OWN.md](../CREATE_YOUR_OWN.md) |
| Understand data fields | [WEBSOCKET_MESSAGE_SPEC.md](./WEBSOCKET_MESSAGE_SPEC.md) + [OWLCMS_TRANSLATIONS_SPEC.md](./OWLCMS_TRANSLATIONS_SPEC.md) |
| Configure OWLCMS | [WEBSOCKET_CONFIGURATION.md](./WEBSOCKET_CONFIGURATION.md) |
| Handle logos/flags | [USING_LOGOS_IN_SCOREBOARDS.md](./USING_LOGOS_IN_SCOREBOARDS.md) |
| Understand system internals | [HUB_UPDATE_FLOW.md](./HUB_UPDATE_FLOW.md) |

## 📝 Contributing

When adding documentation:
- ✅ Keep permanent reference docs here
- ✅ Move change logs to `/compliance`
- ✅ Update this README if adding new docs
- ✅ Link from main project README.md
