import {
  PROMPT_TARGETS,
  type IdeaTitleProvenance,
  type PromptTarget,
} from "./prompt-store.ts";

export const IDEA_TITLE_MODEL = "gpt-5.6-terra";
const IDEA_TITLE_INSTRUCTIONS =
  "Write one specific title for this coding-task idea. Return only 2 to 10 words of plain text on one line, with no quotes, Markdown, prefix, or ending punctuation. Maximum 80 characters.";

export interface IdeaTitleRequest {
  idea: string;
  target: PromptTarget;
}

export interface IdeaTitleResult {
  title: string;
  provenance: IdeaTitleProvenance;
}

export interface IdeaTitleOptions {
  apiKey: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

export async function generateIdeaTitle(
  request: IdeaTitleRequest,
  options: IdeaTitleOptions,
): Promise<IdeaTitleResult> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error(
      "Add an OpenAI API key in Prompt Studio preferences. Use a manual title instead.",
    );
  }
  if (!request.idea.trim()) throw new Error("Idea text is required.");
  if (request.idea.length > 20_000)
    throw new Error("Idea text must be 20,000 characters or fewer.");
  if (!PROMPT_TARGETS.includes(request.target))
    throw new Error(`Unsupported idea target: ${request.target}.`);

  const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const response = await (options.fetcher ?? fetch)(
    options.endpoint ?? "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IDEA_TITLE_MODEL,
        instructions: IDEA_TITLE_INSTRUCTIONS,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  idea: request.idea,
                  target: request.target,
                }),
              },
            ],
          },
        ],
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        max_output_tokens: 128,
        store: false,
        service_tier: "default",
        safety_identifier: "prompt-studio-local-user",
      }),
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(
      `OpenAI rejected the idea-title request (${response.status}). No idea was saved. No provider fallback occurred.`,
    );
  }

  const title = validateIdeaTitle(openAIOutputText(await response.json()));
  return {
    title,
    provenance: {
      provider: "openai",
      model: IDEA_TITLE_MODEL,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function validateIdeaTitle(value: unknown): string {
  if (typeof value !== "string") throw new Error("Idea title must be text.");
  const title = value.trim();
  if (!title) throw new Error("Idea title is required.");
  if (/[\r\n]/u.test(title))
    throw new Error("Idea title must fit on one line.");
  if (title.length > 80)
    throw new Error("Idea title must be 80 characters or fewer.");
  const words = title.split(/\s+/u);
  if (words.length < 2 || words.length > 10)
    throw new Error("Idea title must contain 2 to 10 words.");
  if (
    /^["'`#>*+-]/u.test(title) ||
    /["'`]$/u.test(title) ||
    /[.!?:;]$/u.test(title)
  ) {
    throw new Error(
      "Idea title must be plain text without quotes, Markdown, or ending punctuation.",
    );
  }
  return title;
}

function openAIOutputText(value: unknown): string {
  if (!isObject(value)) throw new Error("OpenAI returned an invalid response.");
  if (value.error) {
    throw new Error(
      "OpenAI returned an idea-title error. No idea was saved. No provider fallback occurred.",
    );
  }
  if (value.status !== "completed" || !Array.isArray(value.output)) {
    throw new Error(
      "OpenAI returned no completed idea title. No idea was saved. No provider fallback occurred.",
    );
  }
  const output: string[] = [];
  for (const item of value.output) {
    if (!isObject(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isObject(content)) continue;
      if (content.type === "refusal") {
        throw new Error(
          "OpenAI declined the idea-title request. No idea was saved. No provider fallback occurred.",
        );
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        output.push(content.text);
      }
    }
  }
  if (output.length !== 1) {
    throw new Error(
      "OpenAI must return exactly one idea title. No idea was saved. No provider fallback occurred.",
    );
  }
  return output[0]!;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
