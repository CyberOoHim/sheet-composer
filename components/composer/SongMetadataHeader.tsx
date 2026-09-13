'use client';

import React, { useState, useEffect, useRef } from 'react';
import { KeySignature, LyricDisplayMode, Song, TimeSignature } from '@/types/song';
import {
  AlignLeft,
  ChevronDown,
  Music,
  ScanLine,
  FilePlus2,
  FileEdit,
  Check,
  ArrowDown,
  ArrowUp,
  Plus,
  Minus,
  Activity,
  X,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { useGeminiAuth } from '@/hooks/useGeminiAuth';
import {
  CHROMATIC_KEYS,
  STANDARD_TIME_SIGNATURES,
  TEMPO_PRESETS,
  transposeSongChords,
  autoFillSongMeasureRests,
  smartRebarSong,
} from '@/lib/taigiUtils';

interface SongMetadataHeaderProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onOpenAligner: () => void;
  onOpenScanner?: () => void;
  onStartFreshSong?: () => void;
}

export const SongMetadataHeader: React.FC<SongMetadataHeaderProps> = React.memo(({
  song,
  onUpdateSong,
  displayMode,
  setDisplayMode,
  onOpenAligner,
  onOpenScanner,
  onStartFreshSong,
}) => {
  const { hasApiKey } = useGeminiAuth();
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Active inline popover for DAW LCD items: 'key' | 'timeSignature' | 'bpm' | 'displayMode' | null
  const [activePopover, setActivePopover] = useState<'key' | 'timeSignature' | 'bpm' | 'displayMode' | null>(null);

  // Key Signature Settings
  const [autoTransposeChords, setAutoTransposeChords] = useState<boolean>(true);

  // Time Signature Settings
  const [syncAllMeasures, setSyncAllMeasures] = useState<boolean>(true);

  // Tap Tempo state
  const tapTimesRef = useRef<number[]>([]);
  const [tapTempoFeedback, setTapTempoFeedback] = useState<string | null>(null);

  // Close popovers on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePopover(null);
        setIsSettingsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Key Change
  const handleSelectKey = (targetKey: KeySignature) => {
    if (targetKey === song.key) {
      setActivePopover(null);
      return;
    }
    if (autoTransposeChords) {
      const updated = transposeSongChords(song, targetKey);
      onUpdateSong(updated);
    } else {
      onUpdateSong({ ...song, key: targetKey });
    }
    setActivePopover(null);
  };

  const handleStepKey = (delta: number) => {
    const currentIdx = CHROMATIC_KEYS.indexOf(song.key);
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (safeIdx + delta + 12) % 12;
    const targetKey = CHROMATIC_KEYS[nextIdx];
    handleSelectKey(targetKey);
  };

  // Handle Time Signature Change
  const handleSelectTimeSignature = (targetTimeSig: TimeSignature) => {
    if (syncAllMeasures) {
      const updatedMeasures = song.measures.map(m => ({
        ...m,
        timeSignature: undefined,
      }));
      onUpdateSong({
        ...song,
        timeSignature: targetTimeSig,
        measures: updatedMeasures,
      });
    } else {
      onUpdateSong({ ...song, timeSignature: targetTimeSig });
    }
    setActivePopover(null);
  };

  // Smart Re-bar measures
  const handleSmartRebar = (targetTimeSig: TimeSignature) => {
    const updated = smartRebarSong(song, targetTimeSig);
    onUpdateSong(updated);
    setActivePopover(null);
  };

  // Auto Fill Rests
  const handleAutoFillRests = () => {
    const updated = autoFillSongMeasureRests(song);
    onUpdateSong(updated);
    setActivePopover(null);
  };

  // Handle BPM Change
  const handleSetBpm = (newBpm: number) => {
    const clamped = Math.max(30, Math.min(260, Math.round(newBpm)));
    onUpdateSong({ ...song, bpm: clamped });
  };

  const handleStepBpm = (delta: number) => {
    handleSetBpm(song.bpm + delta);
  };

  // Tap Tempo Handler
  const handleTapTempo = () => {
    const now = Date.now();
    const recentTaps = tapTimesRef.current.filter(t => now - t < 2600);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps;

    if (recentTaps.length >= 2) {
      let totalDiff = 0;
      for (let i = 1; i < recentTaps.length; i++) {
        totalDiff += recentTaps[i] - recentTaps[i - 1];
      }
      const avgInterval = totalDiff / (recentTaps.length - 1);
      const computedBpm = Math.round(60000 / avgInterval);
      const clamped = Math.max(40, Math.min(240, computedBpm));
      handleSetBpm(clamped);
      setTapTempoFeedback(`${clamped} BPM (${recentTaps.length} taps)`);
    } else {
      setTapTempoFeedback('Tap again to measure...');
    }
  };

  // Display mode label helper
  const getDisplayModeSummary = () => {
    switch (displayMode) {
      case 'roman':
        return 'Roman (POJ)';
      case 'hanlo':
      case 'hanji_only':
      case 'custom_only':
        return 'Han-lô';
      case 'roman_major_hanlo':
      case 'all':
        return 'Bilingual (Roman)';
      case 'hanlo_major_roman':
      case 'hanji_poj':
        return 'Bilingual (Han-lô)';
      default:
        return 'Lyric Mode';
    }
  };

  return (
    <>
      {/* Click-away Backdrop for Active Popovers */}
      {activePopover && (
        <div
          id="popover-backdrop"
          className="fixed inset-0 z-30 bg-black/10 dark:bg-black/30"
          onClick={() => setActivePopover(null)}
        />
      )}

      {/* COMPACT DAW PROJECT STRIP (High-Density, Maximize Viewport for Notation) */}
      <div
        id="song-metadata-card"
        className="px-3 py-1.5 sm:py-2 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800/80 rounded-xl shadow-2xs flex items-center justify-between gap-2 flex-wrap select-none relative"
      >
        {/* Left: Song Title & Quick Musical LCD Badges */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-500/20">
              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            <button
              id="compact-song-title-btn"
              type="button"
              onClick={() => {
                setActivePopover(null);
                setIsSettingsModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-left font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer group max-w-[180px] sm:max-w-[260px] truncate"
              title="Click to edit song details and layout settings"
            >
              <span className="truncate">{song.title || 'Untitled Song'}</span>
              <FileEdit className="w-3 h-3 text-zinc-400 group-hover:text-amber-500 shrink-0 opacity-70" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Key Signature Popover Trigger */}
            <div className="relative inline-block">
              <button
                id="header-key-badge-btn"
                type="button"
                onClick={() => setActivePopover(activePopover === 'key' ? null : 'key')}
                className={`daw-lcd text-xs px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs cursor-pointer touch-manipulation transition-all flex items-center gap-1 border ${
                  activePopover === 'key'
                    ? 'ring-2 ring-amber-400 border-amber-500 brightness-110 text-amber-300'
                    : 'border-amber-500/20 hover:border-amber-400/60 hover:brightness-105 active:scale-95'
                }`}
                title="Key Signature: 1 = ?"
              >
                <span>1 = {song.key}</span>
                <ChevronDown className="w-3 h-3 text-amber-500/70" />
              </button>

              {activePopover === 'key' && (
                <div
                  id="popover-key-editor"
                  className="absolute left-0 top-full mt-2 z-40 w-72 sm:w-80 p-3.5 bg-white dark:bg-[#161922] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      <Music className="w-3.5 h-3.5 text-amber-500" />
                      <span>Key Signature (1 = ?)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <button
                      id="key-step-down-btn"
                      type="button"
                      onClick={() => handleStepKey(-1)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Down 1 semitone"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-amber-500" />
                      <span>-1 Semitone</span>
                    </button>

                    <div className="daw-lcd px-2.5 py-1 text-xs font-mono font-bold rounded-lg shrink-0">
                      1 = {song.key}
                    </div>

                    <button
                      id="key-step-up-btn"
                      type="button"
                      onClick={() => handleStepKey(1)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Up 1 semitone"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-amber-500" />
                      <span>+1 Semitone</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {CHROMATIC_KEYS.map(k => {
                      const isCurrent = song.key === k;
                      return (
                        <button
                          key={k}
                          id={`key-opt-${k}`}
                          type="button"
                          onClick={() => handleSelectKey(k)}
                          className={`py-1.5 px-2 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer touch-manipulation flex items-center justify-center gap-1 ${
                            isCurrent
                              ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                              : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700/60 hover:bg-amber-500/10 hover:border-amber-500/40'
                          }`}
                        >
                          <span>1={k}</span>
                          {isCurrent && <Check className="w-3 h-3 text-zinc-950 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 cursor-pointer">
                    <input
                      id="auto-transpose-chords-checkbox"
                      type="checkbox"
                      checked={autoTransposeChords}
                      onChange={e => setAutoTransposeChords(e.target.checked)}
                      className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-400 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Auto-transpose measure chords
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        Transpose chords when changing key (e.g. Gm → Am)
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Time Signature Popover Trigger */}
            <div className="relative inline-block">
              <button
                id="header-timesig-badge-btn"
                type="button"
                onClick={() => setActivePopover(activePopover === 'timeSignature' ? null : 'timeSignature')}
                className={`daw-lcd text-xs px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs cursor-pointer touch-manipulation transition-all flex items-center gap-1 border ${
                  activePopover === 'timeSignature'
                    ? 'ring-2 ring-amber-400 border-amber-500 brightness-110 text-amber-300'
                    : 'border-amber-500/20 hover:border-amber-400/60 hover:brightness-105 active:scale-95'
                }`}
                title="Time Signature / Meter"
              >
                <span>{song.timeSignature}</span>
                <ChevronDown className="w-3 h-3 text-amber-500/70" />
              </button>

              {activePopover === 'timeSignature' && (
                <div
                  id="popover-timesig-editor"
                  className="absolute left-0 top-full mt-2 z-40 w-72 sm:w-80 p-3.5 bg-white dark:bg-[#161922] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                      <span>Time Signature Settings</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 mb-3">
                    {STANDARD_TIME_SIGNATURES.map(ts => {
                      const isCurrent = song.timeSignature === ts.value;
                      return (
                        <button
                          key={ts.value}
                          id={`timesig-opt-${ts.value.replace('/', '-')}`}
                          type="button"
                          onClick={() => handleSelectTimeSignature(ts.value)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer touch-manipulation flex items-center justify-between ${
                            isCurrent
                              ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-xs'
                              : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700/60 hover:bg-amber-500/10 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm w-8">{ts.label}</span>
                            <span className="text-[11px] opacity-90">{ts.sublabel}</span>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-zinc-950 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleSmartRebar(song.timeSignature)}
                      className="w-full py-1.5 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left"
                    >
                      Smart Re-bar to new meter
                    </button>

                    <button
                      type="button"
                      onClick={handleAutoFillRests}
                      className="w-full py-1.5 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left"
                    >
                      Auto Fill Rests for incomplete measures
                    </button>

                    <label className="flex items-center gap-2 px-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncAllMeasures}
                        onChange={e => setSyncAllMeasures(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-amber-500"
                      />
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Apply to all measures without custom meter
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* BPM Popover Trigger */}
            <div className="relative inline-block">
              <button
                id="header-bpm-badge-btn"
                type="button"
                onClick={() => setActivePopover(activePopover === 'bpm' ? null : 'bpm')}
                className={`daw-lcd text-xs px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs cursor-pointer touch-manipulation transition-all flex items-center gap-1 border ${
                  activePopover === 'bpm'
                    ? 'ring-2 ring-amber-400 border-amber-500 brightness-110 text-amber-300'
                    : 'border-amber-500/20 hover:border-amber-400/60 hover:brightness-105 active:scale-95'
                }`}
                title="Tempo (BPM)"
              >
                <span>♩ = {song.bpm}</span>
                <ChevronDown className="w-3 h-3 text-amber-500/70" />
              </button>

              {activePopover === 'bpm' && (
                <div
                  id="popover-bpm-editor"
                  className="absolute left-0 top-full mt-2 z-40 w-72 sm:w-80 p-3.5 bg-white dark:bg-[#161922] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                      <span>Tempo Settings (BPM)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 mb-3">
                    <button
                      id="bpm-minus-10-btn"
                      type="button"
                      onClick={() => handleStepBpm(-10)}
                      className="py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                      title="-10 BPM"
                    >
                      -10
                    </button>
                    <button
                      id="bpm-minus-1-btn"
                      type="button"
                      onClick={() => handleStepBpm(-1)}
                      className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="-1 BPM"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1">
                      <input
                        id="bpm-direct-input"
                        type="number"
                        min="30"
                        max="260"
                        value={song.bpm}
                        onChange={e => handleSetBpm(parseInt(e.target.value, 10) || 80)}
                        className="w-16 text-center text-base font-mono font-black text-amber-600 dark:text-amber-400 bg-transparent focus:outline-hidden"
                      />
                      <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                        BPM
                      </span>
                    </div>

                    <button
                      id="bpm-plus-1-btn"
                      type="button"
                      onClick={() => handleStepBpm(1)}
                      className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="+1 BPM"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id="bpm-plus-10-btn"
                      type="button"
                      onClick={() => handleStepBpm(10)}
                      className="py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                      title="+10 BPM"
                    >
                      +10
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {TEMPO_PRESETS.map(preset => {
                      const isCurrent = song.bpm === preset.bpm;
                      return (
                        <button
                          key={preset.bpm}
                          id={`bpm-preset-${preset.bpm}`}
                          type="button"
                          onClick={() => handleSetBpm(preset.bpm)}
                          className={`py-1 px-1.5 text-[11px] font-medium rounded-lg border transition-all cursor-pointer text-center truncate ${
                            isCurrent
                              ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-xs'
                              : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700/60 hover:bg-amber-500/10'
                          }`}
                          title={preset.label}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5">
                    <button
                      id="bpm-tap-tempo-btn"
                      type="button"
                      onClick={handleTapTempo}
                      className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center gap-1.5"
                    >
                      <Activity className="w-4 h-4 text-zinc-950" />
                      <span>Tap Tempo</span>
                    </button>

                    {tapTempoFeedback && (
                      <p className="text-[11px] text-center font-mono text-amber-600 dark:text-amber-400 font-bold animate-in fade-in">
                        {tapTempoFeedback}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Measures Count Pill */}
            <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-750 shrink-0">
              {song.measures.length} M
            </span>
          </div>
        </div>

        {/* Right: Lyric Mode Selector & Studio Utilities */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Quick Lyric Display Mode Switcher */}
          <div className="relative">
            <div
              id="header-lyric-mode-group"
              className="flex items-center bg-zinc-100 dark:bg-zinc-900/90 p-0.5 rounded-xl border border-zinc-200/90 dark:border-zinc-750 text-xs font-bold shadow-2xs"
            >
              <button
                type="button"
                onClick={() => setDisplayMode('roman')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer touch-manipulation ${
                  displayMode === 'roman'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
                title="Romanization Only (POJ/TL)"
              >
                Roman
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('hanlo')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer touch-manipulation ${
                  displayMode === 'hanlo' || displayMode === 'hanji_only' || displayMode === 'custom_only'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
                title="Han-lô Only"
              >
                Han-lô
              </button>
              <button
                type="button"
                onClick={() => setActivePopover(activePopover === 'displayMode' ? null : 'displayMode')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer touch-manipulation ${
                  displayMode.includes('major') || displayMode === 'all'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
                title="Bilingual Mode"
              >
                <span>Bilingual</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Display Mode Sub-Menu Popover */}
            {activePopover === 'displayMode' && (
              <div
                id="popover-display-mode-menu"
                className="absolute right-0 top-full mt-2 z-40 w-56 p-2 bg-white dark:bg-[#161922] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-1 text-xs"
              >
                <div className="px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Bilingual Alignment Display
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDisplayMode('roman_major_hanlo');
                    setActivePopover(null);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl text-left font-bold transition-colors cursor-pointer ${
                    displayMode === 'roman_major_hanlo' || displayMode === 'all'
                      ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span>Roman (Primary) + Han-lô</span>
                  {(displayMode === 'roman_major_hanlo' || displayMode === 'all') && (
                    <Check className="w-3.5 h-3.5 text-amber-600" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisplayMode('hanlo_major_roman');
                    setActivePopover(null);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl text-left font-bold transition-colors cursor-pointer ${
                    displayMode === 'hanlo_major_roman' || displayMode === 'hanji_poj'
                      ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span>Han-lô (Primary) + Roman</span>
                  {(displayMode === 'hanlo_major_roman' || displayMode === 'hanji_poj') && (
                    <Check className="w-3.5 h-3.5 text-amber-600" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Quick Lyric Aligner Modal Trigger */}
          <button
            id="composer-open-aligner-btn"
            type="button"
            onClick={() => {
              setActivePopover(null);
              onOpenAligner();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-lg border border-zinc-200/90 dark:border-zinc-750 shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation h-8"
            title="Lyric Aligner (Supports Roman and Han-lô)"
          >
            <AlignLeft className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Align Lyrics</span>
          </button>

          {/* Song Settings / Metadata Dialog Trigger */}
          <button
            id="composer-expand-settings-btn"
            type="button"
            onClick={() => {
              setActivePopover(null);
              setIsSettingsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 font-bold text-xs rounded-lg border transition-all cursor-pointer h-8 touch-manipulation bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-750 shadow-2xs"
            title="Song Settings (Title, Composer, Lyricist, Layout, Notes)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* SONG SETTINGS MODAL DIALOG (Non-intrusive, Does not shift notation scroll position) */}
      {isSettingsModalOpen && (
        <div
          id="song-settings-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            id="song-settings-modal-card"
            className="bg-white dark:bg-[#141720] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                    Song Settings & Details
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Edit score title, credits, layout per line, and background notes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Basic Song Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Song Title */}
              <div>
                <label
                  htmlFor="composer-song-title-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Title *
                </label>
                <input
                  id="composer-song-title-input"
                  type="text"
                  value={song.title}
                  onChange={e => onUpdateSong({ ...song, title: e.target.value })}
                  className="w-full text-sm font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. Bang Chhun-hong..."
                />
              </div>

              {/* Subtitle / Alternate Name */}
              <div>
                <label
                  htmlFor="composer-song-subtitle-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Subtitle / English
                </label>
                <input
                  id="composer-song-subtitle-input"
                  type="text"
                  value={song.subtitle || ''}
                  onChange={e => onUpdateSong({ ...song, subtitle: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. Taiwanese Folk Song..."
                />
              </div>

              {/* Composer */}
              <div>
                <label
                  htmlFor="composer-song-composer-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Composer
                </label>
                <input
                  id="composer-song-composer-input"
                  type="text"
                  value={song.composer || ''}
                  onChange={e => onUpdateSong({ ...song, composer: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. Tēng Ú-hiân..."
                />
              </div>

              {/* Lyricist */}
              <div>
                <label
                  htmlFor="composer-song-lyricist-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Lyricist
                </label>
                <input
                  id="composer-song-lyricist-input"
                  type="text"
                  value={song.lyricist || ''}
                  onChange={e => onUpdateSong({ ...song, lyricist: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. Lí Lîm-chhiu..."
                />
              </div>
            </div>

            {/* Section 2: Layout & Measures Per Line */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
              <div>
                <label
                  htmlFor="composer-notes-per-line-select"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Measures Per Line
                </label>
                <select
                  id="composer-notes-per-line-select"
                  value={song.notesPerLine || 4}
                  onChange={e =>
                    onUpdateSong({ ...song, notesPerLine: parseInt(e.target.value, 10) || 4 })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
                >
                  <option value="2">2 Measures / Line</option>
                  <option value="3">3 Measures / Line</option>
                  <option value="4">4 Measures / Line (Standard 4/4)</option>
                  <option value="5">5 Measures / Line</option>
                  <option value="6">6 Measures / Line (Compact)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Structure Summary
                </label>
                <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                  <span>{song.measures.length} Measures</span>
                  <span>·</span>
                  <span>Key 1 = {song.key}</span>
                  <span>·</span>
                  <span>{song.timeSignature} Meter</span>
                  <span>·</span>
                  <span>{song.bpm} BPM</span>
                </div>
              </div>
            </div>

            {/* Section 3: Description Multi-line Input */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
              <label
                htmlFor="composer-song-description-textarea"
                className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                Background & Performance Notes
              </label>
              <textarea
                id="composer-song-description-textarea"
                rows={3}
                value={song.description || ''}
                onChange={e => onUpdateSong({ ...song, description: e.target.value })}
                className="w-full text-xs font-normal leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all resize-y"
                placeholder="Enter historical background, lyrical context, or performance tips..."
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                {onStartFreshSong && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsModalOpen(false);
                      onStartFreshSong();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>New Blank Song</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

SongMetadataHeader.displayName = 'SongMetadataHeader';
