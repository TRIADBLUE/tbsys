import { useState, useRef, useEffect, useCallback } from "react";
import {
  useChatThreads,
  useChatThread,
  useCreateChatThread,
  useStreamMessage,
  useChatProviders,
  useUpdateChatProvider,
} from "@/hooks/use-chat";
import { useProjects } from "@/hooks/use-projects";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Paperclip,
  X,
  Wrench,
  Loader2,
  Square,
  Settings,
  GitBranch,
  FolderOpen,
  FileCode,
  FolderIcon,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import type { ChatThread, ChatMessage } from "@shared/types";

// ── Compact Chat Pane ──

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
  const [stagedFiles, setStagedFiles] = useState<
    { filename: string; mimeType: string; base64: string; preview?: string }[]
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadDetail?.messages, streamingContent]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        const preview = file.type.startsWith("image/") ? result : undefined;
        setStagedFiles((prev) => [
          ...prev,
          { filename: file.name, mimeType: file.type, base64, preview },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function removeStaged(index: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !threadId || isStreaming) return;
    const content = messageInput.trim();
    const attachments = stagedFiles.length
      ? stagedFiles.map(({ filename, mimeType, base64 }) => ({
          filename,
          mimeType,
          base64,
        }))
      : undefined;
    setMessageInput("");
    setStagedFiles([]);
    await send(threadId, content, attachments);
  }

  const Icon = role === "architect" ? Cpu : Wrench;
  const label = role === "architect" ? "Architect" : "Builder";

  if (!threadId) {
    return (
      <div className="flex flex-col bg-white rounded-lg border border-gray-200 opacity-40">
        <div
          className="px-3 py-2 border-b flex items-center gap-2"
          style={{ borderTopColor: colorAccent, borderTopWidth: 3 }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: colorAccent }} />
          <span className="font-medium text-xs">{label}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs p-4">
          Select a project to start
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white rounded-lg border border-gray-200 min-w-0">
      {/* Header */}
      <div
        className="px-3 py-2 border-b flex items-center gap-2"
        style={{ borderTopColor: colorAccent, borderTopWidth: 3 }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: colorAccent }} />
        <span className="font-medium text-xs">{label}</span>
        {threadDetail?.thread.providerSlug && (
          <Badge variant="outline" className="text-[10px] ml-auto px-1.5 py-0">
            {threadDetail.thread.providerSlug}
          </Badge>
        )}
      </div>

      {/* Messages — compact */}
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-2">
          {threadDetail?.messages.map((msg: ChatMessage) => {
            const attachments = (msg.metadata as any)?.attachments as
              | { filename: string; mimeType: string }[]
              | undefined;
            return (
              <div key={msg.id}>
                {attachments?.length ? (
                  <div className="flex gap-1 mb-1 ml-4">
                    {attachments.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-50 rounded px-1"
                      >
                        <Paperclip className="h-2 w-2" />
                        {a.filename}
                      </span>
                    ))}
                  </div>
                ) : null}
                {msg.role === "user" ? (
                  <div className="flex items-start gap-1.5">
                    <User className="h-3 w-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <Bot
                      className="h-3 w-3 mt-0.5 flex-shrink-0"
                      style={{ color: colorAccent }}
                    />
                    <p className="text-xs text-gray-800 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {isStreaming && streamingContent && (
            <div className="flex items-start gap-1.5">
              <Bot
                className="h-3 w-3 mt-0.5 flex-shrink-0"
                style={{ color: colorAccent }}
              />
              <p className="text-xs text-gray-800 whitespace-pre-wrap">
                {streamingContent}
              </p>
            </div>
          )}

          {isStreaming && !streamingContent && (
            <div className="flex items-center gap-1.5 text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
              {error}
            </div>
          )}

          {(!threadDetail?.messages || threadDetail.messages.length === 0) &&
            !isStreaming && (
              <p className="text-xs text-gray-400 text-center py-4">
                Ask the {label}...
              </p>
            )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Staged files */}
      {stagedFiles.length > 0 && (
        <div className="flex gap-1.5 px-2 pt-2 flex-wrap">
          {stagedFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5 text-[10px] text-gray-600"
            >
              {f.preview ? (
                <img
                  src={f.preview}
                  alt=""
                  className="h-4 w-4 rounded object-cover"
                />
              ) : (
                <Paperclip className="h-2.5 w-2.5" />
              )}
              <span className="truncate max-w-[80px]">{f.filename}</span>
              <button
                type="button"
                onClick={() => removeStaged(i)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-1.5 p-2 border-t"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx,.py,.css,.html,.csv"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
        >
          <Paperclip className="h-3 w-3" />
        </Button>
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder={`Message ${label}...`}
          className="flex-1 h-7 text-xs"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={abort}
          >
            <Square className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!messageInput.trim()}
          >
            <Send className="h-3 w-3" />
          </Button>
        )}
      </form>
    </div>
  );
}

// ── Code Viewer Panel ──

function CodePanel({
  repo,
  onFileSelect,
}: {
  repo: string | null;
  onFileSelect?: (path: string) => void;
}) {
  const [currentPath, setCurrentPath] = useState("");
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  // Reset when repo changes
  useEffect(() => {
    setCurrentPath("");
    setViewingFile(null);
  }, [repo]);

  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ["github-tree", repo, currentPath],
    queryFn: () =>
      apiClient.get<{
        type: string;
        contents: { name: string; path: string; type: string; size: number | null }[];
      }>("/github/tree", { repo: repo!, path: currentPath || undefined }),
    enabled: !!repo && !viewingFile,
  });

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ["github-file", repo, viewingFile],
    queryFn: () =>
      apiClient.get<{ name: string; path: string; content: string; size: number }>(
        "/github/file",
        { repo: repo!, path: viewingFile! },
      ),
    enabled: !!repo && !!viewingFile,
  });

  function handleItemClick(item: { name: string; path: string; type: string }) {
    if (item.type === "dir") {
      setCurrentPath(item.path);
      setViewingFile(null);
    } else {
      setViewingFile(item.path);
      onFileSelect?.(item.path);
    }
  }

  function handleBack() {
    if (viewingFile) {
      setViewingFile(null);
      return;
    }
    const parts = currentPath.split("/");
    parts.pop();
    setCurrentPath(parts.join("/"));
  }

  if (!repo) {
    return (
      <div className="flex-1 flex flex-col bg-gray-900 rounded-lg border border-gray-700 items-center justify-center text-gray-500">
        <FileCode className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">Select a project to browse code</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 rounded-lg border border-gray-700 min-w-0 overflow-hidden">
      {/* File browser header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
        {(currentPath || viewingFile) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
            onClick={handleBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
          <GitBranch className="h-3 w-3 flex-shrink-0" />
          <span className="font-mono truncate">
            {repo}
            {currentPath && `/${currentPath}`}
            {viewingFile && `/${viewingFile.split("/").pop()}`}
          </span>
        </div>
      </div>

      {/* Content area */}
      <ScrollArea className="flex-1">
        {viewingFile ? (
          // File viewer
          fileLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-xs">Loading file...</span>
            </div>
          ) : fileData ? (
            <pre className="p-4 text-xs font-mono text-gray-300 leading-relaxed whitespace-pre overflow-x-auto">
              {fileData.content}
            </pre>
          ) : (
            <p className="text-xs text-gray-500 text-center py-8">
              Could not load file
            </p>
          )
        ) : // Directory listing
        treeLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Loading...</span>
          </div>
        ) : treeData?.contents ? (
          <div className="py-1">
            {[...treeData.contents]
              .sort((a, b) => {
                if (a.type === "dir" && b.type !== "dir") return -1;
                if (a.type !== "dir" && b.type === "dir") return 1;
                return a.name.localeCompare(b.name);
              })
              .map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 text-left group"
                >
                  {item.type === "dir" ? (
                    <FolderIcon className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                  ) : (
                    <FileCode className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                  )}
                  <span className="text-xs text-gray-300 truncate font-mono">
                    {item.name}
                  </span>
                  {item.type === "dir" && (
                    <ChevronRight className="h-3 w-3 text-gray-600 ml-auto opacity-0 group-hover:opacity-100" />
                  )}
                  {item.size != null && item.type !== "dir" && (
                    <span className="text-[10px] text-gray-600 ml-auto">
                      {item.size > 1024
                        ? `${(item.size / 1024).toFixed(1)}k`
                        : `${item.size}b`}
                    </span>
                  )}
                </button>
              ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 text-center py-8">
            Could not load directory
          </p>
        )}
      </ScrollArea>
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

  // When a project is selected, find existing paired threads
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

    const archProv =
      architectProvider || enabledProviders[0]?.slug || undefined;
    const buildProv =
      builderProvider || enabledProviders[0]?.slug || undefined;

    if (!architectThreadId) {
      const arch = await createThread.mutateAsync({
        title: `${project.displayName} — Architect`,
        agentRole: "architect",
        providerSlug: archProv,
        projectId: pid,
      });
      setArchitectThreadId(arch.thread.id);
    }

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
    <div className="max-w-[1800px] mx-auto px-4 py-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">Workspace</h1>

          {/* Project Selector */}
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-52 h-9">
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
              <div className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-purple-500" />
                <Select
                  value={architectProvider}
                  onValueChange={setArchitectProvider}
                >
                  <SelectTrigger className="w-36 h-8 text-xs">
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
              <div className="flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5 text-blue-500" />
                <Select
                  value={builderProvider}
                  onValueChange={setBuilderProvider}
                >
                  <SelectTrigger className="w-36 h-8 text-xs">
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
              size="sm"
              disabled={createThread.isPending || enabledProviders.length === 0}
            >
              <GitBranch className="h-3.5 w-3.5 mr-1.5" />
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

      {/* Three-Column Layout: Architect | Code | Builder */}
      <div
        className="grid gap-3 h-[calc(100vh-140px)]"
        style={{ gridTemplateColumns: "280px 1fr 280px" }}
      >
        {/* Left: Architect */}
        <ChatPane
          role="architect"
          threadId={architectThreadId}
          colorAccent="#7C3AED"
        />

        {/* Center: Code Viewer */}
        <CodePanel repo={selectedProject?.githubRepo || null} />

        {/* Right: Builder */}
        <ChatPane
          role="builder"
          threadId={builderThreadId}
          colorAccent="#2563EB"
        />
      </div>
    </div>
  );
}
