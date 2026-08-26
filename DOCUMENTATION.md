# Self-Evaluating Lesson Content Generator — Technical Documentation

## 1. System Overview

RAG Content Agent is an n8n-based AI content generation and quality-control workflow.

Its purpose is to generate beginner-friendly educational material and use an independent LLM evaluation step to decide whether the material should be accepted or regenerated.

The workflow has two terminal outcomes:

- **Final Lesson** — successful quality evaluation.
- **Failed Final Lesson** — fallback after the maximum number of generation attempts.

The successful Final Lesson is the intended primary outcome.

---

## 2. Architecture

```text
When clicking ‘Execute workflow’ (Manual Trigger)
      |
      v
Edit Fields
      |
      v
Generator <----------------------+
      |                          |
      v                          |
Store Generated Lesson           |
      |                          |
      v                          |
Lesson Evaluator                 |
      |                          |
      v                          |
If: overall_pass?                |
   |                 |           |
 TRUE              FALSE         |
   |                 |           |
   v                 v           |
Final Lesson     Retry Limit     |
                     |           |
                attempt < 3?     |
                  |       |      |
                 YES      NO     |
                  |        |     |
                  v        v     |
          Prepare Regeneration  Failed Final Lesson
                  |
                  +-------------> Generator
```

---

## 3. Node Responsibilities

### 3.1 When clicking ‘Execute workflow’

Manual workflow trigger.

### 3.2 Edit Fields

Initializes workflow state:

```text
topic   = Introduction to RAG
attempt = 1
```

### 3.3 Generator

Generates the lesson using the beginner-oriented instructional prompt.

The prompt includes the topic, current attempt, and previous evaluator feedback when regeneration occurs.

**To test the evaluator catching a deliberate error** The Generator prompt contains the demo-only deliberate-error instruction only during the evaluator demonstration/testing run. It is not part of the normal final workflow prompt.

**Instruction to add**
```text
FOR DEMO ONLY:
Introduce one obvious technical error about the topic in the lesson, while keeping the rest of the lesson unchanged.
```

### 3.4 Store Generated Lesson

Normalizes the model response:

```text
lesson  = generated text
topic   = original topic
attempt = current attempt
```

This node is important because it provides a stable state object for downstream nodes.

### 3.5 Lesson Evaluator

The evaluator checks all of the following:

1. **Topic accuracy**
2. **Beginner friendly**
3. **Key concepts**
4. **Examples**
5. **Jargon**
6. **Teaching flow**
7. **Technical accuracy**
8. **Standalone lesson**

The evaluator returns `overall_pass = true` only when every check passes.

Each check contains:

- id
- passed
- reason

For a failed check it returns:

- what failed;
- why it failed;
- what should be changed during regeneration.

The evaluator also produces `failed_checks` and `regeneration_feedback`.

### 3.6 Structured Output Parser

Parses the evaluator into the expected structured JSON object.

### 3.7 If

Checks:

```text
$json.output.overall_pass === true
```

TRUE routes to `Final Lesson`.

FALSE routes to `Retry Limit`.

### 3.8 Retry Limit

Checks:

```text
$('Store Generated Lesson').item.json.attempt < 3
```

This bounds the regeneration loop.

### 3.9 Prepare Regeneration

Creates the next generation state:

```text
topic   = original topic
attempt = current attempt + 1
feedback = evaluator output
```
The evaluator output contains the failed checks and regeneration feedback.

The updated attempt and feedback are then passed back into the Generator.

### 3.10 Final Lesson

**Final Lesson** is the successful terminal node.

It returns:

```text
status
lesson
attempt
```
Example:

```json
{
  "status": "passed",
  "lesson": "<accepted lesson content>",
  "attempt": 1
}
```

### 3.11 Failed Final Lesson

**Failed Final Lesson** is the controlled fallback terminal node.

Output Fields:

```text
status
lesson
evaluation (with failed_checks & regeneration_feedback)
attempt
```

This branch is intentionally retained so the workflow fails safely after the retry limit instead of looping indefinitely.

Example structure:

```json
{
  "status": "failed",
  "lesson": "<last generated lesson>",
  "evaluation": {
    "output": {
      "overall_pass": false,
      "checks": [
        {
          "id": "<check_id>",
          "passed": true,
          "reason": "<reason>"
        }
      ],
      "failed_checks": [
        "<failed_check_id>"
      ],
      "regeneration_feedback": "<what failed and what should be corrected>"
    }
  },
  "attempt": 3,
}
```
The node preserves the last generated lesson together with the evaluator's failure information.

The `evaluation` field preserves the evaluator result with `failed_checks` and `regeneration_feedback`, surfaced directly by the final failure node for easier inspection.

---

## 4. State and Expressions

The workflow uses explicit n8n node references to preserve state across branches.

The initial attempt state is established in Edit Fields:

```
attempt = 1
```

The attempt value is accessed from upstream nodes using expressions such as:

```text
$('Store Generated Lesson').item.json.attempt
```

During regeneration, the attempt is incremented using:

```text
$('Store Generated Lesson').item.json.attempt + 1
```

The regeneration state also retains the original topic and evaluator feedback.

Using explicit node references avoids depending on **$json** containing the desired upstream state after branch execution.

---

## 5. Evaluation Contract

The Lesson Evaluator returns a structured object containing the overall result, individual checks, failed checks, and regeneration feedback.

General structure:

```json
{
  "overall_pass": true,
  "checks": [
    {
      "id": "topic_accuracy",
      "passed": true,
      "reason": "The lesson accurately covers the requested topic."
    },
    {
      "id": "beginner_friendly",
      "passed": true,
      "reason": "The explanation uses accessible language."
    }
  ],
  "failed_checks": [],
  "regeneration_feedback": ""
}
```

The actual workflow contains all eight check definitions:

```text
topic_accuracy
beginner_friendly
key_concepts
examples
jargon
teaching_flow
technical_accuracy
standalone
```

The overall result is:

```text
overall_pass = true
```

only when every required check passes.

When a check fails, **failed_checks** identifies the failed criteria and **regeneration_feedback** explains:
- what failed;
- why it failed;
- what should be changed during regeneration.

---

## 6. Regeneration Contract

When evaluation fails, the evaluator output becomes feedback for the next Generator call.

The Generator receives:

```text
Topic
Attempt
Previous evaluation feedback
```

The Generator uses this information to create another version of the lesson.

The intended behavior is to correct the evaluator-identified issues while retaining content that already satisfies the quality requirements.

The regeneration loop therefore follows:

```text
Generated Lesson
      ↓
Evaluation
      ↓
Failure identified
      ↓
Evaluator feedback
      ↓
Prepare Regeneration
      ↓
Generator
      ↓
New Lesson
```

This creates the key self-correction mechanism.

---

## 7. Retry Semantics

Maximum generation attempts: **3**

```text
Attempt 1
   |
   +-- PASS → Final Lesson
   |
   +-- FAIL → Attempt 2
                 |
                 +-- PASS → Final Lesson
                 |
                 +-- FAIL → Attempt 3
                               |
                               +-- PASS → Final Lesson
                               |
                               +-- FAIL → Failed Final Lesson
```
The Retry Limit condition is:

```text
$('Store Generated Lesson').item.json.attempt < 3
```

Therefore:

```text
Attempt 1 → fail → regenerate
Attempt 2 → fail → regenerate
Attempt 3 → fail → stop
```

This prevents an unbounded agentic loop.

---

## 8. Primary Final Outcome

The normal successful workflow ends at:

```text
Final Lesson
```

with:

```text
status = passed
```

The complete successful output format is:

```json
{
  "status": "passed",
  "lesson": "<accepted lesson content>",
  "attempt": 1
}
```

The successful attempt can be 1, 2, or 3 depending on whether regeneration was required.

The accepted lesson is the content that successfully satisfies the evaluator.

`Failed Final Lesson` is not the expected normal output; it is the controlled fallback used when all allowed attempts fail.

---

## 9. Testing the Successful Path

To test the normal successful path:

1. Configure a valid Gemini API credential.
2. Open `Edit Fields`.
3. Set a topic.
4. Keep `attempt = 1`.
5. Ensure the `Generator/evaluator` contains the normal evaluation prompt.
6. Execute the workflow.
7. Follow the execution from Generator to Lesson Evaluator.
8. Confirm `overall_pass = true`.
9. Confirm the `If` TRUE branch executes.
10. Inspect `Final Lesson`.
11. Confirm `status = passed`.

The successful path is:

```text
Generator
  → Store Generated Lesson
  → Lesson Evaluator
  → If (TRUE)
  → Final Lesson
```

---

## 10. Testing the Regeneration Path

The regeneration behavior was demonstrated using a deliberate evaluator-detectable error.

### 10.1 Deliberate technical-error demonstration

For the demonstration, the following temporary instruction was added to the Generator prompt:

```text
FOR DEMO ONLY:
Introduce one obvious technical error about the topic in the lesson, while keeping the rest of the lesson unchanged.
```

This instruction was used only for the demonstration/testing run.

The intended behavior is:

```text
Generator
   ↓
lesson containing deliberate error
   ↓
Lesson Evaluator
   ↓
overall_pass = false
   ↓
failed_checks identifies the relevant problem
   ↓
regeneration_feedback explains what to fix
   ↓
Prepare Regeneration
   ↓
Generator receives feedback
```

After the demonstration, **remove the testing instruction** from the Generator prompt.

This instruction must not be present in the final production workflow.

### 10.2 Testing the terminal Failed Final Lesson branch

If you specifically want to demonstrate the terminal failure branch without depending on the model randomly producing a failing lesson, temporarily add this line to the **Lesson Evaluator** prompt:

```text
FOR TESTING ONLY:
Set overall_pass to false for this evaluation, regardless of the lesson quality.
```

This deliberately forces the FALSE branch.

Expected behavior:

```text
Attempt 1 → Retry Limit → Prepare Regeneration
Attempt 2 → Retry Limit → Prepare Regeneration
Attempt 3 → Retry Limit → Failed Final Lesson
```

After the demonstration, **remove that line**.

It must not be present in the final submitted evaluator prompt.


The deliberate-error instruction and forced-failure instruction serve different purposes:

→ Generator DEMO ONLY — demonstrates that the evaluator can catch a technical error and provide useful regeneration feedback.

→ Evaluator TESTING ONLY — demonstrates that the retry limit eventually routes execution to Failed Final Lesson.

---

## 11. Gemini Configuration

The primary model used during development and workflow execution was:

```text
Gemini 3.6 Flash
```

**Gemini 3.5 Flash** was used only for final verification of the workflow and demonstration video after the Gemini 3.6 Flash quota was exceeded.

The workflow requires the user importing it to configure their own Gemini credential.

**API credentials** are not included in the workflow export.

The Gemini model is used by:

- Generator
- Lesson Evaluator

The Structured Output Parser is responsible for enforcing/parsing the evaluator's structured response format.

---

## 12. Rate-Limit Considerations

During development, Gemini API quota/rate-limit errors were encountered.

Observed examples included:

```text
429 Too Many Requests
503 Service Unavailable
```

These errors prevent the model nodes from executing but do not change the workflow's logical design.

When live API execution is unavailable, the captured successful execution can be used for the presentation/demo, and the regeneration behavior can be explained using the captured branch evidence.

---

## 13. Demonstration Strategy

The demonstration is divided into three main parts.

### Part 1 — Architecture

Show the complete n8n canvas and explain the major nodes:

```text
When clicking 'Execute workflow'
 → Edit Fields
 → Generator
 → Store Generated Lesson
 → Lesson Evaluator
 → If
 → Final Lesson / Retry branch
```

Highlight the bounded regeneration loop:

```text
Retry Limit
 → Prepare Regeneration
 → Generator
```
and the terminal fallback:

```text
Retry Limit
 → Failed Final Lesson
```

### Part 2 — Successful run

Show the captured successful execution:

```text
Generator
 → Store Generated Lesson
 → Lesson Evaluator
 → If TRUE
 → Final Lesson
```

Highlight:

```text
overall_pass = true
status = passed
```

The Final Lesson node returns:

```text
status
lesson
attempt
```

The accepted final lesson is provided separately as the Final Lesson Output document.

### Part 3 — Regeneration/fallback

Show the deliberate-error demonstration and retry branch.

The Generator temporarily introduces a technical error for demonstration, the Lesson Evaluator identifies the issue, and the resulting:

```text
failed_checks
regeneration_feedback
```

are passed into the regeneration process.

The retry guard ensures:

```text
attempt < 3
```

If the evaluator continues to fail through the third attempt, execution reaches:

```text
Failed Final Lesson
```

For the terminal failure demonstration, the temporary evaluator testing instruction can be used to force the FALSE branch.

All temporary **DEMO ONLY / TESTING ONLY instructions** are removed from the final workflow.

The final workflow and video were verified using Gemini 3.5 Flash after the Gemini 3.6 Flash quota was exceeded.

---

## 14. Security

Do not commit or record the actual Gemini API key.

When recording the setup process:

- show the credential configuration conceptually;
- do not reveal the key value;
- use a redacted/hidden credential field in the recording.

---