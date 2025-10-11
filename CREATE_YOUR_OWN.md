# Create Your Own Scoreboard

This guide shows you how to create custom scoreboard types using the plugin system. Whether you're a programmer or using AI assistance, you can create new scoreboard displays tailored to your competition needs.

## OWLCMS Configuration Required ⚙️

**Important:** You must configure OWLCMS to send data to this tracker.

### Configure OWLCMS (One-time Setup)

In OWLCMS, navigate to:

**Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set the URL to:
```
ws://localhost:8096/ws
```

Or if running on a separate machine:
```
ws://your-tracker-host:8096/ws
```

(Use `wss://` for secure WebSocket connections)

### What OWLCMS Sends

OWLCMS sends data via WebSocket:

```
OWLCMS → WebSocket ws://localhost:8096/ws
      → type="database"  (full competition data)
      → type="update"    (lifting order updates, UI events)
      → type="timer"     (timer start/stop)
      → type="decision"  (referee decisions)
```

✅ **WebSocket server already running** in `src/hooks.server.js`
✅ **Competition Hub stores** per-FOP data from WebSocket messages
✅ **No code changes needed** in OWLCMS - just the URL configuration above

### What's New - The Scoreboard System

The new system **pulls** data from the Competition Hub and formats it for different display types:

```
Competition Hub (has data from OWLCMS via WebSocket)
       ↓
Scoreboard Registry (discovers plugins)
       ↓
/api/scoreboard?type=lifting-order&fop=Platform_A
       ↓
Browser displays scoreboard
```

## Testing the System

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Connect OWLCMS

**Important:** You must configure OWLCMS to send data to the tracker (see OWLCMS configuration section above).

Alternatively, use your test script with sample data files:

```bash
./test-sample-data.sh
```

### 3. View Scoreboards

Open these URLs in your browser:

```
http://localhost:8096/lifting-order?fop=A
```

Change the FOP parameter to match your competition:

```
http://localhost:8096/lifting-order?fop=Platform_A
http://localhost:8096/lifting-order?fop=Platform_B
http://localhost:8096/lifting-order?fop=Platform_C
```

### 4. Check Available FOPs

```bash
curl -X POST http://localhost:8096/api/scoreboard \
  -H "Content-Type: application/json" \
  -d '{"action": "list_fops"}'
```

Response:
```json
{
  "success": true,
  "fops": ["Platform_A", "Platform_B", "Platform_C"]
}
```

### 5. Check Available Scoreboards

```bash
curl -X POST http://localhost:8096/api/scoreboard \
  -H "Content-Type: application/json" \
  -d '{"action": "list_scoreboards"}'
```

Response:
```json
{
  "success": true,
  "scoreboards": [
    {
      "type": "lifting-order",
      "name": "Lifting Order",
      "description": "Shows current lifter and upcoming lifting order with timer",
      "options": [...]
    }
  ]
}
```

## How FOP Names Work

### Option 1: From Database (Recommended)

OWLCMS sends FOP configuration in the `/database` payload:

```json
{
  "competition": {
    "name": "Provincial Championship",
    "fops": ["Platform_A", "Platform_B", "Platform_C"]
  }
}
```

The system extracts these FOP names automatically.

### Option 2: From Update Messages (Fallback)

If the database doesn't include FOP list, the system discovers FOPs from the `fopName` field in type="update" messages:

```json
{
  "type": "update",
  "payload": {
    "fopName": "Platform_A",
    "fullName": "John Doe",
    ...
  }
}
```

The system adds "Platform_A" to the available FOPs list.

### Option 3: Default (Last Resort)

If no database and no updates yet, defaults to FOP "A":

```
http://localhost:8096/lifting-order?fop=A
```

## Creating Your First Custom Scoreboard

### Use AI to Generate It

**Prompt:**

> "Create a results scoreboard that shows the top 10 athletes sorted by total. Display: rank, name, team, snatch, clean & jerk, total, sinclair. Allow sorting by total or sinclair via URL parameter."

AI will create:

1. **config.js** - Defines options
2. **helpers.data.js** - Extracts and sorts data
3. **page-simple.svelte** - Displays the results

### Manual Creation (3 Files)

**1. Create folder:**
```bash
mkdir src/plugins/results
```

**2. Create `config.js`:**
```javascript
export default {
	name: 'Results Board',
	description: 'Final competition results',
	options: [
		{
			key: 'sortBy',
			label: 'Sort By',
			type: 'select',
			options: ['total', 'sinclair'],
			default: 'total'
		},
		{
			key: 'showTop',
			label: 'Show Top',
			type: 'number',
			default: 10,
			min: 3,
			max: 50
		}
	]
};
```

**3. Create `helpers.data.js`:**
```javascript
import { competitionHub } from '$lib/server/competition-hub.js';

export function getScoreboardData(fopName, options = {}) {
	const fopUpdate = competitionHub.getFopUpdate(fopName);
	const sortBy = options.sortBy || 'total';
	const showTop = options.showTop || 10;
	
	// Parse athletes from OWLCMS precomputed data (from WebSocket type="update")
	// For field mappings, see docs/FIELD_MAPPING_OVERVIEW.md
	let athletes = [];
	if (fopUpdate?.groupAthletes) {
		athletes = fopUpdate.groupAthletes; // Already parsed as nested object
	}
	
	// Sort
	if (sortBy === 'sinclair') {
		athletes.sort((a, b) => (b.sinclair || 0) - (a.sinclair || 0));
	} else {
		athletes.sort((a, b) => (b.total || 0) - (a.total || 0));
	}
	
	// Limit
	athletes = athletes.slice(0, showTop);
	
	return {
		competition: {
			name: fopUpdate?.competitionName || 'Competition',
			fop: fopName
		},
		athletes,
		sortBy,
		showTop,
		status: athletes.length > 0 ? 'ready' : 'waiting'
	};
}
```

**4. Create `page-simple.svelte`:**
```svelte
<script>
	export let data = {};
</script>

<div class="results">
	<h1>{data.competition?.name} - Results</h1>
	<p>Sorted by: {data.sortBy}</p>
	
	<table>
		<thead>
			<tr>
				<th>Rank</th>
				<th>Name</th>
				<th>Team</th>
				<th>Snatch</th>
				<th>C&J</th>
				<th>Total</th>
				<th>Sinclair</th>
			</tr>
		</thead>
		<tbody>
			{#each data.athletes || [] as athlete, i}
				<tr>
					<td>{i + 1}</td>
					<td>{athlete.fullName}</td>
					<td>{athlete.teamName || '--'}</td>
					<td>{athlete.bestSnatch || '--'}</td>
					<td>{athlete.bestCleanJerk || '--'}</td>
					<td>{athlete.total || '--'}</td>
					<td>{athlete.sinclair?.toFixed(2) || '--'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.results {
		padding: 2rem;
		background: #1a1a1a;
		color: white;
		min-height: 100vh;
	}
	
	table {
		width: 100%;
		border-collapse: collapse;
		background: #2a2a2a;
		border-radius: 8px;
		overflow: hidden;
	}
	
	th, td {
		padding: 1rem;
		text-align: left;
	}
	
	thead {
		background: #3a3a3a;
	}
	
	tbody tr:hover {
		background: #333;
	}
</style>
```

**5. Restart server and test:**
```
http://localhost:8096/results?fop=Platform_A&sortBy=sinclair&showTop=15
```

## Troubleshooting

### "FOP parameter is required"

**Problem:** Accessing `/lifting-order` without `?fop=...`

**Solution:** Always include FOP in URL:
```
http://localhost:8096/lifting-order?fop=A
```

### "No competition data"

**Problem:** No data from OWLCMS yet

**Solutions:**
1. Check OWLCMS is sending to correct URL
2. Send test data: `./test-sample-data.sh`
3. Check hub has data: Look for `[Hub] Update processed` in console

### "Scoreboard type not found"

**Problem:** Plugin folder doesn't match URL

**Solutions:**
1. Check folder name: Must be `{type}`
2. URL must match: `/{type}?fop=...`
3. Restart server after creating new plugin

## Next Steps

1. ✅ Test with your OWLCMS instance
2. ✅ Create custom scoreboards for your needs
3. ✅ Deploy to production (same endpoints work)
4. ✅ Share scoreboard configs with community

## Summary

**What you DON'T need to do:**
- ❌ Change OWLCMS code
- ❌ Modify OWLCMS endpoints
- ❌ Update OWLCMS data format

**What you CAN do:**
- ✅ Create unlimited scoreboard types
- ✅ Support multiple FOPs simultaneously
- ✅ Customize display per competition
- ✅ Use AI to generate new scoreboards
- ✅ Share scoreboards with other competitions
