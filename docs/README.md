# Documentation - OWLCMS Tracker System

This folder contains the permanent documentation for developing and extending the OWLCMS Tracker scoreboard system.

## 📚 Core Documents

### Architecture & Design
- **[SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md)** - Complete system architecture
  - Multi-FOP, multi-scoreboard design
  - Plugin system patterns
  - Data flow and caching strategy
  - **Start here** for understanding the system

- **[WEBSOCKET_MESSAGE_SPEC.md](./WEBSOCKET_MESSAGE_SPEC.md)** - WebSocket API specification
  - OWLCMS message formats
  - Message type documentation
  - Integration requirements

### Data Mapping
- **[FIELD_MAPPING_OVERVIEW.md](./FIELD_MAPPING_OVERVIEW.md)** - Quick reference guide
  - Navigation index
  - Common questions
  - Troubleshooting guide
  - **Start here** for data mapping questions

- **[FIELD_MAPPING.md](./FIELD_MAPPING.md)** - Complete field reference
  - Field-by-field mapping tables
  - Data source comparison
  - Merging strategy
  - Type conversions

- **[FIELD_MAPPING_SAMPLES.md](./FIELD_MAPPING_SAMPLES.md)** - Real-world examples
  - Actual OWLCMS JSON samples
  - Transformation code
  - Before/after comparisons

### Performance
- **[CACHING_IMPLEMENTATION.md](./CACHING_IMPLEMENTATION.md)** - Caching patterns
  - Plugin-level caching
  - Cache key strategies
  - Performance optimization
  - Timer event handling

## 🚀 Quick Start

### For New Developers
1. Read **[SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md)** - Understand the system
2. Review **[FIELD_MAPPING_OVERVIEW.md](./FIELD_MAPPING_OVERVIEW.md)** - Learn data sources
3. See **[CREATE_YOUR_OWN.md](../CREATE_YOUR_OWN.md)** - Create your first scoreboard

### Creating Custom Scoreboards
- See **[CREATE_YOUR_OWN.md](../CREATE_YOUR_OWN.md)** in project root
- Follow plugin patterns in **[SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md)**
- Use **[FIELD_MAPPING.md](./FIELD_MAPPING.md)** for data field reference

### Understanding Data Flow
```
OWLCMS WebSocket → Competition Hub → Plugin Processing → Browser Display
      ↓                   ↓                  ↓                  ↓
  See WEBSOCKET_    See SCOREBOARD_    See CACHING_      See Plugin
  MESSAGE_SPEC.md   ARCHITECTURE.md   IMPLEMENTATION.md  READMEs
```

## 📖 Document Organization

### Data Source Priority (Session Athletes First)
The system follows the **"Session Athletes First"** principle:

1. **Primary source:** Session athletes from `groupAthletes` key (WebSocket type="update")
   - Contains current session data with highlighting
   - Precomputed by OWLCMS with display-ready values

2. **Secondary source:** Database athletes (WebSocket type="database")
   - ONLY for athletes NOT in current session
   - Requires field transformation

See **[FIELD_MAPPING_OVERVIEW.md](./FIELD_MAPPING_OVERVIEW.md)** for details.

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
| Find data field | [FIELD_MAPPING_OVERVIEW.md](./FIELD_MAPPING_OVERVIEW.md) |
| Understand caching | [CACHING_IMPLEMENTATION.md](./CACHING_IMPLEMENTATION.md) |
| Debug highlighting | [FIELD_MAPPING_OVERVIEW.md](./FIELD_MAPPING_OVERVIEW.md) → Troubleshooting |
| Add FOP support | [SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md) → Multi-FOP |

### Troubleshooting
See the **Troubleshooting** section in [FIELD_MAPPING_OVERVIEW.md](./FIELD_MAPPING_OVERVIEW.md)

## 📝 Contributing

When adding documentation:
- ✅ Keep permanent reference docs here
- ✅ Move change logs to `/compliance`
- ✅ Update this README if adding new docs
- ✅ Link from main project README.md
