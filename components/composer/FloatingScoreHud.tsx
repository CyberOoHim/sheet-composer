'use client';

import React from 'react';
import {
  Play,
  Square,
  Plus,
  CornerDownLeft,
  Wand2,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  ChevronDown,
  Music,
  Trash2,
  Sun,
  Moon,
} from 'lucide-react';
import { NoteDuration, PitchNumber } from '@/types/song';

export interface FloatingScoreHudProps {
  // Playback
  isPlaying: boolean;
  onTogglePlay: () => void;
  selectedMeasureNumber?: number;
  selectedNoteNumber?: number;

  // Pitch input
  onSetPitch: (pitch: PitchNumber) => void;
  onSetDash: () => void; // Sustain dash '-'
  onSetOctave: (delta: number) => void;
  currentOctave: number;

  // Duration input
  onSetDuration: (duration: NoteDuration) => void;
  currentDuration?: NoteDuration;
  onToggleDotted: () => void;
  isDotted?: boolean;

  // Modifiers
  onToggleSlur: () => void;
  isSlur?: boolean;
  onToggleTie: () => void;
  isTie?: boolean;
  onSetAccidental: (acc: '' | '#' | 'b') => void;
  currentAccidental?: '' | '#' | 'b';

  // Measure operations
  onAddMeasure: () => void;
  onDeleteSelectedMeasure?: () => void;
  onToggleLineBreak: () => void;
  isLineBreak?: boolean;
  onTogglePrelude?: () => void;
  isPrelude?: boolean;
  onToggleVoltaEnding?: () => void;
  voltaEnding?: number[];
  onAutoFillRest?: () => void;
  canFillRest?: boolean;

  // Zoom & Print & Theme
  zoomScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onPrint: () => void;
  sheetTheme?: 'light' | 'dark';
  onToggleSheetTheme?: () => void;

  // State
  activeField: 'pitch' | 'lyric';
  onToggleActiveField: () => void;
  selectedVerseRow: number;
  onChangeVerseRow: (row: number) => void;
  availableVerseRows?: number[];
}

export const FloatingScoreHud: React.FC<FloatingScoreHudProps> = ({
  isPlaying,
  onTogglePlay,
  selectedMeasureNumber,
  selectedNoteNumber,
  onSetPitch,
  onSetDash,
  onSetOctave,
  currentOctave,
  onSetDuration,
  currentDuration,
  onToggleDotted,
  isDotted,
  onToggleSlur,
  isSlur,
  onToggleTie,
  isTie,
  onSetAccidental,
  currentAccidental,
  onAddMeasure,
  onDeleteSelectedMeasure,
  onToggleLineBreak,
  isLineBreak,
  onTogglePrelude,
  isPrelude,
  onToggleVoltaEnding,
  voltaEnding,
  onAutoFillRest,
  canFillRest,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onPrint,
  sheetTheme,
  onToggleSheetTheme,
  activeField,
  onToggleActiveField,
  selectedVerseRow,
  onChangeVerseRow,
  availableVerseRows = [1, 2, 3],
}) => {
  return (
    <div
      id="floating-score-hud-container"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] w-auto print:hidden"
    >
      <div className="flex flex-col items-center gap-1.5 p-1.5 sm:p-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xl transition-all duration-200">
        {/* Main Ribbon Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
          {/* Play/Stop Sheet Button */}
          <button
            id="floating-hud-play-btn"
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${
              isPlaying
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400 font-extrabold animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold'
            }`}
            title={
              isPlaying
                ? 'Stop playback (Space)'
                : selectedMeasureNumber
                ? `Play score from Measure #${selectedMeasureNumber} (Space)`
                : 'Play score from beginning (Space)'
            }
          >
            {isPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block mx-0.5" />

          {/* Active Field Toggle: Pitch vs Lyric */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <button
              id="floating-hud-pitch-mode-btn"
              type="button"
              onClick={() => activeField !== 'pitch' && onToggleActiveField()}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeField === 'pitch'
                  ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
              title="Edit musical pitches & durations (Up/Down arrow to switch)"
            >
              Notes
            </button>
            <button
              id="floating-hud-lyric-mode-btn"
              type="button"
              onClick={() => activeField !== 'lyric' && onToggleActiveField()}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeField === 'lyric'
                  ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
              title="Edit lyrics aligned under notes (Up/Down arrow to switch)"
            >
              Lyrics
            </button>
          </div>

          {/* Verse Selector when in Lyric mode */}
          {activeField === 'lyric' && (
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold">
              <span className="text-zinc-500 text-[11px]">Verse:</span>
              {availableVerseRows.map(row => (
                <button
                  key={`hud-vrow-${row}`}
                  type="button"
                  onClick={() => onChangeVerseRow(row)}
                  className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    selectedVerseRow === row
                      ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {row}
                </button>
              ))}
            </div>
          )}

          {/* Pitch Palette: 1-7, 0, - */}
          {activeField === 'pitch' && (
            <div className="flex items-center gap-0.5 sm:gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              {([1, 2, 3, 4, 5, 6, 7] as PitchNumber[]).map(p => (
                <button
                  key={`hud-pitch-${p}`}
                  id={`floating-hud-pitch-${p}-btn`}
                  type="button"
                  onClick={() => onSetPitch(p)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-mono font-black text-sm sm:text-base flex items-center justify-center text-zinc-800 dark:text-zinc-100 hover:bg-amber-500 hover:text-zinc-950 transition-all active:scale-90 cursor-pointer"
                  title={`Pitch ${p} (Key ${p})`}
                >
                  {p}
                </button>
              ))}
              <button
                id="floating-hud-pitch-rest-btn"
                type="button"
                onClick={() => onSetPitch(0)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-mono font-black text-sm sm:text-base flex items-center justify-center text-zinc-800 dark:text-zinc-100 hover:bg-amber-500 hover:text-zinc-950 transition-all active:scale-90 cursor-pointer"
                title="Rest note (0)"
              >
                0
              </button>
              <button
                id="floating-hud-pitch-dash-btn"
                type="button"
                onClick={onSetDash}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-mono font-black text-sm sm:text-base flex items-center justify-center text-zinc-800 dark:text-zinc-100 hover:bg-amber-500 hover:text-zinc-950 transition-all active:scale-90 cursor-pointer"
                title="Sustain Dash (-) extend note duration"
              >
                -
              </button>
            </div>
          )}

          {/* Octave Controls */}
          {activeField === 'pitch' && (
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                id="floating-hud-octave-down-btn"
                type="button"
                onClick={() => onSetOctave(-1)}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentOctave < 0
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Octave Down (• below) (Key -)"
              >
                8vb •
              </button>
              <button
                id="floating-hud-octave-up-btn"
                type="button"
                onClick={() => onSetOctave(1)}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentOctave > 0
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Octave Up (• above) (Key +)"
              >
                8va •
              </button>
            </div>
          )}

          {/* Duration Selector */}
          {activeField === 'pitch' && (
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                id="floating-hud-dur-quarter-btn"
                type="button"
                onClick={() => onSetDuration(1)}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentDuration === 1
                    ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Quarter note (1 beat)"
              >
                1
              </button>
              <button
                id="floating-hud-dur-eighth-btn"
                type="button"
                onClick={() => onSetDuration(0.5)}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentDuration === 0.5
                    ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="8th note (1/2 beat - single beam) (Key /)"
              >
                <span className="underline decoration-2">1/2</span>
              </button>
              <button
                id="floating-hud-dur-sixteenth-btn"
                type="button"
                onClick={() => onSetDuration(0.25)}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentDuration === 0.25
                    ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="16th note (1/4 beat - double beam)"
              >
                <span className="underline decoration-double">1/4</span>
              </button>
              <button
                id="floating-hud-dur-half-btn"
                type="button"
                onClick={() => onSetDuration(2)}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentDuration === 2
                    ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Half note (2 beats)"
              >
                2
              </button>
              <button
                id="floating-hud-dur-whole-btn"
                type="button"
                onClick={() => onSetDuration(4)}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentDuration === 4
                    ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Whole note (4 beats)"
              >
                4
              </button>
            </div>
          )}

          {/* Dotted, Slur, Tie, Accidentals */}
          {activeField === 'pitch' && (
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                id="floating-hud-toggle-dot-btn"
                type="button"
                onClick={onToggleDotted}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  isDotted
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Toggle Dotted Note (Key .)"
              >
                • Dot
              </button>
              <button
                id="floating-hud-toggle-slur-btn"
                type="button"
                onClick={onToggleSlur}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  isSlur
                    ? 'bg-purple-600 text-white font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Toggle Slur arc across notes (Key S)"
              >
                ⌒ Slur
              </button>
              <button
                id="floating-hud-toggle-tie-btn"
                type="button"
                onClick={onToggleTie}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  isTie
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Toggle Tie sustain same pitch (Key T)"
              >
                Tie
              </button>
              <button
                id="floating-hud-toggle-sharp-btn"
                type="button"
                onClick={() => onSetAccidental('#')}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentAccidental === '#'
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Sharp accidental (Key #)"
              >
                ♯
              </button>
              <button
                id="floating-hud-toggle-flat-btn"
                type="button"
                onClick={() => onSetAccidental('b')}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentAccidental === 'b'
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Flat accidental (Key b)"
              >
                ♭
              </button>
            </div>
          )}

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block mx-0.5" />

          {/* Measure Level Controls: Append Measure, Line Break, Prelude, Voltas */}
          <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <button
              id="floating-hud-append-measure-btn"
              type="button"
              onClick={onAddMeasure}
              className="flex items-center gap-1 px-2.5 h-7 sm:h-8 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-amber-500 hover:text-zinc-950 transition-all cursor-pointer"
              title="Append Measure to Score"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Measure</span>
            </button>

            <button
              id="floating-hud-toggle-break-btn"
              type="button"
              onClick={onToggleLineBreak}
              className={`flex items-center gap-1 px-2 h-7 sm:h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isLineBreak
                  ? 'bg-amber-500 text-zinc-950 font-black'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title="Force line break at current measure (splits staff system)"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Break ↵</span>
            </button>

            {onTogglePrelude && (
              <button
                id="floating-hud-toggle-prelude-btn"
                type="button"
                onClick={onTogglePrelude}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isPrelude
                    ? 'bg-indigo-600 text-white font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Toggle instrumental prelude parentheses ( ... )"
              >
                ( )
              </button>
            )}

            {onToggleVoltaEnding && (
              <button
                id="floating-hud-toggle-volta-btn"
                type="button"
                onClick={onToggleVoltaEnding}
                className={`px-2 h-7 sm:h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  voltaEnding && voltaEnding.length > 0
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="Toggle Volta repeat ending bracket ┌ 1. 2. ──┐"
              >
                ┌ 1. 2. ┐
              </button>
            )}

            {canFillRest && onAutoFillRest && (
              <button
                id="floating-hud-auto-rest-btn"
                type="button"
                onClick={onAutoFillRest}
                className="flex items-center gap-1 px-2 h-7 sm:h-8 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-all cursor-pointer shadow-2xs"
                title="Auto-fill missing beats with rest notes (0)"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Pad</span>
              </button>
            )}

            {onDeleteSelectedMeasure && (
              <button
                id="floating-hud-delete-measure-btn"
                type="button"
                onClick={onDeleteSelectedMeasure}
                className="p-1 h-7 sm:h-8 w-7 sm:w-8 rounded-lg text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 flex items-center justify-center transition-all cursor-pointer"
                title="Delete current measure"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block mx-0.5" />

          {/* Zoom & Print */}
          <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <button
              id="floating-hud-zoom-out-btn"
              type="button"
              onClick={onZoomOut}
              className="p-1 h-7 sm:h-8 w-7 sm:w-8 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-all cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              id="floating-hud-reset-zoom-btn"
              type="button"
              onClick={onResetZoom}
              className="px-1.5 h-7 sm:h-8 rounded-lg text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-all cursor-pointer"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              id="floating-hud-zoom-in-btn"
              type="button"
              onClick={onZoomIn}
              className="p-1 h-7 sm:h-8 w-7 sm:w-8 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              id="floating-hud-print-btn"
              type="button"
              onClick={onPrint}
              className="p-1 h-7 sm:h-8 w-7 sm:w-8 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-center transition-all cursor-pointer"
              title="Print Sheet Music (WYSIWYG)"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            {onToggleSheetTheme && (
              <button
                id="floating-hud-toggle-theme-btn"
                type="button"
                onClick={onToggleSheetTheme}
                className="p-1 h-7 sm:h-8 w-7 sm:w-8 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-center transition-all cursor-pointer"
                title={sheetTheme === 'dark' ? 'Switch score paper to Light Parchment' : 'Switch score paper to Dark Stage Mode'}
              >
                {sheetTheme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Subtle helper shortcut hint */}
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono hidden md:flex items-center gap-3">
          <span>Type 1-7 for pitch</span>
          <span>•</span>
          <span>0 for rest</span>
          <span>•</span>
          <span>- for sustain dash</span>
          <span>•</span>
          <span>/ halves duration</span>
          <span>•</span>
          <span>* doubles duration</span>
          <span>•</span>
          <span>. toggles dot</span>
          <span>•</span>
          <span>Arrows move caret</span>
        </div>
      </div>
    </div>
  );
};
