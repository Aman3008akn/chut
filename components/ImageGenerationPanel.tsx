'use client'

/**
 * ImageGenerationPanel - Advanced AI image generation interface
 * Professional UI for generating high-quality images with style controls
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Image as ImageIcon, Sparkles, Download, RefreshCw, X, Maximize2,
  Settings, Palette, Zap, Layers, Check, AlertCircle, Loader2,
  Grid3x3, Square, RectangleHorizontal, RectangleVertical,
  Camera, Brush, Palette as PaletteIcon, Box, Pencil, Film
} from 'lucide-react'
import { generateImage, downloadImage, validateImagePrompt } from '@/lib/imageGeneration'
import type { ImageGenerationOptions, GeneratedImage, ImageResult } from '@/lib/imageGeneration'
import { cn } from '@/lib/utils'

interface Props {
  onImageGenerated?: (image: GeneratedImage) => void
  onClose?: () => void
  initialPrompt?: string
}

const STYLES = [
  { id: 'photorealistic', label: 'Photorealistic', icon: Camera, color: 'from-blue-500 to-cyan-500' },
  { id: 'digital-art', label: 'Digital Art', icon: Brush, color: 'from-purple-500 to-pink-500' },
  { id: 'anime', label: 'Anime', icon: Sparkles, color: 'from-pink-500 to-rose-500' },
  { id: 'oil-painting', label: 'Oil Painting', icon: PaletteIcon, color: 'from-amber-500 to-orange-500' },
  { id: 'watercolor', label: 'Watercolor', icon: PaletteIcon, color: 'from-teal-500 to-emerald-500' },
  { id: '3d-render', label: '3D Render', icon: Box, color: 'from-indigo-500 to-purple-500' },
  { id: 'sketch', label: 'Sketch', icon: Pencil, color: 'from-gray-500 to-slate-500' },
  { id: 'cinematic', label: 'Cinematic', icon: Film, color: 'from-red-500 to-orange-500' }
]

const SIZES = [
  { id: '1024x1024', label: '1:1', icon: Square, description: 'Square' },
  { id: '1024x512', label: '16:9', icon: RectangleHorizontal, description: 'Landscape' },
  { id: '512x1024', label: '9:16', icon: RectangleVertical, description: 'Portrait' }
]

const QUALITIES = [
  { id: 'standard', label: 'Standard', speed: 'Fast' },
  { id: 'hd', label: 'HD', speed: 'Medium' },
  { id: 'ultra', label: 'Ultra HD', speed: 'Slow' }
]

export default function ImageGenerationPanel({ onImageGenerated, onClose, initialPrompt = '' }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [selectedStyle, setSelectedStyle] = useState<string>('photorealistic')
  const [selectedSize, setSelectedSize] = useState<string>('1024x1024')
  const [selectedQuality, setSelectedQuality] = useState<string>('hd')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [generationHistory, setGenerationHistory] = useState<GeneratedImage[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationSuggestions, setValidationSuggestions] = useState<string[]>([])
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value)
    
    // Validate prompt in real-time
    if (value.length > 0) {
      const validation = validateImagePrompt(value)
      setValidationErrors(validation.errors.map(e => e.message))
      setValidationSuggestions(validation.suggestions)
    } else {
      setValidationErrors([])
      setValidationSuggestions([])
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    
    setIsGenerating(true)
    setError(null)
    
    try {
      const options: ImageGenerationOptions = {
        prompt: prompt.trim(),
        style: selectedStyle as any,
        size: selectedSize as any,
        quality: selectedQuality as any
      }
      
      const result = await generateImage(options)
      
      if (result.ok && result.image) {
        setGeneratedImage(result.image)
        setGenerationHistory(prev => [result.image!, ...prev].slice(0, 10))
        onImageGenerated?.(result.image)
      } else {
        setError((result as { ok: false; error: { message: string } }).error?.message || 'Failed to generate image')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, selectedStyle, selectedSize, selectedQuality, onImageGenerated])

  const handleDownload = useCallback(async () => {
    if (!generatedImage) return
    
    try {
      await downloadImage(generatedImage.url, { filename: `nexus-ai-${generatedImage.style}-${Date.now()}.png` })
    } catch (err) {
      setError('Failed to download image')
    }
  }, [generatedImage])

  const handleRegenerate = useCallback(() => {
    handleGenerate()
  }, [handleGenerate])

  const handleHistorySelect = useCallback((image: GeneratedImage) => {
    setGeneratedImage(image)
    setShowPreview(true)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleGenerate()
    }
    if (e.key === 'Escape') {
      onClose?.()
    }
  }, [handleGenerate, onClose])

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <ImageIcon size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">AI Image Generator</h2>
            <p className="text-sm text-muted-foreground">Create stunning images with AI</p>
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Prompt Input */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Describe your image
            </label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A majestic dragon flying over a medieval castle at sunset..."
              className="w-full min-h-[120px] px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-sm"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{prompt.length} / 1000</span>
              <span className="flex items-center gap-1">
                <Zap size={12} />
                Ctrl+Enter to generate
              </span>
            </div>
            
            {/* Validation Messages */}
            <AnimatePresence>
              {validationErrors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-1"
                >
                  {validationErrors.map((err, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-red-500">
                      <AlertCircle size={12} />
                      <span>{err}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Style Selection */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                <Palette size={16} />
                Art Style
              </label>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 rounded hover:bg-secondary transition-colors"
              >
                <Settings size={14} className="text-muted-foreground" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((style) => {
                const Icon = style.icon
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                      selectedStyle === style.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground text-foreground"
                    )}
                  >
                    <Icon size={16} />
                    <span className="truncate">{style.label}</span>
                    {selectedStyle === style.id && (
                      <Check size={14} className="ml-auto" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Size & Quality */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-surface border border-border rounded-xl p-4 space-y-4"
              >
                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Grid3x3 size={16} />
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {SIZES.map((size) => {
                      const Icon = size.icon
                      return (
                        <button
                          key={size.id}
                          onClick={() => setSelectedSize(size.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all",
                            selectedSize === size.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-muted-foreground text-foreground"
                          )}
                        >
                          <Icon size={20} />
                          <span className="text-xs">{size.label}</span>
                          <span className="text-[10px] text-muted-foreground">{size.description}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Quality */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Layers size={16} />
                    Quality
                  </label>
                  <div className="space-y-2">
                    {QUALITIES.map((quality) => (
                      <button
                        key={quality.id}
                        onClick={() => setSelectedQuality(quality.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-sm",
                          selectedQuality === quality.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground text-foreground"
                        )}
                      >
                        <span>{quality.label}</span>
                        <span className="text-xs text-muted-foreground">{quality.speed}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || validationErrors.length > 0}
            className={cn(
              "w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all",
              isGenerating || !prompt.trim() || validationErrors.length > 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} />
                <span>Generate Image</span>
              </>
            )}
          </button>
        </div>

        {/* Image Display */}
        <div className="lg:col-span-2">
          <div className="bg-surface border border-border rounded-xl p-6 min-h-[500px] flex flex-col">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles size={24} className="text-purple-500 animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">Creating your masterpiece...</p>
                  <p className="text-sm text-muted-foreground mt-1">This usually takes 5-15 seconds</p>
                </div>
                <div className="w-full max-w-xs bg-secondary rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 10, ease: 'linear' }}
                  />
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-full">
                  <AlertCircle size={40} className="text-red-500" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-red-500">Generation Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
                <button
                  onClick={handleRegenerate}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </div>
            ) : generatedImage ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex-1 relative group rounded-xl overflow-hidden bg-background">
                  <img
                    ref={imageRef}
                    src={generatedImage.url}
                    alt={generatedImage.originalPrompt}
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() => setShowPreview(true)}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => setShowPreview(true)}
                      className="p-3 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
                    >
                      <Maximize2 size={24} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Palette size={14} />
                    <span>{generatedImage.style}</span>
                    <span className="mx-1">•</span>
                    <span>{generatedImage.size}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegenerate}
                      className="px-3 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2 text-sm"
                    >
                      <RefreshCw size={14} />
                      Regenerate
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full">
                  <ImageIcon size={48} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-foreground">Ready to Create</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Describe the image you want to create and select your preferred style
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 w-full max-w-md">
                  {[
                    'A futuristic city at night',
                    'Magical forest with glowing mushrooms',
                    'Portrait in Renaissance style',
                    'Abstract digital art'
                  ].map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(suggestion)}
                      className="px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs text-foreground hover:bg-secondary hover:border-primary transition-all text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generation History */}
          {generationHistory.length > 0 && (
            <div className="mt-4 bg-surface border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Recent Generations</h3>
              <div className="grid grid-cols-4 gap-2">
                {generationHistory.slice(0, 4).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleHistorySelect(img)}
                    className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                  >
                    <img src={img.url} alt={img.originalPrompt} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Preview Modal */}
      <AnimatePresence>
        {showPreview && generatedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-6xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={generatedImage.url}
                alt={generatedImage.originalPrompt}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X size={24} />
              </button>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg text-foreground hover:bg-white transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
