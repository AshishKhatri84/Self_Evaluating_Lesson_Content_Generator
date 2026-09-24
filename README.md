# Self-Evaluating Lesson Content Generator

An autonomous agentic workflow and interactive web application that generates beginner-friendly educational lessons on any topic, rigorously audits them against an 8-point quality rubric, and automatically self-corrects using evaluator feedback loops.

![Agentic Workflow Overview](Evidence/01_Workflow_Overview.png)

---

## Overview

Traditional LLM generators frequently suffer from hallucinations, unexplained technical jargon, or uneven teaching flow. The **Self-Evaluating Lesson Content Generator** solves this by implementing an autonomous **Generator-Evaluator Agentic Feedback Loop**:

1. **Content Generator**: Creates a structured, beginner-level lesson tailored for high school graduates with limited technical vocabulary.
2. **Evaluator Agent**: Audits the draft against **8 hard PASS/FAIL quality checks** using structured JSON output schemas.
3. **Autonomous Routing**:
   - If **all 8 checks pass** $\to$ Immediately accepts and outputs the **Final Lesson**.
   - If **any check fails** $\to$ Automatically extracts specific remediation feedback and re-prompts the Generator for an improved draft (bounded by a maximum 3-attempt safety limit).
   - If retry limit is reached $\to$ Delivers a controlled **Failed Final Lesson** terminal output with full audit history.

Originally engineered as an **n8n agentic workflow**, the project now features a **full-stack web application** with an interactive dashboard, live workflow monitoring, multi-format export capabilities (Word, PDF, Text), and optional client-side API key management.

---

## Workflow Video Walkthrough

A comprehensive video walkthrough demonstrating the workflow architecture, execution paths, and self-correction behavior is available:

📹 **[https://drive.google.com/file/d/15yYll0uGifpvhGQJLQHGvmUfIn4XGkDP/view?usp=drive_link](https://drive.google.com/file/d/15yYll0uGifpvhGQJLQHGvmUfIn4XGkDP/view?usp=drive_link))** 

### Walkthrough Chapters & Demonstration Structure

| Chapter | Topic | What is Demonstrated |
|---|---|---|
| **Part 1** | **Architecture & Node Topology** | Tour of the complete n8n canvas: Manual Trigger $\to$ Edit Fields $\to$ Generator $\to$ Store Generated Lesson $\to$ Evaluator $\to$ Structured Output Parser $\to$ If Router $\to$ Retry Limit $\to$ Prepare Regeneration $\to$ Final Lesson / Failed Final Lesson. |
| **Part 2** | **Successful First-Pass Execution** | Execution with `topic = "Introduction to RAG"`. Demonstrates all 8 rubric checks passing (`overall_pass = true`), routing through the `If (TRUE)` branch, and delivering the verified `Final Lesson` on Attempt 1. |
| **Part 3** | **Regeneration & Self-Correction Loop** | Demonstrating the self-correction mechanism: Evaluator detects missing analogies and unexplained technical jargon, routing through `Retry Limit` $\to$ `Prepare Regeneration` (`attempt = 2`), prompting the Generator with feedback, and producing a perfected lesson that passes all 8 checks. |
| **Part 4** | **Retry Limit Safeguard Execution** | Demonstrates the bounded guardrail: persistent failures across 3 iterations safely route to `Failed Final Lesson` with complete diagnostic feedback instead of entering an infinite loop. |

---

## Key Features

### 1. Interactive Web Application
- **Topic Input for Any Domain**: Generate lessons on cutting-edge AI (RAG, Vector Embeddings, Prompt Engineering), science (Photosynthesis, CRISPR), economics (Inflation, Compound Interest), or daily life concepts.
- **Interactive Results Modal**: View the complete lesson, inspect check-by-check pass/fail scores with detailed reasoning, and review real-time execution logs.
- **Multi-Format Export Suite**:
  - **Formatted Text**: Clean Markdown file with full headers and structure.
  - **Microsoft Word (`.doc`)**: Styled HTML-based Word document with clean typography.
  - **PDF Export**: Clean, multi-page formatted document generated via `jspdf`.
  - **One-Click Clipboard Copy**: Instantly copy the complete text.
- **Workflow State & Log Monitor**: View timestamped logs of each node execution (Generator, Storage, Evaluator, Parser, Routing).

### 2. Multi-Model Resilience
- Automatically navigates Google Gemini service demand spikes by falling back across models:
  $$\text{gemini-3.8-flash} \longrightarrow \text{gemini-3.6-flash} \longrightarrow \text{gemini-3.5-flash-lite}$$
- Ensures reliable, uninterrupted generation even during high global API traffic.

### 3. Optional Gemini API Key & Privacy Guarantee
- Users can run using the shared environment or provide their own Google AI Studio API key.
- **Live Key Connection Test**: Verify any key with a live ping before saving.
- **Privacy & Security Guarantee**:
  - **Zero Server Storage**: Your key is never saved to any database, file system, or server log.
  - **Browser-Only Storage**: Stored exclusively inside your local browser's private `localStorage`.
  - **Ephemeral In-Flight Proxy**: Forwarded in-memory over encrypted HTTPS solely to Google's official Gemini endpoint.
  - **1-Click Erase**: Wipe stored credentials instantly anytime with the "Clear Stored Key" button.

---

## The 8-Point Quality Evaluation Rubric

Every lesson draft is strictly audited by the Evaluator Agent against 8 hard PASS/FAIL criteria:

| # | Check ID | Criterion | Requirement |
|:---:|---|---|---|
| **1** | `topic_accuracy` | **Topic Accuracy** | Must correctly explain the requested topic and never drift off-subject. |
| **2** | `beginner_friendly` | **Beginner Friendly** | 12th-grade pass level; accessible vocabulary, clear phrasing, zero assumed background. |
| **3** | `key_concepts` | **Core Concepts** | Must answer: (1) What it is, (2) Why it matters, and (3) How it works step-by-step. |
| **4** | `examples` | **Analogies & Examples** | Must include at least 1 intuitive real-world analogy and 1 concrete practical example. |
| **5** | `jargon` | **Jargon Control** | Unfamiliar or technical terms must be defined immediately upon introduction. |
| **6** | `teaching_flow` | **Logical Flow** | Must progress smoothly from familiar everyday intuition to technical details. |
| **7** | `technical_accuracy` | **Technical Accuracy** | No factual errors, unsupported claims, or misleading oversimplifications. |
| **8** | `standalone` | **Standalone Mastery** | Complete enough that a learner needs no outside references or links to grasp the fundamentals. |

> **Rule:** `overall_pass` is **TRUE** if and only if **all 8 checks pass**. A single failure triggers the feedback-driven regeneration loop.

---

## Agentic Architecture & Node Responsibilities

```text
               ┌──────────────────────────────┐
               │ When clicking 'Execute'      │
               └──────────────┬───────────────┘
                              ▼
               ┌──────────────────────────────┐
               │ Edit Fields (Topic, Attempt) │
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
        └─────────────────────────┘                                  │
         (Feedback & incremented attempt loop back to Generator) ────┘
```

| Node | Type | Function |
|---|---|---|
| **Manual Trigger** | Trigger | Initiates the workflow run |
| **Edit Fields** | Transform | Sets `topic` and initializes `attempt = 1` |
| **Generator** | LLM Task | Drafts the lesson using pedagogical guidelines and previous feedback |
| **Store Lesson** | State | Caches the latest draft and forwards attempt metadata |
| **Lesson Evaluator** | LLM Evaluator | Audits against the 8 pass/fail checks |
| **Structured Output Parser** | Parser | Enforces structured JSON output schema |
| **If Router** | Logic | Routes to **Final Lesson** on pass, or **Retry Limit** on fail |
| **Retry Limit** | Guard | Verifies `attempt < 3` to guarantee bounded, non-infinite execution |
| **Prepare Regeneration** | State | Increments attempt (`attempt + 1`) and bundles evaluator feedback for the Generator |
| **Final Lesson** | Terminal | Returns verified, quality-assured lesson output |
| **Failed Final Lesson** | Terminal | Delivers final draft with diagnostic evaluation report when retries are exhausted |

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
│   └── 11_Retry-Regeneration_Flow.png
├── src/                         # Frontend React + TypeScript application
│   ├── App.tsx                  # Dashboard, landing page, modal viewer, and export tools
│   ├── main.tsx                 # React DOM mount
│   └── index.css                # Global Tailwind CSS styling
├── server.ts                    # Full-stack Node/Express engine & Gemini workflow runner
├── DOCUMENTATION.md             # In-depth technical architecture documentation
├── Workflow                     # Original n8n workflow specification (JSON)
├── package.json                 # Project dependencies and run scripts
└── README.md                    # Project documentation
```

---

## Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **Google Gemini API Key** (Free tier available at [Google AI Studio](https://aistudio.google.com/apikey))

### 1. Clone & Install
```bash
git clone https://github.com/AshishKhatri84/Self_Evaluating_Lesson_Content_Generator.git
cd Self_Evaluating_Lesson_Content_Generator
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=3000
```
*(Note: You can also start the app without setting `GEMINI_API_KEY` in `.env` and enter your key directly in the web UI settings modal).*

### 3. Run the Development Server
```bash
npm run dev
```
Open your browser and navigate to:
```text
http://localhost:3000
```

### 4. Build for Production
```bash
npm run build
npm start
```

---

## Importing into n8n (Optional)

If you wish to inspect or execute the standalone workflow inside an **n8n** automation instance:

1. Start your n8n instance (local or hosted).
2. Click **Add Workflow** $\to$ **Import from File**.
3. Select the file named `Workflow` (or `Workflow.json`) in the root directory.
4. Set up your **Google Gemini** credentials under **Credentials** $\to$ **Google PaLM / Gemini Chat Model**.
5. Set your topic in the **Edit Fields** node and click **Execute workflow**.

---

## Author & Acknowledgements

- **Created by:** [Ashish Khatri](https://github.com/AshishKhatri84)
- **AI Engine:** Google Gemini (`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`) via `@google/genai`
- **Frontend Stack:** React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, jsPDF
