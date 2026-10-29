"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { LifeBuoy, Search, Send, Sparkles, Clock, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TicketResult {
  ticket_id: number;
  client_id: number;
  company_name?: string;
  subject: string;
  body: string;
  created_at: string;
  similarity?: number;
}

interface ClientOption {
  client_id: number;
  company_name: string;
}

const SAMPLE_QUERIES = [
  "my server keeps charging me even though I turned it off",
  "why was my account frozen and unable to deploy",
  "export raw usage logs to a spreadsheet",
  "Frankfurt data center maintenance failure",
];

export default function SupportPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TicketResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [recentTickets, setRecentTickets] = useState<TicketResult[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number>(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoadingRecent(true);
    const [ticketsRes, clientsRes] = await Promise.all([
      fetch("/api/tickets"),
      fetch("/api/clients"),
    ]);
    if (ticketsRes.ok) {
      const tData = await ticketsRes.json();
      setRecentTickets(tData.tickets ?? []);
    }
    if (clientsRes.ok) {
      const cData = await clientsRes.json();
      const cList: ClientOption[] = cData.clients ?? [];
      setClients(cList);
      if (cList.length > 0) {
        setSelectedClientId((prev) => prev || cList[0].client_id);
      }
    }
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitial();
  }, [loadInitial]);

  async function runSearch(searchQuery: string) {
    if (searchQuery.trim().length < 3) return;
    setSearching(true);
    const res = await fetch("/api/tickets/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery, limit: 5 }),
    });
    if (res.ok) {
      const data = await res.json();
      setResults(data.results);
    } else {
      toast.error("Search failed.");
    }
    setSearching(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await runSearch(query);
  }

  async function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) {
      toast.error("No client mapped to this account.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Number(selectedClientId),
        subject,
        body,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Ticket submitted and embedded into pgvector.");
      setSubject("");
      setBody("");
      await loadInitial();
    } else {
      toast.error("Failed to submit ticket.");
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-[10px]">
            PostgreSQL + pgvector
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            Xenova/all-MiniLM-L6-v2 · 384-dim Cosine Similarity (&lt;=&gt;)
          </span>
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          AI Semantic Support Hub
        </h1>
        <p className="text-sm text-muted-foreground">
          Search historical tickets by conceptual meaning rather than exact keywords, or submit a new support ticket.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Semantic Search */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Card className="border-border/80 shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Semantic Vector Search
              </CardTitle>
              <CardDescription>
                Describe an issue in natural language — pgvector ranks past tickets by cosine similarity.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. server won't stop billing after shutdown"
                    className="pl-9"
                    minLength={3}
                    required
                  />
                </div>
                <Button type="submit" disabled={searching}>
                  {searching ? "Embedding..." : "Search"}
                </Button>
              </form>

              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Wand2 className="size-3 text-primary" />
                  Try a sample semantic query (zero exact keyword overlap needed):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_QUERIES.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setQuery(sample);
                        runSearch(sample);
                      }}
                      className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    >
                      &ldquo;{sample}&rdquo;
                    </button>
                  ))}
                </div>
              </div>

              {searching && (
                <div className="flex flex-col gap-2 pt-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              )}

              {!searching && results && (
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Top nearest-neighbor tickets</span>
                    <span>Cosine similarity score</span>
                  </div>
                  {results.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No matching tickets in your client scope.
                    </p>
                  )}
                  {results.map((r) => {
                    const pct = Math.max(0, Math.min(100, (r.similarity ?? 0) * 100));
                    return (
                      <div
                        key={r.ticket_id}
                        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 text-sm shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{r.ticket_id}
                            </span>
                            <span className="font-semibold">{r.subject}</span>
                            {r.company_name && (
                              <Badge variant="outline" className="text-[10px]">
                                {r.company_name}
                              </Badge>
                            )}
                          </div>
                          <Badge
                            variant={pct >= 55 ? "default" : "secondary"}
                            className="font-mono text-[11px]"
                          >
                            {pct.toFixed(1)}% match
                          </Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{r.body}</p>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Recent Tickets Feed
              </CardTitle>
              <CardDescription>
                Latest weak-entity <code>support_tickets</code> rows scoped to your accessible clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRecent ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : recentTickets.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No support tickets yet.
                </p>
              ) : (
                <ul className="flex max-h-96 flex-col gap-2.5 overflow-y-auto pr-1">
                  {recentTickets.map((t) => (
                    <li
                      key={t.ticket_id}
                      className="rounded-xl border border-border bg-muted/20 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{t.ticket_id}
                          </span>
                          <span className="font-semibold">{t.subject}</span>
                          {t.company_name && (
                            <Badge variant="secondary" className="text-[10px]">
                              {t.company_name}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Submit New Ticket */}
        <div className="lg:col-span-5">
          <Card className="sticky top-20 border-border/80 shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="size-4 text-primary" />
                Submit a Support Ticket
              </CardTitle>
              <CardDescription>
                Automatically computes a 384-dim vector embedding and stores the ticket under the selected client.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitTicket} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ticket-client">Client Organization (SUBMITS)</Label>
                  <select
                    id="ticket-client"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(Number(e.target.value))}
                    disabled={clients.length <= 1}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring disabled:opacity-70"
                    required
                  >
                    {clients.map((c) => (
                      <option key={c.client_id} value={c.client_id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary of the issue"
                    required
                    minLength={3}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="body">Detailed Description</Label>
                  <textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Describe the symptoms, affected instance IDs, or billing questions..."
                    required
                    minLength={3}
                    rows={5}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
                <Button type="submit" size="lg" disabled={submitting} className="w-full">
                  <Send className="size-4" />
                  {submitting ? "Embedding & Saving..." : "Submit & Embed Ticket"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
