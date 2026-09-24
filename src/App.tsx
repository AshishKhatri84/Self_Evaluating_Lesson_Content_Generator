import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Copy,
  Check,
  X,
  FileText,
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  HelpCircle,
  Layers,
  Key,
  Lock,
  ExternalLink,
  Printer,
  FileCode,
  CheckCheck,
  Globe,
  Cpu,
  Coins,
  Microscope,
  Info,
  RefreshCw,
  Zap,
  ShieldAlert,
  GitCompare,
  Download,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CheckItem {
  id: string;
  passed: boolean;
  reason: string;
}

interface EvaluationOutput {
  overall_pass: boolean;
  checks: CheckItem[];
  failed_checks: string[];
  regeneration_feedback: string;
}

interface WorkflowIteration {
  attempt: number;
  topic: string;
  lesson: string;
  feedbackGiven?: EvaluationOutput | null;
  evaluation: EvaluationOutput;
  passed: boolean;
  simulated?: boolean;
}

interface WorkflowRunResult {
  status: 'passed' | 'failed';
  topic: string;
  finalLesson: string;
  attemptsCount: number;
  iterations: WorkflowIteration[];
  terminalNode: 'Final Lesson' | 'Failed Final Lesson';
  logs: { timestamp: string; node: string; message: string; data?: any }[];
}

export const RUBRIC_TITLES: Record<string, string> = {
  topic_accuracy: 'Topic Accuracy',
  beginner_friendly: 'Beginner-Friendly Tone',
  key_concepts: 'Core Key Concepts (What, Why & How)',
  examples: 'Everyday Analogies & Practical Examples',
  jargon: 'Plain Jargon Explanations',
  teaching_flow: 'Logical Scaffolding Flow',
  technical_accuracy: 'Technical Accuracy',
  standalone: 'Standalone Completeness'
};

const RUBRIC_DETAILS = [
  {
    id: 'topic_accuracy',
    title: 'Topic Accuracy',
    summary: 'Accurately and strictly explains the requested topic without straying.',
    details: 'Ensures the model stays on target for any subject chosen, without drifting into unrelated generalities.'
  },
  {
    id: 'beginner_friendly',
    title: 'Beginner-Friendly Tone',
    summary: 'Tailored for a 12th-grade pass student with no prior subject background and simple vocabulary.',
    details: 'Language is simple, encouraging, and free from intimidating academic barriers.'
  },
  {
    id: 'key_concepts',
    title: 'Core Key Concepts (What, Why & How)',
    summary: 'Systematically covers: (1) what it is, (2) why it matters, and (3) step-by-step how it works.',
    details: 'Builds a complete, well-rounded mental model so the student grasps motivation and mechanics.'
  },
  {
    id: 'examples',
    title: 'Everyday Analogies & Practical Examples',
    summary: 'Must contain at least 1 relatable real-world analogy and 1 concrete practical example.',
    details: 'Connects abstract ideas to familiar everyday experiences like cooking, a library, or a doctor.'
  },
  {
    id: 'jargon',
    title: 'Plain Jargon Explanations',
    summary: 'Every new technical term is plainly defined when first introduced.',
    details: 'No assumed prerequisites. Concepts are demystified immediately before they are applied.'
  },
  {
    id: 'teaching_flow',
    title: 'Logical Scaffolding Flow',
    summary: 'Progresses smoothly from everyday intuition to deeper technical details.',
    details: 'Prevents cognitive overload by introducing simple concepts first and layering complexity naturally.'
  },
  {
    id: 'technical_accuracy',
    title: 'Technical Accuracy',
    summary: 'Free of technical fallacies, misconceptions, or false claims presented as facts.',
    details: 'Strictly audited to prevent AI hallucinations or misleading oversimplifications.'
  },
  {
    id: 'standalone',
    title: 'Standalone Completeness',
    summary: 'Self-contained lesson with key takeaways and summary for independent learning.',
    details: 'The learner fully understands the core subject without needing external links or supplementary books.'
  }
];

export default function App() {
  const [topic, setTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepText, setCurrentStepText] = useState('Initializing...');
  
  // Results Pop-up Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'lesson' | 'compare' | 'evaluation' | 'logs'>('lesson');
  const [runResult, setRunResult] = useState<WorkflowRunResult | null>(null);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState(0);
  const [compareBaseIndex, setCompareBaseIndex] = useState(0);
  const [compareTargetIndex, setCompareTargetIndex] = useState(1);
  const [compareExportOpen, setCompareExportOpen] = useState(false);

  const currentAttempt = runResult?.iterations[selectedAttemptIndex] || runResult?.iterations[0];
  const activeLesson = currentAttempt?.lesson || runResult?.finalLesson || '';

  // Workflow Scenario Mode: 'auto' | 'self_correction' | 'retry_limit'
  const [scenarioMode, setScenarioMode] = useState<'auto' | 'self_correction' | 'retry_limit'>('auto');

  // Copy feedback
  const [copyStatus, setCopyStatus] = useState(false);

  // Custom Gemini API Key & Quota Management
  const [customApiKey, setCustomApiKey] = useState('');
  const [tempApiKeyInput, setTempApiKeyInput] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [quotaExhaustedNotice, setQuotaExhaustedNotice] = useState<string | null>(null);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [apiKeyTestResult, setApiKeyTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Load custom API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('user_gemini_api_key');
    if (savedKey) {
      setCustomApiKey(savedKey);
      setTempApiKeyInput(savedKey);
    }
  }, []);

  const handleTestApiKey = async () => {
    const keyToTest = tempApiKeyInput.trim();
    if (!keyToTest) {
      setApiKeyTestResult({
        valid: false,
        message: 'Please enter or paste an API key first before running the test.'
      });
      return;
    }

    setIsTestingApiKey(true);
    setApiKeyTestResult(null);

    try {
      const res = await fetch('/api/workflow/verify-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey: keyToTest })
      });

      const data = await res.json();
      if (data.valid) {
        setApiKeyTestResult({
          valid: true,
          message: data.message || 'API Key is verified and connected to Google Gemini!'
        });
      } else {
        setApiKeyTestResult({
          valid: false,
          message: data.error || 'Verification failed. Please double check your API key.'
        });
      }
    } catch {
      setApiKeyTestResult({
        valid: false,
        message: 'Could not connect to verification endpoint. Please verify server connection.'
      });
    } finally {
      setIsTestingApiKey(false);
    }
  };

  const handleSaveApiKey = () => {
    const trimmed = tempApiKeyInput.trim();
    setCustomApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('user_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('user_gemini_api_key');
    }
    setIsApiKeyModalOpen(false);
    setQuotaExhaustedNotice(null);
    setApiKeyTestResult(null);
  };

  const handleClearApiKey = () => {
    setCustomApiKey('');
    setTempApiKeyInput('');
    localStorage.removeItem('user_gemini_api_key');
    setApiKeyTestResult(null);
  };

  // Sample Topics organized by category (showing any topic can be explored!)
  const topicCategories = [
    {
      category: 'In-Demand AI & Tech',
      icon: Cpu,
      items: ['Introduction to RAG', 'Vector Embeddings', 'Prompt Engineering', 'How LLMs Predict Words', 'Fine-Tuning vs RAG']
    },
    {
      category: 'Science & Nature',
      icon: Microscope,
      items: ['How Photosynthesis Works', 'CRISPR Gene Editing', 'Quantum Computing Basics', 'Solar Energy Cells']
    },
    {
      category: 'Economics & Everyday Life',
      icon: Coins,
      items: ['What is Inflation?', 'Compound Interest Explained', 'How the Internet Works', 'Blockchain Basics']
    }
  ];

  const triggerExecution = async (customTopic?: string, overrideScenarioMode?: 'auto' | 'self_correction' | 'retry_limit') => {
    const activeScenario = overrideScenarioMode || scenarioMode;
    const topicToRun = customTopic || topic;
    if (!topicToRun.trim()) return;

    setIsRunning(true);
    setQuotaExhaustedNotice(null);
    setCurrentStepText('Generating initial beginner lesson with 12th-grade pedagogical profile...');

    const steps = activeScenario === 'self_correction'
      ? [
          'Drafting initial lesson (with natural first-draft pedagogical flaws)...',
          'Storing Attempt 1 draft & handing to strict Lesson Evaluator...',
          'Lesson Evaluator auditing: detecting missing analogy & jargon...',
          'Passing evaluator critique into Generator for Attempt 2 self-correction...',
          'Finalizing accepted lesson & verified audit report...'
        ]
      : activeScenario === 'retry_limit'
      ? [
          'Executing Attempt 1 under advanced academic constraints...',
          'Evaluator rejecting Attempt 1 & routing to Prepare Regeneration...',
          'Executing Attempt 2... Evaluating persistent pedagogical barriers...',
          'Executing Attempt 3... Evaluating retry limit condition (attempt < 3)...',
          'Retry limit reached! Activating terminal fallback safeguard...'
        ]
      : [
          'Drafting beginner lesson with relatable everyday analogies...',
          'Storing payload & passing to strict Lesson Evaluator...',
          'Auditing drafted lesson against 8 hard PASS/FAIL quality checks...',
          'Processing self-correction feedback loop & finalizing report...',
        ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setCurrentStepText(steps[stepIdx]);
      }
    }, 850);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customApiKey) {
        headers['x-gemini-api-key'] = customApiKey.trim();
      }

      const res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: topicToRun,
          customApiKey: customApiKey || undefined,
          scenarioMode: activeScenario
        }),
      });

      if (res.status === 429) {
        const errorData = await res.json();
        clearInterval(interval);
        setQuotaExhaustedNotice(errorData.message || 'Free daily API quota reached.');
        setIsApiKeyModalOpen(true);
        setIsRunning(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server returned error status ${res.status}`);
      }

      const data: WorkflowRunResult = await res.json();
      clearInterval(interval);
      setRunResult(data);
      setSelectedAttemptIndex(data.iterations.length - 1);
      if (data.iterations.length > 1) {
        setCompareBaseIndex(0);
        setCompareTargetIndex(data.iterations.length - 1);
      }
      setIsModalOpen(true);
      setModalTab('lesson');

      if (data.status === 'passed') {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#10B981', '#6366F1', '#EC4899']
        });
      }
    } catch (err: any) {
      console.error('Workflow run error:', err);
      clearInterval(interval);
      setQuotaExhaustedNotice(err.message || 'An error occurred during workflow execution.');
    } finally {
      setIsRunning(false);
      setCurrentStepText('Execution complete');
    }
  };

  const handleSelectTestScenario = (mode: 'self_correction' | 'retry_limit') => {
    setScenarioMode(mode);
    const generatorStation = document.getElementById('generator-station');
    if (generatorStation) {
      generatorStation.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopy = () => {
    if (!activeLesson) return;
    navigator.clipboard.writeText(activeLesson);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const exportAsText = () => {
    if (!activeLesson || !runResult) return;
    const attemptLabel = currentAttempt ? `Attempt ${currentAttempt.attempt} of ${runResult.attemptsCount}` : `Attempt ${runResult.attemptsCount}`;
    const statusLabel = currentAttempt ? (currentAttempt.passed ? 'PASSED 8/8 CHECKS' : 'CRITIQUE / REJECTED') : runResult.status.toUpperCase();
    const content = `# ${runResult.topic} - Educational Lesson\n\n${activeLesson}\n\n---\nEvaluated by: Self-Evaluating Lesson Content Generator\nDraft Version: ${attemptLabel}\nAudit Status: ${statusLabel}\nTerminal Node: ${runResult.terminalNode}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${runResult.topic.replace(/\s+/g, '_')}_Attempt${currentAttempt?.attempt || 1}_Lesson.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsWord = () => {
    if (!activeLesson || !runResult) return;
    const attemptLabel = currentAttempt ? `Attempt ${currentAttempt.attempt} of ${runResult.attemptsCount}` : `Attempt ${runResult.attemptsCount}`;
    const statusLabel = currentAttempt ? (currentAttempt.passed ? 'PASSED 8/8' : 'REJECTED (NEEDS REGENERATION)') : runResult.status.toUpperCase();
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${runResult.topic} - Attempt ${currentAttempt?.attempt || 1}</title>
        <style>
          body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #333333; margin: 40px; }
          h1 { color: #8C4A00; font-size: 20pt; border-bottom: 2px solid #E6D5C3; padding-bottom: 8px; }
          h2 { color: #A0522D; font-size: 14pt; margin-top: 24px; }
          h3 { color: #4A4A4A; font-size: 12pt; }
          p { margin-bottom: 12px; }
          ul, ol { margin-bottom: 16px; }
          li { margin-bottom: 6px; }
          .meta-box { background-color: #FAF8F5; border: 1px solid #E2D9CF; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
          .footer { font-size: 9pt; color: #888888; border-top: 1px solid #EEEEEE; margin-top: 30px; padding-top: 8px; }
        </style>
      </head>
      <body>
        <h1>${runResult.topic}</h1>
        <div class="meta-box">
          <p><strong>Draft Version:</strong> ${attemptLabel}</p>
          <p><strong>Evaluator Audit Status:</strong> ${statusLabel}</p>
          <p><strong>Target Audience:</strong> 12th-Grade Beginner Learners</p>
        </div>
        <hr />
        <div>
          ${activeLesson
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/\n\n/g, '<p></p>')
            .replace(/\n- (.*)/g, '<li>$1</li>')}
        </div>
        <div class="footer">
          Generated & Verified via Self-Evaluating Lesson Content Generator • Agentic Workflow Loop
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${runResult.topic.replace(/\s+/g, '_')}_Attempt${currentAttempt?.attempt || 1}_Lesson.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dedicated Client-side PDF Generation with jsPDF (Reliable, formats markdown, direct download)
  const exportAsPdf = () => {
    if (!activeLesson || !runResult) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 45;
    const maxLineWidth = pageWidth - margin * 2;
    let cursorY = 50;

    // Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(140, 74, 0); // Warm amber tone
    const titleLines = doc.splitTextToSize(runResult.topic, maxLineWidth);
    doc.text(titleLines, margin, cursorY);
    cursorY += titleLines.length * 22 + 6;

    // Subtitle / metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const attemptLabel = currentAttempt ? `Attempt ${currentAttempt.attempt} of ${runResult.attemptsCount}` : `Attempt ${runResult.attemptsCount}`;
    const statusLabel = currentAttempt ? (currentAttempt.passed ? 'PASSED 8/8' : 'REJECTED (NEEDS REGENERATION)') : runResult.status.toUpperCase();
    doc.text(
      `Audience: Beginner Learners (12th Grade) | ${attemptLabel} | Status: ${statusLabel}`,
      margin,
      cursorY
    );
    cursorY += 14;

    // Divider line
    doc.setDrawColor(220, 210, 200);
    doc.setLineWidth(1);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 18;

    // Parse markdown lines
    const lines = activeLesson.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) {
        cursorY += 8;
        continue;
      }

      if (rawLine.startsWith('# ')) {
        if (cursorY > pageHeight - 70) {
          doc.addPage();
          cursorY = 50;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(140, 74, 0);
        const text = rawLine.replace(/^#\s+/, '');
        const wrapped = doc.splitTextToSize(text, maxLineWidth);
        doc.text(wrapped, margin, cursorY);
        cursorY += wrapped.length * 18 + 6;
      } else if (rawLine.startsWith('## ')) {
        if (cursorY > pageHeight - 60) {
          doc.addPage();
          cursorY = 50;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(160, 82, 45);
        const text = rawLine.replace(/^##\s+/, '');
        const wrapped = doc.splitTextToSize(text, maxLineWidth);
        doc.text(wrapped, margin, cursorY);
        cursorY += wrapped.length * 16 + 4;
      } else if (rawLine.startsWith('### ')) {
        if (cursorY > pageHeight - 50) {
          doc.addPage();
          cursorY = 50;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(70, 70, 70);
        const text = rawLine.replace(/^###\s+/, '');
        const wrapped = doc.splitTextToSize(text, maxLineWidth);
        doc.text(wrapped, margin, cursorY);
        cursorY += wrapped.length * 14 + 3;
      } else if (rawLine.startsWith('---')) {
        if (cursorY > pageHeight - 40) {
          doc.addPage();
          cursorY = 50;
        }
        doc.setDrawColor(230, 220, 210);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 12;
      } else {
        const isBullet = rawLine.startsWith('- ') || rawLine.startsWith('* ');
        const cleanText = rawLine.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(45, 45, 45);

        const indent = isBullet ? margin + 12 : margin;
        const lineWidth = isBullet ? maxLineWidth - 12 : maxLineWidth;
        const wrapped = doc.splitTextToSize(cleanText, lineWidth);

        if (cursorY + wrapped.length * 13 > pageHeight - 50) {
          doc.addPage();
          cursorY = 50;
        }

        if (isBullet) {
          doc.circle(margin + 5, cursorY - 3, 1.5, 'F');
        }

        doc.text(wrapped, indent, cursorY);
        cursorY += wrapped.length * 13 + 4;
      }
    }

    // Number all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Self-Evaluating Lesson Content Generator · Page ${p} of ${pageCount}`,
        margin,
        pageHeight - 25
      );
    }

    doc.save(`${runResult.topic.replace(/\s+/g, '_')}_Attempt${currentAttempt?.attempt || 1}_Lesson.pdf`);
  };

  // Download side-by-side comparison of 2 attempts (Text, Word, or PDF)
  const exportComparison = (format: 'txt' | 'doc' | 'pdf' = 'txt') => {
    if (!runResult || runResult.iterations.length < 2) return;
    const base = runResult.iterations[compareBaseIndex];
    const target = runResult.iterations[compareTargetIndex];
    if (!base || !target) return;

    const baseStatus = base.passed ? 'PASSED 8/8 CHECKS' : 'FAILED AUDIT (CRITIQUE GENERATED)';
    const targetStatus = target.passed ? 'PASSED 8/8 CHECKS' : 'FAILED AUDIT (CRITIQUE GENERATED)';

    if (format === 'txt') {
      const content = `================================================================================
SELF-EVALUATING LESSON CONTENT GENERATOR: COMPARISON REPORT
Topic: ${runResult.topic}
Comparison: Attempt ${base.attempt} vs Attempt ${target.attempt}
Audit Date: ${new Date().toLocaleDateString()}
Workflow Result: ${runResult.status.toUpperCase()} (Total Attempts: ${runResult.attemptsCount}, Terminal Node: ${runResult.terminalNode})
================================================================================

COMPARISON OVERVIEW:
- Draft A: Attempt ${base.attempt} — Status: ${baseStatus}
- Draft B: Attempt ${target.attempt} — Status: ${targetStatus}

${!base.passed ? `CRITIQUE ON ATTEMPT ${base.attempt}:
${base.evaluation.regeneration_feedback}
Failed Checks: ${base.evaluation.failed_checks.map(c => RUBRIC_TITLES[c] || c).join(', ')}` : `ATTEMPT ${base.attempt}: All 8 rubric criteria satisfied.`}

${target.passed ? `ATTEMPT ${target.attempt} RESOLUTION:
Attempt ${target.attempt} successfully satisfied all 8 evaluation criteria, addressing previous feedback.` : `ATTEMPT ${target.attempt} STATUS:
${target.evaluation.regeneration_feedback}
Failed Checks: ${target.evaluation.failed_checks.map(c => RUBRIC_TITLES[c] || c).join(', ')}`}

================================================================================
DRAFT A: ATTEMPT ${base.attempt}
================================================================================

${base.lesson}

================================================================================
DRAFT B: ATTEMPT ${target.attempt}
================================================================================

${target.lesson}

================================================================================
RUBRIC CHECKS BREAKDOWN:
Attempt ${base.attempt}:
${base.evaluation.checks.map(c => `  - [${c.passed ? 'PASS' : 'FAIL'}] ${RUBRIC_TITLES[c.id] || c.id}: ${c.reason}`).join('\n')}

Attempt ${target.attempt}:
${target.evaluation.checks.map(c => `  - [${c.passed ? 'PASS' : 'FAIL'}] ${RUBRIC_TITLES[c.id] || c.id}: ${c.reason}`).join('\n')}
================================================================================
Generated by Self-Evaluating Lesson Content Generator • Agentic Workflow Loop
`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${runResult.topic.replace(/\s+/g, '_')}_Comparison_Attempt${base.attempt}_vs_Attempt${target.attempt}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'doc') {
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${runResult.topic} - Comparison: Attempt ${base.attempt} vs Attempt ${target.attempt}</title>
          <style>
            body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #222; margin: 30px; }
            h1 { color: #8C4A00; font-size: 18pt; border-bottom: 2px solid #E6D5C3; padding-bottom: 6px; }
            h2 { color: #9E5300; font-size: 13pt; margin-top: 18px; }
            .meta-box { background-color: #FAF8F5; border: 1px solid #E2D9CF; padding: 12px; border-radius: 6px; margin-bottom: 18px; }
            .badge-pass { background-color: #D1FAE5; color: #065F46; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9pt; }
            .badge-fail { background-color: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9pt; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
            th { background-color: #F3ECE2; border: 1px solid #D6C8B8; padding: 8px; text-align: left; font-size: 10.5pt; }
            td { border: 1px solid #E2D9CF; padding: 12px; vertical-align: top; font-size: 10pt; line-height: 1.5; }
            .critique-box { background-color: #FEF9C3; border-left: 4px solid #F59E0B; padding: 10px; margin: 10px 0; font-size: 10pt; }
            .footer { font-size: 9pt; color: #888; border-top: 1px solid #EEE; margin-top: 25px; padding-top: 8px; }
          </style>
        </head>
        <body>
          <h1>${runResult.topic} — Draft Comparison Report</h1>
          <div class="meta-box">
            <p><strong>Compared Iterations:</strong> Attempt ${base.attempt} vs Attempt ${target.attempt}</p>
            <p><strong>Attempt ${base.attempt} Status:</strong> <span class="${base.passed ? 'badge-pass' : 'badge-fail'}">${baseStatus}</span></p>
            <p><strong>Attempt ${target.attempt} Status:</strong> <span class="${target.passed ? 'badge-pass' : 'badge-fail'}">${targetStatus}</span></p>
            <p><strong>Overall Workflow Status:</strong> ${runResult.status.toUpperCase()} (Total attempts: ${runResult.attemptsCount})</p>
          </div>

          ${!base.passed ? `
            <div class="critique-box">
              <strong>Evaluator Critique on Attempt ${base.attempt}:</strong><br />
              ${base.evaluation.regeneration_feedback}
            </div>
          ` : ''}

          <h2>Drafts Side-by-Side Comparison</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Attempt ${base.attempt} (${base.passed ? 'PASSED' : 'REJECTED'})</th>
                <th style="width: 50%;">Attempt ${target.attempt} (${target.passed ? 'PASSED' : 'REJECTED'})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  ${base.lesson
                    .replace(/\n\n/g, '<p></p>')
                    .replace(/\n- (.*)/g, '<li>$1</li>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                </td>
                <td>
                  ${target.lesson
                    .replace(/\n\n/g, '<p></p>')
                    .replace(/\n- (.*)/g, '<li>$1</li>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            Generated & Verified via Self-Evaluating Lesson Content Generator • Agentic Workflow Loop
          </div>
        </body>
        </html>
      `;
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${runResult.topic.replace(/\s+/g, '_')}_Comparison_Attempt${base.attempt}_vs_Attempt${target.attempt}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const maxLineWidth = pageWidth - margin * 2;
      let cursorY = 45;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(140, 74, 0);
      doc.text(`${runResult.topic} — Comparison Report`, margin, cursorY);
      cursorY += 20;

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Comparing: Attempt ${base.attempt} (${baseStatus}) vs Attempt ${target.attempt} (${targetStatus})`, margin, cursorY);
      cursorY += 15;

      doc.setDrawColor(220, 210, 200);
      doc.setLineWidth(1);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 16;

      // Critique box if base failed
      if (!base.passed) {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.roundedRect(margin, cursorY, maxLineWidth, 38, 4, 4, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(146, 64, 14);
        doc.text(`Evaluator Critique on Attempt ${base.attempt}:`, margin + 8, cursorY + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const feedbackLines = doc.splitTextToSize(base.evaluation.regeneration_feedback, maxLineWidth - 16);
        doc.text(feedbackLines, margin + 8, cursorY + 26);
        cursorY += 46;
      }

      const renderAttemptSection = (attemptIter: typeof base, label: string) => {
        if (cursorY > pageHeight - 80) {
          doc.addPage();
          cursorY = 45;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(160, 82, 45);
        doc.text(label, margin, cursorY);
        cursorY += 18;

        const lines = attemptIter.lesson.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            cursorY += 6;
            continue;
          }
          if (cursorY > pageHeight - 50) {
            doc.addPage();
            cursorY = 45;
          }
          if (trimmed.startsWith('# ')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(140, 74, 0);
            const wrapped = doc.splitTextToSize(trimmed.replace(/^#\s+/, ''), maxLineWidth);
            doc.text(wrapped, margin, cursorY);
            cursorY += wrapped.length * 15 + 4;
          } else if (trimmed.startsWith('## ')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(160, 82, 45);
            const wrapped = doc.splitTextToSize(trimmed.replace(/^##\s+/, ''), maxLineWidth);
            doc.text(wrapped, margin, cursorY);
            cursorY += wrapped.length * 14 + 3;
          } else if (trimmed.startsWith('- ')) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
            const bulletText = `• ${trimmed.replace(/^-\s+/, '')}`;
            const wrapped = doc.splitTextToSize(bulletText, maxLineWidth - 10);
            doc.text(wrapped, margin + 10, cursorY);
            cursorY += wrapped.length * 12 + 2;
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
            const wrapped = doc.splitTextToSize(trimmed, maxLineWidth);
            doc.text(wrapped, margin, cursorY);
            cursorY += wrapped.length * 12 + 4;
          }
        }
      };

      renderAttemptSection(base, `Draft A — Attempt ${base.attempt} (${base.passed ? 'PASSED' : 'FAILED AUDIT'})`);
      cursorY += 15;
      renderAttemptSection(target, `Draft B — Attempt ${target.attempt} (${target.passed ? 'PASSED' : 'FAILED AUDIT'})`);

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          `Self-Evaluating Lesson Content Generator · Comparison Report · Page ${p} of ${pageCount}`,
          margin,
          pageHeight - 20
        );
      }

      doc.save(`${runResult.topic.replace(/\s+/g, '_')}_Comparison_Attempt${base.attempt}_vs_Attempt${target.attempt}.pdf`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-base tracking-tight text-stone-900">
                  LessonFlow
                </span>
                <span className="text-[11px] font-medium text-amber-800 bg-amber-100/70 border border-amber-300/60 rounded px-1.5 py-0.5">
                  Autonomous Agent
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Self-Evaluating Lesson Content Generator
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-xs font-medium text-stone-600">
            <a href="#how-it-works" className="hover:text-amber-800 transition-colors hidden md:block">
              How It Works
            </a>
            <a href="#rubric" className="hover:text-amber-800 transition-colors hidden md:block">
              8 Quality Checks
            </a>

            {/* API Key Settings Button */}
            <button
              type="button"
              onClick={() => {
                setTempApiKeyInput(customApiKey);
                setIsApiKeyModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                customApiKey
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300/80'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{customApiKey ? 'Custom API Key Active' : 'API Key (Optional)'}</span>
            </button>

            {runResult && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 transition-colors text-xs font-semibold shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                <span>View Results ({runResult.status.toUpperCase()})</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Quota Exhaustion Alert Banner if limit is hit */}
      {quotaExhaustedNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-xs text-amber-900">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Daily Free Quota Notice:</strong> {quotaExhaustedNotice} You can enter your own free Gemini API key to continue without waiting.
              </span>
            </div>
            <button
              onClick={() => {
                setTempApiKeyInput(customApiKey);
                setIsApiKeyModalOpen(true);
              }}
              className="underline font-semibold hover:text-amber-950 shrink-0"
            >
              Enter API Key &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-16">
        
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/70 text-amber-900 text-xs font-medium border border-amber-200/80 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>n8n Agentic Architecture + Gemini 3.8 Flash</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-stone-900 leading-[1.15]">
            Generate Lessons That <span className="italic text-amber-800 font-normal">Evaluate & Perfect</span> Themselves
          </h1>

          <p className="text-stone-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            Like a miniature pedagogical Google for <strong>any topic</strong> you want to understand. 
            While we focus heavily on popular tech like <em>RAG, Prompt Engineering, and LLMs</em>, you can ask about biology, finance, or physics. 
            The agentic loop drafts the lesson, audits it against 8 hard quality checks, and auto-corrects before handing you the final document.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stone-500 pt-1">
            <span>· 12th-Grade Vocabulary</span>
            <span>· Real-World Analogies</span>
            <span>· 8 Strict Quality Checks</span>
            <span>· Max 3-Retry Attempt Safeguard</span>
          </div>
        </section>

        {/* The Generator Station (Focused, Single Action) */}
        <section id="generator-station" className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          {/* Subtle Warm Gradient Bar at Top */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500"></div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="topic-input" className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Enter Any Lesson Topic
                </label>
                <span className="text-[11px] text-stone-500">
                  Any subject · Tech, Science, Economics, Everyday Phenomena
                </span>
              </div>
              <div className="relative">
                <input
                  id="topic-input"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isRunning) {
                      triggerExecution();
                    }
                  }}
                  placeholder="e.g. Introduction to RAG, Quantum Computing, Photosynthesis, Inflation..."
                  disabled={isRunning}
                  className="w-full bg-[#FAF8F5] border border-stone-300 rounded-2xl px-4 sm:px-5 py-3.5 text-base sm:text-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200/50 transition-all font-medium"
                />
              </div>

              {/* Sample Categories & Ideas */}
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Popular Topics to Explore:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  {topicCategories.map((cat, idx) => {
                    const IconComponent = cat.icon;
                    return (
                      <div key={idx} className="p-3 bg-stone-50/70 border border-stone-200/70 rounded-xl space-y-1.5">
                        <div className="font-semibold text-stone-800 flex items-center gap-1.5 text-[11px]">
                          <IconComponent className="w-3.5 h-3.5 text-amber-700" />
                          <span>{cat.category}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {cat.items.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setTopic(item)}
                              disabled={isRunning}
                              className="text-[11px] px-2 py-0.5 rounded bg-white hover:bg-amber-100 hover:text-amber-900 text-stone-700 border border-stone-200 transition-colors"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quota & Model Transparency Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                <p className="leading-relaxed">
                  <strong>Gemini Flash Quota Notice:</strong> Runs on Gemini 3.8 Flash. The shared free tier has daily request limits. If exhausted, you can simply plug in your own free Gemini API key using the button on top to keep learning without waiting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempApiKeyInput(customApiKey);
                  setIsApiKeyModalOpen(true);
                }}
                className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline shrink-0"
              >
                {customApiKey ? 'Manage Key' : 'Add Free Key'}
              </button>
            </div>

            {/* Primary Action Button Bar with Scenario Badge */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-stone-100">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <GraduationCap className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Outputs complete standalone educational document with recap & glossary.</span>
              </div>

              <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-auto">
                {/* Badge with the name of the test scenario selected */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-stone-500 font-medium">Selected Scenario:</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                      scenarioMode === 'self_correction'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : scenarioMode === 'retry_limit'
                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    {scenarioMode === 'self_correction' && <RotateCcw className="w-3.5 h-3.5 text-amber-700" />}
                    {scenarioMode === 'retry_limit' && <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />}
                    {scenarioMode === 'auto' && <Zap className="w-3.5 h-3.5 text-emerald-600" />}
                    <span>
                      {scenarioMode === 'self_correction'
                        ? 'Test Self-Correction Loop'
                        : scenarioMode === 'retry_limit'
                        ? 'Test Retry Safeguard'
                        : 'Standard Autonomous Run'}
                    </span>
                    {scenarioMode !== 'auto' && (
                      <button
                        type="button"
                        onClick={() => setScenarioMode('auto')}
                        className="ml-1 text-stone-400 hover:text-stone-700 font-bold"
                        title="Reset to Standard Autonomous Run"
                      >
                        ×
                      </button>
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => triggerExecution()}
                  disabled={isRunning || !topic.trim()}
                  className={`w-full sm:w-auto px-7 py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all ${
                    isRunning || !topic.trim()
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-amber-700/15 active:scale-98'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin text-amber-200" />
                      <span>Running Workflow...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Generate & Evaluate Lesson</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Progress Bar when Running */}
            {isRunning && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-stone-800 space-y-2 animate-gentle-pulse">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                  <span className="flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                    Active Pipeline Status
                  </span>
                  <span className="text-[11px] font-mono text-amber-800">Agent Processing</span>
                </div>
                <p className="text-xs text-stone-700 font-medium">{currentStepText}</p>
                <div className="w-full bg-amber-200/60 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-600 h-1.5 rounded-full animate-pulse w-3/4"></div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section: How It Works (Under the Hood Pipeline) */}
        <section id="how-it-works" className="space-y-6 pt-4">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900">
              How the Agentic Workflow Operates
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              A 5-stage closed loop that combines generative instruction with strict automated auditing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                  Node 01
                </span>
                <h3 className="font-semibold text-sm text-stone-900 mt-2">State Ingestion</h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Extracts topic, sets attempt counter to 1, and initializes learner parameters.
                </p>
              </div>
              <div className="text-[11px] font-mono text-stone-400">Edit Fields Node</div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                  Node 02
                </span>
                <h3 className="font-semibold text-sm text-stone-900 mt-2">Lesson Generator</h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Gemini drafts the lesson following the What, Why, How structure with real-world analogies.
                </p>
              </div>
              <div className="text-[11px] font-mono text-stone-400">Gemini LLM</div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                  Node 03
                </span>
                <h3 className="font-semibold text-sm text-stone-900 mt-2">Quality Evaluator</h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Audits the drafted lesson against 8 hard criteria with binary PASS/FAIL results.
                </p>
              </div>
              <div className="text-[11px] font-mono text-stone-400">Strict Rubric Audit</div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                  Node 04
                </span>
                <h3 className="font-semibold text-sm text-stone-900 mt-2">Decision Gateway</h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  If overall_pass is TRUE &rarr; Final Lesson. If FALSE &rarr; Evaluates retry limit guard.
                </p>
              </div>
              <div className="text-[11px] font-mono text-stone-400">If Node (Pass/Fail)</div>
            </div>

            {/* Step 5 */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                  Node 05
                </span>
                <h3 className="font-semibold text-sm text-stone-900 mt-2">Feedback & Guard</h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Packs evaluator critique, increments attempt, loops back, or stops at 3 retries.
                </p>
              </div>
              <div className="text-[11px] font-mono text-stone-400">Bounded Retry Guard</div>
            </div>
          </div>
        </section>

        {/* Section: Workflow Execution Scenarios */}
        <section id="workflow-scenarios" className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="max-w-2xl space-y-1">
            <h2 className="font-display text-2xl font-semibold text-stone-900">
              Workflow Execution Scenarios
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              Observe how the autonomous evaluator handles flawed initial drafts and enforces loop termination.
            </p>
          </div>

          {/* 1. Explanations: 2 Grids Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Scenario 1 Explanation Card */}
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-sm">Self-Correction Loop Scenario</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100/90 text-amber-900 border border-amber-300">
                  Attempt 1 ➔ Attempt 2
                </span>
              </div>
              <p className="text-stone-600 leading-relaxed">
                <strong className="text-stone-800">What happens:</strong> The initial draft intentionally exhibits realistic pedagogical flaws — such as missing non-technical real-world analogies or introducing unexplained technical jargon.
              </p>
              <div className="p-3 bg-white rounded-xl border border-stone-200/70 space-y-1">
                <div className="font-semibold text-stone-800 text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Evaluator Action & Recovery:</span>
                </div>
                <p className="text-stone-600 text-[11px] leading-snug">
                  The evaluator catches the missing criteria during the 8-point audit, rejects Attempt 1, and synthesizes actionable feedback. Attempt 2 addresses every critique, introduces relatable analogies, demystifies jargon, and passes.
                </p>
              </div>
            </div>

            {/* Scenario 2 Explanation Card */}
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-rose-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-100 text-rose-800">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-sm">Retry Safeguard Scenario</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100/90 text-rose-900 border border-rose-300">
                  Max 3 Retries (attempt &lt; 3)
                </span>
              </div>
              <p className="text-stone-600 leading-relaxed">
                <strong className="text-stone-800">What happens:</strong> Simulates persistent university-level academic framing or excessive technical complexity that continually fails the 12th-grade beginner threshold across retries.
              </p>
              <div className="p-3 bg-white rounded-xl border border-stone-200/70 space-y-1">
                <div className="font-semibold text-stone-800 text-[11px] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Loop Brake & Terminal Fallback:</span>
                </div>
                <p className="text-stone-600 text-[11px] leading-snug">
                  To protect against infinite loops or runaway API calls, the bounded retry guard trips once the attempt counter reaches 3, cleanly routing the execution to <code className="text-rose-900 bg-rose-50 px-1 py-0.5 rounded font-mono">Failed Final Lesson</code> with a full diagnostic audit.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Moved Component: Test Scenarios */}
          <div className="space-y-2 pt-3 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Test Scenarios
              </label>
              <span className="text-[11px] text-stone-400">Click to select scenario, then generate lesson in the main box above</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectTestScenario('self_correction')}
                disabled={isRunning}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  scenarioMode === 'self_correction'
                    ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/50 shadow-xs'
                    : 'bg-[#FAF8F5] hover:bg-stone-50 border-stone-200 text-stone-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-950">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Test Self-Correction Loop</span>
                  </div>
                  {scenarioMode === 'self_correction' && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-600 mt-1.5 leading-snug">
                  Attempt 1 drafts with realistic flaws (unexplained jargon, missing non-tech analogy). Evaluator catches them & Attempt 2 fixes them!
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTestScenario('retry_limit')}
                disabled={isRunning}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  scenarioMode === 'retry_limit'
                    ? 'bg-rose-50/90 border-rose-500 ring-2 ring-rose-400/50 shadow-xs'
                    : 'bg-[#FAF8F5] hover:bg-stone-50 border-stone-200 text-stone-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-950">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Test Retry Safeguard</span>
                  </div>
                  {scenarioMode === 'retry_limit' && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-600 mt-1.5 leading-snug">
                  Simulates persistent university-level barriers over 3 attempts, routing to "Failed Final Lesson" with diagnostic report.
                </p>
              </button>
            </div>
          </div>
        </section>

        {/* Section: How to Use the Interface */}
        <section id="how-to-use" className="bg-[#FAF4EC] border border-amber-200/70 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="max-w-2xl space-y-1">
            <h2 className="font-display text-2xl font-semibold text-stone-900">
              How to Use This Interface
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              Simple steps to generate, audit, inspect self-corrections, and export beginner-friendly lessons.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-white/80 rounded-2xl border border-amber-200/50 space-y-1.5">
              <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                1
              </div>
              <div className="font-bold text-stone-900 text-sm">Choose Any Subject</div>
              <p className="text-stone-600 leading-relaxed">
                Enter any topic you want to understand — from AI architectures to nature or economics.
              </p>
            </div>

            <div className="p-4 bg-white/80 rounded-2xl border border-amber-200/50 space-y-1.5">
              <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                2
              </div>
              <div className="font-bold text-stone-900 text-sm">Watch Agent Evaluate</div>
              <p className="text-stone-600 leading-relaxed">
                The agent generates and audits content. If any check fails, it auto-regenerates using targeted feedback.
              </p>
            </div>

            <div className="p-4 bg-white/80 rounded-2xl border border-amber-200/50 space-y-1.5">
              <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                3
              </div>
              <div className="font-bold text-stone-900 text-sm">Inspect in Pop-up</div>
              <p className="text-stone-600 leading-relaxed">
                Review the finished lesson, inspect pass/fail checks, and read any evaluator feedback between attempts.
              </p>
            </div>

            <div className="p-4 bg-white/80 rounded-2xl border border-amber-200/50 space-y-1.5">
              <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                4
              </div>
              <div className="font-bold text-stone-900 text-sm">Download or Re-run</div>
              <p className="text-stone-600 leading-relaxed">
                Export directly as a genuine PDF, Word document, or plain text, or click "Generate Again".
              </p>
            </div>
          </div>
        </section>

        {/* Section: 8 Hard Quality Checks (Interactive Matrix) */}
        <section id="rubric" className="space-y-6 pt-4">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900">
              The 8 Hard Quality Checks
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              The Lesson Evaluator enforces these strict checks. If any check fails on its own during drafting, the workflow triggers regeneration.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RUBRIC_DETAILS.map((check) => (
              <div
                key={check.id}
                className="p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs hover:border-amber-300 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-stone-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    {check.title}
                  </h3>
                  <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                    Hard Pass/Fail
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed font-medium">
                  {check.summary}
                </p>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  {check.details}
                </p>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-8 px-4 sm:px-6 text-center text-xs text-stone-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-semibold text-stone-800">Self-Evaluating Lesson Content Generator</span>
            <span className="mx-2">·</span>
            <span>Created by Ashish Khatri</span>
          </div>
          <div className="text-stone-400 text-[11px]">
            n8n Agentic Architecture • Google Gemini 3.8 Flash • Autonomous Feedback Loop
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* RESULTS POP-UP MODAL WINDOW */}
      {/* ========================================================================= */}
      {isModalOpen && runResult && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
            
            {/* Modal Top Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    runResult.status === 'passed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {runResult.status === 'passed' ? (
                    <CheckCheck className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-semibold text-base sm:text-lg text-stone-900 leading-tight">
                      {runResult.topic}
                    </h2>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        runResult.status === 'passed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {runResult.status === 'passed' ? 'PASSED 8/8 CHECKS' : 'FALLBACK SAFEGUARD'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Terminal Node: <span className="font-semibold text-stone-700">{runResult.terminalNode}</span> · Took {runResult.attemptsCount} attempt{runResult.attemptsCount > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Nav Tabs */}
            <div className="flex flex-wrap items-center justify-between px-5 pt-2 border-b border-stone-200 bg-stone-50/60 gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setModalTab('lesson')}
                  className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                    modalTab === 'lesson'
                      ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Lesson Document</span>
                  {runResult.iterations.length > 1 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200/70 text-stone-700 font-mono">
                      Att. {currentAttempt?.attempt || 1}
                    </span>
                  )}
                </button>

                {runResult.iterations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setModalTab('compare')}
                    className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                      modalTab === 'compare'
                        ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5 text-amber-600" />
                    <span>Compare Attempts</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono font-bold">
                      Diff View
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setModalTab('evaluation')}
                  className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                    modalTab === 'evaluation'
                      ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>8-Point Rubric Audit</span>
                  <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded font-mono">
                    {runResult.iterations[selectedAttemptIndex]?.evaluation?.checks?.filter(c => c.passed).length || 8}/8
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('logs')}
                  className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                    modalTab === 'logs'
                      ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Execution Trace ({runResult.logs.length})</span>
                </button>
              </div>

              {/* Attempt Selector if Evaluator triggered regeneration */}
              {runResult.iterations.length > 1 && (
                <div className="flex items-center gap-1 pb-1">
                  <span className="text-[11px] text-stone-500 mr-1 font-medium">Viewing:</span>
                  {runResult.iterations.map((iter, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAttemptIndex(idx)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                        selectedAttemptIndex === idx
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                      }`}
                    >
                      <span>Attempt {iter.attempt}</span>
                      {iter.passed ? (
                        <Check className="w-3 h-3 text-emerald-200" />
                      ) : (
                        <span className="text-[9px] bg-amber-900/40 text-amber-200 px-1 rounded">Critique</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Body Area */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-white space-y-4">
              {/* TAB 1: Lesson Content */}
              {modalTab === 'lesson' && currentAttempt && (
                <div className="space-y-4">
                  {/* Status Banner for Currently Selected Attempt */}
                  {!currentAttempt.passed ? (
                    <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-amber-950 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Attempt {currentAttempt.attempt} Draft — Rejected by Evaluator Audit</span>
                        </div>
                        <span className="text-[10px] font-bold bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                          NEEDS REGENERATION
                        </span>
                      </div>
                      <p className="text-stone-700 leading-relaxed">
                        <strong className="text-stone-900">Evaluator Critique:</strong> {currentAttempt.evaluation.regeneration_feedback}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-amber-900">Failed Quality Criteria:</span>
                        {currentAttempt.evaluation.failed_checks.map((chkId) => (
                          <span
                            key={chkId}
                            className="px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[11px] font-medium text-amber-900"
                          >
                            {RUBRIC_TITLES[chkId] || chkId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-950 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Attempt {currentAttempt.attempt} Draft — Passed All 8 Quality Criteria</span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
                        VERIFIED STANDALONE LESSON
                      </span>
                    </div>
                  )}

                  {/* Document Text */}
                  <div className="prose prose-stone max-w-none text-stone-800 text-sm leading-relaxed whitespace-pre-wrap font-sans bg-[#FAF8F5] p-5 sm:p-6 rounded-2xl border border-stone-200/80">
                    {currentAttempt.lesson || runResult.finalLesson}
                  </div>
                </div>
              )}

              {/* TAB: Compare Attempts (Diff / Side-by-Side Evolution) */}
              {modalTab === 'compare' && runResult.iterations.length > 1 && (
                <div className="space-y-4">
                  {/* Pair Selector Controls */}
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <GitCompare className="w-4 h-4 text-amber-700" />
                      <span className="font-semibold text-stone-800">Compare Drafts Side-by-Side:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-500 text-[11px]">Draft A:</span>
                        <select
                          value={compareBaseIndex}
                          onChange={(e) => setCompareBaseIndex(Number(e.target.value))}
                          className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-800 font-medium focus:outline-none focus:border-amber-500"
                        >
                          {runResult.iterations.map((iter, idx) => (
                            <option key={idx} value={idx}>
                              Attempt {iter.attempt} ({iter.passed ? 'Passed' : 'Critique'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />

                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-500 text-[11px]">Draft B:</span>
                        <select
                          value={compareTargetIndex}
                          onChange={(e) => setCompareTargetIndex(Number(e.target.value))}
                          className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-800 font-medium focus:outline-none focus:border-amber-500"
                        >
                          {runResult.iterations.map((iter, idx) => (
                            <option key={idx} value={idx}>
                              Attempt {iter.attempt} ({iter.passed ? 'Passed' : 'Critique'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Download Comparison Button on Right */}
                      <div className="relative inline-flex items-center ml-1">
                        <button
                          type="button"
                          onClick={() => exportComparison('txt')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                          title="Download comparison report as Text / Markdown"
                        >
                          <Download className="w-3.5 h-3.5 text-white" />
                          <span>Download Comparison</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompareExportOpen(!compareExportOpen)}
                          className="px-2 py-1.5 rounded-r-xl bg-amber-700 hover:bg-amber-800 border-l border-amber-500/60 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                          title="Choose export format"
                        >
                          <ChevronDown className="w-3.5 h-3.5 text-white" />
                        </button>

                        {compareExportOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-stone-200 rounded-xl shadow-lg z-30 py-1 text-stone-800 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                exportComparison('txt');
                                setCompareExportOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                            >
                              <FileCode className="w-3.5 h-3.5 text-stone-500" />
                              <span>Text / Markdown (.txt)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportComparison('doc');
                                setCompareExportOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600" />
                              <span>Word Document (.doc)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportComparison('pdf');
                                setCompareExportOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-700" />
                              <span>PDF Document (.pdf)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary of What Changed */}
                  {(() => {
                    const base = runResult.iterations[compareBaseIndex];
                    const target = runResult.iterations[compareTargetIndex];
                    if (!base || !target) return null;

                    return (
                      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-2">
                        <h4 className="font-semibold text-amber-950 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                          <span>Iterative Workflow Evolution: Attempt {base.attempt} ➔ Attempt {target.attempt}</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-3 bg-white/80 rounded-xl border border-stone-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-stone-800">
                                Attempt {base.attempt}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                base.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {base.passed ? 'PASSED 8/8' : 'FAILED AUDIT'}
                              </span>
                            </div>
                            {!base.passed && (
                              <p className="text-[11px] text-stone-600 leading-snug">
                                <strong>Feedback:</strong> {base.evaluation.regeneration_feedback}
                              </p>
                            )}
                          </div>

                          <div className="p-3 bg-white/80 rounded-xl border border-stone-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-stone-800">
                                Attempt {target.attempt}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                target.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {target.passed ? 'PASSED 8/8' : 'FAILED AUDIT'}
                              </span>
                            </div>
                            {target.passed ? (
                              <p className="text-[11px] text-emerald-800 leading-snug font-medium">
                                Successfully addressed all feedback: Added relatable everyday analogies, defined technical terms, and satisfied beginner 12th-grade standard.
                              </p>
                            ) : (
                              <p className="text-[11px] text-stone-600 leading-snug">
                                <strong>Feedback:</strong> {target.evaluation.regeneration_feedback}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Side-by-Side Comparison Columns */}
                  {(() => {
                    const base = runResult.iterations[compareBaseIndex];
                    const target = runResult.iterations[compareTargetIndex];
                    if (!base || !target) return null;

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Draft A Column */}
                        <div className="flex flex-col rounded-2xl border border-stone-200 overflow-hidden bg-[#FAF8F5]">
                          <div className="p-3 bg-stone-100 border-b border-stone-200 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-stone-600" />
                              <span className="font-semibold text-xs text-stone-800">
                                Attempt {base.attempt} Draft
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              base.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {base.passed ? 'PASSED' : 'REJECTED'}
                            </span>
                          </div>
                          <div className="p-4 text-xs text-stone-800 leading-relaxed font-sans whitespace-pre-wrap flex-1 max-h-[440px] overflow-y-auto">
                            {base.lesson}
                          </div>
                        </div>

                        {/* Draft B Column */}
                        <div className="flex flex-col rounded-2xl border border-stone-200 overflow-hidden bg-[#FAF8F5]">
                          <div className="p-3 bg-stone-100 border-b border-stone-200 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-stone-600" />
                              <span className="font-semibold text-xs text-stone-800">
                                Attempt {target.attempt} Draft
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              target.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {target.passed ? 'PASSED' : 'REJECTED'}
                            </span>
                          </div>
                          <div className="p-4 text-xs text-stone-800 leading-relaxed font-sans whitespace-pre-wrap flex-1 max-h-[440px] overflow-y-auto">
                            {target.lesson}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 2: Rubric Evaluation Breakdown */}
              {modalTab === 'evaluation' && currentAttempt && (
                <div className="space-y-4">
                  {/* Notice showing if attempt failed during natural execution */}
                  {!currentAttempt.passed && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 text-xs space-y-1.5">
                      <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        Evaluator Critique Generated on Attempt {currentAttempt.attempt}:
                      </div>
                      <p className="text-stone-700 leading-relaxed">
                        {currentAttempt.evaluation.regeneration_feedback}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-amber-900">Failed Criteria:</span>
                        {currentAttempt.evaluation.failed_checks.map((chkId) => (
                          <span
                            key={chkId}
                            className="px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[11px] font-medium text-amber-900"
                          >
                            {RUBRIC_TITLES[chkId] || chkId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 8 Checks Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentAttempt.evaluation.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                          chk.passed
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                            : 'bg-amber-50/60 border-amber-300 text-amber-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-stone-900 flex items-center gap-1.5">
                            {chk.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                            {RUBRIC_TITLES[chk.id] || chk.id.replace(/_/g, ' ')}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              chk.passed
                                ? 'bg-emerald-200/80 text-emerald-900'
                                : 'bg-amber-200/90 text-amber-900'
                            }`}
                          >
                            {chk.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <p className="text-stone-600 text-[11px] leading-snug pl-5.5">
                          {chk.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Execution Trace Logs */}
              {modalTab === 'logs' && (
                <div className="space-y-2 font-mono text-xs">
                  {runResult.logs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-800">{log.node}</span>
                        <span className="text-stone-400">·</span>
                        <span className="text-stone-600">{log.message}</span>
                      </div>
                      <span className="text-[11px] text-stone-400 shrink-0">{log.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Bottom Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-stone-200 bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold transition-colors"
                >
                  Close
                </button>

                {/* Generate Again Button */}
                <button
                  type="button"
                  onClick={() => triggerExecution(runResult.topic)}
                  disabled={isRunning}
                  className="px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-amber-700 ${isRunning ? 'animate-spin' : ''}`} />
                  <span>Generate Again</span>
                </button>
              </div>

              {/* Export / Download Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {modalTab === 'compare' && runResult.iterations.length > 1 ? (
                  <>
                    {/* Compare Text (.txt) */}
                    <button
                      type="button"
                      onClick={() => exportComparison('txt')}
                      className="px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5 text-stone-500" />
                      <span>Compare Text (.txt)</span>
                    </button>

                    {/* Compare Word (.doc) */}
                    <button
                      type="button"
                      onClick={() => exportComparison('doc')}
                      className="px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Compare Word (.doc)</span>
                    </button>

                    {/* Compare PDF */}
                    <button
                      type="button"
                      onClick={() => exportComparison('pdf')}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                      <span>Download Comparison</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Copy Text */}
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      {copyStatus ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copyStatus ? 'Copied' : 'Copy'}</span>
                    </button>

                    {/* Download as Text */}
                    <button
                      type="button"
                      onClick={exportAsText}
                      className="px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5 text-stone-500" />
                      <span>Text (.txt)</span>
                    </button>

                    {/* Download as Word */}
                    <button
                      type="button"
                      onClick={exportAsWord}
                      className="px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Word (.doc)</span>
                    </button>

                    {/* Direct Download as PDF via jsPDF */}
                    <button
                      type="button"
                      onClick={exportAsPdf}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* API KEY CONFIGURATION MODAL (Required by User for Quota Exhaustion) */}
      {/* ========================================================================= */}
      {isApiKeyModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsApiKeyModalOpen(false);
          }}
        >
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 my-auto overflow-hidden">
            {/* Modal Header - Fixed at top */}
            <div className="flex items-center justify-between border-b border-stone-100 p-4 sm:p-5 bg-[#FAF8F5] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-base text-stone-900 leading-tight">
                    Gemini API Key Settings
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Optional fallback for heavy usage and daily quota exhaustion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors shrink-0"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-stone-800 overscroll-contain">
              {/* Explanation of Quota Limits */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Why provide your own API key?</span>
                </div>
                <p className="text-stone-700 leading-relaxed text-[11px]">
                  Google Gemini 3.8 Flash free tier operates under daily rate limits. During high traffic or prolonged sessions, the shared quota may temporarily exhaust and stop mid-generation. Providing your personal Gemini API key bypasses all shared limits.
                </p>
              </div>

              {/* Privacy & Security Guarantee */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-1.5">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Privacy & Data Security Guarantee:</span>
                </div>
                <ul className="text-stone-600 text-[11px] list-disc list-inside space-y-1 leading-relaxed">
                  <li><strong>Strictly Local:</strong> Your API key is stored exclusively inside your browser's private <code className="text-stone-800 bg-stone-200/60 px-1 py-0.5 rounded">localStorage</code>.</li>
                  <li><strong>Never Logged or Stored on Server:</strong> It is only forwarded through HTTPS headers to authorize your own requests directly with Google Gemini.</li>
                  <li><strong>Full Control:</strong> You can edit, override, or erase your stored key at any time with a single click.</li>
                </ul>
              </div>

              {/* API Key Input */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-700 block">
                    Your Google Gemini API Key
                  </label>
                  <span className="text-[10px] text-stone-400 font-medium">Free Tier or Paid Key</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tempApiKeyInput}
                    onChange={(e) => {
                      setTempApiKeyInput(e.target.value);
                      if (apiKeyTestResult) setApiKeyTestResult(null);
                    }}
                    placeholder="AIzaSy..."
                    className="flex-1 bg-[#FAF8F5] border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-300"
                  />
                  <button
                    type="button"
                    onClick={handleTestApiKey}
                    disabled={isTestingApiKey || !tempApiKeyInput.trim()}
                    className="px-3.5 py-2.5 rounded-xl border border-stone-300 hover:border-amber-500 bg-stone-50 hover:bg-amber-50/60 text-stone-700 hover:text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isTestingApiKey ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                        <span>Run Test</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live Test Status Banner */}
                {apiKeyTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-150 ${
                      apiKeyTestResult.valid
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50/80 border-rose-300 text-rose-900'
                    }`}
                  >
                    {apiKeyTestResult.valid ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <div className="font-semibold text-[11px]">
                        {apiKeyTestResult.valid ? 'API Key Verified & Ready' : 'Key Test Failed'}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {apiKeyTestResult.message}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-800 hover:text-amber-950 underline flex items-center gap-1"
                  >
                    <span>Get a free key from Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {customApiKey && (
                    <button
                      type="button"
                      onClick={handleClearApiKey}
                      className="text-rose-600 hover:text-rose-700 underline font-medium"
                    >
                      Clear Stored Key
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions - Fixed at bottom */}
            <div className="flex items-center justify-end gap-2 p-3.5 sm:px-6 border-t border-stone-100 bg-[#FAF8F5] shrink-0">
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors shadow-xs"
              >
                Save & Apply Key
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
