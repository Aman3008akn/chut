'use client'
import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { 
  Send, 
  Microscope, 
  X, 
  Square, 
  Image as ImageIcon, 
  Plus, 
  ArrowUp,
  Brain,
  Sparkles,
  Paperclip,
  Globe
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Props {
  onSend: (text: string, deepResearch: boolean, imageUrl?: string, webSearch?: boolean) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
}

export default function ChatInput({ onSend, onStop, disabled, isGenerating }: Props) {
  const [text, setText] = useState('')
  const [deepResearch, setDeepResearch] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const send = () => {
    const trimmed = text.trim()
    if ((!trimmed && !imagePreview) || disabled) return
    onSend(trimmed || 'Analyze this image', deepResearch, imagePreview || undefined, webSearch)
    setText('')
    setDeepResearch(false)
    setWebSearch(false)
    setImagePreview(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }

  useEffect(() => {
    resize()
  }, [text])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size should be less than 10MB')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 relative flex flex-col gap-4">
      {/* Dynamic Mode Pill (Leaked Style) */}
      <AnimatePresence>
        {(deepResearch || webSearch || imagePreview) && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="flex gap-2 mb-[-8px]"
          >
            {deepResearch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20">
                <Microscope size={12} className="animate-pulse" />
                Deep Research Mode
                <button 
                  onClick={() => setDeepResearch(false)} 
                  className="ml-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {webSearch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                <Globe size={12} className="animate-pulse" />
                Web Search Mode
                <button 
                  onClick={() => setWebSearch(false)} 
                  className="ml-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {imagePreview && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-amber-500/20">
                <ImageIcon size={12} />
                Image Attached
                <button 
                  onClick={removeImage} 
                  className="ml-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Container */}
      <div className={cn(
        "relative flex flex-col w-full rounded-[2rem] border transition-all duration-300 group",
        isFocused 
          ? "border-primary bg-background shadow-2xl shadow-primary/10 ring-4 ring-primary/5" 
          : "border-border bg-secondary/50 hover:border-zinc-400 dark:hover:border-zinc-600"
      )}>
        
        {/* Preview Strip */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pt-4 overflow-hidden"
            >
              <div className="relative inline-block group/img">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-20 w-auto rounded-xl border border-border shadow-sm object-cover"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover/img:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="flex flex-col p-2 pt-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={deepResearch ? "What should Nexus research specifically?" : webSearch ? "Search the web for..." : "Ask Nexus anything..."}
            className="w-full bg-transparent border-none outline-none resize-none px-4 py-2 min-h-[44px] text-base sm:text-[17px] text-foreground placeholder:text-muted-foreground/60 focus:ring-0 leading-relaxed scrollbar-hide"
            disabled={isGenerating}
          />

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all"
                title="Attach Files"
              >
                <Paperclip size={20} />
              </button>
              <button
                onClick={() => { setDeepResearch(!deepResearch); if (!deepResearch) setWebSearch(false) }}
                className={cn(
                  "p-2.5 rounded-full transition-all flex items-center justify-center",
                  deepResearch 
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800"
                )}
                title="Deep Research Mode"
              >
                <Brain size={20} />
              </button>
              <button
                onClick={() => { setWebSearch(!webSearch); if (!webSearch) setDeepResearch(false) }}
                className={cn(
                  "p-2.5 rounded-full transition-all flex items-center justify-center",
                  webSearch 
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800"
                )}
                title="Web Search Mode"
              >
                <Globe size={20} />
              </button>
              <button
                className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all"
                title="Aura Plugins"
              >
                <Sparkles size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <AnimatePresence>
                {isGenerating ? (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    onClick={onStop}
                    className="p-3 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Square size={18} fill="currentColor" />
                  </motion.button>
                ) : (
                  <motion.button
                    disabled={!text.trim() && !imagePreview}
                    onClick={send}
                    className={cn(
                      "p-3 rounded-full transition-all",
                      (text.trim() || imagePreview)
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                        : "bg-muted/10 text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <ArrowUp size={20} strokeWidth={3} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      
      {/* Keyboard Hint */}
      <span className={cn(
        "text-[10px] text-center text-muted-foreground/40 transition-opacity duration-300",
        isFocused ? "opacity-100" : "opacity-0"
      )}>
        Shift + Enter for new line • Enter to send
      </span>
    </div>
  )
}

