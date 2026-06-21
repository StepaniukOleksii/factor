# Feature Spec: Record Creation

* Date: 2026-06-21

## 1. Goal

The goal of this feature is to allow users to capture a new `Record` for an existing `Observation`.

The Observation List becomes the entry point for record logging. Each Observation tile provides an action to create a Record. When creating a Record, the application dynamically displays inputs for the Metrics defined by the selected Observation, ensuring that users provide data consistent with the Metric types.

This iteration focuses exclusively on creating Records. Record editing, deletion, history browsing, and analysis are out of scope.

---

## 2. Requirements

* [ ] **Record Creation Entry Point:** Each Observation tile on the Observation List screen must display a "+" button for adding a new Record.
* [ ] **Navigate to Record Creation:** Clicking the "+" button must navigate the user to the Record Creation screen for the selected Observation.
* [ ] **Display Observation Information:** The Record Creation screen must display the selected Observation name at the top of the screen.
* [ ] **Dynamic Metric Inputs:** The Record Creation screen must render an input for each Metric belonging to the selected Observation.
* [ ] **Type-Based Input Validation:** Metric inputs must validate user input based on the Metric type.
* [ ] **Required Metric Values:** The user must provide a value for every Metric before the Record can be created.
* [ ] **Record Timestamp:** The created Record must automatically store the current timestamp representing when the observation was recorded.
* [ ] **Local-First Storage:** Records must be persisted only in local device storage.
* [ ] **Create Record Action:** The Record Creation screen must provide an "Add Record" button at the bottom of the screen.
* [ ] **Return to Observation List:** After a Record is successfully created, the user must be navigated back to the Observation List screen.

---

## 3. Technical Design

### 3.1 Data Models

Reuse existing Record and Metric domain models.

---

### 3.2 Application Layer

* **Command/UseCase:** `CreateRecordUseCase`

  **Input:**

    * `observationId`: UUID
    * `values`: Array of `{ metricId: UUID, value: unknown }`

  **Behavior:**

    * Retrieves the Observation and its Metrics.
    * Validates that all required Metrics have corresponding values.
    * Validates that each value matches the Metric type.
    * Generates UUIDs for the Record and Record Values.
    * Assigns the current timestamp.
    * Persists the Record and associated Record Values through the repository.

---

### 3.3 Storage Layer

Implement `RecordRepository` using the project's local SQLite storage.

The implementation must:

* Persist the Record.
* Persist all associated Record Values.
* Maintain foreign key relationships with Observations and Metrics.

---

### 3.4 Navigation

Introduce the following navigation flow:

Observation List
↓
Record Creation

Behavior:

* Selecting the "+" button on an Observation tile opens the Record Creation screen for that Observation.
* After a successful Record creation, the user returns to the Observation List.

---

### 3.5 User Interface

### Observation List Screen

Update the existing Observation tiles to include:

* Observation name.
* Metric count.
* A "+" button for creating a new Record.

### Record Creation Screen

The screen contains:

* The Observation name displayed at the top.
* A dynamically generated list of inputs based on the Observation Metrics.
* Validation feedback when entered values do not match Metric constraints.
* An "Add Record" button positioned at the bottom of the screen.

The visual layout and styling must follow the separately provided design specification.

---

## 4. Verification Plan

### Manual Verification

1. Open the Observation List.
2. Verify every Observation tile displays a "+" button.
3. Click the "+" button for an Observation.
4. Verify navigation to the Record Creation screen.
5. Verify the Observation title is displayed.
6. Verify all associated Metrics appear as input fields.
7. Enter valid values for each Metric.
8. Click "Add Record".
9. Verify the application returns to the Observation List.
10. Verify the Record is stored in the local database.

Additional validation checks:

* Enter invalid text into a NUMBER field and verify validation prevents submission.
* Leave required Metric values empty and verify Record creation is blocked.
* Verify BOOLEAN Metrics use an appropriate control and save correctly.

---

### Automated Tests

* **Unit Tests:**

    * Verify `CreateRecordUseCase` creates Records and Record Values correctly.
    * Verify validation rejects missing Metric values.
    * Verify validation rejects values that do not match Metric types.
    * Verify timestamps and IDs are generated correctly.

* **Integration Tests:**

    * Verify `RecordRepository.save()` persists Records and their values correctly.
    * Verify foreign key relationships between Record, RecordValue, Observation, and Metric are maintained.

* **UI Tests:**

    * Verify the "+" button navigates to the correct Observation Record Creation screen.
    * Verify invalid input prevents submission.
    * Verify successful creation returns to the Observation List.
