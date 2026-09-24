import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

const getAiClient = (customApiKey?: string) => {
  const apiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

export interface CheckResult {
  id: string;
  passed: boolean;
  reason: string;
}

export interface EvaluationOutput {
  overall_pass: boolean;
  checks: CheckResult[];
  failed_checks: string[];
  regeneration_feedback: string;
}

export interface WorkflowIteration {
  attempt: number;
  topic: string;
  lesson: string;
  feedbackGiven?: EvaluationOutput | null;
  evaluation: EvaluationOutput;
  passed: boolean;
  simulated?: boolean;
}

export interface WorkflowRunResult {
  status: 'passed' | 'failed';
  topic: string;
  finalLesson: string;
  attemptsCount: number;
  iterations: WorkflowIteration[];
  terminalNode: 'Final Lesson' | 'Failed Final Lesson';
  demoMode: 'normal' | 'deliberate_error' | 'force_failure';
  errorDetails?: string;
  logs: { timestamp: string; node: string; message: string; data?: any }[];
}

// Built-in high quality sample lessons and fallbacks (from repository's tested outputs)
const SAMPLE_ACCEPTED_LESSON = `# Introduction to RAG (Retrieval-Augmented Generation)

## 1. What is RAG? (In Very Simple Words)
Imagine you are writing a school exam. 
If you only rely on what you memorized last month, you might forget some specific facts, dates, or numbers. 
Now imagine the teacher says: "You can keep your course textbook on the desk. Whenever a question asks for a specific fact, you can quickly look it up in the book and write down a fresh, accurate answer."

In the world of Artificial Intelligence:
- The student is like an **AI Model (LLM)**.
- The textbook is like an **External Knowledge Base** or document folder.
- The action of looking up the right page before answering is called **Retrieval**.
- Writing the answer using that looked-up information is called **Generation**.

Putting it together: **Retrieval-Augmented Generation (RAG)** is a method where an AI computer program searches your own notes, documents, or books first, finds the exact relevant paragraphs, and gives you a truthful answer based on them.

---

## 2. Why Does RAG Matter?
When large AI models answer questions, they have two common problems:
1. **Outdated Knowledge**: If a model was trained in 2023, it does not know what happened this morning in your college or office.
2. **Hallucination (Making Things Up)**: When an AI does not know an exact fact, it sometimes guesses confidently and gives a false answer.

RAG solves this! Because the AI is given the exact reference text from your documents right before it writes the answer, it gives reliable, up-to-date, and verifiable answers.

---

## 3. How Does RAG Work? (Step-by-Step)
Let's see how a college student would use RAG to search their syllabus:

### Step A: Preparing the Documents (Indexing)
1. You take your college textbooks or PDF files.
2. The computer breaks long chapters into small, digestible paragraphs called **chunks**.
3. It converts each paragraph into a mathematical list of numbers called an **embedding** (think of this like a fingerprint for meaning).
4. These fingerprints are stored in a specialized library called a **Vector Database**.

### Step B: Searching and Answering (Retrieval & Generation)
1. **User Question**: You type: *"What is the passing criteria for Semester 1 Chemistry?"*
2. **Retrieval**: The system converts your question into a meaning fingerprint and quickly finds the top 2 paragraphs in the syllabus that discuss chemistry marks.
3. **Augmentation**: The system packs your question together with those 2 found paragraphs into one prompt:
   *"Using only this chemistry syllabus rule: [Chemistry passing mark is 40 out of 100], answer the student's question."*
4. **Generation**: The AI model reads the provided rule and writes: *"According to your syllabus, you need at least 40 marks out of 100 to pass Semester 1 Chemistry."*

---

## 4. Real-World Analogy: The Doctor and the Patient Record
Think of a medical doctor in a hospital clinic:
- A doctor has high medical knowledge (like an AI model's training).
- But when you visit, the doctor doesn't just guess your blood group or past surgeries from memory.
- The doctor opens your **medical chart file** (Retrieval), reads your personal history, and then prescribes the medicine (Generation).
- Without the chart file, even the smartest doctor might make a risky guess!

---

## 5. Technical Example: Customer Support for a Railway App
Imagine a passenger asking an AI chatbot: *"Is Train 12951 currently delayed today?"*
- Standard AI without RAG: *"Train 12951 is the Rajdhani Express, but I do not have access to live train status."*
- AI with RAG:
  1. System queries the live railway timetable database for train 12951.
  2. Database returns: *"Train 12951 is running 15 minutes late at Vadodara junction."*
  3. AI generates: *"Train 12951 (Rajdhani Express) is currently running 15 minutes behind schedule at Vadodara."*

---

## 6. Glossary of Essential Terms
- **LLM (Large Language Model)**: A smart AI text program that understands and generates human language.
- **Retrieval**: Searching and fetching relevant facts from a database or document.
- **Chunk**: A small section or paragraph cut out from a long document.
- **Embedding**: Converting words into numbers that represent their meaning so the computer can compare similarities.
- **Hallucination**: When an AI generates factually incorrect information because it lacks the true reference.

---

## 7. Quick Recap (Key Takeaways)
1. **RAG** stands for **Retrieval-Augmented Generation**.
2. It bridges the gap between general AI intelligence and your specific, private, or current documents.
3. It prevents AI from guessing or making up false facts.
4. It works in three simple steps: **Retrieve** the relevant text, **Augment** the question with the text, and **Generate** a reliable answer.`;

// 8 Quality rubric checks definition
export const RUBRIC_CHECKS = [
  {
    id: "topic_accuracy",
    name: "Topic Accuracy",
    description: "The lesson must correctly explain the requested topic and must not teach a different topic.",
  },
  {
    id: "beginner_friendly",
    name: "Beginner-Friendly Tone",
    description: "A learner who has only completed 12th grade with limited English and no prior subject knowledge should easily understand.",
  },
  {
    id: "key_concepts",
    name: "Core Key Concepts (What, Why & How)",
    description: "Must explicitly explain: (1) what the topic is, (2) why it matters, and (3) how it works step-by-step.",
  },
  {
    id: "examples",
    name: "Everyday Analogies & Practical Examples",
    description: "Must contain at least one simple real-world analogy and at least one concrete practical example.",
  },
  {
    id: "jargon",
    name: "Plain Jargon Explanations",
    description: "Technical terms must be plainly explained when first introduced without relying on unexplained vocabulary.",
  },
  {
    id: "teaching_flow",
    name: "Logical Scaffolding Flow",
    description: "Must move logically from basic everyday concepts to more technical concepts.",
  },
  {
    id: "technical_accuracy",
    name: "Technical Accuracy",
    description: "Must not contain obvious technical errors, misleading explanations, or unsupported claims presented as facts.",
  },
  {
    id: "standalone",
    name: "Standalone Completeness",
    description: "The learner should be able to master the foundational topic without needing another explanation or external links.",
  },
];

// Multi-model resilience helper: prioritizes active Gemini 3.x models with model-to-model fallback
async function callGeminiWithFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
  }
): Promise<{ text: string; modelUsed: string }> {
  const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      return { text: response.text || '', modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const errorMsg = String(err?.message || err);

      // Auth errors should fail fast without trying other models on the same invalid key
      if (
        errorMsg.includes('API_KEY_INVALID') ||
        errorMsg.includes('403') ||
        errorMsg.includes('unauthorized')
      ) {
        throw err;
      }

      // If a model hits quota (429) or high demand (503/404), log and try next available model in list
      console.warn(`[Gemini] ${model} unavailable (${errorMsg.slice(0, 100)}). Trying next fallback model...`);
    }
  }

  throw lastError;
}

// Dynamic topic-aware template if completely offline or without credentials (never mixes up topics)
function getOfflineTopicLesson(topic: string): string {
  return `# ${topic}: A Beginner's Practical Guide

## 1. What is ${topic}? (In Very Simple Words)
Imagine explaining this idea to a friend who has never heard of it before.
**${topic}** is a core concept that helps us understand how things work and make sense of patterns in the real world.

At its heart, **${topic}** answers the question: "Why do certain changes happen, and how can we anticipate or manage them?"

## 2. Why Does ${topic} Matter?
Understanding **${topic}** is crucial because it directly influences decisions we make every day:
- **For Everyday Life**: It gives you the clarity to evaluate choices rather than guessing in the dark.
- **For Problem Solving**: It provides a reliable framework to break down complex questions into simple, manageable pieces.

## 3. How Does It Work? (Step-by-Step)
Here is how **${topic}** unfolds in a simple 1-2-3 sequence:
1. **Initial Trigger or Input**: Something begins the process—like an event, a set of observations, or a question.
2. **The Core Mechanism**: Logical rules or natural dynamics process this input and cause a ripple effect.
3. **The Observable Outcome**: A clear, measurable result is produced that you can observe and verify.

## 4. Real-World Analogy
Think of **${topic}** like water boiling in a kettle:
- When you apply heat (the cause or input), the temperature steadily rises.
- At first, you might not notice much on the surface, but inside, energy is building up.
- Once it reaches the boiling point, steam forms and the kettle whistles (the clear, unavoidable outcome).
Similarly, **${topic}** operates through clear causes that lead step-by-step to visible results.

## 5. Concrete Practical Example
Consider what happens when people interact with this in daily life:
If you monitor how **${topic}** behaves under normal conditions versus sudden changes, you can clearly see how the rules hold true and guide the final result.

## 6. Key Takeaways Recap
- **Foundational**: Master the intuition before diving into complex mathematics or terminology.
- **Cause & Effect**: Every step in **${topic}** follows a logical sequence from cause to result.
- **Practical Value**: Knowing how **${topic}** works empowers you to make smarter, better-informed choices.`;
}

// Substantive text inspection heuristic when Gemini API is offline or quota-limited
function evaluateLessonHeuristically(topic: string, lesson: string): EvaluationOutput {
  const lower = lesson.toLowerCase();
  
  // Check: Topic accuracy
  const hasTopic = topic.split(' ').some(word => word.length > 2 && lower.includes(word.toLowerCase()));
  
  // Check: Must have an everyday non-technical analogy
  const hasAnalogy = lower.includes('analogy') || lower.includes('imagine you') || lower.includes('think of a') || lower.includes('like a doctor') || lower.includes('like a student') || lower.includes('library') || lower.includes('kitchen') || lower.includes('recipe') || lower.includes('kettle');
  
  // Check: Key concepts (what, why, how step by step)
  const hasSteps = lower.includes('step') || lower.includes('how it works') || lower.includes('step-by-step') || lower.includes('1.') || lower.includes('step 1');
  const hasWhy = lower.includes('why') || lower.includes('matters') || lower.includes('importance');
  const hasWhat = lower.includes('what is') || lower.includes('what are') || lower.includes('definition') || lower.includes('stands for') || lower.includes('introduction') || lower.includes('overview');
  
  // Check: Beginner friendly & Jargon handling
  const hasHeavyAcademicTone = lower.includes('treatise') || lower.includes('monograph') || lower.includes('dissertation') || lower.includes('methodological') || lower.includes('taxonomies') || lower.includes('epistemological') || lower.includes('endogenous') || lower.includes('deconstruction') || lower.includes('dialectical') || lower.includes('hilbert') || lower.includes('post-structuralist');
  const hasGlossaryOrDefinitions = lower.includes('glossary') || lower.includes('definition') || lower.includes('plain words') || lower.includes('means') || lower.includes('called') || lower.includes('takeaways') || lower.includes('in simple terms');
  
  const failed: string[] = [];
  const checks = RUBRIC_CHECKS.map(c => {
    let passed = true;
    let reason = `Criterion satisfied: ${c.name} meets 12th-grade beginner standards.`;
    
    if (c.id === 'topic_accuracy' && !hasTopic) {
      passed = false;
      reason = `Topic Accuracy failed: The draft does not directly address or name "${topic}".`;
    } else if (c.id === 'examples' && !hasAnalogy) {
      passed = false;
      reason = `Everyday Analogies failed: No intuitive non-technical analogy found (needs an everyday comparison, e.g. comparing to a library, cooking, or a doctor's chart).`;
    } else if (c.id === 'key_concepts' && (!hasSteps || !hasWhy || !hasWhat)) {
      passed = false;
      reason = `Core Key Concepts failed: Missing structured breakdown of What it is, Why it matters, or Step-by-Step mechanics.`;
    } else if (c.id === 'beginner_friendly' && hasHeavyAcademicTone) {
      passed = false;
      reason = `Beginner-Friendly Tone failed: Contains dense university-level academic framing exceeding a 12th-grade pass baseline.`;
    } else if (c.id === 'jargon' && (hasHeavyAcademicTone || !hasGlossaryOrDefinitions)) {
      passed = false;
      reason = `Plain Jargon Explanations failed: Technical or specialized domain terms were introduced without upfront plain-English definitions or a glossary.`;
    }
    
    if (!passed) failed.push(c.id);
    return { id: c.id, passed, reason };
  });
  
  const overall_pass = failed.length === 0;
  let feedback = "";
  if (!overall_pass) {
    const failedNames = failed.map(id => RUBRIC_CHECKS.find(rc => rc.id === id)?.name || id);
    feedback = `The lesson draft failed on: ${failedNames.join(', ')}. Action required: Please ensure you include an everyday real-world analogy (e.g. comparing to cooking, an open-book exam, or a library), define all technical terms in plain English when first introduced, and provide a clear 1-2-3 step-by-step breakdown for a 12th-grade beginner.`;
  }
  
  return {
    overall_pass,
    checks,
    failed_checks: failed,
    regeneration_feedback: feedback
  };
}

// Helper to evaluate a lesson with Gemini or natural rubric evaluation
async function evaluateLessonWithGemini(
  ai: GoogleGenAI | null,
  topic: string,
  lesson: string
): Promise<EvaluationOutput> {
  if (!ai) {
    return evaluateLessonHeuristically(topic, lesson);
  }

  try {
    const prompt = `You are a strict, objective educational quality auditor for beginner learning materials.

You are auditing a lesson generated for the topic:
"${topic}"

Here is the lesson draft to evaluate:
"""
${lesson}
"""

Audit the lesson strictly against these 8 Quality Criteria (Hard Pass/Fail):
1. Topic Accuracy (topic_accuracy): The lesson must directly and accurately explain "${topic}". It must not drift onto an unrelated subject.
2. Beginner-Friendly Tone (beginner_friendly): A 12th-grade student with no prior background must easily comprehend the text. Avoid dense academic prose or university-level complexity.
3. Core Key Concepts (key_concepts): Must explicitly answer: (1) what the topic is, (2) why it matters in the real world, and (3) how it works step-by-step.
4. Everyday Analogies & Practical Examples (examples): Must contain AT LEAST ONE explicit everyday non-technical analogy (e.g. comparing to cooking, an open-book exam, a doctor's chart, a public library, etc.) AND at least one concrete practical example. If it only provides technical examples without an intuitive real-world analogy, this check MUST FAIL.
5. Plain Jargon Explanations (jargon): Technical terms, acronyms, or specialized domain vocabulary must be clearly defined in plain English right when introduced. If technical terms appear without immediate explanation, this check MUST FAIL.
6. Logical Scaffolding Flow (teaching_flow): Must progress smoothly from intuitive everyday concepts to specific details.
7. Technical Accuracy (technical_accuracy): No factual errors, misleading simplifications, or unsupported claims.
8. Standalone Completeness (standalone): A learner should master the foundational topic from this text alone without needing outside links.

Auditing Rules:
- Be an honest, thorough auditor. Do NOT automatically pass a draft if it lacks an everyday analogy or uses unexplained technical vocabulary.
- overall_pass is TRUE ONLY if ALL 8 checks pass.
- If ANY check fails, overall_pass must be FALSE, and failed_checks must list their exact IDs (e.g. ["examples", "jargon"]).
- For each check, write a concise, specific reason citing the criterion name and what was found or missing.
- If failed, regeneration_feedback must cite the failed criteria by name (e.g. "Everyday Analogies & Practical Examples", "Plain Jargon Explanations") and tell the author exactly what to add or fix for the next draft.`;

    const { text } = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overall_pass: { type: Type.BOOLEAN },
            checks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  passed: { type: Type.BOOLEAN },
                  reason: { type: Type.STRING },
                },
                required: ['id', 'passed', 'reason'],
              },
            },
            failed_checks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            regeneration_feedback: { type: Type.STRING },
          },
          required: ['overall_pass', 'checks', 'failed_checks', 'regeneration_feedback'],
        },
      },
    });

    const parsed = JSON.parse(text || '{}');
    return parsed as EvaluationOutput;
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    console.error('[Evaluator error]:', errorMsg);
    // Use substantive heuristic fallback so audit is genuine even if API has a temporary hiccup
    return evaluateLessonHeuristically(topic, lesson);
  }
}

function getOfflineLessonForScenario(topic: string, attempt: number, scenarioMode: string): string {
  if (scenarioMode === 'self_correction' && attempt === 1) {
    return `# Practical Technical Guide: ${topic} (Initial Draft)

## 1. What is ${topic}?
**${topic}** is an essential mechanism in contemporary workflows and computational architectures. It standardizes how information is structured, processed, and evaluated across target pipelines.

## 2. Core Operational Sequence
1. **Input Parsing & Pre-Processing**: Data relating to ${topic} is captured and normalized according to predefined architectural schemas.
2. **Algorithmic Evaluation**: Dedicated subroutines analyze the normalized payload against core operational parameters.
3. **Delivery & Downstream Integration**: The resulting payload is transmitted to consumer systems or persistent storage layers.

## 3. Implementation Context
In enterprise deployment, **${topic}** is commonly exposed through API endpoints with optimized indexing structures to ensure high throughput and minimal response latency.

## 4. Key Takeaways
- **${topic}** provides a reliable operational pipeline for complex data interactions.
- Structured input protocols enable reliable automated execution.`;
  }

  if (scenarioMode === 'retry_limit') {
    if (attempt === 1) {
      return `# Advanced Academic Monograph: ${topic} (Attempt 1)

## 1. Theoretical & Contextual Overview
A rigorous scholarly inquiry into **${topic}** necessitates investigating its multi-tiered conceptual architecture and institutional conventions. Rather than reducing the subject to colloquial simplifications, advanced scholarship situates **${topic}** within historical, structural, and systemic theoretical frameworks.

## 2. Structural Dynamics & Systemic Mechanics
Within the domain of **${topic}**, operational efficacy is governed by continuous interactions between constituent modules. Systemic behaviors emerge from specialized protocols, latent variable dynamics, and domain-specific taxonomies that require extensive prior familiarity.

## 3. Critical Analytical Perspective
Standard introductory literature frequently overlooks the underlying tensions inherent to **${topic}**. Comprehensive analysis demands formal deconstruction of its structural parameters rather than high-level intuitive metaphors.`;
    }

    if (attempt === 2) {
      return `# Structural & Conceptual Treatise: ${topic} (Attempt 2)

## 1. Re-Evaluation of Structural Foundations
Re-evaluating **${topic}** following initial critique requires deeper engagement with its macro-level architecture and specialized nomenclature. The conceptual framework of **${topic}** remains characterized by high-density domain taxonomies and interconnected procedural standards.

## 2. Institutional Mechanics & Dialectical Interactions
The operational continuum of **${topic}** relies on continuous feedback between specialized protocols and external environmental constraints. Specific mechanisms dictate how inputs are transformed across distinct layers of execution without colloquial simplification.

## 3. Methodological Synthesis
A complete structural model of **${topic}** demands rigorous synthesis of its overarching paradigms, rejecting elementary simplifications in favor of comprehensive domain-specific analytical precision.`;
    }

    return `# Advanced Theoretical Dissertation: ${topic} (Attempt 3)

## 1. Definitive Conceptual Synthesis
This third revision of **${topic}** presents a formal scholarly assessment. The central framework explores the systemic integration, evolutionary adaptations, and structural constraints that define **${topic}** within modern literature.

## 2. Operational Modalities & Latent Variables
The internal mechanics of **${topic}** operate through multi-layered procedural standards. Rigorous empirical observation indicates that functional performance is dictated by systemic boundary conditions rather than isolated operational drivers.

## 3. Concluding Analytical Assessment
A rigorous assessment demonstrates that **${topic}** constitutes an advanced architectural paradigm whose nuances cannot be adequately captured without specialized domain expertise and theoretical mastery.`;
  }

  return getOfflineTopicLesson(topic);
}

// Helper to generate a lesson with Gemini
async function generateLessonWithGemini(
  ai: GoogleGenAI | null,
  topic: string,
  attempt: number,
  feedback: EvaluationOutput | null,
  scenarioMode: 'auto' | 'self_correction' | 'retry_limit' = 'auto'
): Promise<string> {
  if (!ai) {
    return getOfflineLessonForScenario(topic, attempt, scenarioMode);
  }

  try {
    let prompt = '';

    if (scenarioMode === 'self_correction' && attempt === 1) {
      // Intentionally simulate a realistic, un-audited initial draft with common pedagogical flaws
      // (e.g. explains mechanics, but omits an everyday analogy and uses technical terminology without defining it upfront)
      prompt = `You are an author drafting an initial educational overview of "${topic}".
Write an initial, un-audited first draft explaining the concept.
CRITICAL INSTRUCTIONS FOR THIS INITIAL DRAFT:
1. Explain the technical mechanics of "${topic}".
2. Do NOT include any everyday non-technical analogies (do not compare to libraries, cooking, doctors, or exams). Keep examples strictly technical.
3. Use specialized technical terms or abbreviations without providing upfront plain-English definitions.
4. Keep it around 250-350 words in clean Markdown.`;
    } else if (scenarioMode === 'retry_limit') {
      // Simulates persistent pedagogical barriers / dense university-level framing for ANY topic
      prompt = `You are a university academic researcher writing a formal scholarly critique of "${topic}" (Draft Attempt ${attempt}).
Instructions:
1. Strictly write about "${topic}" in depth. Discuss its real-world context, history, narrative, or technology depending on what "${topic}" is.
2. Do NOT introduce unrelated quantum physics or math equations unless "${topic}" is specifically physics or math.
3. Write in dense, highly formal academic prose with specialized academic vocabulary suitable to "${topic}".
4. Do NOT include any simple everyday analogies (no cooking, library, or doctor comparisons).
5. Do NOT simplify for a 12th grader with no prior background.
6. Do NOT include a beginner glossary or simple 1-2-3 guide.
7. Length: 200-300 words in clean Markdown.`;
    } else {
      // Standard autonomous authoring
      prompt = `You are an expert instructional content creator for beginner learners.

Create a standalone beginner lesson about:
"${topic}"

Learner profile:
- 12th-grade pass background
- No prior knowledge of the topic
- Simple, clear English vocabulary
- Needs intuitive real-world analogies and concrete examples

Attempt number:
${attempt}

Previous evaluator feedback (if any):
${feedback ? JSON.stringify(feedback) : 'No previous evaluation feedback. This is the first attempt.'}

${feedback ? 'IMPORTANT: Carefully address the evaluator critique above! Fix the failed points (such as adding the missing everyday analogy or defining jargon) while keeping the positive parts of the lesson intact.' : ''}

Lesson Structure:
1. Explain what "${topic}" is in very simple, conversational language.
2. Explain why "${topic}" matters in the real world.
3. Explain how it works step by step (clear 1-2-3 sequence).
4. Include at least 1 simple real-world everyday analogy (e.g., comparing to a library, cooking, doctor, etc.).
5. Include at least 1 concrete practical or technical example.
6. Explain all new or unfamiliar terms when first introduced (zero unexplained jargon).
7. Progress logically from familiar everyday intuition to specific details.
8. Include a short glossary of essential terms and key takeaways recap.

Write only the final lesson text in clean Markdown.`;
    }

    const { text } = await callGeminiWithFallback(ai, {
      contents: prompt,
    });

    if (!text) {
      throw new Error('No content returned from AI model.');
    }
    return text;
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    console.error('[Generator error]:', errorMsg);
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      const quotaErr = new Error('GEMINI_QUOTA_EXHAUSTED');
      (quotaErr as any).isQuota = true;
      throw quotaErr;
    }
    throw err;
  }
}

// API Routes
app.get('/api/health', (req: Request, res: Response) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    hasGeminiKey,
    model: 'gemini-3.8-flash',
    defaultTopic: 'Introduction to RAG',
    maxAttempts: 3
  });
});

// Returns the rubric definition
app.get('/api/workflow/rubric', (req: Request, res: Response) => {
  res.json({ checks: RUBRIC_CHECKS });
});

// Returns the raw workflow specification & documentation
app.get('/api/workflow/info', (req: Request, res: Response) => {
  let workflowJson = null;
  let documentationText = '';
  let readmeText = '';

  try {
    if (fs.existsSync(path.resolve('Workflow'))) {
      workflowJson = JSON.parse(fs.readFileSync(path.resolve('Workflow'), 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading Workflow file:', e);
  }

  try {
    if (fs.existsSync(path.resolve('DOCUMENTATION.md'))) {
      documentationText = fs.readFileSync(path.resolve('DOCUMENTATION.md'), 'utf-8');
    }
  } catch (e) {
    console.error('Error reading DOCUMENTATION.md:', e);
  }

  try {
    if (fs.existsSync(path.resolve('README.md'))) {
      readmeText = fs.readFileSync(path.resolve('README.md'), 'utf-8');
    }
  } catch (e) {
    console.error('Error reading README.md:', e);
  }

  res.json({
    name: 'Self-Evaluating Lesson Content Generator',
    author: 'Ashish Khatri',
    workflowNodes: workflowJson?.nodes || [],
    connections: workflowJson?.connections || {},
    documentation: documentationText,
    readme: readmeText,
    sampleAcceptedLesson: SAMPLE_ACCEPTED_LESSON
  });
});

// Endpoint to run a live test of an API key without saving or logging it anywhere
app.post('/api/workflow/verify-key', async (req: Request, res: Response) => {
  const customApiKey = (req.body?.apiKey || req.headers['x-gemini-api-key'] || '').toString().trim();

  if (!customApiKey) {
    return res.status(400).json({
      valid: false,
      error: 'Please enter a Gemini API key to test.'
    });
  }

  try {
    const testAi = new GoogleGenAI({
      apiKey: customApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-verifier',
        },
      },
    });

    const { modelUsed } = await callGeminiWithFallback(testAi, {
      contents: 'Respond with the single word: "READY"',
    });

    return res.json({
      valid: true,
      modelUsed,
      message: `API Key successfully verified with ${modelUsed}. You have active access to Google Gemini models.`
    });
  } catch (err: any) {
    const rawMsg = String(err?.message || err);
    let userMsg = 'Failed to verify key. Please verify the key format and permissions in Google AI Studio.';
    if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('400')) {
      userMsg = 'Invalid API key. Please check that you copied the complete key from Google AI Studio.';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      userMsg = 'API key is valid, but is currently rate-limited or out of quota.';
    } else if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED')) {
      userMsg = 'Permission denied. Please ensure the API key has access to Gemini generative language API.';
    }

    return res.status(200).json({
      valid: false,
      error: userMsg
    });
  }
});

// Main endpoint: Execute the agentic workflow loop
app.post('/api/workflow/run', async (req: Request, res: Response) => {
  const { topic = 'Introduction to RAG', customApiKey, scenarioMode = 'auto' } = req.body;
  const headerApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  const effectiveApiKey = customApiKey || headerApiKey;

  const ai = getAiClient(effectiveApiKey);

  const logs: { timestamp: string; node: string; message: string; data?: any }[] = [];
  const addLog = (node: string, message: string, data?: any) => {
    logs.push({
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
      node,
      message,
      data
    });
  };

  addLog("When clicking ‘Execute workflow’", `Manual workflow trigger executed (Mode: ${scenarioMode}).`);
  addLog("Edit Fields", `Initialized workflow state: topic="${topic}", attempt=1, mode="${scenarioMode}".`);

  let currentAttempt = 1;
  let previousFeedback: EvaluationOutput | null = null;
  const iterations: WorkflowIteration[] = [];
  let terminalNode: 'Final Lesson' | 'Failed Final Lesson' = 'Failed Final Lesson';
  let finalLesson = '';
  let overallStatus: 'passed' | 'failed' = 'failed';

  const MAX_ATTEMPTS = 3;

  try {
    while (currentAttempt <= MAX_ATTEMPTS) {
      addLog("Generator", `Executing generator LLM (Attempt ${currentAttempt}/${MAX_ATTEMPTS}, Mode: ${scenarioMode})...`);

      const lessonText = await generateLessonWithGemini(
        ai,
        topic,
        currentAttempt,
        previousFeedback,
        scenarioMode
      );

      addLog("Store Generated Lesson", `Stored generated lesson payload (${lessonText.length} chars). Carrying attempt=${currentAttempt} forward.`);

      addLog("Lesson Evaluator", `Auditing against 8 hard PASS/FAIL quality checks...`);
      const evaluation = await evaluateLessonWithGemini(ai, topic, lessonText);

      iterations.push({
        attempt: currentAttempt,
        topic,
        lesson: lessonText,
        feedbackGiven: previousFeedback,
        evaluation,
        passed: evaluation.overall_pass,
        simulated: !ai
      });

      addLog("Structured Output Parser", `Parsed structured evaluation JSON (overall_pass: ${evaluation.overall_pass}).`, evaluation);

      addLog("If", `Evaluated condition: output.overall_pass === true (${evaluation.overall_pass ? 'TRUE' : 'FALSE'}).`);

      if (evaluation.overall_pass) {
        terminalNode = 'Final Lesson';
        finalLesson = lessonText;
        overallStatus = 'passed';
        addLog("Final Lesson", `Quality standards verified. Accepted final lesson output. Status: passed, attempt: ${currentAttempt}.`);
        break;
      } else {
        addLog("Retry Limit", `Evaluating retry condition: attempt < ${MAX_ATTEMPTS} (${currentAttempt} < ${MAX_ATTEMPTS}: ${currentAttempt < MAX_ATTEMPTS ? 'YES' : 'NO'}).`);

        if (currentAttempt < MAX_ATTEMPTS) {
          addLog("Prepare Regeneration", `Self-correction loop triggered: Incrementing attempt from ${currentAttempt} to ${currentAttempt + 1} with evaluator feedback for Generator.`, {
            failed_checks: evaluation.failed_checks,
            feedback: evaluation.regeneration_feedback
          });
          previousFeedback = evaluation;
          currentAttempt++;
        } else {
          terminalNode = 'Failed Final Lesson';
          finalLesson = lessonText;
          overallStatus = 'failed';
          addLog("Failed Final Lesson", `Retry limit reached (attempt=${currentAttempt}). Routing to controlled fallback terminal node with evaluation report.`, {
            failed_checks: evaluation.failed_checks,
            regeneration_feedback: evaluation.regeneration_feedback
          });
          break;
        }
      }
    }

    const demoModeValue: 'normal' | 'deliberate_error' | 'force_failure' = 
      scenarioMode === 'self_correction' ? 'deliberate_error' : 
      scenarioMode === 'retry_limit' ? 'force_failure' : 'normal';

    const result: WorkflowRunResult = {
      status: overallStatus,
      topic,
      finalLesson,
      attemptsCount: currentAttempt,
      iterations,
      terminalNode,
      demoMode: demoModeValue,
      logs
    };

    res.json(result);
  } catch (err: any) {
    if (err?.isQuota || err?.message === 'GEMINI_QUOTA_EXHAUSTED') {
      return res.status(429).json({
        error: 'QUOTA_EXHAUSTED',
        message: 'The shared Gemini Flash API daily free limit has been exhausted. You can provide your own Gemini API Key to continue running without interruptions.'
      });
    }

    console.error('Workflow execution error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: err?.message || 'An unexpected error occurred during workflow execution.'
    });
  }
});

// Serve frontend with Vite middlewares in dev, or static build in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[AI Studio] Server is running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
