# Feature Spec: Observation Creation

* Date: 2026-06-15

## 1. Goal
The goal of this feature is to provide the foundational capability for users to create a new `Observation` and define its associated `Metrics`. This is the first step in enabling the domain-agnostic tracking philosophy of Factor. As established, this iteration is strictly "lean" to minimize the initial lift: it only supports creation, stores data locally, and intentionally omits editing, deletion, viewing existing observations, and record logging.

## 2. Requirements
* [ ] **Local-First Storage:** All data must be saved to local on-device storage. No cloud synchronization or account requirements.
* [ ] **Create Observation:** The user must be able to input a name for a new Observation.
* [ ] **Define Metrics:** The user must be able to define one or more Metrics for the Observation, specifying the metric name and type (e.g., Number, String, Boolean).
* [ ] **Creation Only:** The feature must strictly limit scope to adding new Observations. Updating or deleting them is out of scope.
* [ ] **No View/List Feature:** Creating a list or detail view for Observations is out of scope. The feature simply needs to capture and persist the input.
* [ ] **No Record Logging:** The ability to log a `Record` against an Observation is out of scope for this iteration.

## 3. Technical Design

### 3.1 Data Models
*   **Observation**
    *   `id`: UUID (Primary Key)
    *   `name`: String
    *   `createdAt`: Timestamp
*   **Metric**
    *   `id`: UUID (Primary Key)
    *   `observationId`: UUID (Foreign Key to Observation)
    *   `name`: String
    *   `type`: Enum (e.g., `NUMBER`, `TEXT`, `BOOLEAN`, `SCALE`)

### 3.2 Application Layer
*   **Command/UseCase:** `CreateObservationUseCase`
    *   **Input:** `observationName` (String), `metrics` (Array of `{ name: string, type: string }`)
    *   **Behavior:** Validates inputs, generates UUIDs, creates domain entities, and passes them to the repository for persistence.
*   **Repository Interface:** `ObservationRepository`
    *   Must define a `save(observation: Observation): Promise<void>` method.

### 3.3 Storage Layer
*   Implementation of `ObservationRepository` using the project's chosen local storage technology (e.g., SQLite/Expo SQLite).

### 3.4 User Interface
*   A standalone screen or modal containing:
    *   A text input for the Observation Name.
    *   A dynamic list of inputs for Metrics (Name and Type selector).
    *   A button to "Add another metric".
    *   A "Save" button to execute the `CreateObservationUseCase`.
    *   A simple success toast/alert upon successful save (since there is no list view to return to).

## 4. Verification Plan

### Manual Verification
1. Open the application and navigate to the Observation Creation form.
2. Enter a valid Observation name (e.g., "Coffee").
3. Add multiple Metrics with different types (e.g., "Cups" [Number], "Roast" [Text]).
4. Tap the "Save" button.
5. Verify a success message is displayed.
6. Open the local database inspector (e.g., via Flipper or Expo tools) and verify that the `Observation` row and associated `Metric` rows were correctly inserted with the appropriate relationships.

### Automated Tests
*   **Unit Tests:** Verify `CreateObservationUseCase` correctly constructs domain models, handles validation (e.g., empty names), and calls the repository.
*   **Integration Tests:** Verify `ObservationRepository.save` correctly persists the `Observation` and its `Metrics` to the local database and handles foreign key constraints properly.
