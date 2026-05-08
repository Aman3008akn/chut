'use client'

import { useMemo, useState } from 'react'
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
  Settings,
  Sparkles,
  UserCircle2,
  Layers,
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

const isToday = (ts: number) => {
  const d = new Date(ts)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

const isYesterday = (ts: number) => {
  const d = new Date(ts)
  const y = new Date()
  y.setDate(y.getDate() - 1)
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, syncing, onRefresh }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase())), [conversations, search])
  const today = filtered.filter(c => isToday(c.updatedAt))
  const yesterday = filtered.filter(c => isYesterday(c.updatedAt))
  const older = filtered.filter(c => !isToday(c.updatedAt) && !isYesterday(c.updatedAt))

  return (
    <>
      <motion.button whileTap={{ scale: 0.94 }} onClick={() => setMobileOpen(true)} className="fixed top-4 left-4 z-40 p-2 rounded-xl bg-black/60 backdrop-blur-lg text-zinc-200 sm:hidden">
        <Menu size={18} />
      </motion.button>

      <AnimatePresence>
        {mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/70 z-40 sm:hidden" />}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 76 : 248, x: mobileOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 640 ? -248 : 0) }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn('h-screen fixed sm:relative z-50 flex flex-col bg-gradient-to-b from-[#090909] to-[#0f0f10] border-r border-white/5', mobileOpen && 'w-[248px]')}
      >
        <div className="px-3 py-3 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="text-sm font-medium tracking-tight text-zinc-100">Astra AI</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setCollapsed(!collapsed)} className="hidden sm:flex p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition">
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            {mobileOpen && <button onClick={() => setMobileOpen(false)} className="sm:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200"><X size={18} /></button>}
          </div>
        </div>

        <div className="px-3 pt-1 pb-2">
          <button onClick={onNew} className={cn('w-full h-10 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-100 transition-all duration-300 backdrop-blur-xl shadow-[0_0_18px_rgba(255,255,255,0.08)] flex items-center justify-center gap-2', collapsed && 'w-10 h-10 p-0')}>
            <Plus size={16} />
            {!collapsed && <span className="text-sm font-medium">New Chat</span>}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pb-2 space-y-1">
            <button onClick={onRefresh} disabled={syncing} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition text-sm">
              <RefreshCw size={14} className={cn(syncing && 'animate-spin')} /> Sync
            </button>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats" className="w-full h-9 rounded-lg bg-white/5 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:bg-white/[0.07]" />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
          <Section title="Today" data={today} collapsed={collapsed} activeId={activeId} onSelect={onSelect} onDelete={onDelete} setMobileOpen={setMobileOpen} />
          <Section title="Yesterday" data={yesterday} collapsed={collapsed} activeId={activeId} onSelect={onSelect} onDelete={onDelete} setMobileOpen={setMobileOpen} />
          <Section title="Earlier" data={older} collapsed={collapsed} activeId={activeId} onSelect={onSelect} onDelete={onDelete} setMobileOpen={setMobileOpen} />
        </div>

        <div className="px-3 py-3 border-t border-white/5 space-y-1">
          <button className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition text-sm', collapsed && 'justify-center')}><Layers size={15} />{!collapsed && 'Workspace'}</button>
          <button className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition text-sm', collapsed && 'justify-center')}><Settings size={15} />{!collapsed && 'Settings'}</button>
          <button className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-white/5 transition text-sm', collapsed && 'justify-center')}><UserCircle2 size={15} />{!collapsed && 'Profile'}</button>
        </div>
      </motion.aside>
    </>
  )
}

function Section({ title, data, collapsed, activeId, onSelect, onDelete, setMobileOpen }: any) {
  if (!data.length || collapsed) return null
  return (
    <div>
      <p className="px-2.5 mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <div className="space-y-0.5">
        {data.map((conv: Conversation) => (
          <div key={conv.id} onClick={() => { onSelect(conv.id); setMobileOpen(false) }} className={cn('group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all', activeId === conv.id ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200')}>
            {conv.teamId ? <Users size={14} className="shrink-0 text-emerald-400" /> : <MessageSquare size={14} className="shrink-0" />}
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs truncate">{conv.title}</p>
                {conv.teamId && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider">
                    Team
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">{formatTime(conv.updatedAt)}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(conv.id); setMobileOpen(false) }} className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-red-300 hover:bg-red-500/10 transition">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
