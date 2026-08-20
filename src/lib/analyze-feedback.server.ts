import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { BUSINESS_LINES, FALLBACK_CATEGORY, type BusinessLineKey } from "./business-lines";
import { COMMENT_TYPES, type AnalysisResult } from "./analyze-feedback.types";

const ItemSchema = z.object({
  statement: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  type: z.enum(COMMENT_TYPES),
  category: z.string(),
  isNewCategory: z.boolean().default(false),
  journeyStage: z.string(),
  intent: z.string(),
  urgency: z.enum(["high", "medium", "low"]),
  actionable: z.boolean(),
  confidence: z.number(),
  summary: z.string(),
});

const ResultSchema = z.object({
  overallSummary: z.string(),
  items: z.array(ItemSchema),
});

export async function runFeedbackAnalysis(data: {
  statements: string[];
  businessLine: string;
  categories?: string[];
}): Promise<AnalysisResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const line = BUSINESS_LINES[data.businessLine as BusinessLineKey];
  const label = line?.label ?? data.businessLine;
  const journey = line?.journey ?? [];
  const baseCategories =
    data.categories && data.categories.length > 0
      ? data.categories
      : [...(line?.categories ?? []), FALLBACK_CATEGORY];

  const gateway = createLovableAiGatewayProvider(key);

  const system = `You are a CX analyst for a ${label} business. Analyze each customer comment / chat transcript line and return structured JSON.

Use this standard categorisation list where relevant; only invent a new category when nothing fits, and then set isNewCategory to true:
${baseCategories.map((c) => `- ${c}`).join("\n")}

Map each item to a stage of the ${label} customer journey. Preferred stages:
${journey.length ? journey.map((s) => `- ${s}`).join("\n") : "- (infer sensible stages)"}

For every input statement, in the same order, output:
- statement: the original statement, verbatim
- sentiment: positive | neutral | negative
- type: ${COMMENT_TYPES.join(" | ")}
- category: from the list above (or a new one, with isNewCategory true)
- isNewCategory: boolean
- journeyStage: from the stage list above
- intent: short phrase (max 60 chars) describing what the customer wants
- urgency: high (blocking / financial / safety / trust), medium (broken experience, workaround exists), low (minor annoyance, praise, cosmetic)
- actionable: true if specific and fixable, false if vague venting
- confidence: your self-reported 0-1 confidence in this categorisation
- summary: rephrasing of the statement in at most 100 characters

Also produce overallSummary (2-3 sentences on key themes).

Respond with ONLY a JSON object, no prose, no markdown fences:
{"overallSummary": string, "items": [{"statement": string, "sentiment": string, "type": string, "category": string, "isNewCategory": boolean, "journeyStage": string, "intent": string, "urgency": string, "actionable": boolean, "confidence": number, "summary": string}]}`;

  const prompt = data.statements.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const { text } = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    system,
    prompt,
  });

  const cleaned = extractJson(text);
  try {
    const parsed = ResultSchema.parse(JSON.parse(cleaned));
    return {
      overallSummary: parsed.overallSummary,
      businessLine: label,
      items: parsed.items.map((it) => ({
        ...it,
        summary: it.summary.slice(0, 100),
      })),
    };
  } catch (err) {
    console.error("Failed to parse model output:", err, "\nRaw:", text);
    throw new Error("The model returned malformed output. Please try again.");
  }
}

function extractJson(raw: string): string {
  let s = raw.trim();
  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (s.startsWith("{") || s.startsWith("[")) return s;
  const objStart = s.indexOf("{");
  const arrStart = s.indexOf("[");
  const isArr = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
  const start = isArr ? arrStart : objStart;
  const end = isArr ? s.lastIndexOf("]") : s.lastIndexOf("}");
  if (start !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}
