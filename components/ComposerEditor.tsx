'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BarlineType,
  NumberedNotationNote,
  LyricDisplayMode,
  Measure,
  NoteDuration,
  PitchNumber,
  Song,
  ArticulationType,
} from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  normalizeSongDurations,
  getMeasureRhythmReport,
  getRestDurationsForDeficit,
  getNoteBeatDuration,
  getMeasureChords,
  halveNoteDuration,
  doubleNoteDuration,
  setUniformNoteDuration,
  determineTargetQuarterEighthDuration,
  isPunctuationOrSpacer,
  isNonNotationItem,
} from '@/lib/taigiUtils';
import { autoArrangeSongChords } from '@/lib/chordArranger';
import { scrollToCardElement } from '@/lib/utils';
import {
  getStoredAutoStepAdvance,
  setStoredAutoStepAdvance,
} from '@/lib/storage';
import { SongMetadataHeader } from './composer/SongMetadataHeader';
import { SectionRail } from './composer/SectionRail';
import { RealSheetCanvas } from './composer/RealSheetCanvas';
import { KeyboardToScoreModal, InsertionMode } from './composer/KeyboardToScoreModal';
import { InSongSearchBar } from './composer/InSongSearchBar';
import { InSongMatchLocation } from '@/lib/lyricSearch';
import {
  Plus,
  Undo2,
  Redo2,
  AlignLeft,
  Sparkles,
  Wand2,
  Keyboard,
  Trash2,
  Search,
} from 'lucide-react';

interface ComposerEditorProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;
  audioEngine: AudioEngine;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onOpenAligner: () => void;
  onOpenScanner?: () => void;
  onStartFreshSong?: () => void;
  onOpenKeyboardModal?: () => void;
  isKeyboardModalOpen?: boolean;
  onCloseKeyboardModal?: () => void;
  targetMeasureIndex?: number | null;
  onTargetMeasureHandled?: () => void;
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  pastCount?: number;
  futureCount?: number;
  /** Skip per-note editor highlights at tracker FPS. */
  suspendNoteHighlights?: boolean;
}

let uniqueIdCounter = 0;
const generateId = (prefix: string) => {
  uniqueIdCounter += 1;
  return `${prefix}-${Date.now()}-${uniqueIdCounter}`;
};

const renumberMeasures = (measures: Measure[]): Measure[] =>
  measures.map((m, idx) => (m.measureNumber === idx + 1 ? m : { ...m, measureNumber: idx + 1 }));

export const ComposerEditor: React.FC<ComposerEditorProps> = ({
  song,
  onUpdateSong,
  audioEngine,
  displayMode,
  setDisplayMode,
  onOpenAligner,
  onOpenScanner,
  onStartFreshSong,
  onOpenKeyboardModal: propOnOpenKeyboardModal,
  isKeyboardModalOpen: propIsKeyboardModalOpen,
  onCloseKeyboardModal: propOnCloseKeyboardModal,
  targetMeasureIndex,
  onTargetMeasureHandled,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pastCount = 0,
  futureCount = 0,
  suspendNoteHighlights = false,
}) => {
  const [internalKeyboardModalOpen, setInternalKeyboardModalOpen] = useState<boolean>(false);
  const isKeyboardModalOpen = propIsKeyboardModalOpen ?? internalKeyboardModalOpen;
  const handleOpenKeyboardModal = useCallback(() => {
    if (propOnOpenKeyboardModal) propOnOpenKeyboardModal();
    else setInternalKeyboardModalOpen(true);
  }, [propOnOpenKeyboardModal]);
  const handleCloseKeyboardModal = useCallback(() => {
    if (propOnCloseKeyboardModal) propOnCloseKeyboardModal();
    else setInternalKeyboardModalOpen(false);
  }, [propOnCloseKeyboardModal]);

  const [selectedCoord, setSelectedCoord] = useState<[number, number] | null>([0, 0]);
  const [autoStepAdvance, setAutoStepAdvanceState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return getStoredAutoStepAdvance(false);
    return false;
  });

  const setAutoStepAdvance = useCallback((adv: boolean | ((prev: boolean) => boolean)) => {
    setAutoStepAdvanceState(prev => {
      const next = typeof adv === 'function' ? adv(prev) : adv;
      setStoredAutoStepAdvance(next);
      return next;
    });
  }, []);

  const [notification, setNotification] = useState<string | null>(null);
  const [playingMeasureIdx, setPlayingMeasureIdx] = useState<number | null>(null);
  const [playingSystemIdx, setPlayingSystemIdx] = useState<number | null>(null);
  const [isPlayingSheet, setIsPlayingSheet] = useState<boolean>(false);
  const [activePlaybackNoteId, setActivePlaybackNoteId] = useState<string | null>(null);
  const [isInSongSearchOpen, setIsInSongSearchOpen] = useState<boolean>(false);
  const [showRhythmTools, setShowRhythmTools] = useState<boolean>(false);
  const [inSongActiveMatch, setInSongActiveMatch] = useState<InSongMatchLocation | null>(null);

  // Incomplete / Over-beat measures count for whole song
  const incompleteMeasuresCount = useMemo(() => {
    return song.measures.filter(m => !getMeasureRhythmReport(m, song.timeSignature || '4/4').isFull).length;
  }, [song.measures, song.timeSignature]);

  const activeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const safeTimeout = useCallback((callback: () => void, ms: number) => {
    const id = setTimeout(() => {
      activeTimersRef.current.delete(id);
      callback();
    }, ms);
    activeTimersRef.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    const timers = activeTimersRef.current;
    return () => {
      timers.forEach(id => clearTimeout(id));
      timers.clear();
    };
  }, []);

  const showNotice = useCallback((msg: string) => {
    setNotification(msg);
    safeTimeout(() => {
      setNotification(prev => (prev === msg ? null : prev));
    }, 3500);
  }, [safeTimeout]);

  const handleSearchJumpToMeasure = useCallback(
    (mIdx: number) => {
      const validMeasureIdx = Math.min(song.measures.length - 1, Math.max(0, mIdx));
      setSelectedCoord([validMeasureIdx, 0]);

      const note = song.measures[validMeasureIdx]?.notes[0];
      if (note) {
        audioEngine.previewNote(song.key, note);
        const el = document.getElementById(`sheet-note-${note.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    },
    [song.measures, song.key, audioEngine]
  );

  const handleSearchJumpToVerse = useCallback(
    (_vIdx: number, startMeasureIdx: number) => {
      const validMeasureIdx = Math.min(song.measures.length - 1, Math.max(0, startMeasureIdx));
      setSelectedCoord([validMeasureIdx, 0]);

      const note = song.measures[validMeasureIdx]?.notes[0];
      if (note) {
        audioEngine.previewNote(song.key, note);
        const el = document.getElementById(`sheet-note-${note.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    },
    [song.measures, song.key, audioEngine]
  );

  const [isSongPlaying, setIsSongPlaying] = useState<boolean>(() => (audioEngine ? audioEngine.getIsPlaying() : false));

  // Handle stop audio playback directly from score editor deck
  const handleStopAudio = useCallback(() => {
    if (audioEngine) {
      audioEngine.stop();
      setIsPlayingSheet(false);
    }
  }, [audioEngine]);

  // Subscribe to audio engine playback state
  useEffect(() => {
    const unsub = audioEngine.subscribeState(state => {
      setIsSongPlaying(state.isPlaying);
      if (suspendNoteHighlights && state.isPlaying) {
        return;
      }
      setActivePlaybackNoteId(state.isPlaying ? state.currentNoteId : null);
      if (!state.isPlaying) {
        setPlayingMeasureIdx(null);
        setPlayingSystemIdx(null);
        setIsPlayingSheet(false);
      }
    });
    return () => {
      unsub();
    };
  }, [audioEngine, suspendNoteHighlights]);

  // Handle jump-to-section / target measure index request
  useEffect(() => {
    if (targetMeasureIndex !== null && targetMeasureIndex !== undefined && targetMeasureIndex >= 0) {
      const validMeasureIdx = Math.min(song.measures.length - 1, Math.max(0, targetMeasureIndex));

      // Smooth scroll and select corresponding note
      const timer = safeTimeout(() => {
        // Find the first pitched/content note in this measure, defaulting to note 0
        const m = song.measures[validMeasureIdx];
        let targetNoteIdx = 0;
        if (m && m.notes.length > 0) {
          const firstPitchedIdx = m.notes.findIndex(
            n => !isNonNotationItem(n) && (typeof n.pitch === 'number' && n.pitch > 0 || Boolean(n.lyric.hanji && !isPunctuationOrSpacer(n.lyric.hanji)))
          );
          targetNoteIdx = firstPitchedIdx !== -1 ? firstPitchedIdx : 0;
        }

        setSelectedCoord([validMeasureIdx, targetNoteIdx]);

        // Preview the target note of this section/measure
        const note = song.measures[validMeasureIdx]?.notes[targetNoteIdx] || song.measures[validMeasureIdx]?.notes[0];
        if (note) {
          audioEngine.previewNote(song.key, note);
          const el = document.getElementById(`sheet-note-${note.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }

        const secName = song.measures[validMeasureIdx]?.section || `Measure ${validMeasureIdx + 1}`;
        showNotice(`Jumped to section "${secName}"`);

        if (onTargetMeasureHandled) {
          onTargetMeasureHandled();
        }
      }, 50);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [targetMeasureIndex, song, audioEngine, showNotice, onTargetMeasureHandled, safeTimeout]);

  const selectedMeasureIndex = selectedCoord ? selectedCoord[0] : null;
  const selectedNoteIndex = selectedCoord ? selectedCoord[1] : null;

  const currentMeasure: Measure | null =
    selectedMeasureIndex !== null && song.measures[selectedMeasureIndex]
      ? song.measures[selectedMeasureIndex]
      : null;

  const currentNote: NumberedNotationNote | null =
    currentMeasure && selectedNoteIndex !== null && currentMeasure.notes[selectedNoteIndex]
      ? currentMeasure.notes[selectedNoteIndex]
      : null;

  // Sound note on select
  const handleSelectNote = useCallback(
    (mIdx: number, nIdx: number, preview = true) => {
      setSelectedCoord([mIdx, nIdx]);
      const note = song.measures[mIdx]?.notes[nIdx];
      if (note && preview) {
        audioEngine.previewNote(song.key, note);
      }
    },
    [song, audioEngine]
  );

  // Dedicated Play/Stop Measure verification
  const handleTogglePlayMeasure = (mIdx: number) => {
    if (playingMeasureIdx === mIdx && audioEngine.getIsPlaying()) {
      audioEngine.stop();
      setPlayingMeasureIdx(null);
    } else {
      setPlayingSystemIdx(null);
      setIsPlayingSheet(false);
      setPlayingMeasureIdx(mIdx);
      audioEngine.playMeasure(song, mIdx, () => {
        setPlayingMeasureIdx(null);
      });
    }
  };

  // Dedicated Play/Stop System verification (Sheet Mode)
  const handleTogglePlaySystem = (systemIdx: number, measureIndices: number[]) => {
    if (playingSystemIdx === systemIdx && audioEngine.getIsPlaying()) {
      audioEngine.stop();
      setPlayingSystemIdx(null);
    } else {
      setPlayingMeasureIdx(null);
      setIsPlayingSheet(false);
      setPlayingSystemIdx(systemIdx);
      audioEngine.playSystem(song, measureIndices, () => {
        setPlayingSystemIdx(null);
      });
    }
  };

  // Dedicated Play/Stop Sheet playback from current note (Sheet Mode)
  const handleTogglePlaySheetFromNote = useCallback(
    (mIdx?: number, nIdx?: number) => {
      if (audioEngine.getIsPlaying()) {
        audioEngine.stop();
        setPlayingMeasureIdx(null);
        setPlayingSystemIdx(null);
        setIsPlayingSheet(false);
        return;
      }

      const targetMIdx = mIdx ?? selectedMeasureIndex ?? 0;
      const targetNIdx = nIdx ?? selectedNoteIndex ?? 0;
      const safeMIdx = Math.max(0, Math.min(song.measures.length - 1, targetMIdx));
      const measure = song.measures[safeMIdx];
      const safeNIdx = measure && measure.notes.length > 0
        ? Math.max(0, Math.min(measure.notes.length - 1, targetNIdx))
        : 0;

      // Select coordinate in editor state without triggering extra preview sound
      handleSelectNote(safeMIdx, safeNIdx, false);

      const startSec = audioEngine.getNoteStartTime(song, safeMIdx, safeNIdx);
      setPlayingMeasureIdx(null);
      setPlayingSystemIdx(null);
      setIsPlayingSheet(true);

      audioEngine.play(song, startSec);
    },
    [audioEngine, selectedMeasureIndex, selectedNoteIndex, song, handleSelectNote]
  );

  // Mutate specific note helper
  const updateNoteAt = useCallback(
    (
      mIdx: number,
      nIdx: number,
      updater: (note: NumberedNotationNote) => NumberedNotationNote
    ) => {
      const newMeasures = song.measures.map((m, currentMIdx) => {
        if (currentMIdx !== mIdx) return m;
        const newNotes = m.notes.map((n, currentNIdx) => {
          if (currentNIdx !== nIdx) return n;
          return updater({ ...n });
        });
        return { ...m, notes: newNotes };
      });

      onUpdateSong({ ...song, measures: newMeasures });
    },
    [song, onUpdateSong]
  );

  // Mutate currently selected note
  const updateSelectedNote = useCallback(
    (updater: (note: NumberedNotationNote) => NumberedNotationNote) => {
      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
      updateNoteAt(selectedMeasureIndex, selectedNoteIndex, updater);
    },
    [selectedMeasureIndex, selectedNoteIndex, updateNoteAt]
  );

  // Direct note updater for RealSheetCanvas
  const handleUpdateNoteDirect = useCallback(
    (mIdx: number, nIdx: number, partialNote: Partial<NumberedNotationNote>) => {
      updateNoteAt(mIdx, nIdx, n => ({ ...n, ...partialNote }));
    },
    [updateNoteAt]
  );

  // Measure Multi-Selection State for batch operations
  const [selectedMeasureIndices, setSelectedMeasureIndices] = useState<Set<number>>(new Set());

  const handleToggleSelectMeasure = useCallback((mIdx: number) => {
    setSelectedMeasureIndices(prev => {
      const next = new Set(prev);
      if (next.has(mIdx)) {
        next.delete(mIdx);
      } else {
        next.add(mIdx);
      }
      return next;
    });
    handleSelectNote(mIdx, 0);
  }, [handleSelectNote]);

  const handleSelectAllMeasures = useCallback(() => {
    setSelectedMeasureIndices(new Set(song.measures.map((_, i) => i)));
  }, [song.measures]);

  const handleClearMeasureSelection = useCallback(() => {
    setSelectedMeasureIndices(new Set());
  }, []);

  // Determine which measures to apply duration changes to:
  // If user passed a specific measure index, use that.
  // Otherwise if multi-selection has measures, use those.
  // Otherwise fallback to currently active/selected measure (or measure 0).
  const getTargetMeasureIndices = useCallback(
    (specificMIdx?: number): number[] => {
      if (typeof specificMIdx === 'number' && specificMIdx >= 0 && specificMIdx < song.measures.length) {
        return [specificMIdx];
      }
      if (selectedMeasureIndices.size > 0) {
        return Array.from(selectedMeasureIndices)
          .filter(i => i >= 0 && i < song.measures.length)
          .sort((a, b) => a - b);
      }
      const activeIdx =
        selectedMeasureIndex !== null && selectedMeasureIndex >= 0 && selectedMeasureIndex < song.measures.length
          ? selectedMeasureIndex
          : 0;
      return [activeIdx];
    },
    [selectedMeasureIndices, selectedMeasureIndex, song.measures.length]
  );

  // 1-Tap Toggle: Quarter (1.0) ↔ 8th (0.5)
  const handleQuickToggleMeasureDuration = useCallback(
    (specificMIdx?: number) => {
      const targetIndices = getTargetMeasureIndices(specificMIdx);
      if (targetIndices.length === 0) return;

      const targetMeasures = targetIndices.map(idx => song.measures[idx]).filter(Boolean);
      const targetDur = determineTargetQuarterEighthDuration(targetMeasures);

      const targetSet = new Set(targetIndices);
      const updatedMeasures = song.measures.map((m, idx) => {
        if (!targetSet.has(idx)) return m;
        return {
          ...m,
          notes: m.notes.map(n => setUniformNoteDuration(n, targetDur)),
        };
      });

      onUpdateSong({ ...song, measures: updatedMeasures });

      const label =
        targetIndices.length === 1
          ? `Measure #${targetIndices[0] + 1}`
          : `${targetIndices.length} measures (#${targetIndices.map(i => i + 1).join(', ')})`;
      showNotice(
        `Toggled ${label}: Converted to ${targetDur === 0.5 ? 'Eighth notes (0.5 beats)' : 'Quarter notes (1.0 beat)'}`
      );
    },
    [getTargetMeasureIndices, song, onUpdateSong, showNotice]
  );

  // Proportional Scale: Halve (÷2) or Double (×2)
  const handleScaleMeasureDuration = useCallback(
    (factor: 0.5 | 2.0, specificMIdx?: number) => {
      const targetIndices = getTargetMeasureIndices(specificMIdx);
      if (targetIndices.length === 0) return;

      const targetSet = new Set(targetIndices);
      const updatedMeasures = song.measures.map((m, idx) => {
        if (!targetSet.has(idx)) return m;
        return {
          ...m,
          notes: m.notes.map(n => (factor === 0.5 ? halveNoteDuration(n) : doubleNoteDuration(n))),
        };
      });

      onUpdateSong({ ...song, measures: updatedMeasures });

      const label =
        targetIndices.length === 1
          ? `Measure #${targetIndices[0] + 1}`
          : `${targetIndices.length} measures (#${targetIndices.map(i => i + 1).join(', ')})`;
      showNotice(`${factor === 0.5 ? 'Halved (÷2)' : 'Doubled (×2)'} durations in ${label}`);
    },
    [getTargetMeasureIndices, song, onUpdateSong, showNotice]
  );

  // Set Uniform Duration (e.g. 0.25, 0.5, 1.0, 2.0)
  const handleSetUniformMeasureDuration = useCallback(
    (duration: NoteDuration, specificMIdx?: number) => {
      const targetIndices = getTargetMeasureIndices(specificMIdx);
      if (targetIndices.length === 0) return;

      const targetSet = new Set(targetIndices);
      const updatedMeasures = song.measures.map((m, idx) => {
        if (!targetSet.has(idx)) return m;
        return {
          ...m,
          notes: m.notes.map(n => setUniformNoteDuration(n, duration)),
        };
      });

      onUpdateSong({ ...song, measures: updatedMeasures });

      const label =
        targetIndices.length === 1
          ? `Measure #${targetIndices[0] + 1}`
          : `${targetIndices.length} measures (#${targetIndices.map(i => i + 1).join(', ')})`;
      showNotice(`Set note durations to ${duration} beat(s) in ${label}`);
    },
    [getTargetMeasureIndices, song, onUpdateSong, showNotice]
  );

  // Note Navigation: Previous and Next note
  const handleNavigateNextNote = useCallback(() => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) {
      if (song.measures.length > 0 && song.measures[0].notes.length > 0) {
        handleSelectNote(0, 0);
      }
      return;
    }
    const curM = song.measures[selectedMeasureIndex];
    if (curM && selectedNoteIndex < curM.notes.length - 1) {
      handleSelectNote(selectedMeasureIndex, selectedNoteIndex + 1);
    } else if (selectedMeasureIndex < song.measures.length - 1) {
      handleSelectNote(selectedMeasureIndex + 1, 0);
    }
  }, [selectedMeasureIndex, selectedNoteIndex, song.measures, handleSelectNote]);

  const handleNavigatePrevNote = useCallback(() => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) {
      if (song.measures.length > 0 && song.measures[0].notes.length > 0) {
        handleSelectNote(0, 0);
      }
      return;
    }
    if (selectedNoteIndex > 0) {
      handleSelectNote(selectedMeasureIndex, selectedNoteIndex - 1);
    } else if (selectedMeasureIndex > 0) {
      const prevMIdx = selectedMeasureIndex - 1;
      const prevM = song.measures[prevMIdx];
      if (prevM && prevM.notes.length > 0) {
        const prevNoteIdx = prevM.notes.length - 1;
        handleSelectNote(prevMIdx, prevNoteIdx);
      }
    }
  }, [selectedMeasureIndex, selectedNoteIndex, song.measures, handleSelectNote]);

  // Change pitch (with optional auto-advance)
  const handleSetPitch = useCallback(
    (pitch: PitchNumber) => {
      updateSelectedNote(n => {
        const isEmpty = pitch === 'empty';
        const updated = {
          ...n,
          pitch,
          duration: isEmpty ? (0 as NoteDuration) : (n.duration <= 0 ? (1 as NoteDuration) : n.duration),
        };
        if (pitch !== 0 && pitch !== 'empty') {
          audioEngine.previewNote(song.key, updated);
        }
        return updated;
      });

      if (autoStepAdvance) {
        safeTimeout(() => {
          handleNavigateNextNote();
        }, 120);
      }
    },
    [updateSelectedNote, audioEngine, song.key, autoStepAdvance, handleNavigateNextNote, safeTimeout]
  );

  // Change octave
  const handleSetOctave = useCallback((delta: number) => {
    updateSelectedNote(n => {
      const newOctave = Math.max(-2, Math.min(2, n.octave + delta));
      const updated = { ...n, octave: newOctave };
      audioEngine.previewNote(song.key, updated);
      return updated;
    });
  }, [updateSelectedNote, audioEngine, song.key]);

  // Change accidental
  const handleSetAccidental = useCallback((acc: '' | '#' | 'b') => {
    updateSelectedNote(n => {
      const updated = { ...n, accidental: n.accidental === acc ? '' : acc };
      audioEngine.previewNote(song.key, updated);
      return updated;
    });
  }, [updateSelectedNote, audioEngine, song.key]);

  // Change duration
  const handleSetDuration = (duration: NoteDuration) => {
    updateSelectedNote(n => ({
      ...n,
      duration,
      pitch: duration === 0 ? 'empty' : (n.pitch === 'empty' ? 1 : n.pitch),
      isDotted:
        duration === 1.5 ||
        duration === 0.75 ||
        duration === 3 ||
        duration === 0.375 ||
        duration === 1.75,
    }));
  };

  // Toggle dotted
  const handleToggleDotted = useCallback(() => {
    updateSelectedNote(n => {
      let newDur = n.duration;
      let newDotted = !n.isDotted;
      if (newDotted) {
        if (n.duration === 1) newDur = 1.5;
        else if (n.duration === 0.5) newDur = 0.75;
        else if (n.duration === 2) newDur = 3;
        else if (n.duration === 0.25) newDur = 0.375;
        else newDur = Math.round(n.duration * 1.5 * 1000) / 1000;
      } else {
        if (n.duration === 1.5) newDur = 1;
        else if (n.duration === 0.75) newDur = 0.5;
        else if (n.duration === 3) newDur = 2;
        else if (n.duration === 0.375) newDur = 0.25;
        else newDur = Math.round((n.duration / 1.5) * 1000) / 1000;
      }
      return { ...n, duration: newDur, isDotted: newDotted };
    });
  }, [updateSelectedNote]);

  // Toggle tie
  const handleToggleTie = useCallback(() => {
    updateSelectedNote(n => {
      const nextTie = !(n.tieToNext ?? n.isTied);
      showNotice(nextTie ? 'Tie enabled ⌒' : 'Tie disabled');
      return { ...n, tieToNext: nextTie, isTied: nextTie };
    });
  }, [updateSelectedNote, showNotice]);

  // Toggle slur
  const handleToggleSlur = useCallback(() => {
    updateSelectedNote(n => {
      const nextSlur = !n.slurToNext;
      showNotice(nextSlur ? 'Slur enabled ⌢' : 'Slur disabled');
      return { ...n, slurToNext: nextSlur };
    });
  }, [updateSelectedNote, showNotice]);

  // Set articulation
  const handleSetArticulation = useCallback((art: ArticulationType) => {
    updateSelectedNote(n => {
      showNotice(`Articulation set: ${art}`);
      return { ...n, articulation: art };
    });
  }, [updateSelectedNote, showNotice]);

  // Toggle triplet
  const handleToggleTriplet = useCallback(() => {
    updateSelectedNote(n => {
      const nextTrip = !n.isTriplet;
      let nextDur = n.duration;
      if (nextTrip) {
        if (n.duration === 0.5) nextDur = 0.333;
        else if (n.duration === 1) nextDur = 0.667;
        else nextDur = 0.333;
      } else {
        if (n.duration === 0.333) nextDur = 0.5;
        else if (n.duration === 0.667) nextDur = 1;
      }
      showNotice(nextTrip ? 'Triplet mode ┌ 3 ┐' : 'Triplet mode disabled');
      return { ...n, isTriplet: nextTrip, duration: nextDur };
    });
  }, [updateSelectedNote, showNotice]);

  // Toggle double dotted
  const handleToggleDoubleDotted = useCallback(() => {
    updateSelectedNote(n => {
      const nextDouble = !n.isDoubleDotted;
      let nextDur = n.duration;
      if (nextDouble) {
        if (n.duration === 1) nextDur = 1.75;
        else if (n.duration === 2) nextDur = 3.5;
      } else {
        if (n.duration === 1.75) nextDur = 1;
        else if (n.duration === 3.5) nextDur = 2;
      }
      showNotice(nextDouble ? 'Double dotted ··' : 'Double dotted disabled');
      return { ...n, isDoubleDotted: nextDouble, duration: nextDur };
    });
  }, [updateSelectedNote, showNotice]);

  // Halve note duration (e.g. 1 -> 0.5 -> 0.25 -> 0.125)
  const handleHalveDuration = useCallback(() => {
    updateSelectedNote(n => {
      let newDur: NoteDuration = 0.5;
      if (n.duration >= 4) newDur = 2;
      else if (n.duration >= 2) newDur = 1;
      else if (n.duration >= 1) newDur = 0.5;
      else if (n.duration >= 0.5) newDur = 0.25;
      else newDur = 0.125;
      showNotice(`Halved duration: ${newDur} beats (/)`);
      return { ...n, duration: newDur };
    });
  }, [updateSelectedNote, showNotice]);

  // Double note duration (e.g. 0.125 -> 0.25 -> 0.5 -> 1 -> 2 -> 4)
  const handleDoubleDuration = useCallback(() => {
    updateSelectedNote(n => {
      let newDur: NoteDuration = 1;
      if (n.duration <= 0.125) newDur = 0.25;
      else if (n.duration <= 0.25) newDur = 0.5;
      else if (n.duration <= 0.5) newDur = 1;
      else if (n.duration <= 1) newDur = 2;
      else newDur = 4;
      showNotice(`Doubled duration: ${newDur} beats (*)`);
      return { ...n, duration: newDur };
    });
  }, [updateSelectedNote, showNotice]);

  // Update lyric text on a specific note
  const handleUpdateLyricAt = (
    mIdx: number,
    nIdx: number,
    type: 'roman' | 'hanlo' | 'poj' | 'hanji' | 'custom',
    val: string
  ) => {
    updateNoteAt(mIdx, nIdx, n => {
      const updatedLyric = {
        ...n.lyric,
      };
      if (type === 'roman' || type === 'poj') {
        updatedLyric.poj = val;
      } else if (type === 'hanlo' || type === 'hanji' || type === 'custom') {
        updatedLyric.hanlo = val;
        updatedLyric.hanji = val;
        updatedLyric.custom = val;
      }
      const rawHanlo = updatedLyric.hanlo ?? updatedLyric.custom ?? updatedLyric.hanji ?? '';
      const rawPoj = updatedLyric.poj ?? '';

      const hasAnyLyric = rawHanlo.length > 0 || rawPoj.length > 0;

      const isPurePunct =
        hasAnyLyric &&
        (!rawHanlo || isPunctuationOrSpacer(rawHanlo)) &&
        (!rawPoj || isPunctuationOrSpacer(rawPoj));

      return {
        ...n,
        lyric: updatedLyric,
        pitch: isPurePunct ? 'empty' : n.pitch,
        duration: isPurePunct ? (0 as NoteDuration) : n.duration,
      };
    });
  };

  // Quick insert punctuation to note (setting pitch to empty spacer and duration to 0)
  const handleInsertPunctuationToNote = useCallback(
    (punct: string) => {
      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
      updateSelectedNote(n => ({
        ...n,
        pitch: 'empty',
        duration: 0 as NoteDuration,
        isDotted: false,
        isTied: false,
        lyric: {
          ...n.lyric,
          hanji: punct,
          custom: punct,
        },
      }));
      const isNewline = punct === '\n' || punct === '\r' || punct === '↵';
      if (isNewline) {
        showNotice('Inserted newline verse break "↵" (0 beats)');
      } else if (punct === ' ') {
        showNotice('Inserted space spacer "␣" (0 beats, no verse split)');
      } else {
        showNotice(`Inserted delimiter "${punct}" (0 beats, no verse split)`);
      }
    },
    [selectedMeasureIndex, selectedNoteIndex, updateSelectedNote, showNotice]
  );

  // Quick insert annotation to note
  const handleInsertAnnotationToNote = (annot: string) => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
    updateSelectedNote(n => ({
      ...n,
      pitch: 'empty',
      duration: 0 as NoteDuration,
      isDotted: false,
      isTied: false,
      annotation: annot,
      lyric: {
        ...n.lyric,
        hanji: annot,
        custom: annot,
      },
    }));
    showNotice(`Inserted annotation "${annot}" (0 beats)`);
  };

  // Set custom annotation text on selected note
  const handleSetAnnotation = (annot: string) => {
    updateSelectedNote(n => ({
      ...n,
      annotation: annot,
    }));
  };

  // Set annotation on note at (mIdx, nIdx)
  const handleUpdateAnnotationAt = (mIdx: number, nIdx: number, val: string) => {
    updateNoteAt(mIdx, nIdx, n => ({
      ...n,
      annotation: val,
    }));
  };

  // Helper to focus appropriate input on destination note
  const focusNoteInput = (mIdx: number, nIdx: number, type: string) => {
    safeTimeout(() => {
      const preferredId = `lyric-input-${mIdx}-${nIdx}-${type}`;
      const el =
        (document.getElementById(preferredId) as HTMLInputElement) ||
        (document.getElementById(`lyric-input-${mIdx}-${nIdx}-punct`) as HTMLInputElement) ||
        (document.getElementById(`lyric-input-${mIdx}-${nIdx}-annotation`) as HTMLInputElement) ||
        (document.getElementById(`lyric-input-${mIdx}-${nIdx}-hanlo`) as HTMLInputElement) ||
        (document.getElementById(`lyric-input-${mIdx}-${nIdx}-roman`) as HTMLInputElement);
      if (el) {
        el.focus();
        el.select();
      }
    }, 30);
  };

  // Navigate to next note (focus lyric input)
  const handleGoToNextNote = (currentMIdx: number, currentNIdx: number, type: 'roman' | 'hanlo') => {
    const curM = song.measures[currentMIdx];
    if (!curM) return;

    if (currentNIdx < curM.notes.length - 1) {
      const nextNIdx = currentNIdx + 1;
      setSelectedCoord([currentMIdx, nextNIdx]);
      focusNoteInput(currentMIdx, nextNIdx, type);
    } else if (currentMIdx < song.measures.length - 1) {
      const nextMIdx = currentMIdx + 1;
      setSelectedCoord([nextMIdx, 0]);
      focusNoteInput(nextMIdx, 0, type);
    }
  };

  // Navigate to previous note
  const handleGoToPrevNote = (currentMIdx: number, currentNIdx: number, type: 'roman' | 'hanlo') => {
    if (currentNIdx > 0) {
      const prevNIdx = currentNIdx - 1;
      setSelectedCoord([currentMIdx, prevNIdx]);
      focusNoteInput(currentMIdx, prevNIdx, type);
    } else if (currentMIdx > 0) {
      const prevMIdx = currentMIdx - 1;
      const prevM = song.measures[prevMIdx];
      if (prevM && prevM.notes.length > 0) {
        const prevNIdx = prevM.notes.length - 1;
        setSelectedCoord([prevMIdx, prevNIdx]);
        focusNoteInput(prevMIdx, prevNIdx, type);
      }
    }
  };

  // Note management: Insert Note after specific note
  const handleInsertNoteAt = (mIdx: number, nIdx: number) => {
    const newNote: NumberedNotationNote = {
      id: generateId('n'),
      pitch: 1,
      octave: 0,
      duration: 1,
      lyric: {},
    };

    const newMeasures = song.measures.map((m, currentMIdx) => {
      if (currentMIdx !== mIdx) return m;
      const notes = [...m.notes];
      notes.splice(nIdx + 1, 0, newNote);
      return { ...m, notes };
    });

    onUpdateSong({ ...song, measures: newMeasures });
    setSelectedCoord([mIdx, nIdx + 1]);
    audioEngine.previewNote(song.key, newNote);
    showNotice(`Inserted new note after note #${nIdx + 1}`);
  };

  // Note management: Insert Note before specific note
  const handleInsertNoteBeforeAt = (mIdx: number, nIdx: number) => {
    const newNote: NumberedNotationNote = {
      id: generateId('n'),
      pitch: 1,
      octave: 0,
      duration: 1,
      lyric: {},
    };

    const newMeasures = song.measures.map((m, currentMIdx) => {
      if (currentMIdx !== mIdx) return m;
      const notes = [...m.notes];
      notes.splice(nIdx, 0, newNote);
      return { ...m, notes };
    });

    onUpdateSong({ ...song, measures: newMeasures });
    setSelectedCoord([mIdx, nIdx]);
    audioEngine.previewNote(song.key, newNote);
    showNotice(`Inserted new note before note #${nIdx + 1}`);
  };

  // Note management: Insert Break (Line break note ↵) directly after specific note
  const handleInsertBreakAt = (mIdx: number, nIdx: number) => {
    const newBreakNote: NumberedNotationNote = {
      id: generateId('n'),
      pitch: 'empty',
      octave: 0,
      duration: 0,
      lyric: {
        hanji: '\n',
        custom: '\n',
      },
    };

    const newMeasures = song.measures.map((m, currentMIdx) => {
      if (currentMIdx !== mIdx) return m;
      const notes = [...m.notes];
      notes.splice(nIdx + 1, 0, newBreakNote);
      return { ...m, notes };
    });

    onUpdateSong({ ...song, measures: newMeasures });
    setSelectedCoord([mIdx, nIdx + 1]);
    showNotice('Inserted line break note "↵" after current note (splits verse, 0 beats)');
  };

  // Note management: Delete Note at specific position
  const handleDeleteNoteAt = (mIdx: number, nIdx: number) => {
    const targetMeasure = song.measures[mIdx];
    if (targetMeasure && targetMeasure.notes.length <= 1) {
      showNotice('Measure must retain at least one note. To delete, remove the entire measure.');
      return;
    }

    const newMeasures = song.measures.map((m, currentMIdx) => {
      if (currentMIdx !== mIdx) return m;
      const notes = m.notes.filter((_, currentNIdx) => currentNIdx !== nIdx);
      return { ...m, notes };
    });

    onUpdateSong({ ...song, measures: newMeasures });
    setSelectedCoord([mIdx, Math.max(0, nIdx - 1)]);
  };

  // Add Note to end of measure
  const handleAddNoteToMeasure = (mIdx: number) => {
    const targetMeasure = song.measures[mIdx];
    if (!targetMeasure) return;
    handleInsertNoteAt(mIdx, targetMeasure.notes.length - 1);
  };

  // Measure Management: Add New Measure at End
  const handleAddMeasure = () => {
    const newMeasureNum = song.measures.length + 1;
    const newMeasure: Measure = {
      id: generateId('m'),
      measureNumber: newMeasureNum,
      chord: 'C',
      notes: [
        { id: generateId('n'), pitch: 1, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 2, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 3, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 5, octave: 0, duration: 1, lyric: {} },
      ],
    };

    onUpdateSong({
      ...song,
      measures: [...song.measures, newMeasure],
    });
    setSelectedCoord([song.measures.length, 0]);
  };

  // Keyboard-to-Score commit handler
  const handleCommitKeyboardTranscription = useCallback(
    (measures: Measure[], mode: InsertionMode) => {
      if (!measures || measures.length === 0) return;

      let nextMeasures: Measure[];
      if (mode === 'append') {
        nextMeasures = [...song.measures, ...measures];
      } else if (mode === 'replace' && selectedMeasureIndex !== null && selectedMeasureIndex >= 0) {
        const before = song.measures.slice(0, selectedMeasureIndex);
        const after = song.measures.slice(selectedMeasureIndex + 1);
        nextMeasures = [...before, ...measures, ...after];
      } else {
        const insertIdx =
          selectedMeasureIndex !== null && selectedMeasureIndex >= 0
            ? selectedMeasureIndex + 1
            : song.measures.length;
        const before = song.measures.slice(0, insertIdx);
        const after = song.measures.slice(insertIdx);
        nextMeasures = [...before, ...measures, ...after];
      }

      const renumbered = renumberMeasures(nextMeasures);
      onUpdateSong({
        ...song,
        measures: renumbered,
      });

      showNotice(`Successfully transcribed and inserted ${measures.length} measures from keyboard!`);
    },
    [song, selectedMeasureIndex, onUpdateSong, showNotice]
  );

  // Measure Management: Delete Measure
  const handleDeleteMeasure = (mIdx: number) => {
    if (song.measures.length <= 1) {
      showNotice('Song must retain at least one measure.');
      return;
    }

    const newMeasures = song.measures.filter((_, idx) => idx !== mIdx);
    const renumbered = renumberMeasures(newMeasures);

    onUpdateSong({ ...song, measures: renumbered });
    setSelectedCoord([Math.max(0, Math.min(newMeasures.length - 1, mIdx)), 0]);
    setSelectedMeasureIndices(prev => {
      if (prev.size === 0) return prev;
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < mIdx) next.add(i);
        else if (i > mIdx) next.add(i - 1);
      });
      return next;
    });
    showNotice(`Deleted Measure #${mIdx + 1}`);
  };

  // Measure Chord change
  const handleUpdateMeasureChord = (mIdx: number, chord: string) => {
    const newMeasures = song.measures.map((m, idx) => {
      if (idx !== mIdx) return m;
      const chords = getMeasureChords({ chord });
      return { ...m, chord, chords };
    });
    onUpdateSong({ ...song, measures: newMeasures });
  };


  // Auto-harmonize entire Song chords
  const handleAutoHarmonizeSong = useCallback(() => {
    const updated = autoArrangeSongChords(song);
    onUpdateSong(updated);
    showNotice(`🪄 Auto-harmonized chords across all ${updated.measures.length} measures!`);
  }, [song, onUpdateSong, showNotice]);

  // Measure Section change
  const handleUpdateMeasureSection = useCallback(
    (mIdx: number, section: string) => {
      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== mIdx) return m;
        return { ...m, section };
      });
      onUpdateSong({ ...song, measures: newMeasures });
    },
    [song, onUpdateSong]
  );

  // Split Measure at specific note index
  const handleSplitMeasureAtNote = useCallback(
    (mIdx: number, splitAtIndex: number) => {
      const targetM = song.measures[mIdx];
      if (!targetM || splitAtIndex <= 0 || splitAtIndex >= targetM.notes.length) return;

      const firstPartNotes = targetM.notes.slice(0, splitAtIndex);
      const secondPartNotes = targetM.notes.slice(splitAtIndex);

      const firstMeasure: Measure = {
        ...targetM,
        notes: firstPartNotes,
      };

      const secondMeasure: Measure = {
        id: generateId('m'),
        measureNumber: targetM.measureNumber + 1,
        chord: targetM.chord,
        section: undefined,
        notes: secondPartNotes,
        barlineType: targetM.barlineType || 'single',
      };

      firstMeasure.barlineType = 'single';

      const newMeasures = [...song.measures];
      newMeasures.splice(mIdx, 1, firstMeasure, secondMeasure);
      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx + 1, 0]);
      showNotice(`Inserted barline at note, splitting into Measures ${mIdx + 1} and ${mIdx + 2}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Merge Measure with next measure
  const handleMergeWithNextMeasure = useCallback(
    (mIdx: number) => {
      if (mIdx >= song.measures.length - 1) return;
      const currentM = song.measures[mIdx];
      const nextM = song.measures[mIdx + 1];
      if (!currentM || !nextM) return;

      const mergedMeasure: Measure = {
        ...currentM,
        notes: [...currentM.notes, ...nextM.notes],
        barlineType: nextM.barlineType || currentM.barlineType || 'single',
      };

      const newMeasures = [...song.measures];
      newMeasures.splice(mIdx, 2, mergedMeasure);
      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx, currentM.notes.length]);
      showNotice(`Merged Measures ${mIdx + 1} and ${mIdx + 2} into one measure`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Shift last note of measure to next measure
  const handleShiftNoteToNextMeasure = useCallback(
    (mIdx: number) => {
      const currentM = song.measures[mIdx];
      if (!currentM || currentM.notes.length <= 1) {
        showNotice('Measure must retain at least one note');
        return;
      }

      const noteToShift = currentM.notes[currentM.notes.length - 1];
      const newCurrentNotes = currentM.notes.slice(0, currentM.notes.length - 1);

      const newMeasures = [...song.measures];

      if (mIdx < song.measures.length - 1) {
        const nextM = song.measures[mIdx + 1];
        const newNextNotes = [noteToShift, ...nextM.notes];
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures[mIdx + 1] = { ...nextM, notes: newNextNotes };
      } else {
        const newMeasure: Measure = {
          id: generateId('m'),
          measureNumber: song.measures.length + 1,
          chord: currentM.chord,
          notes: [noteToShift],
        };
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures.push(newMeasure);
      }

      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx + 1, 0]);
      showNotice(`Moved last note into Measure ${mIdx + 2}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Pull first note from next measure into current measure
  const handlePullNoteFromNextMeasure = useCallback(
    (mIdx: number) => {
      if (mIdx >= song.measures.length - 1) return;
      const currentM = song.measures[mIdx];
      const nextM = song.measures[mIdx + 1];
      if (!currentM || !nextM || nextM.notes.length === 0) return;

      const noteToPull = nextM.notes[0];
      const newCurrentNotes = [...currentM.notes, noteToPull];
      const newNextNotes = nextM.notes.slice(1);

      const newMeasures = [...song.measures];

      if (newNextNotes.length === 0) {
        newMeasures.splice(mIdx, 2, { ...currentM, notes: newCurrentNotes });
      } else {
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures[mIdx + 1] = { ...nextM, notes: newNextNotes };
      }

      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx, newCurrentNotes.length - 1]);
      showNotice(`Borrowed first note from Measure ${mIdx + 2}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Push note from current measure into next measure
  const handlePushNoteToNextMeasure = useCallback(
    (mIdx: number, nIdx?: number) => {
      const currentM = song.measures[mIdx];
      if (!currentM || currentM.notes.length <= 1) {
        showNotice('Measure must retain at least one note');
        return;
      }

      const targetNoteIdx =
        typeof nIdx === 'number' && nIdx >= 0 && nIdx < currentM.notes.length
          ? nIdx
          : selectedCoord && selectedCoord[0] === mIdx && selectedCoord[1] < currentM.notes.length
          ? selectedCoord[1]
          : currentM.notes.length - 1;

      const noteToPush = currentM.notes[targetNoteIdx];
      const newCurrentNotes = currentM.notes.filter((_, idx) => idx !== targetNoteIdx);

      const newMeasures = [...song.measures];

      if (mIdx < song.measures.length - 1) {
        const nextM = song.measures[mIdx + 1];
        const newNextNotes = [noteToPush, ...nextM.notes];
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures[mIdx + 1] = { ...nextM, notes: newNextNotes };
      } else {
        const newMeasure: Measure = {
          id: generateId('m'),
          measureNumber: song.measures.length + 1,
          chord: currentM.chord,
          notes: [noteToPush],
        };
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures.push(newMeasure);
      }

      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx + 1, 0]);
      showNotice(`Pushed note into Measure ${mIdx + 2}`);
    },
    [song, onUpdateSong, showNotice, selectedCoord]
  );

  // Move selected note backward (earlier in song)
  const handleMoveNoteBackward = useCallback(() => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
    const mIdx = selectedMeasureIndex;
    const nIdx = selectedNoteIndex;
    const currentM = song.measures[mIdx];
    if (!currentM || !currentM.notes[nIdx]) return;

    if (nIdx > 0) {
      // Reorder within the same measure
      const newNotes = [...currentM.notes];
      const temp = newNotes[nIdx];
      newNotes[nIdx] = newNotes[nIdx - 1];
      newNotes[nIdx - 1] = temp;

      const newMeasures = song.measures.map((m, idx) =>
        idx === mIdx ? { ...m, notes: newNotes } : m
      );
      onUpdateSong({ ...song, measures: newMeasures });
      setSelectedCoord([mIdx, nIdx - 1]);
      audioEngine.previewNote(song.key, temp);
      showNotice(`Moved note backward to position #${nIdx}`);
    } else {
      // First note in current measure, move into end of previous measure
      if (mIdx === 0) {
        showNotice('Note is already at the very start of the song');
        return;
      }
      const prevM = song.measures[mIdx - 1];
      const noteToMove = currentM.notes[0];
      const newCurrentNotes = currentM.notes.slice(1);
      const newPrevNotes = [...prevM.notes, noteToMove];
      const targetNoteIdx = newPrevNotes.length - 1;

      let newMeasures = [...song.measures];
      if (newCurrentNotes.length === 0) {
        // Measure became empty, remove it and renumber
        newMeasures.splice(mIdx, 1);
        newMeasures[mIdx - 1] = { ...prevM, notes: newPrevNotes };
        newMeasures = renumberMeasures(newMeasures);
        onUpdateSong({ ...song, measures: newMeasures });
        setSelectedCoord([mIdx - 1, targetNoteIdx]);
        audioEngine.previewNote(song.key, noteToMove);
        showNotice(`Moved note into Measure #${mIdx}`);
      } else {
        newMeasures[mIdx - 1] = { ...prevM, notes: newPrevNotes };
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        onUpdateSong({ ...song, measures: newMeasures });
        setSelectedCoord([mIdx - 1, targetNoteIdx]);
        audioEngine.previewNote(song.key, noteToMove);
        showNotice(`Moved note into Measure #${mIdx}`);
      }
      safeTimeout(() => {
        scrollToCardElement(`measure-card-${mIdx - 1}`, { align: 'top' });
      }, 50);
    }
  }, [selectedMeasureIndex, selectedNoteIndex, song, onUpdateSong, showNotice, audioEngine, safeTimeout]);

  // Move selected note forward (later in song)
  const handleMoveNoteForward = useCallback(() => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
    const mIdx = selectedMeasureIndex;
    const nIdx = selectedNoteIndex;
    const currentM = song.measures[mIdx];
    if (!currentM || !currentM.notes[nIdx]) return;

    if (nIdx < currentM.notes.length - 1) {
      // Reorder within the same measure
      const newNotes = [...currentM.notes];
      const temp = newNotes[nIdx];
      newNotes[nIdx] = newNotes[nIdx + 1];
      newNotes[nIdx + 1] = temp;

      const newMeasures = song.measures.map((m, idx) =>
        idx === mIdx ? { ...m, notes: newNotes } : m
      );
      onUpdateSong({ ...song, measures: newMeasures });
      setSelectedCoord([mIdx, nIdx + 1]);
      audioEngine.previewNote(song.key, temp);
      showNotice(`Moved note forward to position #${nIdx + 2}`);
    } else {
      // Last note in current measure, move into start of next measure
      if (mIdx < song.measures.length - 1) {
        const nextM = song.measures[mIdx + 1];
        const noteToMove = currentM.notes[nIdx];
        const newCurrentNotes = currentM.notes.slice(0, nIdx);
        const newNextNotes = [noteToMove, ...nextM.notes];

        let newMeasures = [...song.measures];
        if (newCurrentNotes.length === 0) {
          // Current measure became empty, remove it and renumber
          newMeasures.splice(mIdx, 1);
          newMeasures[mIdx] = { ...nextM, notes: newNextNotes };
          newMeasures = renumberMeasures(newMeasures);
          onUpdateSong({ ...song, measures: newMeasures });
          setSelectedCoord([mIdx, 0]);
          audioEngine.previewNote(song.key, noteToMove);
          showNotice(`Moved note into Measure #${mIdx + 1}`);
        } else {
          newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
          newMeasures[mIdx + 1] = { ...nextM, notes: newNextNotes };
          onUpdateSong({ ...song, measures: newMeasures });
          setSelectedCoord([mIdx + 1, 0]);
          audioEngine.previewNote(song.key, noteToMove);
          showNotice(`Moved note into Measure #${mIdx + 2}`);
        }
        safeTimeout(() => {
          scrollToCardElement(`measure-card-${mIdx + 1}`, { align: 'top' });
        }, 50);
      } else {
        // Last measure in song
        if (currentM.notes.length <= 1) {
          showNotice('Note is already at the very end of the song');
          return;
        }
        const noteToMove = currentM.notes[nIdx];
        const newCurrentNotes = currentM.notes.slice(0, nIdx);
        const newMeasure: Measure = {
          id: generateId('m'),
          measureNumber: song.measures.length + 1,
          chord: currentM.chord,
          notes: [noteToMove],
        };

        const newMeasures = [...song.measures];
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures.push(newMeasure);
        const renumbered = renumberMeasures(newMeasures);

        onUpdateSong({ ...song, measures: renumbered });
        setSelectedCoord([mIdx + 1, 0]);
        audioEngine.previewNote(song.key, noteToMove);
        showNotice(`Moved note into new Measure #${mIdx + 2}`);
        safeTimeout(() => {
          scrollToCardElement(`measure-card-${mIdx + 1}`, { align: 'top' });
        }, 50);
      }
    }
  }, [selectedMeasureIndex, selectedNoteIndex, song, onUpdateSong, showNotice, audioEngine, safeTimeout]);


  // Toggle measure line break
  const handleToggleMeasureLineBreak = useCallback(
    (mIdx: number) => {
      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== mIdx) return m;
        return { ...m, isLineBreak: !m.isLineBreak };
      });
      onUpdateSong({ ...song, measures: newMeasures });
      const willBreak = !song.measures[mIdx]?.isLineBreak;
      showNotice(willBreak ? `Set line break after Measure ${mIdx + 1}` : `Removed line break after Measure ${mIdx + 1}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Update barline type
  const handleUpdateBarlineType = useCallback(
    (mIdx: number, barlineType: BarlineType) => {
      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== mIdx) return m;
        return { ...m, barlineType };
      });
      onUpdateSong({ ...song, measures: newMeasures });
    },
    [song, onUpdateSong]
  );

  // Auto-fill rest note for under-beat measure
  const handleAutoFillMeasureRest = useCallback(
    (mIdx: number) => {
      const targetM = song.measures[mIdx];
      if (!targetM) return;
      const report = getMeasureRhythmReport(targetM, song.timeSignature || '4/4');
      if (!report.isUnder) return;

      const restDurations = getRestDurationsForDeficit(report.absDiff);
      const newRestNotes: NumberedNotationNote[] = restDurations.map(dur => ({
        id: generateId('n'),
        pitch: 0,
        octave: 0,
        duration: dur,
        lyric: {},
      }));

      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          notes: [...m.notes, ...newRestNotes],
        };
      });

      onUpdateSong({ ...song, measures: newMeasures });
      showNotice(`Padded Measure ${mIdx + 1} with ${report.absDiff} beats of rest (0)`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Trim excess notes into next measure
  const handleTrimExcessNotes = useCallback(
    (mIdx: number) => {
      const targetM = song.measures[mIdx];
      if (!targetM) return;
      const report = getMeasureRhythmReport(targetM, song.timeSignature || '4/4');
      if (!report.isOver) return;

      let accumulated = 0;
      let splitIdx = targetM.notes.length - 1;

      for (let i = 0; i < targetM.notes.length; i++) {
        accumulated += getNoteBeatDuration(targetM.notes[i]);
        if (accumulated >= report.expectedBeats && i < targetM.notes.length - 1) {
          splitIdx = i + 1;
          break;
        }
      }

      handleSplitMeasureAtNote(mIdx, splitIdx);
    },
    [song, handleSplitMeasureAtNote]
  );

  // Batch fix all under-beat measures in whole song
  const handleBatchFixAllIncompleteMeasures = useCallback(() => {
    let fixedCount = 0;
    const newMeasures = song.measures.map((m) => {
      const report = getMeasureRhythmReport(m, song.timeSignature || '4/4');
      if (report.isUnder) {
        fixedCount++;
        const restDurations = getRestDurationsForDeficit(report.absDiff);
        const newRestNotes: NumberedNotationNote[] = restDurations.map(dur => ({
          id: generateId('n'),
          pitch: 0,
          octave: 0,
          duration: dur,
          lyric: {},
        }));
        return {
          ...m,
          notes: [...m.notes, ...newRestNotes],
        };
      }
      return m;
    });

    if (fixedCount === 0) {
      showNotice('All measures already have full beats!');
      return;
    }

    onUpdateSong({ ...song, measures: newMeasures });
    showNotice(`Automatically padded ${fixedCount} incomplete measure(s) with rests!`);
  }, [song, onUpdateSong, showNotice]);

  // Undo / Redo triggers with user feedback
  const handleUndo = useCallback(() => {
    if (!onUndo) return false;
    const success = onUndo();
    if (success) {
      showNotice('Undo modification');
    }
    return success;
  }, [onUndo, showNotice]);

  const handleRedo = useCallback(() => {
    if (!onRedo) return false;
    const success = onRedo();
    if (success) {
      showNotice('Redo modification');
    }
    return success;
  }, [onRedo, showNotice]);

  // Jump to specific measure from SectionRail
  const handleJumpToMeasure = useCallback((mIdx: number) => {
    const m = song.measures[mIdx];
    let targetNoteIdx = 0;
    if (m && m.notes.length > 0) {
      const firstPitchedIdx = m.notes.findIndex(
        n => !isNonNotationItem(n) && (typeof n.pitch === 'number' && n.pitch > 0 || Boolean(n.lyric.hanji && !isPunctuationOrSpacer(n.lyric.hanji)))
      );
      targetNoteIdx = firstPitchedIdx !== -1 ? firstPitchedIdx : 0;
    }

    setSelectedCoord([mIdx, targetNoteIdx]);
    const note = song.measures[mIdx]?.notes[targetNoteIdx] || song.measures[mIdx]?.notes[0];
    if (note) {
      audioEngine.previewNote(song.key, note);
      const el = document.getElementById(`sheet-note-${note.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [song, audioEngine]);

  // Select measure within Sheet Mode
  const handleSelectMeasureInSheet = useCallback(
    (mIdx: number) => {
      if (selectedCoord && selectedCoord[0] === mIdx) {
        return;
      }
      const m = song.measures[mIdx];
      let targetNoteIdx = 0;
      if (m && m.notes.length > 0) {
        const firstPitchedIdx = m.notes.findIndex(
          n =>
            !isNonNotationItem(n) &&
            ((typeof n.pitch === 'number' && n.pitch > 0) ||
              Boolean(n.lyric.hanji && !isPunctuationOrSpacer(n.lyric.hanji)))
        );
        targetNoteIdx = firstPitchedIdx !== -1 ? firstPitchedIdx : 0;
      }
      setSelectedCoord([mIdx, targetNoteIdx]);
    },
    [song.measures, selectedCoord]
  );

  const canMoveNoteBackward =
    selectedMeasureIndex !== null &&
    selectedNoteIndex !== null &&
    (selectedMeasureIndex > 0 || selectedNoteIndex > 0);

  const canMoveNoteForward =
    selectedMeasureIndex !== null &&
    selectedNoteIndex !== null &&
    Boolean(
      song.measures[selectedMeasureIndex] &&
      (selectedMeasureIndex < song.measures.length - 1 ||
        selectedNoteIndex < song.measures[selectedMeasureIndex].notes.length - 1 ||
        song.measures[selectedMeasureIndex].notes.length > 1)
    );

  const insertNoteAtRef = useRef(handleInsertNoteAt);
  const insertNoteBeforeAtRef = useRef(handleInsertNoteBeforeAt);

  useEffect(() => {
    insertNoteAtRef.current = handleInsertNoteAt;
    insertNoteBeforeAtRef.current = handleInsertNoteBeforeAt;
  });

  // Keyboard listener for quick score editing (undo/redo handled globally at master transport)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (isTyping) return;

      // Check for In-Song Search (Ctrl+F or Cmd+F)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        e.stopPropagation();
        setIsInSongSearchOpen(prev => !prev);
        return;
      }

      // Play key (P/p or space if not focused) toggles playing sheet from current note
      const isPlayKey =
        ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey);

      if (isPlayKey) {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePlaySheetFromNote();
        return;
      }

      if (e.key === 'ArrowRight' && !e.altKey) {
        e.preventDefault();
        handleNavigateNextNote();
        return;
      }

      if (e.key === 'ArrowLeft' && !e.altKey) {
        e.preventDefault();
        handleNavigatePrevNote();
        return;
      }

      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;

      // 1-7 or 0 (Numpad or number row): Pitch input
      if (
        ['1', '2', '3', '4', '5', '6', '7', '0'].includes(e.key) ||
        (e.code && /^Numpad[0-7]$/.test(e.code))
      ) {
        e.preventDefault();
        const digitStr = e.code && /^Numpad[0-7]$/.test(e.code) ? e.code.replace('Numpad', '') : e.key;
        const p = parseInt(digitStr, 10) as PitchNumber;
        handleSetPitch(p);
      } else if (['e', 'E', '_', 'x', 'X', 'Backspace', 'Delete'].includes(e.key)) {
        e.preventDefault();
        handleSetPitch('empty');
      } else if (e.key === '/' || e.code === 'NumpadDivide') {
        // Halve duration: / or NumpadDivide
        e.preventDefault();
        handleHalveDuration();
      } else if (e.key === '*' || e.code === 'NumpadMultiply') {
        // Double duration: * or NumpadMultiply
        e.preventDefault();
        handleDoubleDuration();
      } else if (e.key === '-' || e.code === 'NumpadSubtract') {
        // Octave down
        e.preventDefault();
        handleSetOctave(-1);
      } else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        // Octave up
        e.preventDefault();
        handleSetOctave(1);
      } else if (e.key === '.' || e.code === 'NumpadDecimal') {
        // Toggle dotted note
        e.preventDefault();
        handleToggleDotted();
      } else if (e.key === 't' || e.key === 'T') {
        // Toggle tie
        e.preventDefault();
        handleToggleTie();
      } else if (e.key === 's' || e.key === 'S') {
        // Toggle slur
        e.preventDefault();
        handleToggleSlur();
      } else if (e.key === '#') {
        // Toggle sharp accidental
        e.preventDefault();
        handleSetAccidental('#');
      } else if (e.key === 'b') {
        // Toggle flat accidental
        e.preventDefault();
        handleSetAccidental('b');
      } else if (['，', '。', '！', '？', '、', '—', '…', '「', '」', ','].includes(e.key)) {
        e.preventDefault();
        const mark = e.key === ',' ? '，' : e.key;
        handleInsertPunctuationToNote(mark);
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleMoveNoteBackward();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleMoveNoteForward();
      } else if (e.key === 'Insert') {
        e.preventDefault();
        if (e.shiftKey) {
          insertNoteBeforeAtRef.current(selectedMeasureIndex, selectedNoteIndex);
        } else {
          insertNoteAtRef.current(selectedMeasureIndex, selectedNoteIndex);
        }
      } else if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          insertNoteBeforeAtRef.current(selectedMeasureIndex, selectedNoteIndex);
        } else {
          insertNoteAtRef.current(selectedMeasureIndex, selectedNoteIndex);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateNextNote();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigatePrevNote();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (currentNote) {
          audioEngine.previewNote(song.key, currentNote);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedMeasureIndex,
    selectedNoteIndex,
    currentNote,
    audioEngine,
    song.key,
    handleSetPitch,
    handleHalveDuration,
    handleDoubleDuration,
    handleSetOctave,
    handleToggleDotted,
    handleToggleTie,
    handleToggleSlur,
    handleSetAccidental,
    handleNavigateNextNote,
    handleNavigatePrevNote,
    handleInsertPunctuationToNote,
    handleMoveNoteBackward,
    handleMoveNoteForward,
    handleTogglePlaySheetFromNote,
  ]);

  return (
    <div id="composer-editor-root" className="flex flex-col gap-2.5 w-full pb-28 sm:pb-36">
      {/* Inline Notification Banner */}
      {notification && (
        <div
          id="composer-notice-banner"
          className="p-2.5 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl shadow-xs flex items-center justify-between animate-in fade-in duration-150"
        >
          <span>{notification}</span>
          <button
            id="composer-notice-dismiss-btn"
            type="button"
            onClick={() => setNotification(null)}
            className="px-2 py-0.5 bg-zinc-950/20 hover:bg-zinc-950/30 rounded-md text-xs cursor-pointer font-bold"
          >
            Close
          </button>
        </div>
      )}

      {/* Song Metadata Card & Global Setting Header */}
      <SongMetadataHeader
        song={song}
        onUpdateSong={onUpdateSong}
        displayMode={displayMode}
        setDisplayMode={setDisplayMode}
        onOpenAligner={onOpenAligner}
        onOpenScanner={onOpenScanner}
        onStartFreshSong={onStartFreshSong}
      />

      {/* Persistent Section Navigation Rail (Quick Section Jump) */}
      <SectionRail
        song={song}
        selectedMeasureIndex={selectedMeasureIndex}
        onSelectMeasure={handleJumpToMeasure}
        playingMeasureIdx={playingMeasureIdx}
      />

      {/* In-Song Measure & Verse Search Bar */}
      <InSongSearchBar
        song={song}
        isOpen={isInSongSearchOpen}
        onClose={() => {
          setIsInSongSearchOpen(false);
          setInSongActiveMatch(null);
        }}
        onJumpToMeasure={handleSearchJumpToMeasure}
        onJumpToVerse={handleSearchJumpToVerse}
        onActiveMatchChange={setInSongActiveMatch}
      />

      {/* WYSIWYG NUMBERED NOTATION SCORE SHEET CONTAINER */}
      <div id="wysiwyg-numbered-notation-score-container" className="flex flex-col gap-2">
        {/* Sleek Score Action Ribbon */}
        <div
          id="score-studio-unified-deck"
          className="flex items-center justify-between gap-2 p-1.5 sm:p-2 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-md rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs text-xs"
        >
          {/* Left: Quick Status & Measures Counter */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-750 text-[11px] shrink-0">
              {song.measures.length} Bars
            </span>
            {incompleteMeasuresCount > 0 && (
              <button
                type="button"
                onClick={handleBatchFixAllIncompleteMeasures}
                className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-mono font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                title="Click to auto-fill rest deficits across all incomplete measures"
              >
                <span>{incompleteMeasuresCount} incomplete</span>
                <Wand2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Right: Consolidated Studio Tools (Compact, Fast Access) */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Transcribe Studio */}
            <button
              id="composer-score-keyboard-btn"
              type="button"
              onClick={handleOpenKeyboardModal}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-400/50 dark:border-amber-600/50 rounded-lg font-bold transition-all active:scale-95 cursor-pointer touch-manipulation h-8"
              title="Keyboard Transcribe Studio (Touch Piano, QWERTY typing, Web MIDI)"
            >
              <Keyboard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Transcribe</span>
            </button>

            {/* Measure Insert / Delete */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/80 h-8">
              <button
                id="composer-score-add-measure-btn"
                type="button"
                onClick={handleAddMeasure}
                className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-md font-bold transition-all active:scale-95 cursor-pointer touch-manipulation h-6.5 text-[11px]"
                title="Add Measure at End"
              >
                <Plus className="w-3 h-3" />
                <span>Add Bar</span>
              </button>

              <button
                id="composer-score-delete-measure-btn"
                type="button"
                onClick={() => {
                  const targetIdx = selectedMeasureIndex !== null ? selectedMeasureIndex : song.measures.length - 1;
                  handleDeleteMeasure(targetIdx);
                }}
                disabled={song.measures.length <= 1}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-md font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer touch-manipulation h-6.5 text-[11px]"
                title={
                  song.measures.length <= 1
                    ? 'Song must retain at least one measure'
                    : `Delete Measure ${(selectedMeasureIndex !== null ? selectedMeasureIndex : song.measures.length - 1) + 1}`
                }
              >
                <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span className="hidden md:inline">Delete</span>
              </button>
            </div>

            {/* Auto-Harmonize Entire Song Button */}
            <button
              id="composer-score-auto-chords-btn"
              type="button"
              onClick={handleAutoHarmonizeSong}
              className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border border-indigo-400/80 rounded-lg font-bold shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation h-8 text-[11px]"
              title="Auto-analyze melody and harmonize chords for all measures (reversible)"
            >
              <Wand2 className="w-3 h-3 text-amber-300 stroke-[2.5]" />
              <span className="hidden sm:inline">Auto Chords</span>
            </button>

            {/* In-Song Find Toggle */}
            <button
              id="composer-score-search-btn"
              type="button"
              onClick={() => setIsInSongSearchOpen(prev => !prev)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all active:scale-95 cursor-pointer touch-manipulation h-8 text-[11px] ${
                isInSongSearchOpen
                  ? 'bg-amber-500 text-zinc-950 font-black shadow-xs ring-1 ring-amber-400'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-700'
              }`}
              title="Find in score [Ctrl+F / ⌘F]"
            >
              <Search className="w-3 h-3 text-amber-500" />
              <span>Find</span>
              <kbd className="hidden lg:inline text-[9px] px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 font-mono">⌘F</kbd>
            </button>
          </div>
        </div>

        {/* WYSIWYG REALISTIC NUMBERED NOTATION SCORE CANVAS */}
        <RealSheetCanvas
          song={song}
          onUpdateSong={onUpdateSong}
          selectedMeasureIndex={selectedMeasureIndex}
          selectedNoteIndex={selectedNoteIndex}
          onSelectNote={handleSelectNote}
          onSelectMeasure={handleSelectMeasureInSheet}
          activePlaybackNoteId={activePlaybackNoteId}
          isPlaying={isSongPlaying}
          onTogglePlay={() => handleTogglePlaySheetFromNote(selectedMeasureIndex ?? 0, selectedNoteIndex ?? 0)}
          onUpdateNote={handleUpdateNoteDirect}
          onInsertNoteAt={handleInsertNoteAt}
          onDeleteNoteAt={handleDeleteNoteAt}
          onAddMeasure={handleAddMeasure}
          onDeleteMeasure={handleDeleteMeasure}
          onToggleLineBreak={handleToggleMeasureLineBreak}
          onUpdateBarlineType={handleUpdateBarlineType}
          onAutoFillRest={handleAutoFillMeasureRest}
          audioEngine={audioEngine}
          previewNoteAudio={(k, n) => audioEngine.previewNote(k, n)}
          onOpenKeyboardModal={handleOpenKeyboardModal}
          onAutoHarmonize={handleAutoHarmonizeSong}
          onUpdateMeasureChord={handleUpdateMeasureChord}
          displayMode={displayMode}
        />
      </div>

      {/* Keyboard-to-Score Real-Time Screen Piano & Musical Typing Modal */}
      {isKeyboardModalOpen && (
        <KeyboardToScoreModal
          isOpen={isKeyboardModalOpen}
          onClose={handleCloseKeyboardModal}
          song={song}
          selectedMeasureIndex={selectedMeasureIndex}
          audioEngine={audioEngine}
          onCommitTranscription={handleCommitKeyboardTranscription}
        />
      )}
    </div>
  );
};
