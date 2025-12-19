# Attempt Board

Full-screen display showing the current athlete with weight, barbell plates visualization, timer, and referee decisions. Matches the OWLCMS Attempt Board layout.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ HOLME                                                           │
│ Ragnar G.                                                       │
│ Tambarskjelvar IL                                               │
├────────┬──────────────┬─────────────────────────┬───────────────┤
│  [3]   │  SM >109     │                         │  C. & J. #2   │
├────────┴──────────────┤   ══╦════════════╦══    ├───────────────┤
│ 208 kg                │     ║▓▓▓▓▓▓▓▓▓▓▓▓║      │    2:00       │
└───────────────────────┴─────────────────────────┴───────────────┘
```

- **Top section**: Athlete name (cyan), first name (white), team (italic)
- **Middle left**: Start number in red box, category
- **Middle center**: Barbell with plates visualization
- **Middle right**: Attempt label (e.g., "C. & J. #2")
- **Bottom left**: Weight in kg (large, cyan)
- **Bottom center**: Plates continue
- **Bottom right**: Timer (yellow when running)

## Decision Display

When referees give decisions, the plates/timer area is replaced with:

1. **Down signal**: Large green down arrow (▼)
2. **Referee lights**: Three circles (white = good, red = no lift)

## Plate Visualization

Plates are calculated from the platform configuration stored in the OWLCMS database:

- **Large plates (bumper)**: 25kg (red), 20kg (blue), 15kg (yellow), 10kg (green), 5kg (white), 2.5kg (red)
- **Collar**: 2.5kg (black with white border)
- **Small plates (change)**: 5kg, 2.5kg, 2kg, 1.5kg, 1kg, 0.5kg

Bar weight is automatically determined by gender (20kg men, 15kg women) or platform configuration.

## URL Parameters

```
/attempt-board?fop=A&showPlates=true&showTimer=true&showDecisions=true&showFlag=false
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fop` | `A` | Field of Play name |
| `showPlates` | `true` | Show barbell plate visualization |
| `showTimer` | `true` | Show countdown timer |
| `showDecisions` | `true` | Show referee decision lights |
| `showFlag` | `false` | Show team/country flag |

## Data Source

Uses session athlete data from OWLCMS WebSocket updates:
- Current athlete identified by `classname: "current"`
- Weight from `fopUpdate.weight`
- Platform plate configuration from `database.platforms`
