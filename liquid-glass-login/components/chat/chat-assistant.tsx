"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { api } from "@/lib/api/endpoints"
import type { ChatMessagePayload } from "@/lib/api/types"
import { getProfiles } from "@/lib/state/session"
import { cn } from "@/lib/utils"

type Message = ChatMessagePayload & { id: string }
type StoredProfiles = { teachers?: unknown[]; students?: unknown[] }

const MAX_HISTORY = 10 // 5 user/assistant pairs

const initialMessage: Message = {
  id: "assistant-welcome",
  role: "assistant",
  content: "Hi! I can summarize your uploaded teacher and student data, surface insights, and suggest matches.",
}

export function ChatAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([initialMessage])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [indexedSignature, setIndexedSignature] = useState<string | null>(null)
  const [profiles, setProfilesState] = useState<StoredProfiles>({ teachers: [], students: [] })
  const [error, setError] = useState<string | null>(null)

  const messagesRef = useRef(messages)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesRef.current = messages
    // Scroll to bottom whenever chat grows
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load saved profiles on mount and whenever the sheet opens
  const loadProfiles = () => {
    const stored = getProfiles() as unknown as StoredProfiles | null
    if (stored?.teachers || stored?.students) {
      setProfilesState({
        teachers: stored.teachers || [],
        students: stored.students || [],
      })
    } else {
      setProfilesState({ teachers: [], students: [] })
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    if (open) loadProfiles()
  }, [open])

  const hasProfiles = Boolean(
    (profiles.teachers && profiles.teachers.length > 0) || (profiles.students && profiles.students.length > 0),
  )

  const datasetSignature = useMemo(() => {
    if (!hasProfiles) return null
    const teacherIds = (profiles.teachers || []).map((t: any) => t.teacher_id || t.id || t.name || "").join("|")
    const studentIds = (profiles.students || []).map((s: any) => s.student_id || s.id || s.name || "").join("|")
    return JSON.stringify({ teacherIds, studentIds })
  }, [profiles, hasProfiles])

  useEffect(() => {
    if (!hasProfiles || !datasetSignature || datasetSignature === indexedSignature || indexing) return

    async function index() {
      try {
        setIndexing(true)
        setError(null)
        await api.chatIndex({
          teachers: profiles.teachers || [],
          students: profiles.students || [],
        })
        setIndexedSignature(datasetSignature)
        setMessages((prev) =>
          trimMessages([
            ...prev,
            {
              id: cryptoId(),
              role: "assistant",
              content: "Updated my knowledge with the latest teacher and student profiles. Ask away!",
            },
          ]),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to index profiles."
        setError(message)
      } finally {
        setIndexing(false)
      }
    }

    index()
  }, [datasetSignature, hasProfiles, indexedSignature, indexing, profiles])

  const canSend = Boolean(input.trim()) && !sending && hasProfiles && !indexing

  const handleSend = async () => {
    const question = input.trim()
    if (!question || sending) return

    const userMsg: Message = { id: cryptoId(), role: "user", content: question }
    const nextHistory = trimMessages([...messagesRef.current, userMsg])
    setMessages(nextHistory)
    setInput("")
    setSending(true)
    setError(null)

    try {
      const historyPayload: ChatMessagePayload[] = nextHistory.map(({ role, content }) => ({ role, content }))
      const res = await api.chatQuery({ question, history: historyPayload })
      const assistantMsg: Message = {
        id: cryptoId(),
        role: "assistant",
        content: res.answer || "I couldn't generate a response right now.",
      }
      setMessages((prev) => trimMessages([...prev, assistantMsg]))
    } catch (err) {
      const fallback =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : "Unable to connect to the assistant."
      const assistantMsg: Message = {
        id: cryptoId(),
        role: "assistant",
        content: `⚠️ ${fallback}`,
      }
      setMessages((prev) => trimMessages([...prev, assistantMsg]))
      setError(fallback)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Show the launcher only when profiles are present and indexed context is available */}
      {hasProfiles && (
        <Button
          aria-label="Open AI assistant"
          size="icon"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 rounded-full bg-indigo-800 text-white shadow-xl hover:bg-indigo-700"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b bg-slate-50 px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Education Copilot
            </SheetTitle>
            <p className="text-sm text-slate-600">Grounded in the latest teacher + student uploads.</p>
          </SheetHeader>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 px-5 py-4">
                {!hasProfiles && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-600">
                    Upload teacher docs and the student CSV on the Upload page to unlock the assistant.
                  </div>
                )}

                {indexing && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    Refreshing context with your latest data...
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex w-full", msg.role === "assistant" ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                        msg.role === "assistant"
                          ? "bg-white text-slate-900 ring-1 ring-slate-200"
                          : "bg-[#0C115B] text-white",
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="chat-markdown text-slate-900">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </div>

          <div className="border-t bg-white px-4 py-3">
            <div className="flex items-center justify-between pb-2 text-xs text-slate-500">
              <span>Showing the last 5 questions for context.</span>
              {sending && (
                <span className="flex items-center gap-1 text-indigo-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking
                </span>
              )}
            </div>
            <Textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={hasProfiles ? "Ask about placements, strengths, or needs..." : "Upload data to start chatting."}
              className="resize-none border-slate-200 focus-visible:ring-[#0C115B]"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-rose-500">{error}</div>
              <Button onClick={handleSend} disabled={!canSend} className="bg-[#0C115B] text-white hover:bg-[#0C115B]/90">
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending
                  </>
                ) : (
                  <>
                    Send <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function trimMessages(messages: Message[]): Message[] {
  if (messages.length <= MAX_HISTORY) return messages
  return messages.slice(messages.length - MAX_HISTORY)
}

function cryptoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}
