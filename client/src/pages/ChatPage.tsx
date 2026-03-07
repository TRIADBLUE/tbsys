import { useState, useRef, useEffect } from "react";
import {
  useChatThreads,
  useChatThread,
  useCreateChatThread,
  useStreamMessage,
  useArchiveChatThread,
  useChatProviders,
  useUpdateChatProvider,
} from "@/hooks/use-chat";
import { useProjects } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Send,
  Bot,
  User,
  Cpu,
  Wrench,
  Loader2,
  Square,
  Settings,
  GitBranch,
  FolderOpen,
} from "lucide-react";
import type { ChatThread, ChatMessage } from "@shared/types";

// ── Single Chat Pane (reusable for Architect or Builder) ──

function ChatPane({
  role,
  threadId,
  colorAccent,
}: {
  role: "architect" | "builder";
  threadId: number | null;
  colorAccent: string;
}) {
  const { data: threadDetail } = useChatThread(threadId);
  const { send, streamingContent, isStreaming, error, abort } =
    useStreamMessage();
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadDetail?.messages, streamingContent]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !threadId || isStreaming) return;
    const content = messageInput.trim();
    setMessageInput("");
    await send(threadId, content);
  }

  const Icon = role === "architect" ? Cpu : Wrench;
  const label = role === "architect" ? "Architect" : "Builder";
  const subtitle =
    role === "architect"
      ? "Plans, reviews & inspects"
      : "Writes code & implements";

  if (!threadId) {
    return (
      <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 opacity-50">
        <div
          className="px-4 py-3 border-b flex items-center gap-2"
          style={{ borderTopColor: colorAccent, borderTopWidth: 3 }}
        >
          <Icon className="h-4 w-4" style={{ color: colorAccent }} />
          <span className="font-medium text-sm">{label}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select a project to start
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 min-w-0">
      {/* Pane Header */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderTopColor: colorAccent, borderTopWidth: 3 }}
      >
        <Icon className="h-4 w-4" style={{ color: colorAccent }} />
        <div>
          <span className="font-medium text-sm">{label}</span>
          <span className="text-xs text-gray-400 ml-2">{subtitle}</span>
        </div>
        {threadDetail?.thread.providerSlug && (
          <Badge variant="outline" className="text-xs ml-auto">
            {threadDetail.thread.providerSlug}
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {threadDetail?.messages.map((msg: ChatMessage) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role !== "user" && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${colorAccent}15` }}
                >
                  <Bot className="h-4 w-4" style={{ color: colorAccent }} />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.role === "user" ? "text-blue-200" : "text-gray-400"
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {isStreaming && streamingContent && (
            <div className="flex gap-3 justify-start">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${colorAccent}15` }}
              >
                <Bot className="h-4 w-4" style={{ color: colorAccent }} />
              </div>
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-700">
                <p className="whitespace-pre-wrap">{streamingContent}</p>
              </div>
            </div>
          )}

          {isStreaming && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${colorAccent}15` }}
              >
                <Bot className="h-4 w-4" style={{ color: colorAccent }} />
              </div>
              <div className="rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-400 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </div>
            </div>
          )}

          {error && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-red-600" />
              </div>
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
                <p>{error}</p>
              </div>
            </div>
          )}

          {(!threadDetail?.messages || threadDetail.messages.length === 0) &&
            !isStreaming && (
              <p className="text-sm text-gray-400 text-center py-8">
                Start a conversation with the {label}...
              </p>
            )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 p-3 border-t"
      >
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder={`Ask the ${label}...`}
          className="flex-1"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={abort}
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={!messageInput.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}

// ── Main Chat Page ──

export default function ChatPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [architectThreadId, setArchitectThreadId] = useState<number | null>(
    null,
  );
  const [builderThreadId, setBuilderThreadId] = useState<number | null>(null);
  const [architectProvider, setArchitectProvider] = useState<string>("");
  const [builderProvider, setBuilderProvider] = useState<string>("");

  const { data: projectData } = useProjects();
  const { data: providersData } = useChatProviders();
  const { data: threadsData } = useChatThreads();
  const createThread = useCreateChatThread();
  const updateProvider = useUpdateChatProvider();

  const enabledProviders =
    providersData?.providers.filter((p) => p.isEnabled) || [];
  const projects = projectData?.projects || [];

  const selectedProject = projects.find(
    (p) => String(p.id) === selectedProjectId,
  );

  // When a project is selected, find or create paired threads
  useEffect(() => {
    if (!selectedProjectId || !threadsData?.threads) return;

    const pid = parseInt(selectedProjectId, 10);
    const projectThreads = threadsData.threads.filter(
      (t: ChatThread) => t.projectId === pid && t.status === "active",
    );

    const archThread = projectThreads.find(
      (t: ChatThread) => t.agentRole === "architect",
    );
    const buildThread = projectThreads.find(
      (t: ChatThread) => t.agentRole === "builder",
    );

    setArchitectThreadId(archThread?.id ?? null);
    setBuilderThreadId(buildThread?.id ?? null);
  }, [selectedProjectId, threadsData?.threads]);

  async function handleStartWorkspace() {
    if (!selectedProjectId) return;
    const pid = parseInt(selectedProjectId, 10);
    const project = projects.find((p) => p.id === pid);
    if (!project) return;

    const archProv = architectProvider || enabledProviders[0]?.slug || undefined;
    const buildProv = builderProvider || enabledProviders[0]?.slug || undefined;

    // Create architect thread if none exists
    if (!architectThreadId) {
      const arch = await createThread.mutateAsync({
        title: `${project.displayName} — Architect`,
        agentRole: "architect",
        providerSlug: archProv,
        projectId: pid,
      });
      setArchitectThreadId(arch.thread.id);
    }

    // Create builder thread if none exists
    if (!builderThreadId) {
      const build = await createThread.mutateAsync({
        title: `${project.displayName} — Builder`,
        agentRole: "builder",
        providerSlug: buildProv,
        projectId: pid,
      });
      setBuilderThreadId(build.thread.id);
    }
  }

  function handleToggleProvider(slug: string, enabled: boolean) {
    updateProvider.mutate({ slug, data: { isEnabled: enabled } });
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Workspace</h1>

          {/* Project Selector */}
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-56">
              <FolderOpen className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.colorPrimary || "#666" }}
                    />
                    {p.displayName}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Provider Selectors */}
          {selectedProjectId && (
            <>
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-purple-500" />
                <Select value={architectProvider} onValueChange={setArchitectProvider}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="Architect AI" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledProviders.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                    {enabledProviders.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Enable a provider
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <Wrench className="h-4 w-4 text-blue-500" />
                <Select value={builderProvider} onValueChange={setBuilderProvider}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="Builder AI" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledProviders.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                    {enabledProviders.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Enable a provider
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Start Button */}
          {selectedProjectId && (!architectThreadId || !builderThreadId) && (
            <Button
              onClick={handleStartWorkspace}
              disabled={createThread.isPending || enabledProviders.length === 0}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              {createThread.isPending ? "Creating..." : "Start Workspace"}
            </Button>
          )}
        </div>

        {/* Providers Settings */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Providers
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>AI Providers</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {providersData?.providers.map((provider) => (
                <div
                  key={provider.slug}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <Label className="text-sm font-medium">
                      {provider.displayName}
                    </Label>
                    <p className="text-xs text-gray-400">
                      {provider.providerType}
                      {provider.defaultForRole && (
                        <span>
                          {" "}
                          &middot; default for {provider.defaultForRole}
                        </span>
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={provider.isEnabled}
                    onCheckedChange={(checked) =>
                      handleToggleProvider(provider.slug, checked)
                    }
                  />
                </div>
              ))}
              {!providersData?.providers.length && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No providers configured.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project Context Bar */}
      {selectedProject && (
        <div className="flex items-center gap-4 mb-4 px-4 py-2 bg-gray-50 rounded-lg border text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: selectedProject.colorPrimary || "#666" }}
          />
          <span className="font-medium">{selectedProject.displayName}</span>
          {selectedProject.githubRepo && (
            <span className="text-gray-400 flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {selectedProject.githubRepo}
            </span>
          )}
          {selectedProject.productionUrl && (
            <a
              href={selectedProject.productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {selectedProject.productionUrl}
            </a>
          )}
          <Badge
            variant="secondary"
            className="text-xs capitalize ml-auto"
          >
            {selectedProject.status}
          </Badge>
        </div>
      )}

      {/* Dual Pane Chat */}
      <div className="flex gap-4 h-[calc(100vh-220px)]">
        <ChatPane
          role="architect"
          threadId={architectThreadId}
          colorAccent="#7C3AED"
        />
        <ChatPane
          role="builder"
          threadId={builderThreadId}
          colorAccent="#2563EB"
        />
      </div>
    </div>
  );
}
