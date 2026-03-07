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
  Plus,
  Send,
  MessageSquare,
  Bot,
  User,
  Trash2,
  Cpu,
  Wrench,
  Loader2,
  Square,
  Settings,
} from "lucide-react";
import type { ChatThread } from "@shared/types";

export default function ChatPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadRole, setNewThreadRole] = useState<string>("builder");
  const [newThreadProvider, setNewThreadProvider] = useState<string>("");
  const [newThreadProject, setNewThreadProject] = useState<string>("");
  const [messageInput, setMessageInput] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: threadsData, isLoading: threadsLoading } = useChatThreads();
  const { data: threadDetail } = useChatThread(selectedThreadId);
  const createThread = useCreateChatThread();
  const { send, streamingContent, isStreaming, error, abort } = useStreamMessage();
  const archiveThread = useArchiveChatThread();
  const { data: projectData } = useProjects();
  const { data: providersData } = useChatProviders();
  const updateProvider = useUpdateChatProvider();

  const enabledProviders = providersData?.providers.filter((p) => p.isEnabled) || [];

  // Auto-scroll when new messages arrive or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadDetail?.messages, streamingContent]);

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!newThreadTitle.trim()) return;

    const result = await createThread.mutateAsync({
      title: newThreadTitle.trim(),
      agentRole: newThreadRole as any,
      providerSlug: newThreadProvider || undefined,
      projectId: newThreadProject ? parseInt(newThreadProject, 10) : undefined,
    });

    setSelectedThreadId(result.thread.id);
    setNewThreadTitle("");
    setNewThreadProvider("");
    setNewThreadProject("");
    setShowNewThread(false);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !selectedThreadId || isStreaming) return;

    const content = messageInput.trim();
    setMessageInput("");
    await send(selectedThreadId, content);
  }

  function handleToggleProvider(slug: string, enabled: boolean) {
    updateProvider.mutate({ slug, data: { isEnabled: enabled } });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
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
                        <span> &middot; default for {provider.defaultForRole}</span>
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
                  No providers configured. Run db:seed to add them.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        {/* Thread Sidebar */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">Threads</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNewThread(!showNewThread)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showNewThread && (
            <form onSubmit={handleCreateThread} className="mb-3 space-y-2">
              <Input
                value={newThreadTitle}
                onChange={(e) => setNewThreadTitle(e.target.value)}
                placeholder="Thread title"
                className="h-8 text-sm"
                autoFocus
              />
              <Select value={newThreadProject} onValueChange={setNewThreadProject}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {projectData?.projects?.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newThreadRole} onValueChange={setNewThreadRole}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builder">Builder</SelectItem>
                  <SelectItem value="architect">Architect</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newThreadProvider} onValueChange={setNewThreadProvider}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="AI Provider" />
                </SelectTrigger>
                <SelectContent>
                  {enabledProviders.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                  {enabledProviders.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No providers enabled
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" className="h-8 w-full">
                Create
              </Button>
            </form>
          )}

          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {threadsLoading ? (
                <Skeleton className="h-12" />
              ) : (
                threadsData?.threads.map((thread: ChatThread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                      selectedThreadId === thread.id
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {thread.agentRole === "architect" ? (
                        <Cpu className="h-3.5 w-3.5 text-purple-500" />
                      ) : (
                        <Wrench className="h-3.5 w-3.5 text-blue-500" />
                      )}
                      <span className="text-sm font-medium text-gray-700 truncate">
                        {thread.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className="text-xs capitalize"
                      >
                        {thread.agentRole}
                      </Badge>
                      {thread.providerSlug && (
                        <Badge variant="outline" className="text-xs">
                          {thread.providerSlug}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(thread.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))
              )}
              {!threadsLoading &&
                (!threadsData?.threads || threadsData.threads.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No threads yet
                  </p>
                )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-3 flex flex-col bg-white rounded-lg border border-gray-200">
          {selectedThreadId && threadDetail ? (
            <>
              {/* Thread Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-sm">
                    {threadDetail.thread.title}
                  </span>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {threadDetail.thread.agentRole}
                  </Badge>
                  {threadDetail.thread.providerSlug && (
                    <Badge variant="outline" className="text-xs">
                      {threadDetail.thread.providerSlug}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    archiveThread.mutate(selectedThreadId);
                    setSelectedThreadId(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-gray-400" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {threadDetail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role !== "user" && (
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-purple-600" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.role === "user"
                              ? "text-blue-200"
                              : "text-gray-400"
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

                  {/* Streaming message */}
                  {isStreaming && streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-700">
                        <p className="whitespace-pre-wrap">{streamingContent}</p>
                      </div>
                    </div>
                  )}

                  {/* Streaming indicator (before any content arrives) */}
                  {isStreaming && !streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-400 flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  )}

                  {/* Error display */}
                  {error && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
                        <p>{error}</p>
                      </div>
                    </div>
                  )}

                  {threadDetail.messages.length === 0 && !isStreaming && (
                    <p className="text-sm text-gray-400 text-center py-8">
                      Start a conversation...
                    </p>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 p-3 border-t"
              >
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
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
                  <Button
                    type="submit"
                    disabled={!messageInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a thread or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
