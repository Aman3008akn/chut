'use client'
import { useState } from 'react'
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  RefreshCw, 
  Menu, 
  X,
  Clock,
  Zap,
  Settings,
  Sparkles,
  History,
  Instagram
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, formatTime } from '@/lib/utils'
import type { Conversation } from '@/lib/types'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  syncing?: boolean
  onRefresh?: () => void
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, syncing, onRefresh }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {/* Mobile Menu Button - Premium Style */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-background/80 backdrop-blur-md border border-border shadow-xl sm:hidden"
      >
        <Menu size={20} className="text-foreground" />
      </motion.button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 sm:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: collapsed ? 80 : 280,
          x: mobileOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 640 ? -280 : 0)
        }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "h-screen flex flex-col border-r border-border bg-card/40 backdrop-blur-2xl fixed sm:relative z-50 overflow-hidden",
          mobileOpen && "w-[280px] translate-x-0"
        )}
      >
        {/* Sidebar Header / Logo Section */}
        <div className="p-4 flex items-center justify-between">
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <Sparkles size={18} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-foreground">Nexus AI</h1>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">Platform</p>
              </div>
            </motion.div>
          )}
          
          <div className={cn("flex items-center gap-1", collapsed && "w-full justify-center")}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all sm:block hidden"
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            {mobileOpen && (
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground sm:hidden">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* New Chat Button (Prominent Style) */}
        <div className="px-4 py-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNew}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground h-12 shadow-lg shadow-primary/20 transition-all font-semibold overflow-hidden",
              collapsed && "w-12 h-12 p-0"
            )}
          >
            <Plus size={20} />
            {!collapsed && <span>New Conversation</span>}
          </motion.button>
        </div>

        {/* Navigation Section */}
        {!collapsed && (
          <div className="px-4 py-4 space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Navigation</div>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground bg-secondary/40 border border-border/40 shadow-sm">
              <Zap size={18} className="text-amber-500" />
              <span>AI Dashboard</span>
            </button>
            <button 
              onClick={onRefresh}
              disabled={syncing}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all"
            >
              <RefreshCw size={18} className={cn(syncing && "animate-spin")} />
              <span>Sync Workspace</span>
            </button>
          </div>
        )}

        {/* Search Bar - Leaked Style */}
        {!collapsed && (
          <div className="px-4 pb-4">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search history..."
                className="w-full h-10 bg-secondary/30 border border-border/40 rounded-xl pl-10 pr-4 text-xs outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
              />
            </div>
          </div>
        )}

        {/* Conversations History List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 space-y-1">
          {!collapsed && (
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-2 flex items-center gap-2">
              <History size={12} />
              Recent Conversations
            </div>
          )}
          
          <AnimatePresence initial={false}>
            {filtered.length === 0 ? (
              <div className="text-center py-10 opacity-30">
                <Clock size={32} className="mx-auto mb-2" />
                {!collapsed && <p className="text-xs font-medium">Clear as starlight</p>}
              </div>
            ) : (
              filtered.map(conv => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "relative group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-300",
                    activeId === conv.id 
                      ? "bg-secondary text-foreground shadow-sm ring-1 ring-border" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30",
                    collapsed && "justify-center"
                  )}
                  onClick={() => { onSelect(conv.id); setMobileOpen(false) }}
                >
                  <MessageSquare size={18} className={cn("shrink-0", activeId === conv.id ? "text-primary" : "text-muted-foreground")} />
                  {!collapsed && (
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="text-sm font-semibold truncate leading-tight">{conv.title}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium italic">
                        {formatTime(conv.updatedAt)}
                      </p>
                    </div>
                  )}
                  
                  {!collapsed && (
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(conv.id); setMobileOpen(false) }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-all text-muted-foreground/40 shadow-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border/40 mt-auto bg-secondary/10 backdrop-blur-md">
          
          
          <button className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all font-medium",
            collapsed && "justify-center"
          )}>
            <Settings size={18} />
            {!collapsed && <span className="text-sm">Workspace Settings</span>}
          </button>
        </div>
      </motion.aside>
    </>
  )
}

