import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { analyzeFeedback } from "@/lib/analyze-feedback.functions";
import type { AnalysisResult } from "@/lib/analyze-feedback.types";
import { BUSINESS_LINES, BUSINESS_LINE_KEYS, type BusinessLineKey } from "@/lib/business-lines";
import { readRowsFromFile, splitLines, toCsv } from "@/lib/spreadsheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
  Loader2,
  Download,
  ListChecks,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CX Feedback Insights — Intent & Sentiment Analyser" },
      {
        name: "description",
        content:
          "Upload customer comments or chat transcripts and get sentiment, comment type, intent, journey stage, urgency and summaries per business line.",
      },
      { property: "og:title", content: "CX Feedback Insights" },
      {
        property: "og:description",
        content:
          "AI categorisation of customer feedback: sentiment, intent, journey stage and actionability for CX and product teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const URGENCY_COLORS: Record<string, string> = {
  high: "hsl(0 84% 55%)",
  medium: "hsl(38 92% 50%)",
  low: "hsl(142 71% 40%)",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "hsl(142 71% 40%)",
  neutral: "hsl(210 10% 55%)",
  negative: "hsl(0 84% 55%)",
};

const CHART_COLORS = [
  "hsl(221 83% 53%)",
  "hsl(262 83% 58%)",
  "hsl(340 82% 52%)",
  "hsl(24 95% 53%)",
  "hsl(142 71% 45%)",
  "hsl(190 95% 40%)",
  "hsl(48 96% 53%)",
  "hsl(280 65% 60%)",
  "hsl(210 10% 50%)",
];

function Dashboard() {
  const [text, setText] = useState("");
  const [businessLine, setBusinessLine] = useState<BusinessLineKey>("ecommerce");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFileName, setCategoryFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const analyze = useServerFn(analyzeFeedback);

  const statements = useMemo(() => splitLines(text), [text]);

  const onDataFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 2_000_000) return toast.error("File too large (max 2MB)");
    try {
      const rows = await readRowsFromFile(f);
      if (!rows.length) return toast.error("No statements found in that file");
      setText(rows.join("\n"));
      toast.success(`Loaded ${rows.length} statement(s) from ${f.name}`);
    } catch {
      toast.error("Could not read that file");
    }
  };

  const onCategoryFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 1_000_000) return toast.error("File too large (max 1MB)");
    try {
      const rows = await readRowsFromFile(f);
      if (!rows.length) return toast.error("No categories found in that file");
      setCategories(rows.slice(0, 200));
      setCategoryFileName(f.name);
      toast.success(`Loaded ${rows.length} categor(ies) from ${f.name}`);
    } catch {
      toast.error("Could not read that file");
    }
  };

  const run = async () => {
    if (statements.length === 0) return toast.error("Add some feedback first");
    if (statements.length > 300) return toast.error("Max 300 statements per run");
    setLoading(true);
    try {
      const res = await analyze({
        data: {
          statements,
          businessLine,
          categories: categories.length ? categories : undefined,
        },
      });
      setResult(res);
      toast.success(`Analysed ${res.items.length} statement(s)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      if (msg.includes("429")) toast.error("Rate limited — try again shortly.");
      else if (msg.includes("402"))
        toast.error("AI credits exhausted. Add credits in workspace settings.");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const activeCategories = categories.length
    ? categories
    : [...BUSINESS_LINES[businessLine].categories, "Other/Uncategorized"];

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center gap-3">
          <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">CX Feedback Insights</h1>
            <p className="text-sm text-muted-foreground">
              Intent, sentiment and journey categorisation for customer comments &amp; chat
              transcripts
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Configure &amp; input</CardTitle>
            <CardDescription>
              Pick the business line, optionally upload your existing categorisation list, then
              upload a dataset (one statement per row) or paste comments below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Business line</label>
                <Select
                  value={businessLine}
                  onValueChange={(v) => setBusinessLine(v as BusinessLineKey)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_LINE_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {BUSINESS_LINES[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Journey stages: {BUSINESS_LINES[businessLine].journey.join(" → ")}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categorisation list (optional)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt"
                      className="hidden"
                      onChange={(e) => onCategoryFile(e.target.files?.[0] ?? null)}
                    />
                    <span className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium cursor-pointer hover:bg-accent">
                      <ListChecks className="h-4 w-4" />
                      Upload Excel/CSV
                    </span>
                  </label>
                  {categoryFileName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCategories([]);
                        setCategoryFileName(null);
                      }}
                    >
                      Reset to defaults
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {categoryFileName
                    ? `${categories.length} categories from ${categoryFileName}`
                    : `Using ${activeCategories.length} standard categories for this business line`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeCategories.slice(0, 12).map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
              {activeCategories.length > 12 && (
                <Badge variant="secondary">+{activeCategories.length - 12} more</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={(e) => onDataFile(e.target.files?.[0] ?? null)}
                />
                <span className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium cursor-pointer hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  Upload dataset
                </span>
              </label>
              <Button onClick={run} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Analyse
                  </>
                )}
              </Button>
              {text && (
                <Button variant="ghost" onClick={() => setText("")}>
                  Clear
                </Button>
              )}
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"One customer statement per line…\nI was charged twice and can't reach support.\nThe delivery arrived two days late."}
              className="min-h-40 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {statements.length.toLocaleString()} statement(s) · {text.length.toLocaleString()}{" "}
              characters
            </p>
          </CardContent>
        </Card>

        {result && <Results result={result} />}
      </main>
    </div>
  );
}

function Results({ result }: { result: AnalysisResult }) {
  const items = result.items;
  const total = items.length;

  const countBy = (fn: (i: AnalysisResult["items"][number]) => string) => {
    const c: Record<string, number> = {};
    items.forEach((i) => (c[fn(i)] = (c[fn(i)] ?? 0) + 1));
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  };

  const urgencyCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 } as Record<string, number>;
    items.forEach((i) => (c[i.urgency] = (c[i.urgency] ?? 0) + 1));
    return c;
  }, [items]);

  const sentimentCounts = useMemo(() => countBy((i) => i.sentiment), [items]);
  const typeCounts = useMemo(() => countBy((i) => i.type), [items]);
  const categoryCounts = useMemo(
    () => countBy((i) => i.category).sort((a, b) => b.value - a.value),
    [items],
  );
  const journeyCounts = useMemo(
    () => countBy((i) => i.journeyStage).sort((a, b) => b.value - a.value),
    [items],
  );

  const actionableCount = items.filter((i) => i.actionable).length;
  const avgConfidence = items.reduce((s, i) => s + i.confidence, 0) / Math.max(1, items.length);
  const lowConfidence = items.filter((i) => i.confidence < 0.6).length;
  const newCategories = items.filter((i) => i.isNewCategory).length;

  const exportCsv = () => {
    const rows: (string | number | boolean)[][] = [
      [
        "Statement",
        "Sentiment",
        "Type",
        "Category",
        "New category",
        "Journey stage",
        "Intent",
        "Urgency",
        "Actionable",
        "Confidence",
        "Summary",
      ],
      ...items.map((i) => [
        i.statement,
        i.sentiment,
        i.type,
        i.category,
        i.isNewCategory,
        i.journeyStage,
        i.intent,
        i.urgency,
        i.actionable,
        i.confidence,
        i.summary,
      ]),
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cx-feedback-insights.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Overall summary
            </CardTitle>
            <CardDescription>Business line: {result.businessLine}</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.overallSummary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Statements" value={total} icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard
          label="High urgency"
          value={urgencyCounts.high}
          tone="destructive"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Actionable"
          value={`${actionableCount}/${total}`}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Avg confidence"
          value={avgConfidence.toFixed(2)}
          hint={
            lowConfidence > 0
              ? `${lowConfidence} to spot-check${newCategories ? ` · ${newCategories} new categories` : ""}`
              : "all high-confidence"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Sentiment">
          <PieChart>
            <Pie data={sentimentCounts} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
              {sentimentCounts.map((d) => (
                <Cell key={d.name} fill={SENTIMENT_COLORS[d.name] ?? CHART_COLORS[0]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Comment type">
          <PieChart>
            <Pie data={typeCounts} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
              {typeCounts.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Urgency">
          <BarChart
            data={(["high", "medium", "low"] as const).map((k) => ({
              name: k,
              value: urgencyCounts[k] ?? 0,
            }))}
          >
            <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
            <YAxis stroke="currentColor" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {(["high", "medium", "low"] as const).map((k) => (
                <Cell key={k} fill={URGENCY_COLORS[k]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Intent categories">
          <BarChart data={categoryCounts} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" stroke="currentColor" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke="currentColor" fontSize={11} width={150} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {categoryCounts.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Customer journey stage">
          <BarChart data={journeyCounts} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" stroke="currentColor" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke="currentColor" fontSize={11} width={150} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={CHART_COLORS[1]} />
          </BarChart>
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analysed comments</CardTitle>
          <CardDescription>Sorted by urgency, then confidence</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">All ({total})</TabsTrigger>
              <TabsTrigger value="high">High urgency ({urgencyCounts.high})</TabsTrigger>
              <TabsTrigger value="negative">
                Negative ({items.filter((i) => i.sentiment === "negative").length})
              </TabsTrigger>
              <TabsTrigger value="actionable">Actionable ({actionableCount})</TabsTrigger>
              <TabsTrigger value="lowconf">Low confidence ({lowConfidence})</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <ItemTable items={sortItems(items)} />
            </TabsContent>
            <TabsContent value="high">
              <ItemTable items={sortItems(items.filter((i) => i.urgency === "high"))} />
            </TabsContent>
            <TabsContent value="negative">
              <ItemTable items={sortItems(items.filter((i) => i.sentiment === "negative"))} />
            </TabsContent>
            <TabsContent value="actionable">
              <ItemTable items={sortItems(items.filter((i) => i.actionable))} />
            </TabsContent>
            <TabsContent value="lowconf">
              <ItemTable items={sortItems(items.filter((i) => i.confidence < 0.6))} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function sortItems(items: AnalysisResult["items"]) {
  const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  return [...items].sort(
    (a, b) => rank[a.urgency]! - rank[b.urgency]! || b.confidence - a.confidence,
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "destructive" | "success";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ItemTable({ items }: { items: AnalysisResult["items"] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6">No items in this view.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">Comment</TableHead>
            <TableHead>Sentiment</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Journey stage</TableHead>
            <TableHead>Intent</TableHead>
            <TableHead>Urgency</TableHead>
            <TableHead>Actionable</TableHead>
            <TableHead className="text-right">Conf.</TableHead>
            <TableHead className="min-w-56">Summary (≤100 chars)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it, idx) => (
            <TableRow key={idx}>
              <TableCell className="text-sm">{it.statement}</TableCell>
              <TableCell>
                <SentimentBadge sentiment={it.sentiment} />
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{it.type}</Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant="outline">{it.category}</Badge>
                {it.isNewCategory && (
                  <Badge className="ml-1" variant="default">
                    new
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{it.journeyStage}</TableCell>
              <TableCell className="text-sm">{it.intent}</TableCell>
              <TableCell>
                <UrgencyBadge urgency={it.urgency} />
              </TableCell>
              <TableCell className="text-sm">{it.actionable ? "Yes" : "No"}</TableCell>
              <TableCell
                className={`text-right text-xs ${
                  it.confidence < 0.6 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                }`}
              >
                {it.confidence.toFixed(2)}
              </TableCell>
              <TableCell className="text-sm">{it.summary}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: "positive" | "neutral" | "negative" }) {
  const map = {
    positive:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    neutral: "bg-muted text-muted-foreground border-border",
    negative:
      "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${map[sentiment]}`}
    >
      {sentiment}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: "high" | "medium" | "low" }) {
  const map = {
    high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900",
    medium:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${map[urgency]}`}
    >
      {urgency}
    </span>
  );
}
