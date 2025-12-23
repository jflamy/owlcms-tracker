# Specification: IWF Protocol Replication (HTML/Svelte)

This document outlines the requirements and implementation plan for replicating the `Protocol_All_IWF-A4.xlsx` JXLS template as a dynamic HTML scoreboard/document within the OWLCMS Tracker architecture.

## 1. Objective
To provide a print-ready, multi-session competition protocol that matches the IWF standard, using real-time data from the Competition Hub.

## 2. Data Requirements (Hub & Helpers)

The `helpers.data.js` must transform the raw Hub state into a nested structure that mimics the JXLS "beans" model.

### 2.1. Root Data Structure
```javascript
{
  competition: {
    name: string,
    city: string,
    date: string,
    endDate: string,
    organizer: string,
    federation: string
  },
  sessions: [
    {
      name: string,        // e.g., "F1", "M1"
      description: string, // e.g., "Men 89kg A"
      startTime: string,   // Formatted from competitionTime [Y, M, D, H, M]
      platform: string,    // e.g., "A"
      athletes: [          // Grouped by Category
        {
          categoryName: string,
          categorySortCode: string,
          items: [ AthleteObject ]
        }
      ],
      officials: {
        referee1: TOObject,
        referee2: TOObject,
        referee3: TOObject,
        juryPresident: TOObject,
        juryMembers: [ TOObject ],
        marshall: TOObject,
        technicalController: TOObject,
        timekeeper: TOObject,
        secretary: TOObject,
        doctor: TOObject
      },
      records: [ RecordObject ]
    }
  ]
}

### 2.4. Record Object (`r`)
- `recordName`: e.g., "World Record"
- `ageGrp`: e.g., "Senior"
- `gender`: "M" or "F"
- `bwCatString`: e.g., "89"
- `resRecordLift`: "Snatch", "Clean & Jerk", or "Total"
- `recordValue`: Weight in kg
- `resAthleteName`: Name of the athlete who set it
- `nation`: Federation/Nation
- `recordDateAsString`: Date of the record
```

### 2.2. Athlete Object (`l`)
Each athlete object must provide the following computed fields (matching JXLS expressions):
- `lastName.toUpperCase()`
- `firstName`
- `formattedBirth`: `athlete.fullBirthDate[0]` (Year)
- `lotNumber`
- `team`: Resolved team name
- `bodyWeight`: Formatted to 2 decimal places
- `snatch1AsInteger`, `snatch2AsInteger`, `snatch3AsInteger`: Formatted weight (e.g., "100", "(100)")
- `bestSnatch`, `bestCleanJerk`, `total`: Best successful lifts
- `snatchRank`, `cleanJerkRank`, `totalRank`: Ranks within the session/category

### 2.3. Technical Official Object (`TOObject`)
- `fullName`: Name of the official
- `federationId`: Federation code (e.g., "USA")
- `displayString`: "Name (Federation)"

## 3. Implementation Logic (`helpers.data.js`)

### 3.1. Grouping Logic
1.  Iterate through all athletes in the `databaseState`.
2.  Filter by the requested FOP or Session (if specified in URL options).
3.  Group athletes by `sessionName`.
4.  Within each session, group athletes by `categorySortCode`.
5.  Sort categories by `categorySortCode` ASC.
6.  Sort athletes within categories by `totalRank` or `lotNumber` (depending on protocol type).

### 3.2. Official Mapping
The helper must look up the `TechnicalOfficial` assignments for each session in the `databaseState`.
- Map `referee1Id` -> `referee1AsTO` object.
- Handle optional officials (e.g., `doctor2`, `marshal2`) with null checks.

### 3.3. Translation Mapping
Use the `translations` from the Hub to provide localized headers:
- `t.get("Results.Total")` -> `translations["Results.Total"]`

## 4. Visual Structure (`page.svelte`)

### 4.1. Layout & Navigation
- **Multi-Session View**: Since the JXLS template generates multiple sheets, the Svelte component should support:
  - **All Sessions View**: A single long page with all sessions (useful for printing the entire protocol).
  - **Single Session View**: Filtered by `sessionName` via URL parameter (e.g., `?session=M1`).
- **Page Breaks**: Each session should start on a new page (CSS `page-break-before: always`).
- **A4 Print Optimization**: Use a fixed-width container (approx. 210mm) with standard margins.

### 4.2. Components
- **Header**: 
  - Competition info (Name, City, Date).
  - Session info (Session Name, Description, Platform, Start Time).
- **Main Table**:
  - Columns: Lot, Name, Birth, Team, BW, Snatch (1,2,3,Rank), C&J (1,2,3,Rank), Total, Rank.
  - Category Spacers: A full-width row indicating the weight category (e.g., "Men 89kg").
- **Records Section**: 
  - A table at the bottom of the athlete list showing records set in the session.
  - Columns: Record Name, Age Group, Gender, BW Cat, Lift, Value, Athlete, Nation, Date.
- **Footer**: 
  - Signature lines for Referees (1, 2, 3).
  - Signature lines for Jury Members.
  - Signature lines for Competition Secretary and Doctor.

## 5. URL Parameters
- `fop`: Filter by a specific platform.
- `session`: Filter by a specific session ID.
- `hideOfficials`: Boolean to hide the signature section.
- `landscape`: Toggle between Portrait/Landscape CSS.

## 6. CSS Requirements
```css
@media print {
  .session-page {
    page-break-after: always;
  }
  .no-print {
    display: none;
  }
}

.protocol-table {
  width: 100%;
  border-collapse: collapse;
}

.protocol-table th, .protocol-table td {
  border: 1px solid black;
  padding: 4px;
  font-size: 10pt;
}
```
