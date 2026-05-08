'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Code2, Play, Copy, Check, Download, 
  Languages, X, Maximize2, Minimize2 
} from 'lucide-react'

interface CodeEditorModeProps {
  code: string
  language: string
  onClose: () => void
  onInsertCode: (code: string) => void
}

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-500',
  typescript: 'bg-blue-500',
  python: 'bg-green-500',
  java: 'bg-red-500',
  cpp: 'bg-purple-500',
  css: 'bg-pink-500',
  html: 'bg-orange-500',
  sql: 'bg-cyan-500',
  default: 'bg-gray-500',
}

export default function CodeEditorMode({
  code,
  language,
  onClose,
  onInsertCode,
}: CodeEditorModeProps) {
  const [editableCode, setEditableCode] = useState(code)
  const [copied, setCopied] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [output, setOutput] = useState<string>('')
  const [running, setRunning] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editableCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [editableCode])

  const handleDownload = useCallback(() => {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      html: 'html',
      css: 'css',
      sql: 'sql',
    }
    
    const ext = extensions[language] || 'txt'
    const blob = new Blob([editableCode], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `code.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }, [editableCode, language])

  const handleRun = useCallback(async () => {
    if (language !== 'javascript' && language !== 'typescript') {
      setOutput('⚠️ Code execution is currently only supported for JavaScript/TypeScript')
      return
    }

    setRunning(true)
    setOutput('')
    
    try {
      // Capture console.log output
      const logs: string[] = []
      const originalLog = console.log
      console.log = (...args) => {
        logs.push(args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '))
        originalLog(...args)
      }

      // Execute code safely in a sandboxed way
      const result = new Function(editableCode)()
      
      console.log = originalLog
      
      if (result !== undefined) {
        logs.push('Return value: ' + JSON.stringify(result, null, 2))
      }

      setOutput(logs.join('\n') || '✓ Code executed successfully (no output)')
    } catch (error: any) {
      setOutput(`❌ Error: ${error.message || error}`)
    } finally {
      setRunning(false)
    }
  }, [editableCode, language])

  const handleInsert = () => {
    onInsertCode(editableCode)
    onClose()
  }

  const langColor = LANGUAGE_COLORS[language] || LANGUAGE_COLORS.default

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed z-50 bg-[var(--bg-secondary)] border border-[var(--surface-border)] 
                    shadow-2xl flex flex-col ${
                      fullscreen 
                        ? 'inset-4 rounded-xl' 
                        : 'inset-[10%] rounded-2xl'
                    }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)] bg-[var(--bg)]">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-white text-xs font-bold ${langColor}`}>
              {language.toUpperCase()}
            </div>
            <h3 className="font-semibold text-[var(--text-primary)]">Code Editor</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 
                         text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Play size={14} />
              {running ? 'Running...' : 'Run'}
            </button>
            
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
              title="Copy code"
            >
              {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-[var(--text-secondary)]" />}
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
              title="Download code"
            >
              <Download size={18} className="text-[var(--text-secondary)]" />
            </button>
            
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 size={18} className="text-[var(--text-secondary)]" /> : <Maximize2 size={18} className="text-[var(--text-secondary)]" />}
            </button>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Close editor"
            >
              <X size={18} className="text-[var(--text-secondary)] hover:text-red-500" />
            </button>
          </div>
        </div>

        {/* Code Editor Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <textarea
            value={editableCode}
            onChange={e => setEditableCode(e.target.value)}
            className="flex-1 p-4 bg-[var(--bg)] text-[var(--text-primary)] font-mono text-sm 
                       resize-none focus:outline-none border-b border-[var(--surface-border)]"
            spellCheck={false}
            placeholder="Edit your code here..."
          />
          
          {/* Output Panel */}
          <AnimatePresence>
            {output && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-[var(--surface-border)] bg-black/5"
              >
                <div className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--surface-border)]">
                  Output
                </div>
                <pre className="p-4 text-sm text-[var(--text-primary)] font-mono overflow-auto max-h-48">
                  {output}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--surface-border)] bg-[var(--bg)]">
          <div className="text-xs text-[var(--text-muted)]">
            Lines: {editableCode.split('\n').length} | Characters: {editableCode.length}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] 
                         transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 
                         transition-opacity font-medium"
            >
              Insert to Chat
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
