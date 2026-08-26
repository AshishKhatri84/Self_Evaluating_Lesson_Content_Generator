# Self-Evaluating Lesson Content Generator

An n8n agentic workflow that generates a beginner-friendly lesson, evaluates it against a strict quality rubric, and either accepts it or regenerates it using evaluator feedback.

## Assignment objective

The workflow is designed for beginner learners in India who may have recently completed 12th grade, have limited English vocabulary, and have no prior AI knowledge.

The current example topic is **Introduction to RAG**.

The workflow demonstrates:

- LLM-based content generation
- structured LLM evaluation
- pass/fail routing
- evaluator-driven regeneration
- bounded retry logic
- a controlled failure/fallback path

---

# Submission deliverables

## 1. GitHub repository

Include:

- agentic workflow JSON
- README
- technical documentation
- evidence screenshots

## 2. Final Output Document

https://docs.google.com/document/d/1Irfxobxdl_lX7-jR5G0Zx-UvvOBNYfG9/edit?usp=sharing&ouid=111519718625107380109&rtpof=true&sd=true

The document contains the accepted final lesson output, rather than the `Failed Final Lesson` fallback.

Note: The document is also uploaded to the repo as **Final Lesson Output.docx**.

## 3. Video

https://drive.google.com/file/d/15yYll0uGifpvhGQJLQHGvmUfIn4XGkDP/view?usp=drive_link

The demonstration video covers:

- the agentic workflow running end-to-end
- the evaluator catching a deliberate technical error
- the retry/regeneration behavior
- the final accepted lesson
- a face-visible walkthrough explaining how the workflow works

---

# Project structure

```text
Self-Evaluating Lesson Content Generator/
└── evidence/
    ├── 01_Workflow_Overview.png
    ├── 02_Generator_Prompt.png
    ├── 03_Store_Generated_Lesson.png
    ├── 04_Lesson_Evaluator_True.png
    ├── 05_If_Pass_Fail_Routing.png
    ├── 06_Final_Lesson_Output.png
    ├── 07_Lesson_Evaluator_False.png
    ├── 08_Retry_Limit.png
    ├── 09_Prepare_Regeneration.png
    ├── 10_Failed_Final_Lesson_Output.png
    ├── 11_Retry-Regeneration_Flow.png
    └── README.md
├── DOCUMENTATION.md
├── Final Lesson Output.docx
├── README.md
└── Workflow.json
```

---

## Workflow

```text
Manual Trigger
    ↓
Edit Fields
    ↓
Generator
    ↓
Store Generated Lesson
    ↓
Lesson Evaluator
    ↓
If: overall_pass?
   ├── TRUE  → Final Lesson
   └── FALSE → Retry Limit
                  ├── attempt < 3 → Prepare Regeneration → Generator
                  └── attempt ≥ 3 → Failed Final Lesson
```

The Google Gemini chat model is connected to the Generator, Lesson Evaluator, and Structured Output Parser.

---

## Node responsibilities

| Node | Purpose |
|---|---|
| **When clicking ‘Execute workflow’** | Starts a manual workflow execution |
| **Edit Fields** | Sets the topic and initializes `attempt = 1` |
| **Generator** | Creates the beginner lesson using the instructional prompt |
| **Store Generated Lesson** | Stores the lesson and carries topic/attempt state forward |
| **Lesson Evaluator** | Applies 8 hard pass/fail quality checks |
| **Structured Output Parser** | Converts evaluator output into the expected JSON structure |
| **If** | Sends passing evaluations to Final Lesson and failures to Retry Limit |
| **Retry Limit** | Allows regeneration only while `attempt < 3` |
| **Prepare Regeneration** | Increments the attempt and passes evaluator feedback back to Generator |
| **Final Lesson** | Returns the accepted lesson |
| **Failed Final Lesson** | Returns the last lesson plus failure details after the retry limit |

---

## Evaluation rubric

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

---

# Setup

## Requirements

- n8n
- Google AI Studio / Gemini API key
- A Google Gemini-compatible model configured in n8n

Docker is only an optional way to run n8n locally. It is not necessarily required.

## 1. Run n8n

Start your normal n8n instance.

If you use Docker for n8n, keep your Docker volume/database local. Do not commit it to GitHub.

## 2. Import the workflow

Import:

```text
Self-Evaluating Lesson Content Generator.json
```

into n8n.

## 3. Create a Gemini API key

Create a Gemini API key in Google AI Studio.

**Never put the API key in this repository or in the workflow JSON.**

Then, in n8n:

1. Open **Credentials**.
2. Create/configure the Google Gemini / Google PaLM API credential supported by your n8n version.
3. Paste your Gemini API key.
4. Save the credential.
5. Open **Google Gemini Chat Model** in the workflow.
6. Select your newly created credential.

Primary model used during development: **Gemini 3.6 Flash & Gemini 3.5 Flash**

## 4. Set the topic

Open **Edit Fields**.

The default example is:

```text
topic = Introduction to RAG
attempt = 1
```

Change `topic` if you want to test another lesson topic.

Keep:

```text
attempt = 1
```

for a fresh execution.

## 5. Execute

Click **Execute workflow**.

A successful run should follow:

```text
Generator
 → Store Generated Lesson
 → Lesson Evaluator
 → If (TRUE)
 → Final Lesson
```

Inspect **Final Lesson** and confirm:

```text
status = passed
```

The successful attempt may be 1, 2, or 3 depending on whether regeneration was required.

---

# Regeneration logic

The workflow uses explicit attempt state.

Initial state:

```text
attempt = 1
```

When evaluation fails, **Prepare Regeneration** sets:

```text
topic   = original topic
attempt = previous attempt + 1
feedback = evaluator output
```

The Generator then receives the new attempt number and previous evaluator feedback.

The Retry Limit checks:

```text
$('Store Generated Lesson').item.json.attempt < 3
```

Therefore:

```text
Attempt 1 → fail → regenerate
Attempt 2 → fail → regenerate
Attempt 3 → fail → stop
```

A maximum of **three generation attempts** is allowed.

This prevents an unbounded agentic loop.

---

# How to test the evaluator catching a deliberate error

The assignment asks for a demonstration of the evaluator catching a deliberate error.

The cleanest demonstration is to temporarily add a testing instruction to the **Generator** prompt:

```text
FOR DEMO ONLY:
Introduce one obvious technical error about the topic in the lesson, while keeping the rest of the lesson unchanged.
```

Run the workflow.

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

---

# How to test the Failed Final Lesson branch

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

The repository's final workflow export does **not** contain this test instruction.

---

# Final outputs

## Successful path

**Final Lesson** returns:

```text
status
lesson
attempt
```

The lesson is the accepted final content, copied into the Final Lesson Output Google Doc.

## Failure path

When the workflow reaches the retry limit without receiving a passing evaluation, 

**Failed Final Lesson** returns:

```text
status
lesson
evaluation (with failed_checks & regeneration_feedback)
attempt
```

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

The `evaluation` field preserves the evaluator result with `failed_checks` and `regeneration_feedback`, surfaced directly by the final failure node for easier inspection.

---

# Evidence

The `evidence/` directory contains labeled screenshots of the workflow and its important execution states.

The evidence covers:

- complete workflow architecture
- lesson generation
- generated lesson storage
- successful evaluator output
- pass/fail routing
- successful Final Lesson output
- evaluator-detected failure
- retry limit
- regeneration preparation
- controlled failed final output
- actual retry/regeneration execution flow

The retry/regeneration evidence is particularly useful because it shows that multiple nodes were actually executed during the failed evaluation and regeneration cycle rather than only showing the static workflow design.

---

# Security

Do not commit:

- Gemini API keys
- `.env` files containing secrets
- n8n database files
- Docker volumes
- browser/session data
- local credential stores

The workflow JSON contains a credential reference, but no Gemini API key.

Before publishing to GitHub, open the JSON once and confirm that no secret value has been added.

---
