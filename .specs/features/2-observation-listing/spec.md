# Feature Spec: Observation Listing

* Date: 2026-06-17

## 1. Goal

The goal of this feature is to allow users to view existing `Observations` that have been previously created and stored
locally.

This feature also establishes the initial application navigation flow. The Observation List becomes the application's
primary screen and serves as the entry point for managing Observations. Users can navigate from the list to the existing
Observation Creation screen to add new Observations.

This iteration remains focused on observation discovery and creation navigation. Editing, deleting, grouping, searching,
filtering, and record management are out of scope.

---

## 2. Requirements

* [ ] **Observation List as Home Screen:** The application must open on the Observation List screen.
* [ ] **Local-First Data Retrieval:** All Observations must be loaded from local on-device storage.
* [ ] **List Observations:** The user must be able to view all created Observations.
* [ ] **Display Observation Information:** Each Observation list item must display:

    * Observation name.
    * The top associated Metrics.
* [ ] **Empty State:** If no Observations exist, the user must see a message indicating that no Observations have been
  created yet.
* [ ] **Create Observation Entry Point:** The Observation List screen must provide a button fixed at the bottom of the
  screen labeled "Create Observation".
* [ ] **Navigate to Creation Screen:** Selecting "Create Observation" must navigate the user to the existing Observation
  Creation screen.
* [ ] **Return After Successful Creation:** After an Observation is successfully created, the application must navigate
  back to the Observation List screen, where the newly created Observation is visible.
* [ ] **Read-Only Observation List:** The list itself must not allow editing, deletion, or selection of Observations.
* [ ] **No Observation Detail View:** Tapping an Observation item must not open a detail screen.
* [ ] **No Record Interaction:** Records must not be displayed, created, or modified.

---

## 3. Technical Design

### 3.1 Data Models

No new domain models are introduced.

Existing `Observation` and `Metric` entities are used for retrieval and presentation.

---

### 3.2 Application Layer

* **Query/UseCase:** `GetObservationsUseCase`

    * **Input:** None.
    * **Output:** Array of `Observation` objects with their associated Metrics.
    * **Behavior:** Retrieves all Observations from the repository.

* **Repository Interface:** `ObservationRepository`

    * Add a `findAll(): Promise<Observation[]>` method for retrieving stored Observations.

---

### 3.3 Storage Layer

Extend the existing SQLite-based `ObservationRepository` implementation.

The implementation must:

* Retrieve all Observation records.
* Retrieve their associated Metrics.
* Reconstruct Observation-to-Metric relationships correctly.

---

### 3.4 Navigation

Introduce a simple navigation flow:

```
Observation List (Home)
            |
            v
Create Observation
```

Behavior:

* The Observation List is the initial route when the application launches.
* The "Create Observation" button navigates to the existing creation screen.
* After a successful creation, the user returns to the Observation List.

---

### 3.5 User Interface

#### Observation List Screen

Contains:
- An empty state message when no Observations exist.
- A dedicated Observation List screen containing elements according to
.specs/features/observation-listing/design/list-observations.html

### Create Observation Screen

The existing creation screen is reused.

The only behavioral change is that after successful creation, the user is redirected back to the Observation List
instead of displaying a standalone success message.

---

## 4. Verification Plan

### Manual Verification

1. Launch the application.
2. Verify that the Observation List screen is displayed first.
3. Verify the empty state appears when no Observations exist.
4. Tap "Create Observation".
5. Verify navigation to the Observation Creation screen.
6. Create a new Observation with one or more Metrics.
7. Verify the application returns to the Observation List.
8. Verify the newly created Observation appears in the list with the correct metric count.
9. Create multiple Observations and verify they all appear correctly.

---

### Automated Tests

* **Unit Tests:**

    * Verify `GetObservationsUseCase` returns the expected list of Observations.
    * Verify empty results are handled correctly.

* **Integration Tests:**

    * Verify `ObservationRepository.findAll()` retrieves Observations and their Metrics from SQLite.
    * Verify Observation-to-Metric relationships are restored correctly.

* **UI/Navigation Tests:**

    * Verify the application opens on the Observation List screen.
    * Verify tapping "Create Observation" navigates to the creation screen.
    * Verify successful creation returns the user to the list and refreshes the displayed data.
