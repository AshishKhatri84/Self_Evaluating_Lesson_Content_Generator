# Self-Evaluating Lesson Content Generator — Evidence

This folder contains the evidence screenshots for the n8n self-evaluating lesson content workflow.

## Evidence Screenshots

| File | What it demonstrates |
|---|---|
| `01_Workflow_Overview.png` | Complete n8n workflow architecture, including lesson generation, evaluation, pass/fail routing, retry handling, regeneration, and final outputs. |
| `02_Generator_Prompt.png` | **Generator** node configuration and generated lesson output for the initial attempt. |
| `03_Store_Generated_Lesson.png` | **Store Generated Lesson** node mapping the generated text into `lesson`, while retaining the `topic` and `attempt` fields. |
| `04_Lesson_Evaluator_True.png` | **Lesson Evaluator** returning `overall_pass: true` with individual quality checks marked as passed. |
| `05_If_Pass_Fail_Routing.png` | **If** node routing based on `{{ $json.output.overall_pass }}`, with the true/pass branch selected for a passing evaluation. |
| `06_Final_Lesson_Output.png` | **Final Lesson** node producing the final output with `status: passed`, the generated lesson, and `attempt: 1`. |
| `07_Lesson_Evaluator_False.png` | **Lesson Evaluator** returning `overall_pass: false` and identifying failed checks, including regeneration feedback for the lesson. |
| `08_Retry_Limit.png` | **Retry Limit** node enforcing the retry condition `attempt < 3` before allowing another regeneration cycle. |
| `09_Prepare_Regeneration.png` | **Prepare Regeneration** node carrying forward the topic, incrementing the attempt number, and preserving evaluator feedback for the next generation. |
| `10_Failed_Final_Lesson_Output.png` | **Failed Final Lesson** node producing the controlled failure result after the retry path, including failed status, failed checks, regeneration feedback, and the final attempt number. |
| `11_Retry-Regeneration_Flow.png` | End-to-end execution evidence showing the retry/regeneration path being traversed, with multiple executions/items visible across the Generator, Store Generated Lesson, Lesson Evaluator, If, Retry Limit, and Prepare Regeneration nodes. |

## Evidence Flow

**Successful path**

`Generator → Store Generated Lesson → Lesson Evaluator (true) → If (true) → Final Lesson`

**Retry/regeneration path**

`Lesson Evaluator (false) → If (false) → Retry Limit → Prepare Regeneration → Generator`

If the retry limit is reached without a passing evaluation:

`... → Retry Limit → Failed Final Lesson`

## Notes

- The screenshots are execution evidence from the n8n workflow and demonstrate both the successful and self-correcting/failure-handling paths.
- `11_Retry-Regeneration_Flow.png` specifically demonstrates that the retry/regeneration path was traversed during execution.