import { Measure, NumberedNotationNote, TimeSignature, PitchNumber, NoteDuration, BarlineType } from '@/types/song';

/**
 * Calculated engraving data for a single numbered notation note on a printed sheet.
 */
export interface EngravedNote {
  note: NumberedNotationNote;
  noteIndex: number;
  measureIndex: number;
  startBeat: number;
  durationBeats: number;
  beatIndex: number; // which beat group (0, 1, 2, 3...)
  beamCount: number; // 0 for quarter or longer, 1 for 8th note, 2 for 16th note, 3 for 32nd
  isDotted: boolean;
  dashCount: number; // number of '-' sustain dashes to render after the pitch (e.g. 1 for half note, 3 for whole note)
  octaveDotsAbove: number;
  octaveDotsBelow: number;
  accidentalSymbol: string; // '♯', '♭', or ''
  isRest: boolean;
  isEmpty: boolean;
  pitchDisplay: string;
  // Continuous beam flags within its beat group
  beam1: {
    hasBeam: boolean;
    connectsToPrev: boolean;
    connectsToNext: boolean;
    isSubGroupStart: boolean;
    isSubGroupEnd: boolean;
  };
  beam2: {
    hasBeam: boolean;
    connectsToPrev: boolean;
    connectsToNext: boolean;
    isSubGroupStart: boolean;
    isSubGroupEnd: boolean;
  };
}

/**
 * Calculated engraving data for a full measure on the sheet.
 */
export interface EngravedMeasure {
  measure: Measure;
  measureIndex: number;
  measureNumber: number;
  notes: EngravedNote[];
  obbligatoNotes?: EngravedNote[];
  obbligatoText?: string;
  totalBeats: number;
  expectedBeats: number;
  isFull: boolean;
  isUnder: boolean;
  isOver: boolean;
  chordText: string;
  sectionText: string;
  barlineType: BarlineType;
  voltaEnding?: number[];
  isPrelude: boolean;
  isLineBreak: boolean;
}

/**
 * Parse time signature into beats per measure and beat unit duration.
 */
export function parseTimeSignature(timeSig: TimeSignature): {
  beatsPerMeasure: number;
  beatUnit: number;
  groupingBeatLength: number;
} {
  switch (timeSig) {
    case '2/4':
      return { beatsPerMeasure: 2, beatUnit: 4, groupingBeatLength: 1.0 };
    case '3/4':
      return { beatsPerMeasure: 3, beatUnit: 4, groupingBeatLength: 1.0 };
    case '6/8':
      return { beatsPerMeasure: 2, beatUnit: 8, groupingBeatLength: 1.5 };
    case '4/4':
    default:
      return { beatsPerMeasure: 4, beatUnit: 4, groupingBeatLength: 1.0 };
  }
}

/**
 * Determine how many underline beams a note receives based on duration.
 */
export function getBeamCountForDuration(duration: NoteDuration): number {
  if (duration <= 0.125) return 3; // 32nd note
  if (duration <= 0.25 || (duration > 0.25 && duration <= 0.375)) return 2; // 16th note or dotted 16th
  if (duration <= 0.5 || (duration > 0.5 && duration <= 0.75)) return 1; // 8th note or dotted 8th
  return 0; // Quarter note or longer
}

/**
 * Determine how many sustain dashes '-' follow the note digit in standard Jianpu notation.
 * In standard Jianpu:
 * - Quarter note (1 beat): "1" (0 dashes)
 * - Half note (2 beats): "1 -" (1 dash)
 * - Dotted half note (3 beats): "1 - -" (2 dashes)
 * - Whole note (4 beats): "1 - - -" (3 dashes)
 */
export function getDashCountForDuration(duration: NoteDuration, isDotted?: boolean): number {
  if (duration >= 3.75) return 3;
  if (duration >= 2.75) return 2;
  if (duration >= 1.75 && !isDotted) return 1;
  return 0;
}

/**
 * Formats accidental character into crisp musical glyph.
 */
export function formatAccidentalGlyph(accidental?: string): string {
  if (accidental === '#') return '♯';
  if (accidental === 'b') return '♭';
  return '';
}

/**
 * Engrave a single measure into full layout metrics with continuous beam analysis.
 */
export function engraveMeasure(
  measure: Measure,
  measureIndex: number,
  timeSignature: TimeSignature
): EngravedMeasure {
  const { beatsPerMeasure, groupingBeatLength } = parseTimeSignature(timeSignature);
  const expectedBeats = beatsPerMeasure * (timeSignature === '6/8' ? 1.5 : 1.0);

  let currentBeat = 0;
  const rawEngravedNotes: Array<Omit<EngravedNote, 'beam1' | 'beam2'>> = [];

  for (let nIdx = 0; nIdx < measure.notes.length; nIdx++) {
    const note = measure.notes[nIdx];
    const duration = Number(note.duration) || 0;
    const isZeroTime = duration === 0;

    const startBeat = currentBeat;
    const durationBeats = duration;
    const beatIndex = Math.floor(startBeat / groupingBeatLength);
    const beamCount = isZeroTime ? 0 : getBeamCountForDuration(duration);
    const dashCount = isZeroTime ? 0 : getDashCountForDuration(duration, note.isDotted);

    const isRest = note.pitch === 0;
    const isEmpty = note.pitch === 'empty';

    let pitchDisplay = '';
    if (isRest) {
      pitchDisplay = '0';
    } else if (isEmpty) {
      pitchDisplay = '';
    } else {
      pitchDisplay = String(note.pitch);
    }

    const octaveDotsAbove = note.octave > 0 ? Math.min(note.octave, 3) : 0;
    const octaveDotsBelow = note.octave < 0 ? Math.min(Math.abs(note.octave), 3) : 0;
    const accidentalSymbol = formatAccidentalGlyph(note.accidental);

    rawEngravedNotes.push({
      note,
      noteIndex: nIdx,
      measureIndex,
      startBeat,
      durationBeats,
      beatIndex,
      beamCount,
      isDotted: Boolean(note.isDotted),
      dashCount,
      octaveDotsAbove,
      octaveDotsBelow,
      accidentalSymbol,
      isRest,
      isEmpty,
      pitchDisplay,
    });

    currentBeat += duration;
  }

  // Calculate continuous beam connectivity for level 1 (8th notes) and level 2 (16th notes)
  const engravedNotes: EngravedNote[] = rawEngravedNotes.map((raw, idx) => {
    const prevRaw = idx > 0 ? rawEngravedNotes[idx - 1] : null;
    const nextRaw = idx < rawEngravedNotes.length - 1 ? rawEngravedNotes[idx + 1] : null;

    // Connect beam 1 if adjacent note in the SAME beat group also has beamCount >= 1
    const prevCanConnectBeam1 = Boolean(
      prevRaw &&
      prevRaw.beatIndex === raw.beatIndex &&
      prevRaw.beamCount >= 1 &&
      raw.beamCount >= 1
    );

    const nextCanConnectBeam1 = Boolean(
      nextRaw &&
      nextRaw.beatIndex === raw.beatIndex &&
      nextRaw.beamCount >= 1 &&
      raw.beamCount >= 1
    );

    // Connect beam 2 if adjacent note in the SAME beat group also has beamCount >= 2
    const prevCanConnectBeam2 = Boolean(
      prevRaw &&
      prevRaw.beatIndex === raw.beatIndex &&
      prevRaw.beamCount >= 2 &&
      raw.beamCount >= 2
    );

    const nextCanConnectBeam2 = Boolean(
      nextRaw &&
      nextRaw.beatIndex === raw.beatIndex &&
      nextRaw.beamCount >= 2 &&
      raw.beamCount >= 2
    );

    return {
      ...raw,
      beam1: {
        hasBeam: raw.beamCount >= 1,
        connectsToPrev: prevCanConnectBeam1,
        connectsToNext: nextCanConnectBeam1,
        isSubGroupStart: !prevCanConnectBeam1 && nextCanConnectBeam1,
        isSubGroupEnd: prevCanConnectBeam1 && !nextCanConnectBeam1,
      },
      beam2: {
        hasBeam: raw.beamCount >= 2,
        connectsToPrev: prevCanConnectBeam2,
        connectsToNext: nextCanConnectBeam2,
        isSubGroupStart: !prevCanConnectBeam2 && nextCanConnectBeam2,
        isSubGroupEnd: prevCanConnectBeam2 && !nextCanConnectBeam2,
      },
    };
  });

  let engravedObbligatoNotes: EngravedNote[] | undefined;
  if (measure.obbligato && measure.obbligato.length > 0) {
    let obBeat = 0;
    const rawOb: Array<Omit<EngravedNote, 'beam1' | 'beam2'>> = [];
    for (let oIdx = 0; oIdx < measure.obbligato.length; oIdx++) {
      const oNote = measure.obbligato[oIdx];
      const dur = Number(oNote.duration) || 0;
      const beamCount = getBeamCountForDuration(dur);
      const dashCount = getDashCountForDuration(dur, oNote.isDotted);
      const isRest = oNote.pitch === 0;
      const isEmpty = oNote.pitch === 'empty';
      const pitchDisplay = isRest ? '0' : isEmpty ? '' : String(oNote.pitch);
      rawOb.push({
        note: oNote,
        noteIndex: oIdx,
        measureIndex,
        startBeat: obBeat,
        durationBeats: dur,
        beatIndex: Math.floor(obBeat / groupingBeatLength),
        beamCount,
        isDotted: Boolean(oNote.isDotted),
        dashCount,
        octaveDotsAbove: oNote.octave > 0 ? Math.min(oNote.octave, 3) : 0,
        octaveDotsBelow: oNote.octave < 0 ? Math.min(Math.abs(oNote.octave), 3) : 0,
        accidentalSymbol: formatAccidentalGlyph(oNote.accidental),
        isRest,
        isEmpty,
        pitchDisplay,
      });
      obBeat += dur;
    }
    engravedObbligatoNotes = rawOb.map((raw, idx) => {
      const prev = idx > 0 ? rawOb[idx - 1] : null;
      const next = idx < rawOb.length - 1 ? rawOb[idx + 1] : null;
      const prevC1 = Boolean(prev && prev.beatIndex === raw.beatIndex && prev.beamCount >= 1 && raw.beamCount >= 1);
      const nextC1 = Boolean(next && next.beatIndex === raw.beatIndex && next.beamCount >= 1 && raw.beamCount >= 1);
      const prevC2 = Boolean(prev && prev.beatIndex === raw.beatIndex && prev.beamCount >= 2 && raw.beamCount >= 2);
      const nextC2 = Boolean(next && next.beatIndex === raw.beatIndex && next.beamCount >= 2 && raw.beamCount >= 2);
      return {
        ...raw,
        beam1: {
          hasBeam: raw.beamCount >= 1,
          connectsToPrev: prevC1,
          connectsToNext: nextC1,
          isSubGroupStart: !prevC1 && nextC1,
          isSubGroupEnd: prevC1 && !nextC1,
        },
        beam2: {
          hasBeam: raw.beamCount >= 2,
          connectsToPrev: prevC2,
          connectsToNext: nextC2,
          isSubGroupStart: !prevC2 && nextC2,
          isSubGroupEnd: prevC2 && !nextC2,
        },
      };
    });
  }

  const totalBeats = Math.round(currentBeat * 1000) / 1000;
  const isFull = Math.abs(totalBeats - expectedBeats) < 0.01;
  const isUnder = totalBeats < expectedBeats - 0.01;
  const isOver = totalBeats > expectedBeats + 0.01;

  const chordText = measure.chord || (measure.chords && measure.chords.length > 0 ? measure.chords.join(' ') : '');
  const sectionText = measure.section || '';
  const barlineType = measure.barlineType || 'single';

  return {
    measure,
    measureIndex,
    measureNumber: measure.measureNumber || measureIndex + 1,
    notes: engravedNotes,
    obbligatoNotes: engravedObbligatoNotes,
    obbligatoText: measure.obbligatoText,
    totalBeats,
    expectedBeats,
    isFull,
    isUnder,
    isOver,
    chordText,
    sectionText,
    barlineType,
    voltaEnding: measure.voltaEnding,
    isPrelude: Boolean(measure.isPrelude || /intro|prelude|interlude/i.test(measure.section || '')),
    isLineBreak: Boolean(measure.isLineBreak),
  };
}

/**
 * Groups measures into systems (staff lines on the sheet).
 * Measures per system defaults to 4, or wraps whenever measure.isLineBreak is true.
 */
export function groupMeasuresIntoSystems(
  measures: Measure[],
  timeSignature: TimeSignature,
  defaultMeasuresPerSystem = 4
): Array<{
  systemIndex: number;
  measures: EngravedMeasure[];
  startMeasureNumber: number;
  endMeasureNumber: number;
}> {
  const systems: Array<{
    systemIndex: number;
    measures: EngravedMeasure[];
    startMeasureNumber: number;
    endMeasureNumber: number;
  }> = [];

  let currentSystem: EngravedMeasure[] = [];

  measures.forEach((measure, idx) => {
    const engraved = engraveMeasure(measure, idx, timeSignature);
    currentSystem.push(engraved);

    const reachesDefaultLimit = currentSystem.length >= (measure.isLineBreak ? 1 : defaultMeasuresPerSystem);
    const forceBreak = measure.isLineBreak;

    if (forceBreak || reachesDefaultLimit) {
      systems.push({
        systemIndex: systems.length + 1,
        measures: currentSystem,
        startMeasureNumber: currentSystem[0].measureNumber,
        endMeasureNumber: currentSystem[currentSystem.length - 1].measureNumber,
      });
      currentSystem = [];
    }
  });

  if (currentSystem.length > 0) {
    systems.push({
      systemIndex: systems.length + 1,
      measures: currentSystem,
      startMeasureNumber: currentSystem[0].measureNumber,
      endMeasureNumber: currentSystem[currentSystem.length - 1].measureNumber,
    });
  }

  return systems;
}
