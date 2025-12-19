# Attempt Bar Visibility Test Fixtures

These sample files are used by `tests/unit/attempt-bar-visibility.test.js` to test the attempt bar visibility logic.

## Sample Files

| File | Description | Key Fields |
|------|-------------|------------|
| `2025-12-18T13-52-13-909-DATABASE.json` | Full database load | Competition data, athletes, categories |
| `2025-12-18T13-58-21-398-UPDATE-SWITCHGROUP.json` | SwitchGroup event (session selected but not started) | `fopState: INACTIVE`, `currentAthleteKey: 1907684233` |
| `2025-12-18T14-05-16-652-UPDATE-STARTLIFTING.json` | StartLifting event (lifting begins) | `fopState: CURRENT_ATHLETE_DISPLAYED` |
| `2025-12-18T14-05-16-672-UPDATE-LIFTINGORDERUPDATED.json` | LiftingOrderUpdated during active session | `fopState: CURRENT_ATHLETE_DISPLAYED` |

## Test Scenarios

1. **No session selected**: `fopState=INACTIVE`, `currentAthleteKey=null` → attempt bar **HIDDEN**
2. **Session selected (SwitchGroup)**: `fopState=INACTIVE`, `currentAthleteKey=set` → attempt bar **VISIBLE**
3. **Lifting started**: `fopState=CURRENT_ATHLETE_DISPLAYED` → attempt bar **VISIBLE**, `hasCurrentAthlete=true`
4. **Session cleared**: Back to initial state → attempt bar **HIDDEN**
5. **Session done (BREAK)**: `fopState=BREAK` → attempt bar **VISIBLE** (for completion message)

## Source

These samples were captured from a real OWLCMS competition using learning mode on 2025-12-18.
