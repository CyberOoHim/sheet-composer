'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Song,
  Measure,
  NumberedNotationNote,
  TimeSignature,
  KeySignature,
  PitchNumber,
  NoteDuration,
  BarlineType,
  LyricDisplayMode,
  GraceNote,
  ArticulationType,
} from '@/types/song';
import {
  engraveMeasure,
  groupMeasuresIntoSystems,
  EngravedMeasure,
  EngravedNote,
} from '@/lib/jianpuEngraver';
import { FloatingScoreHud } from './FloatingScoreHud';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { AudioEngine, audioEngine as defaultAudioEngine } from '@/lib/audioEngine';
import { autoArrangeSongChords, getDiatonicCandidateChords } from '@/lib/chordArranger';
import {
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Edit2,
  Check,
  X,
  Play,
  Square,
  Plus,
  Trash2,
  Music,
  Sun,
  Moon,
  Keyboard,
} from 'lucide-react';
import {
  getStoredRealSheetTheme,
  setStoredRealSheetTheme,
  RealSheetTheme,
} from '@/lib/storage';

export interface RealSheetCanvasProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;

  // Selected coordinate [measureIndex, noteIndex]
  selectedMeasureIndex?: number | null;
  selectedNoteIndex?: number | null;
  onSelectNote?: (measureIndex: number, noteIndex: number) => void;
  onSelectMeasure?: (measureIndex: number) => void;

  // Active playing note ID
  activePlaybackNoteId?: string | null;

  // Playback handlers
  isPlaying?: boolean;
  onTogglePlay?: () => void;

  // Direct editing operations
  onUpdateNote?: (measureIndex: number, noteIndex: number, partialNote: Partial<NumberedNotationNote>) => void;
  onInsertNoteAt?: (measureIndex: number, noteIndex: number) => void;
  onDeleteNoteAt?: (measureIndex: number, noteIndex: number) => void;
  onAddMeasure?: () => void;
  onDeleteMeasure?: (measureIndex: number) => void;
  onToggleLineBreak?: (measureIndex: number) => void;
  onUpdateBarlineType?: (measureIndex: number, barlineType: BarlineType) => void;
  onAutoFillRest?: (measureIndex: number) => void;

  // Audio Engine & preview
  audioEngine?: AudioEngine;
  previewNoteAudio?: (key: KeySignature, note: NumberedNotationNote) => void;

  // Modals & Advanced Tools
  onOpenKeyboardModal?: () => void;
  onOpenOrganizer?: () => void;
  onAutoHarmonize?: () => void;
  onUpdateMeasureChord?: (measureIndex: number, chord: string) => void;

  // Display mode
  displayMode?: LyricDisplayMode;

  // Sheet Theme (Parchment Light vs Studio Dark)
  sheetTheme?: RealSheetTheme;
  onToggleSheetTheme?: () => void;
}

const ALL_KEYS: KeySignature[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'
];

const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '2/4', '6/8'];

export const RealSheetCanvas: React.FC<RealSheetCanvasProps> = ({
  song,
  onUpdateSong,
  selectedMeasureIndex = 0,
  selectedNoteIndex = 0,
  onSelectNote,
  onSelectMeasure,
  activePlaybackNoteId = null,
  isPlaying = false,
  onTogglePlay,
  onUpdateNote,
  onInsertNoteAt,
  onDeleteNoteAt,
  onAddMeasure,
  onDeleteMeasure,
  onToggleLineBreak,
  onUpdateBarlineType,
  onAutoFillRest,
  audioEngine,
  previewNoteAudio,
  onOpenKeyboardModal,
  onOpenOrganizer,
  onAutoHarmonize,
  onUpdateMeasureChord,
  displayMode = 'hanlo_major_roman',
  sheetTheme: propSheetTheme,
  onToggleSheetTheme: propOnToggleSheetTheme,
}) => {
  // Theme state: light (parchment) vs dark (studio stage)
  const [internalSheetTheme, setInternalSheetTheme] = useState<RealSheetTheme>(() => getStoredRealSheetTheme('light'));
  const sheetTheme = propSheetTheme ?? internalSheetTheme;

  const handleToggleSheetTheme = useCallback(() => {
    if (propOnToggleSheetTheme) {
      propOnToggleSheetTheme();
    } else {
      setInternalSheetTheme(prev => {
        const next = prev === 'light' ? 'dark' : 'light';
        setStoredRealSheetTheme(next);
        return next;
      });
    }
  }, [propOnToggleSheetTheme]);

  // Zoom scaling
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Active editing target: 'pitch' vs 'lyric'
  const [activeField, setActiveField] = useState<'pitch' | 'lyric'>('pitch');
  const [activeVerseRow, setActiveVerseRow] = useState<number>(1);

  // In-place editable header modal / inline editors
  const [editingHeaderField, setEditingHeaderField] = useState<string | null>(null);
  const [headerDraftText, setHeaderDraftText] = useState<string>('');

  // Dropdown states for Key / Meter
  const [showKeyPicker, setShowKeyPicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [showBpmPicker, setShowBpmPicker] = useState<boolean>(false);
  const [draftBpm, setDraftBpm] = useState<number>(song.bpm || 88);

  // Virtual Piano Bed state
  const [showPianoBed, setShowPianoBed] = useState<boolean>(false);

  // References
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const activeNoteElementRef = useRef<HTMLDivElement>(null);

  // Resolved safe coordinates
  const currentMIdx = Math.max(0, Math.min(song.measures.length - 1, selectedMeasureIndex ?? 0));
  const currentMeasure = song.measures[currentMIdx];
  const currentNIdx = Math.max(
    0,
    Math.min((currentMeasure?.notes.length ?? 1) - 1, selectedNoteIndex ?? 0)
  );
  const currentNote = currentMeasure?.notes[currentNIdx];

  // Engrave score into systems with horizontal continuous beams
  const systems = useMemo(() => {
    return groupMeasuresIntoSystems(song.measures, song.timeSignature || '4/4', song.notesPerLine || 4);
  }, [song.measures, song.timeSignature, song.notesPerLine]);

  // Handle Note Selection
  const handleNoteClick = useCallback(
    (mIdx: number, nIdx: number, targetField: 'pitch' | 'lyric' = 'pitch', verseRow = 1) => {
      onSelectNote?.(mIdx, nIdx);
      onSelectMeasure?.(mIdx);
      setActiveField(targetField);
      if (targetField === 'lyric') {
        setActiveVerseRow(verseRow);
      }
    },
    [onSelectNote, onSelectMeasure]
  );

  // Scroll active note into view smoothly when navigating
  useEffect(() => {
    if (activeNoteElementRef.current) {
      activeNoteElementRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [currentMIdx, currentNIdx]);

  // Helper to update current selected note
  const updateCurrentNote = useCallback(
    (updater: (note: NumberedNotationNote) => NumberedNotationNote) => {
      if (!currentMeasure || !currentNote) return;
      const updated = updater({ ...currentNote });

      if (onUpdateNote) {
        onUpdateNote(currentMIdx, currentNIdx, updated);
      } else {
        const newMeasures = song.measures.map((m, mI) => {
          if (mI !== currentMIdx) return m;
          const notes = m.notes.map((n, nI) => (nI === currentNIdx ? updated : n));
          return { ...m, notes };
        });
        onUpdateSong({ ...song, measures: newMeasures });
      }

      if (previewNoteAudio && updated.pitch !== 0 && updated.pitch !== 'empty') {
        previewNoteAudio(song.key, updated);
      }
    },
    [currentMeasure, currentNote, onUpdateNote, currentMIdx, currentNIdx, song, onUpdateSong, previewNoteAudio]
  );

  // Diatonic chord suggestions based on key signature
  const chordSuggestions = useMemo(() => {
    try {
      return getDiatonicCandidateChords(song.key).map(c => c.chord);
    } catch {
      return ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'G7'];
    }
  }, [song.key]);

  // Smoothly scroll active playback note into view during playback
  useEffect(() => {
    if (!isPlaying || !activePlaybackNoteId) return;
    const el = document.getElementById(`sheet-note-${activePlaybackNoteId}`);
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [isPlaying, activePlaybackNoteId]);

  // Step to Next Note
  const stepToNextNote = useCallback(() => {
    if (!currentMeasure) return;
    if (currentNIdx < currentMeasure.notes.length - 1) {
      handleNoteClick(currentMIdx, currentNIdx + 1, activeField, activeVerseRow);
    } else if (currentMIdx < song.measures.length - 1) {
      handleNoteClick(currentMIdx + 1, 0, activeField, activeVerseRow);
    }
  }, [currentMeasure, currentNIdx, currentMIdx, song.measures.length, handleNoteClick, activeField, activeVerseRow]);

  // Step to Prev Note
  const stepToPrevNote = useCallback(() => {
    if (currentNIdx > 0) {
      handleNoteClick(currentMIdx, currentNIdx - 1, activeField, activeVerseRow);
    } else if (currentMIdx > 0) {
      const prevM = song.measures[currentMIdx - 1];
      handleNoteClick(currentMIdx - 1, (prevM?.notes.length ?? 1) - 1, activeField, activeVerseRow);
    }
  }, [currentNIdx, currentMIdx, song.measures, handleNoteClick, activeField, activeVerseRow]);

  // Pitch setter
  const handleSetPitch = useCallback(
    (p: PitchNumber) => {
      updateCurrentNote(note => ({
        ...note,
        pitch: p,
      }));
      stepToNextNote();
    },
    [updateCurrentNote, stepToNextNote]
  );

  // Sustain dash '-'
  const handleSetDash = useCallback(() => {
    updateCurrentNote(note => {
      // Extend duration by 1 beat
      const nextDur = (note.duration >= 4 ? 4 : (note.duration + 1)) as NoteDuration;
      return {
        ...note,
        duration: nextDur,
      };
    });
  }, [updateCurrentNote]);

  // Octave setter
  const handleSetOctave = useCallback(
    (delta: number) => {
      updateCurrentNote(note => ({
        ...note,
        octave: Math.max(-2, Math.min(2, note.octave + delta)),
      }));
    },
    [updateCurrentNote]
  );

  // Duration setter
  const handleSetDuration = useCallback(
    (dur: NoteDuration) => {
      updateCurrentNote(note => ({
        ...note,
        duration: dur,
        isDotted: dur === 1.5 || dur === 0.75 || dur === 3 || dur === 0.375,
      }));
    },
    [updateCurrentNote]
  );

  // Toggle dotted
  const handleToggleDotted = useCallback(() => {
    updateCurrentNote(note => {
      const isDotted = !note.isDotted;
      let newDur = note.duration;
      if (isDotted) {
        if (note.duration === 1) newDur = 1.5;
        else if (note.duration === 0.5) newDur = 0.75;
        else if (note.duration === 2) newDur = 3;
        else if (note.duration === 0.25) newDur = 0.375;
      } else {
        if (note.duration === 1.5) newDur = 1;
        else if (note.duration === 0.75) newDur = 0.5;
        else if (note.duration === 3) newDur = 2;
        else if (note.duration === 0.375) newDur = 0.25;
      }
      return {
        ...note,
        duration: newDur,
        isDotted,
      };
    });
  }, [updateCurrentNote]);

  // Toggle Slur
  const handleToggleSlur = useCallback(() => {
    updateCurrentNote(note => ({
      ...note,
      slurToNext: !note.slurToNext,
    }));
  }, [updateCurrentNote]);

  // Toggle Tie
  const handleToggleTie = useCallback(() => {
    updateCurrentNote(note => ({
      ...note,
      tieToNext: !note.tieToNext,
      isTied: !note.tieToNext,
    }));
  }, [updateCurrentNote]);

  // Accidental
  const handleSetAccidental = useCallback(
    (acc: '' | '#' | 'b') => {
      updateCurrentNote(note => ({
        ...note,
        accidental: note.accidental === acc ? '' : acc,
      }));
    },
    [updateCurrentNote]
  );

  // Toggle Triplet
  const handleToggleTriplet = useCallback(() => {
    updateCurrentNote(note => ({
      ...note,
      isTriplet: !note.isTriplet,
    }));
  }, [updateCurrentNote]);

  // Articulations
  const handleSetArticulation = useCallback(
    (art: ArticulationType) => {
      updateCurrentNote(note => ({
        ...note,
        articulation: note.articulation === art ? undefined : art,
      }));
    },
    [updateCurrentNote]
  );

  // Quick Punctuation
  const handleInsertPunctuation = useCallback(
    (punct: string) => {
      updateCurrentNote(note => ({
        ...note,
        lyric: {
          ...note.lyric,
          hanlo: (note.lyric.hanlo || '') + punct,
          hanji: (note.lyric.hanji || '') + punct,
          custom: (note.lyric.custom || '') + punct,
        },
      }));
    },
    [updateCurrentNote]
  );

  // Annotation
  const handleInsertAnnotation = useCallback(
    (annot: string) => {
      updateCurrentNote(note => ({
        ...note,
        annotation: note.annotation === annot ? undefined : annot,
      }));
    },
    [updateCurrentNote]
  );

  // Grace Notes
  const handleAddGraceNote = useCallback(
    (type: 'pre' | 'post', pitch: 1 | 2 | 3 | 4 | 5 | 6 | 7, octave: number) => {
      updateCurrentNote(note => {
        const newGrace: GraceNote = { pitch, octave };
        if (type === 'pre') {
          const existing = note.preGraceNotes || [];
          if (existing.length >= 3) return note;
          return { ...note, preGraceNotes: [...existing, newGrace] };
        } else {
          const existing = note.postGraceNotes || [];
          if (existing.length >= 3) return note;
          return { ...note, postGraceNotes: [...existing, newGrace] };
        }
      });
    },
    [updateCurrentNote]
  );

  const handleClearGraceNotes = useCallback(() => {
    updateCurrentNote(note => ({
      ...note,
      preGraceNotes: undefined,
      postGraceNotes: undefined,
    }));
  }, [updateCurrentNote]);

  // Chords and Harmony
  const handleUpdateMeasureChord = useCallback(
    (chord: string) => {
      if (onUpdateMeasureChord) {
        onUpdateMeasureChord(currentMIdx, chord);
      } else {
        const newMeasures = song.measures.map((m, idx) => {
          if (idx !== currentMIdx) return m;
          return { ...m, chord };
        });
        onUpdateSong({ ...song, measures: newMeasures });
      }
    },
    [onUpdateMeasureChord, currentMIdx, song, onUpdateSong]
  );

  const handleAutoHarmonize = useCallback(() => {
    if (onAutoHarmonize) {
      onAutoHarmonize();
    } else {
      const arranged = autoArrangeSongChords(song);
      onUpdateSong(arranged);
    }
  }, [onAutoHarmonize, song, onUpdateSong]);

  // Virtual Piano key pitch selection
  const handleSelectPitchFromPiano = useCallback(
    (pitch: PitchNumber, octave: number, accidental: '' | '#' | 'b') => {
      updateCurrentNote(note => ({
        ...note,
        pitch,
        octave,
        accidental,
      }));
      stepToNextNote();
    },
    [updateCurrentNote, stepToNextNote]
  );

  // Measure operations
  const handleAddMeasureClick = useCallback(() => {
    if (onAddMeasure) {
      onAddMeasure();
    } else {
      const newM: Measure = {
        id: `m-${Date.now()}`,
        measureNumber: song.measures.length + 1,
        chord: 'C',
        notes: [
          { id: `n-${Date.now()}-1`, pitch: 1, octave: 0, duration: 1, lyric: {} },
          { id: `n-${Date.now()}-2`, pitch: 2, octave: 0, duration: 1, lyric: {} },
          { id: `n-${Date.now()}-3`, pitch: 3, octave: 0, duration: 1, lyric: {} },
          { id: `n-${Date.now()}-4`, pitch: 5, octave: 0, duration: 1, lyric: {} },
        ],
      };
      onUpdateSong({ ...song, measures: [...song.measures, newM] });
    }
  }, [onAddMeasure, song, onUpdateSong]);

  const handleDeleteMeasureClick = useCallback(() => {
    if (song.measures.length <= 1) return;
    if (onDeleteMeasure) {
      onDeleteMeasure(currentMIdx);
    } else {
      const newMeasures = song.measures
        .filter((_, idx) => idx !== currentMIdx)
        .map((m, idx) => ({ ...m, measureNumber: idx + 1 }));
      onUpdateSong({ ...song, measures: newMeasures });
    }
  }, [song, currentMIdx, onDeleteMeasure, onUpdateSong]);

  const handleToggleLineBreakClick = useCallback(() => {
    if (onToggleLineBreak) {
      onToggleLineBreak(currentMIdx);
    } else {
      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== currentMIdx) return m;
        return { ...m, isLineBreak: !m.isLineBreak };
      });
      onUpdateSong({ ...song, measures: newMeasures });
    }
  }, [onToggleLineBreak, currentMIdx, song, onUpdateSong]);

  const handleTogglePreludeClick = useCallback(() => {
    const targetM = song.measures[currentMIdx];
    if (!targetM) return;
    const newMeasures = song.measures.map((m, idx) => {
      if (idx !== currentMIdx) return m;
      return { ...m, isPrelude: !m.isPrelude };
    });
    onUpdateSong({ ...song, measures: newMeasures });
  }, [song, currentMIdx, onUpdateSong]);

  const handleToggleVoltaEndingClick = useCallback(() => {
    const targetM = song.measures[currentMIdx];
    if (!targetM) return;
    const nextEnding = !targetM.voltaEnding ? [1, 2] : targetM.voltaEnding.includes(1) ? [3] : undefined;
    const newMeasures = song.measures.map((m, idx) => {
      if (idx !== currentMIdx) return m;
      return { ...m, voltaEnding: nextEnding };
    });
    onUpdateSong({ ...song, measures: newMeasures });
  }, [song, currentMIdx, onUpdateSong]);

  // Keyboard navigation & direct typewriter input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in standard input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        editingHeaderField !== null
      ) {
        return;
      }

      // Space: Toggle play score
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay?.();
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepToNextNote();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepToPrevNote();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeField === 'pitch') {
          setActiveField('lyric');
          setActiveVerseRow(1);
        } else if (activeField === 'lyric' && activeVerseRow < 3) {
          setActiveVerseRow(prev => prev + 1);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeField === 'lyric' && activeVerseRow > 1) {
          setActiveVerseRow(prev => prev - 1);
        } else {
          setActiveField('pitch');
        }
        return;
      }

      // Pitch mode typing
      if (activeField === 'pitch') {
        if (e.key >= '1' && e.key <= '7') {
          e.preventDefault();
          handleSetPitch(parseInt(e.key, 10) as PitchNumber);
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          handleSetPitch(0);
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          handleSetDash();
          return;
        }
        if (e.key === '.') {
          e.preventDefault();
          handleToggleDotted();
          return;
        }
        if (e.key === '/') {
          e.preventDefault();
          // Halve duration
          updateCurrentNote(note => {
            let nextDur: NoteDuration = 0.5;
            if (note.duration >= 4) nextDur = 2;
            else if (note.duration >= 2) nextDur = 1;
            else if (note.duration >= 1) nextDur = 0.5;
            else if (note.duration >= 0.5) nextDur = 0.25;
            else nextDur = 0.125;
            return { ...note, duration: nextDur };
          });
          return;
        }
        if (e.key === '*') {
          e.preventDefault();
          // Double duration
          updateCurrentNote(note => {
            let nextDur: NoteDuration = 1;
            if (note.duration <= 0.125) nextDur = 0.25;
            else if (note.duration <= 0.25) nextDur = 0.5;
            else if (note.duration <= 0.5) nextDur = 1;
            else if (note.duration <= 1) nextDur = 2;
            else nextDur = 4;
            return { ...note, duration: nextDur };
          });
          return;
        }
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          handleSetOctave(1);
          return;
        }
        if (e.key === '_') {
          e.preventDefault();
          handleSetOctave(-1);
          return;
        }
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleToggleSlur();
          return;
        }
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          handleToggleTie();
          return;
        }
        if (e.key === '#') {
          e.preventDefault();
          handleSetAccidental('#');
          return;
        }
        if (e.key === 'b') {
          e.preventDefault();
          handleSetAccidental('b');
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          updateCurrentNote(note => ({
            ...note,
            pitch: 0,
            duration: 1,
            lyric: {},
          }));
          return;
        }
      }

      // Lyric mode typing
      if (activeField === 'lyric') {
        if (e.key === 'Backspace') {
          e.preventDefault();
          updateCurrentNote(note => {
            if (activeVerseRow === 1) {
              return {
                ...note,
                lyric: {
                  ...note.lyric,
                  hanlo: '',
                  hanji: '',
                  custom: '',
                },
              };
            } else {
              const currentVerses = { ...(note.lyricsByVerse || {}) };
              delete currentVerses[activeVerseRow];
              return {
                ...note,
                lyricsByVerse: currentVerses,
              };
            }
          });
          return;
        }
        if (e.key === ' ' || e.key === 'Tab') {
          e.preventDefault();
          stepToNextNote();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editingHeaderField,
    activeField,
    activeVerseRow,
    onTogglePlay,
    stepToNextNote,
    stepToPrevNote,
    handleSetPitch,
    handleSetDash,
    handleToggleDotted,
    handleSetOctave,
    handleToggleSlur,
    handleToggleTie,
    handleSetAccidental,
    updateCurrentNote,
  ]);

  // Lyric direct input change handler
  const handleLyricInputChange = useCallback(
    (text: string, verseRow: number) => {
      updateCurrentNote(note => {
        if (verseRow === 1) {
          const isHan = /[\u4e00-\u9fa5]/.test(text);
          return {
            ...note,
            lyric: {
              ...note.lyric,
              hanlo: text,
              hanji: isHan ? text : note.lyric.hanji,
              custom: text,
            },
          };
        } else {
          const prevVerses = note.lyricsByVerse || {};
          return {
            ...note,
            lyricsByVerse: {
              ...prevVerses,
              [verseRow]: {
                hanlo: text,
                custom: text,
              },
            },
          };
        }
      });
    },
    [updateCurrentNote]
  );

  // In-place header editing commit
  const commitHeaderEdit = () => {
    if (!editingHeaderField) return;
    const updated = { ...song };
    if (editingHeaderField === 'title') updated.title = headerDraftText;
    else if (editingHeaderField === 'subtitle') updated.subtitle = headerDraftText;
    else if (editingHeaderField === 'composer') updated.composer = headerDraftText;
    else if (editingHeaderField === 'lyricist') updated.lyricist = headerDraftText;
    else if (editingHeaderField === 'notator') updated.notator = headerDraftText;
    else if (editingHeaderField === 'catalogNumber') updated.catalogNumber = headerDraftText;

    onUpdateSong(updated);
    setEditingHeaderField(null);
  };

  const cancelHeaderEdit = () => {
    setEditingHeaderField(null);
  };

  const startHeaderEdit = (field: string, initialValue: string) => {
    setEditingHeaderField(field);
    setHeaderDraftText(initialValue);
  };

  // Print Score handler
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div
      id="real-sheet-viewport-container"
      ref={canvasWrapperRef}
      className="relative w-full min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center py-6 sm:py-10 px-2 sm:px-6 select-none print:p-0 print:m-0 print:bg-white overflow-x-auto"
    >
      {/* Top Floating Paper Control Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-4 px-2 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-serif tracking-wider font-bold text-zinc-500 uppercase">
            Sheet Music Canvas
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Jianpu Standard
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle Button */}
          <button
            id="sheet-theme-toggle-btn"
            type="button"
            onClick={handleToggleSheetTheme}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xs cursor-pointer ${
              sheetTheme === 'dark'
                ? 'bg-zinc-800 border-zinc-700 text-amber-400 hover:bg-zinc-700'
                : 'bg-white border-zinc-200 text-zinc-800 hover:bg-amber-500 hover:text-zinc-950'
            }`}
            title={sheetTheme === 'dark' ? 'Switch Real Sheet to Light Parchment Paper' : 'Switch Real Sheet to Studio Dark Mode'}
          >
            {sheetTheme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light Sheet</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-zinc-600" />
                <span>Dark Sheet</span>
              </>
            )}
          </button>

          <button
            id="sheet-top-print-btn"
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-amber-500 hover:text-zinc-950 transition-all shadow-xs cursor-pointer"
            title="Print or Export PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Score</span>
          </button>
        </div>
      </div>

      {/* The Physical Sheet Paper Canvas */}
      <div
        id="real-sheet-paper-stage"
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: 'top center',
        }}
        className={`relative w-full max-w-5xl rounded-xs p-8 sm:p-14 md:p-20 transition-all duration-150 print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full print:rounded-none select-none ${
          sheetTheme === 'dark'
            ? 'bg-[#14161f] text-zinc-100 border border-zinc-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.06)]'
            : 'bg-[#FCFAF6] text-zinc-900 border border-[#E7E2D8] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.06)]'
        } print:bg-white print:text-black`}
      >
        {/* Subtle physical paper watermark / registration corner marks */}
        <div className={`absolute top-3 left-3 font-mono text-[10px] select-none pointer-events-none print:hidden ${
          sheetTheme === 'dark' ? 'text-zinc-700' : 'text-zinc-300'
        }`}>
          ┌
        </div>
        <div className={`absolute top-3 right-3 font-mono text-[10px] select-none pointer-events-none print:hidden ${
          sheetTheme === 'dark' ? 'text-zinc-700' : 'text-zinc-300'
        }`}>
          ┐
        </div>
        <div className={`absolute bottom-3 left-3 font-mono text-[10px] select-none pointer-events-none print:hidden ${
          sheetTheme === 'dark' ? 'text-zinc-700' : 'text-zinc-300'
        }`}>
          └
        </div>
        <div className={`absolute bottom-3 right-3 font-mono text-[10px] select-none pointer-events-none print:hidden ${
          sheetTheme === 'dark' ? 'text-zinc-700' : 'text-zinc-300'
        }`}>
          ┘
        </div>

        {/* Paper Header: Catalog ID, Title, Credits, Key & Meter */}
        <header id="real-sheet-header" className={`relative pb-6 mb-8 border-b ${
          sheetTheme === 'dark' ? 'border-zinc-800' : 'border-zinc-200/80'
        }`}>
          {/* Top Row: Catalog ID (Left) & Controls (Right) */}
          <div className={`flex items-center justify-between text-xs font-mono mb-3 ${
            sheetTheme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
          }`}>
            <div
              className={`cursor-pointer transition-colors py-0.5 px-1 rounded font-serif italic ${
                sheetTheme === 'dark' ? 'hover:text-amber-400 hover:bg-zinc-800' : 'hover:text-amber-700 hover:bg-amber-50'
              }`}
              onClick={() => startHeaderEdit('catalogNumber', song.catalogNumber || 'LPDC—JCR1341')}
              title="Click to edit score catalog ID"
            >
              {song.catalogNumber || 'LPDC—JCR1341'}
            </div>
            <div className={`text-[11px] font-sans tracking-widest uppercase ${
              sheetTheme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              Numbered Musical Notation
            </div>
          </div>

          {/* Centered Song Title & Subtitle */}
          <div className="text-center my-3">
            <h1
              id="sheet-song-title-display"
              onClick={() => startHeaderEdit('title', song.title)}
              className={`font-serif tracking-[0.25em] text-3xl sm:text-4xl md:text-5xl font-black cursor-pointer hover:opacity-80 transition-opacity ${
                sheetTheme === 'dark' ? 'text-zinc-50' : 'text-zinc-950'
              }`}
              title="Click to edit song title"
            >
              {song.title || 'Untitled Song'}
            </h1>

            {song.subtitle && (
              <p
                id="sheet-song-subtitle-display"
                onClick={() => startHeaderEdit('subtitle', song.subtitle || '')}
                className={`font-serif text-sm sm:text-base mt-2 cursor-pointer hover:opacity-80 ${
                  sheetTheme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                }`}
                title="Click to edit subtitle"
              >
                {song.subtitle}
              </p>
            )}
          </div>

          {/* Key / Time Signature / Tempo (Left) & Credits (Right) */}
          <div className={`flex flex-wrap items-end justify-between mt-6 pt-3 gap-4 border-t ${
            sheetTheme === 'dark' ? 'border-zinc-800' : 'border-zinc-100'
          }`}>
            {/* Left Musical Meter Block */}
            <div className={`flex items-center gap-6 font-serif font-bold text-base sm:text-lg ${
              sheetTheme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
            }`}>
              {/* Key Signature: 1 = E */}
              <div className="relative">
                <button
                  id="sheet-key-signature-btn"
                  type="button"
                  onClick={() => setShowKeyPicker(!showKeyPicker)}
                  className={`flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded transition-colors ${
                    sheetTheme === 'dark' ? 'hover:text-amber-400 hover:bg-zinc-800' : 'hover:text-amber-700 hover:bg-amber-50'
                  }`}
                  title="Click to change Key signature"
                >
                  <span>1</span>
                  <span>=</span>
                  <span className="font-bold underline decoration-amber-500 decoration-2">
                    {song.key || 'C'}
                  </span>
                </button>

                {showKeyPicker && (
                  <div className={`absolute top-full left-0 mt-1 border shadow-xl rounded-xl p-2 grid grid-cols-4 gap-1 z-50 text-xs font-mono ${
                    sheetTheme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-800'
                  }`}>
                    {ALL_KEYS.map(k => (
                      <button
                        key={`key-opt-${k}`}
                        type="button"
                        onClick={() => {
                          onUpdateSong({ ...song, key: k });
                          setShowKeyPicker(false);
                        }}
                        className={`px-2 py-1 rounded cursor-pointer ${
                          song.key === k
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : sheetTheme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Signature Fraction: 4 over 4 */}
              <div className="relative">
                <button
                  id="sheet-time-signature-btn"
                  type="button"
                  onClick={() => setShowTimePicker(!showTimePicker)}
                  className={`flex flex-col items-center justify-center leading-none cursor-pointer px-1 py-0.5 rounded transition-colors ${
                    sheetTheme === 'dark' ? 'hover:text-amber-400 hover:bg-zinc-800' : 'hover:text-amber-700 hover:bg-amber-50'
                  }`}
                  title="Click to change Time signature"
                >
                  <span className="text-sm sm:text-base font-black">
                    {(song.timeSignature || '4/4').split('/')[0]}
                  </span>
                  <span className={`w-3 h-px my-0.5 ${sheetTheme === 'dark' ? 'bg-zinc-300' : 'bg-zinc-800'}`} />
                  <span className="text-sm sm:text-base font-black">
                    {(song.timeSignature || '4/4').split('/')[1]}
                  </span>
                </button>

                {showTimePicker && (
                  <div className={`absolute top-full left-0 mt-1 border shadow-xl rounded-xl p-1.5 flex flex-col gap-1 z-50 text-xs font-mono ${
                    sheetTheme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-800'
                  }`}>
                    {TIME_SIGNATURES.map(ts => (
                      <button
                        key={`ts-opt-${ts}`}
                        type="button"
                        onClick={() => {
                          onUpdateSong({ ...song, timeSignature: ts });
                          setShowTimePicker(false);
                        }}
                        className={`px-3 py-1.5 rounded text-left cursor-pointer ${
                          song.timeSignature === ts
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : sheetTheme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                        }`}
                      >
                        {ts}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tempo: ♩ = 88 */}
              <div className="relative">
                <button
                  id="sheet-tempo-btn"
                  type="button"
                  onClick={() => setShowBpmPicker(!showBpmPicker)}
                  className={`flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded transition-colors font-sans text-sm sm:text-base ${
                    sheetTheme === 'dark' ? 'hover:text-amber-400 hover:bg-zinc-800' : 'hover:text-amber-700 hover:bg-amber-50'
                  }`}
                  title="Click to adjust Tempo"
                >
                  <span className="text-base font-serif">♩</span>
                  <span>=</span>
                  <span className="font-mono font-bold">{song.bpm || 88}</span>
                </button>

                {showBpmPicker && (
                  <div className={`absolute top-full left-0 mt-1 border shadow-xl rounded-xl p-3 flex flex-col gap-2 z-50 text-xs ${
                    sheetTheme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-800'
                  }`}>
                    <label className={`font-bold ${sheetTheme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      Tempo (BPM): {draftBpm}
                    </label>
                    <input
                      type="range"
                      min={40}
                      max={240}
                      value={draftBpm}
                      onChange={e => setDraftBpm(Number(e.target.value))}
                      className="w-36 accent-amber-500"
                    />
                    <div className="flex justify-end gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSong({ ...song, bpm: draftBpm });
                          setShowBpmPicker(false);
                        }}
                        className="px-2 py-1 bg-amber-500 text-zinc-950 rounded font-bold cursor-pointer hover:bg-amber-400"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Credits Block */}
            <div className={`flex flex-col items-end text-xs sm:text-sm font-serif space-y-0.5 ${
              sheetTheme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'
            }`}>
              {song.lyricist && (
                <div
                  className={`cursor-pointer ${sheetTheme === 'dark' ? 'hover:text-amber-400' : 'hover:text-amber-700'}`}
                  onClick={() => startHeaderEdit('lyricist', song.lyricist || '')}
                  title="Click to edit Lyricist credit"
                >
                  {song.lyricist}
                </div>
              )}
              {song.composer && (
                <div
                  className={`cursor-pointer ${sheetTheme === 'dark' ? 'hover:text-amber-400' : 'hover:text-amber-700'}`}
                  onClick={() => startHeaderEdit('composer', song.composer || '')}
                  title="Click to edit Composer credit"
                >
                  {song.composer}
                </div>
              )}
              {song.notator && (
                <div
                  className={`cursor-pointer text-[11px] ${
                    sheetTheme === 'dark' ? 'text-zinc-500 hover:text-amber-400' : 'text-zinc-500 hover:text-amber-700'
                  }`}
                  onClick={() => startHeaderEdit('notator', song.notator || '')}
                  title="Click to edit Notator/Engraver credit"
                >
                  {song.notator}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Systems (Lines of Measures) */}
        <main id="real-sheet-systems-container" className="flex flex-col space-y-8 sm:space-y-10">
          {systems.map((system, sysIdx) => (
            <div
              key={`system-${system.systemIndex}`}
              id={`sheet-system-${system.systemIndex}`}
              className={`relative w-full flex items-stretch border-l-2 ${
                sheetTheme === 'dark' ? 'border-zinc-400' : 'border-zinc-800'
              }`}
            >
              {system.measures.map((engravedM, mInSysIdx) => {
                const isSelectedMeasure = engravedM.measureIndex === currentMIdx;
                const isFirstInSystem = mInSysIdx === 0;
                const isLastInSystem = mInSysIdx === system.measures.length - 1;

                return (
                  <div
                    key={`measure-${engravedM.measure.id}`}
                    id={`sheet-measure-${engravedM.measureNumber}`}
                    onClick={() => {
                      if (engravedM.notes.length > 0) {
                        handleNoteClick(engravedM.measureIndex, 0, activeField, activeVerseRow);
                      }
                    }}
                    className={`relative flex-1 flex flex-col justify-between px-2 sm:px-3 pt-4 pb-2 transition-colors cursor-pointer group ${
                      isSelectedMeasure
                        ? sheetTheme === 'dark' ? 'bg-amber-950/30' : 'bg-amber-50/40'
                        : sheetTheme === 'dark' ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50/80'
                    }`}
                  >
                    {/* Top Annotation Layer: Measure Number, Volta Brackets, Chords */}
                    <div className="relative flex items-center justify-between w-full h-7 mb-1">
                      {/* Left: Measure Number */}
                      <span className="text-[10px] font-mono text-zinc-400 select-none">
                        {engravedM.measureNumber}
                      </span>

                      {/* Center: Volta Bracket if applicable e.g. ┌ 1. 2. ─────┐ */}
                      {engravedM.voltaEnding && engravedM.voltaEnding.length > 0 && (
                        <div className={`absolute left-0 right-0 -top-3 flex items-center text-[11px] font-mono font-bold ${
                          sheetTheme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'
                        }`}>
                          <span className={sheetTheme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>┌</span>
                          <span className={`px-1 font-serif ${sheetTheme === 'dark' ? 'bg-[#14161f] text-zinc-200' : 'bg-[#FCFAF6] text-zinc-800'}`}>
                            {engravedM.voltaEnding.join('. ')}.
                          </span>
                          <div className={`flex-1 h-px ${sheetTheme === 'dark' ? 'bg-zinc-400' : 'bg-zinc-800'}`} />
                          <span className={sheetTheme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>┐</span>
                        </div>
                      )}

                      {/* Chord Symbol */}
                      <div className={`text-xs font-mono font-black tracking-wide ${
                        sheetTheme === 'dark' ? 'text-amber-400' : 'text-zinc-800'
                      }`}>
                        {engravedM.chordText}
                      </div>

                      {/* Section label if present */}
                      {engravedM.sectionText && (
                        <span className={`text-[9px] font-sans font-bold px-1.5 py-0.5 rounded ${
                          sheetTheme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {engravedM.sectionText}
                        </span>
                      )}
                    </div>

                    {/* Upper Obbligato / Counterpoint Layer if present */}
                    {engravedM.obbligatoNotes && engravedM.obbligatoNotes.length > 0 && (
                      <div className={`w-full flex flex-col items-center justify-center py-0.5 mb-1 border-b border-dashed ${
                        sheetTheme === 'dark' ? 'border-zinc-700' : 'border-zinc-300'
                      }`}>
                        <div className={`flex items-center justify-between w-full text-[9px] font-mono font-bold px-1 ${
                          sheetTheme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                          <span>{engravedM.obbligatoText || 'Obbligato (和音)'}</span>
                        </div>
                        <div className="flex items-center justify-around w-full">
                          {engravedM.obbligatoNotes.map((obNote, obIdx) => (
                            <div key={`ob-${obIdx}`} className={`flex flex-col items-center justify-center text-xs sm:text-sm font-mono font-bold ${
                              sheetTheme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'
                            }`}>
                              {obNote.octaveDotsAbove > 0 && (
                                <div className="flex gap-0.5 text-[8px] leading-none">
                                  {Array.from({ length: obNote.octaveDotsAbove }).map((_, i) => (
                                    <span key={`ob-dot-${i}`}>•</span>
                                  ))}
                                </div>
                              )}
                              <span>{obNote.pitchDisplay}</span>
                              {obNote.beam1.hasBeam && (
                                <div className={`h-[1.5px] w-full mt-0.5 ${sheetTheme === 'dark' ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
                              )}
                              {obNote.beam2.hasBeam && (
                                <div className={`h-[1.5px] w-full mt-0.5 ${sheetTheme === 'dark' ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
                              )}
                              {obNote.octaveDotsBelow > 0 && (
                                <div className="flex gap-0.5 text-[8px] leading-none">
                                  {Array.from({ length: obNote.octaveDotsBelow }).map((_, i) => (
                                    <span key={`ob-bdot-${i}`}>•</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notation Line & Continuous Beams */}
                    <div className="relative flex items-center justify-between w-full min-h-[56px] py-1">
                      {/* Prelude Open Parenthesis '(' */}
                      {engravedM.isPrelude && isFirstInSystem && (
                        <span className={`font-serif text-2xl font-bold mr-1 select-none ${
                          sheetTheme === 'dark' ? 'text-zinc-400' : 'text-zinc-700'
                        }`}>
                          (
                        </span>
                      )}

                      {/* Notes within Measure */}
                      <div className="flex-1 flex items-center justify-around">
                        {engravedM.notes.map((engNote, nIdx) => {
                          const isSelectedNote =
                            isSelectedMeasure && nIdx === currentNIdx && activeField === 'pitch';
                          const isPlayingNote = activePlaybackNoteId === engNote.note.id;

                          return (
                            <div
                              key={`note-${engNote.note.id}`}
                              id={`sheet-note-${engNote.note.id}`}
                              data-coord={`sheet-note-${engravedM.measureNumber}-${nIdx}`}
                              ref={isSelectedNote ? activeNoteElementRef : undefined}
                              onClick={e => {
                                e.stopPropagation();
                                handleNoteClick(
                                  engravedM.measureIndex,
                                  nIdx,
                                  'pitch',
                                  activeVerseRow
                                );
                              }}
                              className={`relative flex flex-col items-center justify-center p-1 rounded-sm transition-all cursor-pointer ${
                                isSelectedNote
                                  ? sheetTheme === 'dark'
                                    ? 'ring-2 ring-amber-400 bg-amber-950/60'
                                    : 'ring-2 ring-amber-500 bg-amber-100/50'
                                  : isPlayingNote
                                  ? 'ring-2 ring-emerald-500 bg-emerald-500/20 animate-pulse'
                                  : sheetTheme === 'dark'
                                  ? 'hover:bg-zinc-800'
                                  : 'hover:bg-zinc-100'
                              }`}
                            >
                              {/* Slur / Tie Arc indicator over note */}
                              {(engNote.note.slurToNext || engNote.note.tieToNext) && (
                                <div className="absolute -top-3.5 left-1/2 w-8 h-2 -translate-x-1/2 pointer-events-none">
                                  <svg className="w-full h-full" viewBox="0 0 32 8">
                                    <path
                                      d="M 2 7 Q 16 0 30 7"
                                      fill="none"
                                      stroke={sheetTheme === 'dark' ? '#E4E4E7' : '#18181B'}
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                </div>
                              )}

                              {/* Musical / Vocal Annotation above note */}
                              {engNote.note.annotation && (
                                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-serif italic text-amber-600 dark:text-amber-400 select-none whitespace-nowrap pointer-events-none">
                                  {engNote.note.annotation}
                                </span>
                              )}

                              {/* Articulation symbol above note */}
                              {engNote.note.articulation && engNote.note.articulation !== 'none' && (
                                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold leading-none select-none pointer-events-none">
                                  {engNote.note.articulation === 'staccato' ? '·' :
                                   engNote.note.articulation === 'tenuto' ? '—' :
                                   engNote.note.articulation === 'accent' ? '>' :
                                   engNote.note.articulation === 'fermata' ? '𝄐' : ''}
                                </span>
                              )}

                              {/* High Octave Dots Above */}
                              <div className="flex flex-col items-center h-2.5 justify-end">
                                {engNote.octaveDotsAbove > 0 && (
                                  <div className={`flex gap-0.5 font-black leading-none text-[9px] ${
                                    sheetTheme === 'dark' ? 'text-zinc-100' : 'text-zinc-950'
                                  }`}>
                                    {Array.from({ length: engNote.octaveDotsAbove }).map((_, i) => (
                                      <span key={`dot-above-${i}`}>•</span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Musical Pitch Digit with Accidental and Pre/Post Grace */}
                              <div className={`relative flex items-center font-mono font-bold text-xl sm:text-2xl leading-none select-none ${
                                sheetTheme === 'dark' ? 'text-zinc-100' : 'text-zinc-950'
                              }`}>
                                {/* Pre-Grace Notes */}
                                {engNote.note.preGraceNotes && engNote.note.preGraceNotes.length > 0 && (
                                  <span className="inline-flex items-end gap-0.5 mr-0.5 text-[10px] font-mono font-bold leading-none select-none opacity-85">
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 -mr-0.5">⌒</span>
                                    {engNote.note.preGraceNotes.map((g, idx) => (
                                      <span key={idx} className="relative flex flex-col items-center">
                                        {g.octave > 0 && <span className="text-[7px] leading-none mb-[-2px]">·</span>}
                                        <span className="flex items-baseline">
                                          {g.accidental && <span className="text-[8px]">{g.accidental === '#' ? '♯' : '♭'}</span>}
                                          <span>{g.pitch}</span>
                                        </span>
                                        {g.octave < 0 && <span className="text-[7px] leading-none mt-[-2px]">·</span>}
                                        <span className={`w-full h-[1px] mt-0.5 ${sheetTheme === 'dark' ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
                                      </span>
                                    ))}
                                  </span>
                                )}

                                {/* Accidental */}
                                {engNote.accidentalSymbol && (
                                  <span className={`text-xs font-serif font-black -mr-0.5 ${
                                    sheetTheme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'
                                  }`}>
                                    {engNote.accidentalSymbol}
                                  </span>
                                )}

                                {/* Pitch Digit */}
                                <span>{engNote.pitchDisplay}</span>

                                {/* Post-Grace Notes */}
                                {engNote.note.postGraceNotes && engNote.note.postGraceNotes.length > 0 && (
                                  <span className="inline-flex items-end gap-0.5 ml-0.5 text-[10px] font-mono font-bold leading-none select-none opacity-85">
                                    {engNote.note.postGraceNotes.map((g, idx) => (
                                      <span key={idx} className="relative flex flex-col items-center">
                                        {g.octave > 0 && <span className="text-[7px] leading-none mb-[-2px]">·</span>}
                                        <span className="flex items-baseline">
                                          {g.accidental && <span className="text-[8px]">{g.accidental === '#' ? '♯' : '♭'}</span>}
                                          <span>{g.pitch}</span>
                                        </span>
                                        {g.octave < 0 && <span className="text-[7px] leading-none mt-[-2px]">·</span>}
                                        <span className={`w-full h-[1px] mt-0.5 ${sheetTheme === 'dark' ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
                                      </span>
                                    ))}
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 -ml-0.5">⌒</span>
                                  </span>
                                )}

                                {/* Triplet Indicator */}
                                {engNote.note.isTriplet && (
                                  <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 ml-0.5">
                                    ³
                                  </span>
                                )}

                                {/* Dotted Note Dot */}
                                {engNote.isDotted && (
                                  <span className={`text-sm font-black -ml-0.5 ${
                                    sheetTheme === 'dark' ? 'text-zinc-100' : 'text-zinc-950'
                                  }`}>•</span>
                                )}

                                {/* Sustain Dashes '-' for half and whole notes */}
                                {engNote.dashCount > 0 && (
                                  <span className={`ml-1 tracking-widest font-black ${
                                    sheetTheme === 'dark' ? 'text-zinc-100' : 'text-zinc-950'
                                  }`}>
                                    {Array.from({ length: engNote.dashCount })
                                      .map(() => '-')
                                      .join(' ')}
                                  </span>
                                )}
                              </div>

                              {/* Underline Beams (Level 1: 8th note, Level 2: 16th note) */}
                              <div className="w-full flex flex-col items-center gap-[2px] mt-0.5">
                                {engNote.beam1.hasBeam && (
                                  <div
                                    className={`h-[2px] ${sheetTheme === 'dark' ? 'bg-zinc-100' : 'bg-zinc-950'} ${
                                      engNote.beam1.connectsToNext && engNote.beam1.connectsToPrev
                                        ? 'w-[140%]'
                                        : engNote.beam1.connectsToNext
                                        ? 'w-[120%] ml-[20%]'
                                        : engNote.beam1.connectsToPrev
                                        ? 'w-[120%] mr-[20%]'
                                        : 'w-full'
                                    }`}
                                  />
                                )}
                                {engNote.beam2.hasBeam && (
                                  <div
                                    className={`h-[2px] ${sheetTheme === 'dark' ? 'bg-zinc-100' : 'bg-zinc-950'} ${
                                      engNote.beam2.connectsToNext && engNote.beam2.connectsToPrev
                                        ? 'w-[140%]'
                                        : engNote.beam2.connectsToNext
                                        ? 'w-[120%] ml-[20%]'
                                        : engNote.beam2.connectsToPrev
                                        ? 'w-[120%] mr-[20%]'
                                        : 'w-full'
                                    }`}
                                  />
                                )}
                              </div>

                              {/* Low Octave Dots Below Underlines */}
                              <div className="flex flex-col items-center h-2.5 justify-start">
                                {engNote.octaveDotsBelow > 0 && (
                                  <div className={`flex gap-0.5 font-black leading-none text-[9px] ${
                                    sheetTheme === 'dark' ? 'text-zinc-100' : 'text-zinc-950'
                                  }`}>
                                    {Array.from({ length: engNote.octaveDotsBelow }).map((_, i) => (
                                      <span key={`dot-below-${i}`}>•</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Prelude Close Parenthesis ')' */}
                      {engravedM.isPrelude && isLastInSystem && (
                        <span className={`font-serif text-2xl font-bold ml-1 select-none ${
                          sheetTheme === 'dark' ? 'text-zinc-400' : 'text-zinc-700'
                        }`}>
                          )
                        </span>
                      )}
                    </div>

                    {/* Multi-Verse Stacked Lyrics Aligned Under Notes */}
                    <div className={`w-full flex flex-col gap-1 mt-2 pt-1 border-t ${
                      sheetTheme === 'dark' ? 'border-zinc-800' : 'border-zinc-100'
                    }`}>
                      {/* Verse 1 Line */}
                      <div className={`flex items-center justify-around w-full text-xs sm:text-sm font-sans font-medium ${
                        sheetTheme === 'dark' ? 'text-zinc-200' : 'text-zinc-900'
                      }`}>
                        {isFirstInSystem && (
                          <span className="text-[10px] font-mono text-zinc-400 -ml-1 mr-1 select-none font-bold">
                            1.
                          </span>
                        )}
                        {engravedM.notes.map((engNote, nIdx) => {
                          const isSelectedLyric1 =
                            isSelectedMeasure &&
                            nIdx === currentNIdx &&
                            activeField === 'lyric' &&
                            activeVerseRow === 1;

                          const syllable =
                            engNote.note.lyric?.hanlo ||
                            engNote.note.lyric?.hanji ||
                            engNote.note.lyric?.custom ||
                            engNote.note.lyric?.poj ||
                            '';

                          return (
                            <div
                              key={`lyric-v1-${engNote.note.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                handleNoteClick(engravedM.measureIndex, nIdx, 'lyric', 1);
                              }}
                              className={`flex-1 text-center min-w-[20px] px-0.5 py-0.5 rounded cursor-text ${
                                isSelectedLyric1
                                  ? sheetTheme === 'dark'
                                    ? 'bg-amber-950 ring-2 ring-amber-400 font-bold text-amber-200'
                                    : 'bg-amber-200 ring-2 ring-amber-500 font-bold text-zinc-950'
                                  : sheetTheme === 'dark'
                                  ? 'hover:bg-zinc-800'
                                  : 'hover:bg-zinc-100'
                              }`}
                            >
                              {isSelectedLyric1 ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={syllable}
                                  onChange={e => handleLyricInputChange(e.target.value, 1)}
                                  onKeyDown={e => {
                                    if (e.key === ' ' || e.key === 'Tab') {
                                      e.preventDefault();
                                      stepToNextNote();
                                    }
                                  }}
                                  className="w-full text-center bg-transparent border-none outline-none font-bold"
                                />
                              ) : (
                                <span>{syllable || ' '}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Verse 2 Line (if present or in multi-verse mode) */}
                      <div className={`flex items-center justify-around w-full text-xs sm:text-sm font-sans font-medium ${
                        sheetTheme === 'dark' ? 'text-zinc-400' : 'text-zinc-700'
                      }`}>
                        {isFirstInSystem && (
                          <span className="text-[10px] font-mono text-zinc-400 -ml-1 mr-1 select-none font-bold">
                            2.
                          </span>
                        )}
                        {engravedM.notes.map((engNote, nIdx) => {
                          const isSelectedLyric2 =
                            isSelectedMeasure &&
                            nIdx === currentNIdx &&
                            activeField === 'lyric' &&
                            activeVerseRow === 2;

                          const v2Syllable =
                            engNote.note.lyricsByVerse?.[2]?.hanlo ||
                            engNote.note.lyricsByVerse?.[2]?.custom ||
                            '';

                          return (
                            <div
                              key={`lyric-v2-${engNote.note.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                handleNoteClick(engravedM.measureIndex, nIdx, 'lyric', 2);
                              }}
                              className={`flex-1 text-center min-w-[20px] px-0.5 py-0.5 rounded cursor-text ${
                                isSelectedLyric2
                                  ? sheetTheme === 'dark'
                                    ? 'bg-amber-950 ring-2 ring-amber-400 font-bold text-amber-200'
                                    : 'bg-amber-200 ring-2 ring-amber-500 font-bold text-zinc-950'
                                  : sheetTheme === 'dark'
                                  ? 'hover:bg-zinc-800'
                                  : 'hover:bg-zinc-100'
                              }`}
                            >
                              {isSelectedLyric2 ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={v2Syllable}
                                  onChange={e => handleLyricInputChange(e.target.value, 2)}
                                  onKeyDown={e => {
                                    if (e.key === ' ' || e.key === 'Tab') {
                                      e.preventDefault();
                                      stepToNextNote();
                                    }
                                  }}
                                  className="w-full text-center bg-transparent border-none outline-none font-bold"
                                />
                              ) : (
                                <span>{v2Syllable || ' '}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Barline at right edge */}
                    <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none">
                      {engravedM.barlineType === 'double' ? (
                        <div className="flex gap-[3px] h-full py-2 pr-0.5">
                          <div className={`w-[1.5px] h-full ${sheetTheme === 'dark' ? 'bg-zinc-400' : 'bg-zinc-800'}`} />
                          <div className={`w-[1.5px] h-full ${sheetTheme === 'dark' ? 'bg-zinc-400' : 'bg-zinc-800'}`} />
                        </div>
                      ) : engravedM.barlineType === 'end' ? (
                        <div className="flex gap-[3px] h-full py-2 pr-0.5">
                          <div className={`w-[1.5px] h-full ${sheetTheme === 'dark' ? 'bg-zinc-400' : 'bg-zinc-800'}`} />
                          <div className={`w-[3.5px] h-full ${sheetTheme === 'dark' ? 'bg-zinc-100' : 'bg-zinc-950'}`} />
                        </div>
                      ) : engravedM.barlineType === 'repeat_end' ? (
                        <div className="flex items-center gap-[2px] h-full py-2 pr-0.5">
                          <div className={`flex flex-col justify-center gap-1.5 h-full text-[9px] font-black leading-none mr-0.5 select-none ${
                            sheetTheme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
                          }`}>
                            <span>•</span>
                            <span>•</span>
                          </div>
                          <div className={`w-[1.5px] h-full ${sheetTheme === 'dark' ? 'bg-zinc-400' : 'bg-zinc-800'}`} />
                          <div className={`w-[3.5px] h-full ${sheetTheme === 'dark' ? 'bg-zinc-100' : 'bg-zinc-950'}`} />
                        </div>
                      ) : engravedM.barlineType === 'repeat_start' ? (
                        <div className="flex items-center gap-[2px] h-full py-2 pr-0.5">
                          <div className={`w-[3.5px] h-full ${sheetTheme === 'dark' ? 'bg-zinc-100' : 'bg-zinc-950'}`} />
                          <div className={`w-[1.5px] h-full ${sheetTheme === 'dark' ? 'bg-zinc-400' : 'bg-zinc-800'}`} />
                          <div className={`flex flex-col justify-center gap-1.5 h-full text-[9px] font-black leading-none ml-0.5 select-none ${
                            sheetTheme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
                          }`}>
                            <span>•</span>
                            <span>•</span>
                          </div>
                        </div>
                      ) : (
                        <div className={`w-[1px] h-full py-2 ${sheetTheme === 'dark' ? 'bg-zinc-400' : 'bg-zinc-800'}`} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </main>

        {/* Paper Footnote / Attribution Notice (if available) */}
        {song.footnote && (
          <div id="sheet-footnote-block" className={`mt-10 pt-4 border-t text-[11px] font-serif leading-relaxed space-y-1 ${
            sheetTheme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'
          }`}>
            <p>{song.footnote}</p>
          </div>
        )}

        {/* Paper Footer with page numbers and standard sheet music footer */}
        <footer className={`mt-8 pt-4 border-t flex items-center justify-between text-xs font-serif ${
          sheetTheme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200/80 text-zinc-400'
        }`}>
          <span>{song.title}</span>
          <span className={`font-mono font-bold ${sheetTheme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>— 1 / 1 —</span>
          <span>Numbered Musical Notation</span>
        </footer>
      </div>

      {/* Docked Virtual Piano Bed */}
      {showPianoBed && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-3 relative">
            <button
              type="button"
              onClick={() => setShowPianoBed(false)}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors z-10 cursor-pointer"
              title="Close Piano Bed"
            >
              <X className="w-4 h-4" />
            </button>
            <PianoKeyboard
              keySignature={song.key}
              currentNote={currentNote || null}
              onSelectPitch={handleSelectPitchFromPiano}
              audioEngine={audioEngine || defaultAudioEngine}
              onOpenKeyboardToScore={onOpenKeyboardModal}
            />
          </div>
        </div>
      )}

      {/* Floating HUD / Score Ribbon */}
      <FloatingScoreHud
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay || (() => {})}
        selectedMeasureNumber={currentMeasure?.measureNumber || currentMIdx + 1}
        selectedNoteNumber={currentNIdx + 1}
        onSetPitch={handleSetPitch}
        onSetDash={handleSetDash}
        onSetOctave={handleSetOctave}
        currentOctave={currentNote?.octave || 0}
        onSetDuration={handleSetDuration}
        currentDuration={currentNote?.duration || 1}
        onToggleDotted={handleToggleDotted}
        isDotted={currentNote?.isDotted}
        onToggleTriplet={handleToggleTriplet}
        isTriplet={currentNote?.isTriplet}
        onToggleSlur={handleToggleSlur}
        isSlur={currentNote?.slurToNext}
        onToggleTie={handleToggleTie}
        isTie={currentNote?.tieToNext}
        onSetAccidental={handleSetAccidental}
        currentAccidental={currentNote?.accidental || ''}
        currentArticulation={currentNote?.articulation}
        onSetArticulation={handleSetArticulation}
        onInsertPunctuation={handleInsertPunctuation}
        onInsertAnnotation={handleInsertAnnotation}
        onAddGraceNote={handleAddGraceNote}
        onClearGraceNotes={handleClearGraceNotes}
        hasGraceNotes={Boolean(
          (currentNote?.preGraceNotes && currentNote.preGraceNotes.length > 0) ||
          (currentNote?.postGraceNotes && currentNote.postGraceNotes.length > 0)
        )}
        currentMeasureChord={currentMeasure?.chord}
        onUpdateMeasureChord={handleUpdateMeasureChord}
        chordSuggestions={chordSuggestions}
        onAutoHarmonize={handleAutoHarmonize}
        onTogglePianoBed={() => setShowPianoBed(p => !p)}
        showPianoBed={showPianoBed}
        onOpenKeyboardModal={onOpenKeyboardModal}
        onOpenOrganizer={onOpenOrganizer}
        onAddMeasure={handleAddMeasureClick}
        onDeleteSelectedMeasure={handleDeleteMeasureClick}
        onToggleLineBreak={handleToggleLineBreakClick}
        isLineBreak={currentMeasure?.isLineBreak}
        onTogglePrelude={handleTogglePreludeClick}
        isPrelude={currentMeasure?.isPrelude}
        onToggleVoltaEnding={handleToggleVoltaEndingClick}
        voltaEnding={currentMeasure?.voltaEnding}
        onAutoFillRest={onAutoFillRest ? () => onAutoFillRest(currentMIdx) : undefined}
        canFillRest={true}
        zoomScale={zoomScale}
        onZoomIn={() => setZoomScale(s => Math.min(1.6, s + 0.1))}
        onZoomOut={() => setZoomScale(s => Math.max(0.7, s - 0.1))}
        onResetZoom={() => setZoomScale(1.0)}
        onPrint={handlePrint}
        sheetTheme={sheetTheme}
        onToggleSheetTheme={handleToggleSheetTheme}
        activeField={activeField}
        onToggleActiveField={() => setActiveField(f => (f === 'pitch' ? 'lyric' : 'pitch'))}
        selectedVerseRow={activeVerseRow}
        onChangeVerseRow={row => setActiveVerseRow(row)}
      />

      {/* Inline Header Field Edit Modal */}
      {editingHeaderField && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Edit {editingHeaderField}
            </h3>
            <input
              type="text"
              autoFocus
              value={headerDraftText}
              onChange={e => setHeaderDraftText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitHeaderEdit();
                if (e.key === 'Escape') cancelHeaderEdit();
              }}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-amber-500 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelHeaderEdit}
                className="px-4 py-2 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitHeaderEdit}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
