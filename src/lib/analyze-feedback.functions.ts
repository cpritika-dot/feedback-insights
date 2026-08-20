import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runFeedbackAnalysis } from "./analyze-feedback.server";

const InputSchema = z.object({
  statements: z.array(z.string().min(1)).min(1).max(300),
  businessLine: z.string().min(1).max(60),
  categories: z.array(z.string().min(1).max(120)).max(200).optional(),
});

export const analyzeFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => runFeedbackAnalysis(data));
