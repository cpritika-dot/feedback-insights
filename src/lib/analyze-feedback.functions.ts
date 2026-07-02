import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const CATEGORIES = [
  "Account",
  "Order & Fulfillment",
  "Payment & Checkout",
  "Returns & Refunds",
  "Product",
  "Website/App UX",
  "Customer Support",
  "Pricing & Promotions",
  "Other/Uncategorized",
] as const;

const ItemSchema = z.object({
  excerpt: z.string(),
  urgency: z.enum(["high", "medium", "low"]),
  type: z.enum(["bug report", "feature request", "complaint", "praise", "question"]),
  actionable: z.boolean(),
  confidence: z.number(),
  category: z.enum(CATEGORIES),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  summary: z.string(),
});

const ResultSchema = z.object({
  overallSummary: z.string(),
  items: z.array(ItemSchema),
});

export type AnalysisResult = z.infer<typeof ResultSchema>;
export type AnalysisItem = z.infer<typeof ItemSchema>;
export const FEEDBACK_CATEGORIES = CATEGORIES;

export const analyzeFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(1).max(100_000) }).parse(input),
  )
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are a product feedback analyst. Analyze user feedback and return structured JSON.

For the input, identify each distinct piece of feedback (one per line, paragraph, or logical unit). For each item, provide:
- excerpt: short quote (max 200 chars) from the original
- urgency: high (blocking / financial / security / trust), medium (broken feature, no workaround), low (minor annoyance, praise, cosmetic)
- type: bug report | feature request | complaint | praise | question
- actionable: true if specific and fixable; false if vague venting
- confidence: your self-reported 0-1 confidence in this categorization
- category: one of [${CATEGORIES.join(", ")}]
- sentiment: positive | neutral | negative
- summary: one-sentence rephrasing

Also produce an overallSummary (2-3 sentences) describing key themes.`;

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt: data.text,
        output: Output.object({ schema: ResultSchema }),
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        throw new Error("The model returned malformed output. Please try again.");
      }
      throw err;
    }
  });
