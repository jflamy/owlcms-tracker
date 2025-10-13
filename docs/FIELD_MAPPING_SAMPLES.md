# Field Mapping - Sample Data Examples

## Real Data from OWLCMS

### Sample 1: Group Athlete (Currently Lifting)

**Source:** `fopUpdate.groupAthletes` (JSON parsed from `/update` endpoint)

```json
{
  "fullName": "GARCIA, Steven",
  "firstName": "Steven",
  "lastName": "GARCIA",
  "teamName": "Barbell Club",
  "team": "Barbell Club",
  "startNumber": 12,
  "lotNumber": "42",
  "category": "M 79",                   ← Formatted category name (not categoryName!)
  "gender": "M",
  "bodyWeight": 72.5,
  "yearOfBirth": "1994",                ← String in actual data
  
  "sattempts": [
    {
      "liftStatus": "request",
      "stringValue": "71",
      "className": " current blink"    ← ⭐ CRITICAL for highlighting!
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    }
  ],
  
  "cattempts": [
    {
      "liftStatus": "request",
      "stringValue": "85",
      "className": ""                   ← Not current (no highlight)
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    }
  ],
  
  "bestSnatch": 0,
  "bestCleanJerk": 0,
  "total": 0,
  "totalRank": 0,
  "sinclair": 0.0,
  "globalScore": null,
  
  "classname": "current blink"         ← ⭐ CRITICAL for row highlighting!
}
```

**Usage in Template:**
```svelte
<!-- Row gets highlighted because classname="current blink" -->
<tr class="{athlete.classname}">
  <td class="start-num">12</td>
  <td class="name">GARCIA, Steven</td>
  
  <!-- This cell gets yellow highlight: className=" current blink" -->
  <td class="attempt request current blink">71</td>
  
  <!-- This cell does NOT get highlight: className="" -->
  <td class="attempt request">85</td>
</tr>
```

---

### Sample 2: Database Athlete (Same Person, from /database)

**Source:** `databaseState.athletes[]` (from `/database` endpoint)

**Important:** This sample shows the Database structure for reference only. Since GARCIA is already in `groupAthletes` (Sample 1), we would **NOT** use this Database entry. We only access Database for athletes NOT in the current group.

**When we DO use Database for this athlete:**
- To get `fullBirthDate` if needed (not available in Group)
- To get other fields missing from Group Athletes

**When we DON'T use Database for this athlete:**
- For display data (name, attempts, totals) - Group has everything preformatted
- For highlighting - Database doesn't have `classname` or `className` fields

```json
{
  "firstName": "Steven",
  "lastName": "GARCIA",
  "team": "Barbell Club",
  "club": "Barbell Club",
  "startNumber": 12,
  "lotNumber": 42,                     ← NUMBER (not string!)
  "category": 15,                       ← ID (not name!)
  "categoryName": "M 79",               ← ✓ Now has formatted name!
  "gender": "M",
  "bodyWeight": 72.5,
  "fullBirthDate": [1995, 5, 15],       ← ✓ ONLY in Database (not in Group!)
  
  // Raw snatch data (6 fields per attempt!)
  "snatch1Declaration": "71",
  "snatch1Change1": "",
  "snatch1Change2": "",
  "snatch1ActualLift": "",              ← Empty = not attempted yet
  "snatch1AutomaticProgression": "",
  
  "snatch2Declaration": "",
  "snatch2Change1": "",
  "snatch2Change2": "",
  "snatch2ActualLift": "",
  "snatch2AutomaticProgression": "",
  
  "snatch3Declaration": "",
  "snatch3Change1": "",
  "snatch3Change2": "",
  "snatch3ActualLift": "",
  "snatch3AutomaticProgression": "",
  
  // Raw clean & jerk data
  "cleanJerk1Declaration": "85",
  "cleanJerk1Change1": "",
  "cleanJerk1Change2": "",
  "cleanJerk1ActualLift": "",
  "cleanJerk1AutomaticProgression": "",
  
  "cleanJerk2Declaration": "",
  "cleanJerk2Change1": "",
  "cleanJerk2Change2": "",
  "cleanJerk2ActualLift": "",
  "cleanJerk2AutomaticProgression": "",
  
  "cleanJerk3Declaration": "",
  "cleanJerk3Change1": "",
  "cleanJerk3Change2": "",
  "cleanJerk3ActualLift": "",
  "cleanJerk3AutomaticProgression": "",
  
  "total": 0,
  "sinclair": 0.0,
  "globalScore": null
  
  // ❌ NO classname field
  // ❌ NO attempts[] arrays with className
}
```

**Key Point:** Since GARCIA is in `groupAthletes`, we use Sample 1 data directly. This Database entry is only shown for comparison.

---

### Sample 3: Athlete Who Already Lifted (From Previous Session)

**Source:** `databaseState.athletes[]` (finished competing in earlier session)

**Important:** JONES competed in a **previous session/group** and is **NOT** in the current `groupAthletes`. We must transform Database data to display her on team scoreboards.

```json
{
  "firstName": "Mary",
  "lastName": "JONES",
  "team": "PowerHouse Gym",
  "lotNumber": 5,
  "category": 12,                       ← ID (old format)
  "categoryName": "W 59",               ← ✓ Formatted name!
  "gender": "F",
  "bodyWeight": 58.7,
  
  "snatch1Declaration": "65",
  "snatch1ActualLift": "65",            ← Good lift
  "snatch2ActualLift": "-68",           ← Failed (negative)
  "snatch3ActualLift": "68",            ← Good lift
  
  "cleanJerk1ActualLift": "85",
  "cleanJerk2ActualLift": "90",
  "cleanJerk3ActualLift": "-93",
  
  "total": 158,
  "sinclair": 196.52
}
```

**Transformation to Match Group Format:**

Since JONES finished in a previous session, we transform Database format:

```javascript
{
  fullName: "Mary JONES",
  teamName: "PowerHouse Gym",
  lotNumber: "5",                       // ← Converted to string
  category: dbAthlete.categoryName,     // ← Use categoryName field ("W 59")
  
  sattempts: [
    formatAttempt("65", "", "", "65", ""),
    // Returns: { liftStatus: "good", stringValue: "65" }
    formatAttempt("", "", "", "-68", ""),
    // Returns: { liftStatus: "fail", stringValue: "(68)" }
    formatAttempt("", "", "", "68", "")
    // Returns: { liftStatus: "good", stringValue: "68" }
  ],
  
  cattempts: [
    formatAttempt("", "", "", "85", ""),
    formatAttempt("", "", "", "90", ""),
    formatAttempt("", "", "", "-93", "")
  ],
  
  bestSnatch: 68,                       // ← Computed from attempts
  bestCleanJerk: 90,
  total: 158,
  sinclair: 196.52,
  
  // ❌ NO classname field (not in current session)
  inCurrentSession: false                 // ← From previous session
}
```

**Usage in Template:**
```svelte
<!-- No highlighting (not in current session) -->
<tr class="">
  <td class="name">JONES, Mary</td>
  <td class="attempt success">65</td>
  <td class="attempt failed">(68)</td>
  <td class="attempt success">68</td>
  <td class="best">68</td>
  <td class="total">158</td>
  <td class="score">196.52</td>
</tr>
```

---

### Sample 4: Next Athlete to Lift

**Source:** `fopUpdate.groupAthletes`

```json
{
  "fullName": "SMITH, Robert",
  "teamName": "Iron Warriors",
  "startNumber": 8,
  "lotNumber": "23",
  
  "sattempts": [
    {
      "liftStatus": "request",
      "stringValue": "105",
      "className": ""                   ← Not current yet
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    }
  ],
  
  "classname": "next"                   ← ⭐ Next lifter!
}
```

**Usage in Template:**
```svelte
<!-- Gets orange highlighting because classname="next" -->
<tr class="next">
  <td class="name">SMITH, Robert</td>  ← Orange font
  <td class="attempt request">105</td> ← Gray (not current)
</tr>
```

**CSS Rules:**
```css
/* Current athlete (yellow) */
.scoreboard-table tbody tr.current td.name {
  color: #fbbf24 !important;
}

/* Next athlete (orange) */
.scoreboard-table tbody tr.next td.name {
  color: #f97316 !important;
}

/* Current athlete's requested weight (yellow) */
.scoreboard-table tbody tr.current td.attempt.request.current {
  color: #fbbf24 !important;
  font-size: 1.3rem !important;
}
```

---

### Sample 5: Database-Only Athlete (Not in Current Session)

**Source:** `databaseState.athletes[]` (different session/group)

**Important:** This athlete is **NOT** in `groupAthletes` for the current session, so we **MUST** transform Database data to match Group format for display.

```json
{
  "firstName": "Alice",
  "lastName": "BROWN",
  "team": "Barbell Club",               ← Same team as Garcia!
  "lotNumber": 8,
  "category": 12,                       ← ID number (old format)
  "categoryName": "W 55",               ← ✓ Formatted name (new format!)
  "gender": "F",
  
  "snatch1Declaration": "55",
  "snatch1ActualLift": "55",            ← Already lifted
  "snatch2ActualLift": "-58",           ← Failed (negative)
  "snatch3ActualLift": "58",            ← Good
  
  "cleanJerk1ActualLift": "70",
  "cleanJerk2ActualLift": "75",
  "cleanJerk3ActualLift": "-78",
  
  "total": 133                          ← Best snatch + best C&J
}
```

**Transformation to Match Group Format:**

Since BROWN is not in `groupAthletes`, we transform Database format to match Group format:

```javascript
{
  fullName: "Alice BROWN",
  teamName: "Barbell Club",
  lotNumber: "8",                       // ← Converted to string
  category: dbAthlete.categoryName,     // ← Use categoryName field (has "W 55")
  
  sattempts: [
    formatAttempt("55", "", "", "55", "")  // ← Process 5 fields
    // Returns: { liftStatus: "good", stringValue: "55" }
    // ❌ NO className field (Database doesn't have it)
  ],
  
  cattempts: [
    formatAttempt("", "", "", "70", ""),
    formatAttempt("", "", "", "75", ""),
    formatAttempt("", "", "", "-78", "")
  ],
  
  bestSnatch: 58,                       // ← Computed from attempts
  bestCleanJerk: 75,                    // ← Computed from attempts
  total: 133,
  
  // ❌ NO classname field (not in current group)
  inCurrentSession: false                 // ← Flag added during merge
}
```

**Why Transformation is Needed:**
1. **fullName** - Must concatenate firstName + lastName
2. **lotNumber** - Must convert number to string
3. **category** - Use `categoryName` field (Database now has formatted name!)
4. **sattempts/cattempts** - Must call `formatAttempt()` for each of 6 attempts
5. **bestSnatch/bestCleanJerk** - Must compute from actualLift fields
6. **inCurrentSession** - Must add flag to indicate source

**Transformation Code Example:**
```javascript
// For Database-only athletes (not in groupAthletes)
function transformDatabaseAthlete(dbAthlete) {
  return {
    fullName: `${dbAthlete.firstName} ${dbAthlete.lastName}`,
    teamName: dbAthlete.team || dbAthlete.club,
    lotNumber: String(dbAthlete.lotNumber),
    category: dbAthlete.categoryName,  // ← Use new categoryName field!
    
    sattempts: [
      formatAttempt(
        dbAthlete.snatch1Declaration,
        dbAthlete.snatch1Change1,
        dbAthlete.snatch1Change2,
        dbAthlete.snatch1ActualLift,
        dbAthlete.snatch1AutomaticProgression
      ),
      // ... repeat for snatch2 and snatch3
    ],
    
    // ❌ No classname - not in current session
    // ❌ No className in attempts - Database doesn't track highlighting
    inCurrentSession: false
  };
}
```

**Usage in Template:**
```svelte
<!-- No highlighting (not in current session) -->
<tr class="">
  <td class="name">BROWN, Alice</td>
  <td class="attempt success">55</td>
  <td class="attempt failed">(58)</td>
  <td class="attempt success">58</td>
  <td class="best">58</td>
  <td class="total">133</td>
</tr>
```

---

## Team Grouping Example

After merging Group + Database athletes and grouping by team:

```javascript
teams = [
  {
    teamName: "Barbell Club",
    teamTotal: 133,                     // Garcia (0) + Brown (133)
    teamScore: 0 + 165.2,               // Sum of sinclair/globalScore
    athleteCount: 2,
    athletes: [
      {
        fullName: "GARCIA, Steven",
        total: 0,
        classname: "current blink",     // ⭐ In current session
        sattempts: [
          { 
            liftStatus: "request", 
            stringValue: "71",
            className: " current blink"  // ⭐ Current weight
          }
        ],
        inCurrentSession: true            // ✓ From groupAthletes
      },
      {
        fullName: "BROWN, Alice",
        total: 133,
        // ❌ No classname                 Not in current session
        sattempts: [
          {
            liftStatus: "good",
            stringValue: "58"
            // ❌ No className
          }
        ],
        inCurrentSession: false            // From database only
      }
    ]
  },
  {
    teamName: "PowerHouse Gym",
    teamTotal: 158,
    teamScore: 196.52,
    athleteCount: 1,
    athletes: [
      {
        fullName: "JONES, Mary",
        total: 158,
        // ❌ No classname (finished in previous session)
        sattempts: [
          { liftStatus: "good", stringValue: "65" },
          { liftStatus: "fail", stringValue: "(68)" },
          { liftStatus: "good", stringValue: "68" }
        ],
        inCurrentSession: false            // From previous session (Database only)
      }
    ]
  }
]
```

**Display Result:**
```
╔═══════════════════════════════════════════════╗
║ Barbell Club                Total: 133  Score: 165.2 ║
╠═══════════════════════════════════════════════╣
║ 12  GARCIA, Steven (yellow) │ 71* │ - │ - │ 0  ║  ← Current
║  5  BROWN, Alice            │ 55  │(58)│ 58│ 133║  ← Database only
╠═══════════════════════════════════════════════╣
║ PowerHouse Gym              Total: 158  Score: 196.5 ║
╠═══════════════════════════════════════════════╣
║  5  JONES, Mary             │ 65  │(68)│ 68│ 158║  ← Previous session
╚═══════════════════════════════════════════════╝

* = Yellow highlight (current requested weight)
```

---

## Field Mapping Summary Table

| Field | Garcia (Group) | Garcia (Database) | JONES (Database - Previous Session) |
|-------|----------------|-------------------|-------------------------------------|
| `fullName` | "GARCIA, Steven" ✓ | "Steven GARCIA" (computed) | "Mary JONES" (computed) |
| `lotNumber` | "42" (string) ✓ | 42 (number) → convert | 5 (number) → convert |
| `teamName` | "Barbell Club" ✓ | "Barbell Club" ✓ | "PowerHouse Gym" ✓ |
| `category` | **✓ "M 79"** (formatted name) | ❌ ID number only | ❌ ID number only |
| `categoryName` | ❌ Not in Group | **✓ "M 79"** (Database now has it!) | **✓ "W 59"** (Database has it!) |
| `classname` | "current blink" ⭐ | ❌ Not available | ❌ Not available |
| `sattempts[0].className` | " current blink" ⭐ | ❌ Not available | ❌ Not available |
| `sattempts[0].liftStatus` | "request" ✓ | "request" (computed) | "good" (computed) |
| `sattempts[0].stringValue` | "71" ✓ | "71" (computed) | "65" (computed) |
| `bestSnatch` | 0 ✓ | 0 ✓ | 68 (computed) |
| `total` | 0 ✓ | 0 ✓ | 158 ✓ |
| `inCurrentSession` | true (implicit) | false (set by us) | false (previous session) |

✓ = Used as-is
⭐ = Critical for highlighting
❌ = Not available
**Bold** = Now available in Group (previously needed lookup)
(computed) = We calculate it
(implicit) = Derived from being in groupAthletes

---

## Key Takeaways

1. **Group Athletes are used as-is** - Already preformatted by OWLCMS, no transformation needed
2. **Database Athletes transformed only when NOT in Group** - If athlete is in `groupAthletes`, we ignore their Database entry
3. **Database provides supplemental fields** - Use Database to get `fullBirthDate` or other fields missing from Group
4. **categoryName now in Database!** - Database athletes have `categoryName` field with formatted value (no lookup needed)
5. **Group Athletes use `category` field** - Same formatted value, different field name
6. **className is ONLY in Group** - Absolutely critical for highlighting, never in Database
7. **Type conversions for Database-only athletes** - lotNumber (number→string), fullName (firstName + lastName)
8. **Merge strategy preserves Group data** - Group athletes keep their preformatted data and highlighting
9. **Database fills team roster gaps** - Provides athletes from other sessions on the same team
10. **Team view needs both sources** - Can't show complete team with just Group athletes
