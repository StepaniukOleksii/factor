# Observation Details

## Goal

Allow users to inspect an Observation and review its most recent Records.

The Observation Details screen serves as the primary entry point for understanding an Observation's history before
additional analysis capabilities are introduced.

---

## Requirements

### Navigation

* A user can open the Observation Details screen by tapping an Observation tile on the Observation List screen.
* The selected Observation is loaded and displayed.

### Observation Information

The screen displays:

* Observation title
* Observation Metrics
* Recent Records

Metrics should be displayed in the order defined by the Observation.

### Recent Records

The screen displays the three most recent Records belonging to the Observation.

Records should be ordered from newest to oldest.

If fewer than three Records exist, all available Records should be displayed.

If no Records exist, an empty state message should be displayed.

### Record Tile

Each Record is displayed as a collapsible tile.

By default:

* Record tiles are collapsed.
* Only the last update date is visible.

When a user taps a Record tile:

* The tile expands.
* Record details become visible.

When a user taps an expanded Record tile:

* The tile collapses.

Only the selected tile's expanded state should change.

### Record Details

Expanded Record details display:

* Record timestamp
* Metric names
* Metric values

All Record details must be displayed within a single horizontal row.

If the row content exceeds the available screen width:

* Horizontal scrolling must be available.
* Users can scroll sideways to view all values.
* Content must remain in a single row and must not wrap onto multiple lines.

### Add Record Action

An Add Record button is displayed at the bottom of the screen.

The button:

* Uses the same visual design as the Add Record button used on the New Record screen.
* Uses the same positioning as the Add Record button used on the New Record screen.

When the user taps the button:

* The user is navigated to the New Record screen.
* The selected Observation is passed to the New Record screen.

---

## Out of Scope

This feature does not include:

* Observation editing
* Observation deletion
* Record editing
* Record deletion
* Viewing more than three Records
* Pagination
* Search
* Filtering
* Sorting options
* Charts or data visualization

---

## Technical Design

### Data Loading

The screen loads:

* Observation details
* Observation Metrics
* Three most recent Records

The Records query should be limited to three results ordered by timestamp descending.

### Record Expansion State

Expanded/collapsed state is managed locally within the screen.

Persistence of expansion state is not required.

---

## Verification Plan

### Manual Verification

Verify that:

1. Tapping an Observation tile opens Observation Details.
2. Observation title is displayed.
3. Observation Metrics are displayed.
4. The three newest Records are displayed.
5. Records are ordered newest first.
6. Record tiles are collapsed by default.
7. Tapping a tile expands it.
8. Tapping an expanded tile collapses it.
9. Expanded details display timestamp and metric values.
10. Record details remain on a single row.
11. Horizontal scrolling works when content exceeds screen width.
12. The Add Record button is visible.
13. The Add Record button matches the existing New Record screen button.
14. Tapping Add Record navigates to the New Record screen.
15. Empty state is displayed when no Records exist.

### Automated Tests

Add tests covering:

* Observation loading
* Recent Record retrieval
* Record ordering
* Three-record limit
* Empty state behavior
* Record expansion and collapse behavior
* Navigation to New Record screen
