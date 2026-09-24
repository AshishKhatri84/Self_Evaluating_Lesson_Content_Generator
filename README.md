# Self-Evaluating Lesson Content Generator

An autonomous agentic workflow and interactive web application that generates beginner-friendly educational lessons on any topic, rigorously audits them against an 8-point quality rubric, and automatically self-corrects using evaluator feedback loops.

![Agentic Workflow Overview](Evidence/01_Workflow_Overview.png)

---


## Overview

Traditional single-pass LLM prompts frequently suffer from hallucinations, unexplained technical jargon, or uneven teaching flow. The **Self-Evaluating Lesson Content Generator** solves this by implementing an autonomous **Generator-Evaluator Agentic Feedback Loop**:

1. **Content Generator**: Creates a structured, beginner-level lesson tailored for high school graduates with limited technical vocabulary.
2. **Evaluator Agent**: Audits the draft against **8 hard PASS/FAIL quality checks** using structured JSON output schemas.
3. **Autonomous Routing**:
   - If **all 8 checks pass** $\to$ Immediately accepts and outputs the **Final Lesson**.
   - If **any check fails** $\to$ Automatically extracts specific remediation feedback and re-prompts the Generator for an improved draft (bounded by a maximum 3-attempt safety limit).
   - If retry limit is reached $\to$ Delivers a controlled **Failed Final Lesson** terminal output with full audit history.

Originally engineered as an **n8n agentic workflow**, the project now features a **full-stack web application** with an interactive dashboard, live workflow monitoring, multi-format export capabilities (Word, PDF, Text), and optional client-side API key management.

---

## Workflow Video Walkthrough

A comprehensive video walkthrough demonstrating the workflow architecture, execution paths, and retry/regeneration behavior:

📹 **[https://drive.google.com/file/d/15yYll0uGifpvhGQJLQHGvmUfIn4XGkDP/view?usp=drive_link](https://drive.google.com/file/d/15yYll0uGifpvhGQJLQHGvmUfIn4XGkDP/view?usp=drive_link)** 

### Walkthrough Chapters & Demonstration Structure

| Chapter | Topic | What is Demonstrated |
|---|---|---|
| **Part 1** | **Architecture & Node Topology** | Tour of the complete n8n canvas: Manual Trigger $\to$ Edit Fields $\to$ Generator $\to$ Store Generated Lesson $\to$ Evaluator $\to$ Structured Output Parser $\to$ If Router $\to$ Retry Limit $\to$ Prepare Regeneration $\to$ Final Lesson / Failed Final Lesson. |
| **Part 2** | **Successful First-Pass Execution** | Execution with `topic = "Introduction to RAG"`. Demonstrates all 8 rubric checks passing (`overall_pass = true`), routing through the `If (TRUE)` branch, and delivering the verified `Final Lesson` on Attempt 1. |
| **Part 3** | **Retry Limit Safeguard Execution** | Demonstrates the bounded guardrail: persistent failures across 3 iterations safely route to `Failed Final Lesson` with complete diagnostic feedback instead of entering an infinite loop. |

---

## Architecture & Node Pipeline

```text
               ┌──────────────────────────────┐
               │ When clicking 'Execute'      │ (Manual Trigger)
               └──────────────┬───────────────┘
                              ▼
               ┌──────────────────────────────┐
               │ Edit Fields (Topic, Attempt) │ (Initialize state)
               └──────────────┬───────────────┘
                              ▼
        ┌────────────► ┌──────────────┐
        │              │  Generator   │◄─────────────────────────────┐
        │              └──────┬───────┘                              │
        │                     ▼                                      │
        │              ┌──────────────────────────────┐              │
        │              │ Store Generated Lesson       │              │
        │              └──────┬───────────────────────┘              │
        │                     ▼                                      │
        │              ┌──────────────────────────────┐              │
        │              │ Lesson Evaluator (8 Checks)  │              │
        │              └──────┬───────────────────────┘              │
        │                     ▼                                      │
        │              ┌──────────────────────────────┐              │
        │              │ Structured Output Parser     │              │
        │              └──────┬───────────────────────┘              │
        │                     ▼                                      │
        │              ┌──────────────────────────────┐              │
        │              │ If: overall_pass === true?   │              │
        │              └──────┬───────────────────────┘              │
        │            PASS     │     FAIL                             │
        │         ┌───────────┴───────────┐                          │
        │         ▼                       ▼                          │
        │  ┌──────────────┐        ┌──────────────┐                  │
        │  │ Final Lesson │        │ Retry Limit  │                  │
        │  │  (Accepted)  │        └──────┬───────┘                  │
        │  └──────────────┘     Attempt < 3│  Attempt ≥ 3            │
        │                         ┌────────┴────────┐                │
        │                         ▼                 ▼                │
        │              ┌──────────────────────┐ ┌──────────────────┐ │
        │              │ Prepare Regeneration │ │Failed FinalLesson│ │
        │              └──────────┬───────────┘ └──────────────────┘ │
        │                         │                                  │
        └─────────────────────────┴──────────────────────────────────┘
```

### Node Descriptions & State Responsibilities

| Node Name | Node Type | Responsibility |
|---|---|---|
| **When clicking ‘Execute workflow’** | `manualTrigger` | Initiates the workflow run. |
| **Edit Fields** | `set` | Initializes global execution state: `topic = "Introduction to RAG"`, `attempt = 1`. |
| **Generator** | `chainLlm` | Prompts Google Gemini with pedagogical instructions, topic, attempt number, and previous evaluator feedback (if regenerating). |
| **Google Gemini Chat Model** | `lmChatGoogleGemini` | LangChain model integration configuring `models/gemini-3.5-flash` or `models/gemini-3.6-flash`. |
| **Store Generated Lesson** | `set` | Caches current draft (`lesson`), preserves `topic`, and forwards `attempt` metadata as a stable state object. |
| **Lesson Evaluator** | `chainLlm` | Independent evaluator executing the 8-point rubric audit using hard PASS/FAIL checks. |
| **Structured Output Parser** | `outputParserStructured` | Validates and parses the evaluator's JSON response against the schema. |
| **If** | `if` | Evaluates `{{ $json.output.overall_pass === true }}`. Routes `TRUE` to `Final Lesson`, `FALSE` to `Retry Limit`. |
| **Retry Limit** | `if` | Guardrail evaluating `{{ $('Store Generated Lesson').item.json.attempt < 3 }}`. Bounds loop execution. |
| **Prepare Regeneration** | `set` | Increments `attempt = attempt + 1`, binds evaluator `failed_checks` and `regeneration_feedback`, and loops back into `Generator`. |
| **Final Lesson** | `set` | **Primary terminal node:** Outputs verified lesson with `status: "passed"`, `lesson`, and `attempt`. |
| **Failed Final Lesson** | `set` | **Controlled fallback terminal node:** Outputs latest draft with `status: "failed"`, `attempt: 3`, and diagnostic evaluator failure report. |

---

## The 8-Point Quality Evaluation Rubric

The Evaluator Agent audits every lesson draft against 8 strict, non-negotiable criteria:

| # | Check ID | Criterion Name | Strict Pass Requirement |
|:---:|---|---|---|
| **1** | `topic_accuracy` | **Topic Accuracy** | Accurately and clearly explains the requested topic; zero off-subject drift. |
| **2** | `beginner_friendly` | **Beginner Friendly** | 12th-grade reading level; accessible vocabulary, clear phrasing, no assumed background knowledge. |
| **3** | `key_concepts` | **Core Concepts** | Answers the 3 pedagogical pillars: (1) What it is, (2) Why it matters, and (3) How it works step-by-step. |
| **4** | `examples` | **Analogies & Examples** | Includes at least 1 relatable real-world non-technical analogy and 1 concrete practical example. |
| **5** | `jargon` | **Jargon Control** | Technical or unfamiliar terms must be explicitly defined immediately upon introduction. |
| **6** | `teaching_flow` | **Logical Flow** | Progresses smoothly from familiar everyday intuition to technical breakdown to recap. |
| **7** | `technical_accuracy` | **Technical Accuracy** | No factual errors, unsupported assertions, or misleading oversimplifications. |
| **8** | `standalone` | **Standalone Lesson** | Complete enough that a beginner needs no external search, textbook, or links to understand the core idea. |

> **Evaluation Rule:** `overall_pass` is **TRUE** if and only if **all 8 checks pass**. A single failure sets `overall_pass: false`, populates `failed_checks`, and triggers the regeneration cycle.

---

## Regeneration Logic & Self-Correction Feedback Loop

The core innovation of this agentic system is its closed-loop self-correction cycle:

```text
Generated Lesson Draft (Attempt N)
              │
              ▼
   Lesson Evaluator Audit
              │
    ┌─────────┴─────────┐
    ▼                   ▼
[8/8 Pass]       [Check Fails]
    │                   │
    │                   ▼
    │           Evaluator Output:
    │           - failed_checks: ["jargon", "examples"]
    │           - regeneration_feedback: "Define 'cosine similarity' in Section 2; add a library analogy."
    │                   │
    │                   ▼
    │         Prepare Regeneration:
    │         - attempt = N + 1
    │         - topic = topic
    │         - feedback = evaluator critique
    │                   │
    │                   ▼
    │         Generator Promoted:
    │         - Ingests critique
    │         - Preserves strong sections
    │         - Fixes targeted flaws
    │                   │
    │                   ▼
    │         New Draft (Attempt N + 1) ───► Re-Evaluated
    ▼
Final Lesson Accepted
```

### State Management Across Branches

The workflow relies on explicit n8n node references rather than transient `$json` context to guarantee cross-branch state stability:
- Initial state: `attempt = 1`
- Reading current attempt: `$('Store Generated Lesson').item.json.attempt`
- Incrementing attempt: `$('Store Generated Lesson').item.json.attempt + 1`
- Retry condition: `attempt < 3`

### Guardrail Safety & Bounded Execution

To prevent infinite loops and runaway API token consumption:
1. `Attempt 1` fails $\to$ `1 < 3` $\to$ routes to `Prepare Regeneration` $\to$ generates `Attempt 2`.
2. `Attempt 2` fails $\to$ `2 < 3` $\to$ routes to `Prepare Regeneration` $\to$ generates `Attempt 3`.
3. `Attempt 3` fails $\to$ `3 < 3` is **FALSE** $\to$ routes to `Failed Final Lesson` and halts execution.

---

## Scenarios & Execution Paths

The application supports three distinct testing and production scenarios:

### Scenario 1: Standard Autonomous Run (Clean Success Path)
- **Concept:** Natural production authoring on any topic entered by the user.
- **Workflow Behavior:** Generator creates a high-quality lesson draft. The Evaluator audits all 8 criteria. If the draft meets all standards on Attempt 1, it routes directly to `Final Lesson` with `overall_pass = true`.

### Scenario 2: Self-Correction Loop Scenario (Deliberate Remediation)
- **Concept:** Demonstrates the Evaluator catching realistic pedagogical flaws and the Generator correcting them on Attempt 2.
- **Flaws Simulated in Attempt 1:** High density of undefined jargon (`"dense vector embeddings"`, `"k-NN cosine similarity"`) and absence of a non-technical analogy.
- **Workflow Behavior:**
  1. Attempt 1 is audited: `jargon` and `examples` fail.
  2. Evaluator generates specific feedback: *"Define technical terms like vector embeddings immediately upon introduction and provide a relatable real-world analogy."*
  3. `Prepare Regeneration` increments attempt to `2`.
  4. Attempt 2 addresses every critique, defines terms in plain English, introduces an everyday library analogy, passes all 8 checks, and completes at `Final Lesson`.
- **Testing in n8n:** Add the following temporary instruction to the Generator prompt:
  ```text
  FOR DEMO ONLY:
  Introduce one obvious technical error about the topic in the lesson, while keeping the rest of the lesson unchanged.
  ```

### Scenario 3: Retry Limit Safeguard Scenario (Controlled Fallback)
- **Concept:** Demonstrates the system's termination guardrail when an explanation persistently fails quality criteria across all allowed attempts.
- **Workflow Behavior:**
  1. Attempt 1 fails $\to$ regenerates to Attempt 2.
  2. Attempt 2 fails $\to$ regenerates to Attempt 3.
  3. Attempt 3 fails $\to$ `Retry Limit` condition (`attempt < 3`) evaluates to `false`.
  4. Execution routes safely to `Failed Final Lesson`, outputting the latest draft alongside the complete failure diagnostic report.
- **Testing in n8n:** Add the following temporary instruction to the Lesson Evaluator prompt:
  ```text
  FOR TESTING ONLY:
  Set overall_pass to false for this evaluation, regardless of the lesson quality.
  ```

*(Note: In the full-stack web application, Scenarios 2 and 3 can be selected directly from the interactive "Test Scenarios" panel).*

---

## Importing the Workflow

### Option A: Importing into n8n (Native Automation Instance)

Follow these steps to import and run the workflow inside n8n:

1. **Launch n8n:** Start your local or hosted n8n instance (`n8n start` or Cloud dashboard).
2. **Import Workflow File:**
   - In the n8n left navigation bar, click **Workflows**.
   - Click the **...** menu (or **Add Workflow**) in the top right $\to$ select **Import from File**.
   - Choose the file named `Workflow` (or `Workflow.json`) located in the root of this repository.
3. **Configure Google Gemini Credentials:**
   - In the n8n canvas, locate the node named **Google Gemini Chat Model** connected to the Generator and Evaluator.
   - Click the node to open its settings.
   - Under **Credential for Google Gemini(PaLM) Api**, click **Create New Credential**.
   - Enter your **Google Gemini API Key** (obtainable free from [Google AI Studio](https://aistudio.google.com/apikey)).
   - Save the credential.
4. **Set Your Target Topic:**
   - Open the **Edit Fields** node (second node in the sequence).
   - Change the `topic` value to your desired subject (e.g., `"Introduction to RAG"`, `"CRISPR Gene Editing"`, or `"Quantum Computing"`).
   - Ensure `attempt` is set to `1`.
5. **Execute:**
   - Click **Execute workflow** at the bottom of the canvas.
   - Watch the nodes execute sequentially and inspect the output in `Final Lesson`.

### Option B: Running via the Full-Stack Web Application

The repository includes a ready-to-run interactive web application:

```bash
# 1. Clone repository
git clone https://github.com/AshishKhatri84/Self_Evaluating_Lesson_Content_Generator.git
cd Self_Evaluating_Lesson_Content_Generator

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open `http://localhost:3000` in your browser. You can enter any topic, select testing scenarios, inspect live evaluation logs, and download comparison reports.

---

## Updated Output & Export Formats

### 1. Terminal Node JSON Outputs

#### Successful Terminal Node: `Final Lesson`
```json
{
  "status": "passed",
  "lesson": "# Introduction to Retrieval-Augmented Generation (RAG)\n\nImagine you are taking an open-book exam...",
  "attempt": 1
}
```

#### Fallback Terminal Node: `Failed Final Lesson`
```json
{
  "status": "failed",
  "lesson": "# Advanced Theoretical Dissertation: Introduction to RAG\n\n...",
  "evaluation": {
    "output": {
      "overall_pass": false,
      "checks": [
        { "id": "topic_accuracy", "passed": true, "reason": "Accurately covers topic." },
        { "id": "beginner_friendly", "passed": false, "reason": "Uses post-graduate terminology." }
      ],
      "failed_checks": ["beginner_friendly", "jargon"],
      "regeneration_feedback": "Replace academic terminology with accessible vocabulary suitable for 12th-grade learners."
    }
  },
  "attempt": 3
}
```

### 2. Multi-Format Export Capabilities (Web App)

The application provides a comprehensive suite of client-side export options:

- **Formatted Text (`.txt` / Markdown):** Clean markdown file with structured headers, attempt versioning, and evaluator audit metadata.
- **Microsoft Word (`.doc`):** Fully styled HTML-based Word document with custom typography, callout boxes for metadata, and clean bullet lists.
- **PDF Document (`.pdf`):** Multi-page PDF generated client-side using `jsPDF`, featuring automatic page-break wrapping, colored header hierarchy, and page numbering.
- **Compare Drafts Side-by-Side Export (`.txt`, `.doc`, `.pdf`):**
  - Allows users to compare any two attempts side-by-side.
  - **Download Comparison Button:** Located on the right side of the **Compare Drafts Side-by-Side** toolbar.
  - Generates a comparison report detailing Draft A vs Draft B, the Evaluator critique on Attempt A, how the critique was resolved in Attempt B, and the complete 8-point rubric audit breakdown.
- **One-Click Clipboard Copy:** Copies the active lesson with instant visual confirmation.

---

## Evidence & Execution Screenshots

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

### Execution Traversal Paths

- **Successful Path:**  
  `Generator` $\longrightarrow$ `Store Generated Lesson` $\longrightarrow$ `Lesson Evaluator (true)` $\longrightarrow$ `If (true)` $\longrightarrow$ `Final Lesson`
- **Retry / Regeneration Path:**  
  `Lesson Evaluator (false)` $\longrightarrow$ `If (false)` $\longrightarrow$ `Retry Limit (attempt < 3)` $\longrightarrow$ `Prepare Regeneration` $\longrightarrow$ `Generator`
- **Exhausted Retries Path:**  
  `...` $\longrightarrow$ `Retry Limit (attempt >= 3)` $\longrightarrow$ `Failed Final Lesson`

---

## Security & Privacy Architecture

The system enforces strict security practices across both the n8n workflow and the full-stack web application:

### 1. Zero Credential Exposure
- **No Hardcoded Keys:** Neither the repository nor the exported workflow file (`Workflow`) contain API credentials.
- **Git Protection:** `.env` and local secrets are excluded via `.gitignore`.
- **Safe Video Demonstrations:** All credential fields and API tokens are redacted or obscured during recording.

### 2. Browser-Only Key Storage (Web App)
When users provide their own Google AI Studio API key in the web application:
- **Zero Server Storage:** Custom keys are **never stored** in any server-side database, disk file, or operational log.
- **Isolated Local Storage:** Stored exclusively in the user's private browser `localStorage` (`user_gemini_api_key`).
- **In-Memory Ephemeral Proxy:** The backend server only proxies the key in-memory via HTTPS directly to Google's official Gemini endpoint and immediately discards it.
- **1-Click Key Removal:** Users can instantly wipe their key anytime using the **"Clear Stored Key"** button.

### 3. Multi-Model Resilience & Rate Limiting
To prevent denial-of-service or pipeline failure during Google Gemini traffic spikes:
- Automatic model fallback hierarchy:
  $$\text{gemini-3.8-flash} \longrightarrow \text{gemini-3.6-flash} \longrightarrow \text{gemini-3.5-flash-lite}$$
- Transparent handling of `429 Too Many Requests` and `503 Service Unavailable` error codes.

---

## Project Structure

```text
├── Evidence/                    # Workflow execution screenshots & audit logs
│   ├── 01_Workflow_Overview.png
│   ├── 02_Generator_Prompt.png
│   ├── 03_Store_Generated_Lesson.png
│   ├── 04_Lesson_Evaluator_True.png
│   ├── 05_If_Pass_Fail_Routing.png
│   ├── 06_Final_Lesson_Output.png
│   ├── 07_Lesson_Evaluator_False.png
│   ├── 08_Retry_Limit.png
│   ├── 09_Prepare_Regeneration.png
│   ├── 10_Failed_Final_Lesson_Output.png
│   ├── 11_Retry-Regeneration_Flow.png
│   └── README.md
├── src/                         # React 19 + TypeScript frontend application
│   ├── App.tsx                  # Dashboard, modal viewer, comparison suite & export engine
│   ├── main.tsx                 # React DOM mount point
│   └── index.css                # Tailwind CSS global styles
├── server.ts                    # Node.js/Express full-stack runner & Gemini agentic pipeline
├── WORKFLOW DOCUMENTATION.md    # In-depth technical architecture documentation
├── Workflow                     # Standalone n8n workflow specification (JSON)
├── package.json                 # Project dependencies and npm scripts
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite bundler configuration
└── README.md                    # Project documentation (this file)
```

---

## Author & Acknowledgements

- **Created by:** [Ashish Khatri](https://github.com/AshishKhatri84)
- **Workflow Automation:** [n8n](https://n8n.io/)
- **AI Models:** Google Gemini (`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`) via `@google/genai`
- **Application Stack:** React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, jsPDF
