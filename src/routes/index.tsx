import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  analyzeFeedback,
  type AnalysisResult,
  FEEDBACK_CATEGORIES,
} from "@/lib/analyze-feedback.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
      { title: "Feedback Insights Dashboard" },
      {
        name: "description",
        content:
          "Upload or paste customer feedback to get urgency, type, category and actionability breakdowns.",
      },
      { property: "og:title", content: "Feedback Insights Dashboard" },
      {
        property: "og:description",
        content: "AI-powered analysis of customer feedback for PMs and support teams.",
      },
    ],
  }),
  component: Dashboard,
});

const URGENCY_COLORS: Record<string, string> = {
  high: "hsl(0 84% 55%)",
  medium: "hsl(38 92% 50%)",
  low: "hsl(142 71% 40%)",
};

const CATEGORY_COLORS = [
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const analyze = useServerFn(analyzeFeedback);

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 500_000) {
      toast.error("File too large (max 500KB)");
      return;
    }
    const t = await f.text();
    setText(t);
    toast.success(`Loaded ${f.name}`);
  };

  const run = async () => {
    if (!text.trim()) {
      toast.error("Add some feedback text first");
      return;
    }
    setLoading(true);
    try {
      const res = await analyze({ data: { text } });
      setResult(res);
      toast.success(`Analyzed ${res.items.length} item(s)`);
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

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center gap-3">
          <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Feedback Insights</h1>
            <p className="text-sm text-muted-foreground">
              Turn raw feedback into prioritized, categorized signal
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Input feedback</CardTitle>
            <CardDescription>
              Upload a .txt file or paste feedback below. Multiple entries can be separated by
              blank lines.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".txt,.md,.csv,text/plain"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                <span className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium cursor-pointer hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  Upload text file
                </span>
              </label>
              <Button onClick={run} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Analyze
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
              placeholder="Paste feedback here… e.g. 'I was charged twice and can't reach support.' or 'The search bar is really slow on mobile.'"
              className="min-h-40 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {text.length.toLocaleString()} characters
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

  const urgencyCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 } as Record<string, number>;
    items.forEach((i) => (c[i.urgency] = (c[i.urgency] ?? 0) + 1));
    return c;
  }, [items]);

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    items.forEach((i) => (c[i.type] = (c[i.type] ?? 0) + 1));
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [items]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    FEEDBACK_CATEGORIES.forEach((cat) => (c[cat] = 0));
    items.forEach((i) => (c[i.category] = (c[i.category] ?? 0) + 1));
    return Object.entries(c)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [items]);

  const actionableCount = items.filter((i) => i.actionable).length;
  const avgConfidence =
    items.reduce((s, i) => s + i.confidence, 0) / Math.max(1, items.length);
  const lowConfidence = items.filter((i) => i.confidence < 0.6).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Overall summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.overallSummary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total items"
          value={total}
          icon={<MessageSquare className="h-4 w-4" />}
        />
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
          hint={lowConfidence > 0 ? `${lowConfidence} low-conf items` : "all high-conf"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Urgency</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(["high", "medium", "low"] as const).map((k) => ({
                  name: k,
                  value: urgencyCounts[k] ?? 0,
                }))}
              >
                <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {(["high", "medium", "low"] as const).map((k) => (
                    <Cell key={k} fill={URGENCY_COLORS[k]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Feedback type</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeCounts}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {typeCounts.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryCounts} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" stroke="currentColor" fontSize={11} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="currentColor"
                  fontSize={11}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categoryCounts.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>Sorted by urgency, then confidence</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({total})</TabsTrigger>
              <TabsTrigger value="high">High urgency ({urgencyCounts.high})</TabsTrigger>
              <TabsTrigger value="actionable">Actionable ({actionableCount})</TabsTrigger>
              <TabsTrigger value="lowconf">Low confidence ({lowConfidence})</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <ItemList items={sortItems(items)} />
            </TabsContent>
            <TabsContent value="high">
              <ItemList items={sortItems(items.filter((i) => i.urgency === "high"))} />
            </TabsContent>
            <TabsContent value="actionable">
              <ItemList items={sortItems(items.filter((i) => i.actionable))} />
            </TabsContent>
            <TabsContent value="lowconf">
              <ItemList items={sortItems(items.filter((i) => i.confidence < 0.6))} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function sortItems(items: AnalysisResult["items"]) {
  const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  return [...items].sort(
    (a, b) => rank[a.urgency] - rank[b.urgency] || b.confidence - a.confidence,
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

function ItemList({ items }: { items: AnalysisResult["items"] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6">No items in this view.</p>;
  }
  return (
    <ul className="divide-y">
      {items.map((it, idx) => (
        <li key={idx} className="py-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <UrgencyBadge urgency={it.urgency} />
            <Badge variant="secondary">{it.type}</Badge>
            <Badge variant="outline">{it.category}</Badge>
            <Badge variant={it.actionable ? "default" : "outline"}>
              {it.actionable ? "Actionable" : "Not actionable"}
            </Badge>
            <Badge variant="outline">sentiment: {it.sentiment}</Badge>
            <span
              className={`ml-auto text-xs ${
                it.confidence < 0.6 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}
            >
              confidence {it.confidence.toFixed(2)}
            </span>
          </div>
          <p className="text-sm font-medium">{it.summary}</p>
          <p className="text-sm text-muted-foreground italic">"{it.excerpt}"</p>
        </li>
      ))}
    </ul>
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
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${map[urgency]}`}
    >
      {urgency} urgency
    </span>
  );
}
