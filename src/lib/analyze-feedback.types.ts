export const COMMENT_TYPES = [
  "query",
  "request",
  "complaint",
  "praise",
  "bug report",
  "other",
] as const;

export type CommentType = (typeof COMMENT_TYPES)[number];
export type Urgency = "high" | "medium" | "low";
export type Sentiment = "positive" | "neutral" | "negative";

export type AnalysisItem = {
  statement: string;
  sentiment: Sentiment;
  type: CommentType;
  category: string;
  isNewCategory: boolean;
  journeyStage: string;
  intent: string;
  urgency: Urgency;
  actionable: boolean;
  confidence: number;
  summary: string;
};

export type AnalysisResult = {
  overallSummary: string;
  businessLine: string;
  items: AnalysisItem[];
};
