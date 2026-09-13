# UI Refactor Proposal Plan: Real-Sheet Score Creation & Editing

| Field | Specification |
| --- | --- |
| **Document Name** | Real-Sheet Score Creation & Editing UI Refactor Proposal Plan |
| **Project Name** | Taigi Composer (`taigi-composer`) |
| **Reference Standard** | Classic numbered musical notation print edition (e.g., the referenced sheet for "Bang Chhun-Hong / 望春風" `IMG_0171.png`, JP-Word / People's Music Publishing House engraving standards) |
| **Target Scope** | Refactor the existing card-grid / DAW-style editor into a **direct on-paper creation and editing experience (What You See Is What You Compose)** on an interactive, true-to-life sheet score |
| **Language Policy** | **All application UI texts, labels, buttons, navigation, dialogs, and controls MUST be in English (strictly no Chinese UI text). Songs themselves (titles, lyrics, Han-Lo characters, and Pe̍h-ōe-jī / POJ romanization) are preserved as they are in their original language.** |
| **Target Audience** | Product Managers, Frontend / Audio Architects, Music Engraving Engineers |
| **Status** | Proposal Plan Ready for Engineering Review |

---

## 1. Core Vision & Philosophy

### 1.1 From "Audio Cards Deck" to a "Living Sheet Paper"
Most computer-aided music authoring tools inadvertently fall into the nested paradigms of "Digital Audio Workstation (DAW)" or "Card Decks": stacked buttons, multi-tiered chrome, measures enclosed in rounded boxes, and each musical note rendered like an isolated button chip.

However, the natural mental model most familiar to traditional musicians, folk song enthusiasts, choir members, and music learners is **a clean, elegant physical paper sheet score (such as the reference sheet "Bang Chhun-Hong / 望春風")**:
- **Visual Intuitiveness**: A crisp paper surface, standard key signature `1 = E`, time signature `4/4`, and tempo marking `♩ = 88`.
- **Continuous Beams**: Eighth and sixteenth notes connected naturally within beats with continuous horizontal beam lines rather than broken individual underlines.
- **Stacked Multi-Verse Lyrics**: Verse 1, Verse 2, etc., neatly arranged in vertical rows directly below the notes, with typography strictly aligned to note centers.
- **WYSIWYG Inline Editing**: Direct on-sheet editing where clicking on any note, lyric, or title allows immediate typing and modification—just like writing directly on manuscript paper with a pencil.

### 1.2 The Three Core Pillars
1. **Sheet-First Canvas**: Make the authentic A4 / manuscript score paper the visual core of the application. Eliminate redundant nested DAW card frames and toolbars so the score occupies over 80–90% of the primary viewport.
2. **Direct On-Sheet Caret & Typing**: Introduce a musical insertion cursor ("Music Caret"). Clicking any note, rest, lyric, or barline enables instant on-sheet typing via standard number keys (`1-7` for pitch, `0` for rest, `-` for extension dash, `.` for dot, `/` for duration halving).
3. **Unobtrusive Floating Ribbon / HUD**: Consolidate secondary toolbars into a modern, lightweight floating context palette (Floating HUD) that supports iPad touch input while never obscuring the score canvas itself.
4. **Strict English UI Localization**: All system interfaces, settings, status indicators, tooltips, buttons, and HUD controls are rendered in English. Song content (song names, lyrics, romanizations) remains in its original authentic form.

---

## 2. Visual Anatomy & Transcription Blueprint of Reference Sheet ("Bang Chhun-Hong / 望春風")

Based on the classic numbered musical notation benchmark from `IMG_0171.png`, the comprehensive visual and structural elements of an authentic, real-world paper score are deconstructed below:

```
+-------------------------------------------------------------------------------------------------------------------+
| LPDC—JCR1341                                                                                                      |
|                                                  望   春   風                                                     |
|                                       (根據韓寶儀閩南語演唱音頻記譜)                            鄧雨賢 詞          |
|  1 = E  4/4                                                                                 李臨秋 曲          |
|  ♩ = 88                                                                                   嶺南印象 制譜        |
|                                                                                                                   |
|  System 1 (Prelude & Obbligato Counterpoint):                                                                     |
|                                                                                0 56 53 21 6 5                     |
|                                                                                . __ __ __ . .                     |
|  ( 5·   5 6   5 3  |  3   2 1 6  -  |  5·   3 3   2 3 2  |  1   -   -   -   ) |                                  |
|         _ _   _ _         _ _ .             _ _   =====                                                           |
|                                                                                                                   |
|  System 2 (Theme Entry & Staggered Verses):                                                                       |
|     5·  5 6   1    |  2 3 2 1 2 3 - |  5·   3 3   2 1    |  2   -   -   -   |                                     |
|     .   _ _   .       ===== _ _ .      .    _ _   _ _                                                             |
|  1.3.獨 夜無  伴      守  燈  下，     清   風對  面 吹 ，                                                        |
|    2.想 要郎  君      做  恁  婿，     意   愛在  心 內 ，                                                        |
|                                                                                                                   |
|  System 3 (Bridge & Climax):                                                                                      |
|     3·  5 5   3 5  |  1·  2 2 -     |  5·   3 3   2 3 2  |  1   -   -   -   |                                     |
|     .   _ _   _ _     .   _ _          .    _ _   =====                                                           |
|     十  七八  歲未    出  嫁，         見   著少  年 家 。                                                        |
|     等  待何  時君    來  採，         青   春花  當 開 。                                                        |
|                                                                                                                   |
|  System 4 (Development):                                                                                          |
|     2·  2 3   2 1  |  6·  5 6 1 -   |  6·   1 2   3      |  5   -   -   -   |  5·   5 6   5 3  |                  |
|     .   _ _   _ _     .   _ _          .    _ _                                 .   _ _   _ _                     |
|     果  然標  致面    肉  白，         誰   家人  子 弟，   想  要  問  伊                                         |
|     聽  見外  面有    人  來，         開   門甲  看 見，   月  娘  笑  阮                                         |
|                                                                                                                   |
|  System 5 (Volta Endings 1 & 2 vs. Volta Ending 3):                                                               |
|  ┌ 1. 2. ────────────────────────────────────────────────────────┐ ┌ 3. ──────────────────────────────────────┐  |
|  |  3   2 1 6  -   |  5·   3 3   2 3 2  |  1   -   -   -   :||   |  5·   3 3   2 3 2  |  1   -   -   -   ||   |  |
|  |      _ _ .              _ _   =====                      ||   |       _ _   =====                      ||   |  |
|  |  驚  歹  勢 ，  心   內彈  琵   琶 。                     ||   |  心   內彈  琵   琶 。                    ||   |  |
|  |  憨  大  呆 ，  予   風騙  不   知 。                     ||   |                                           ||   |  |
|                                                                                                                   |
|  Footnote & Engraver Attributions:                                                                                |
|  本曲譜使用JP-Word簡譜編輯軟件製作  JPW簡譜軟件交流群：332718458                                                  |
|  歡迎光臨嶺南印象製譜園地：http://www.qupu123.com/space/336279   QQ：54334643                                     |
|  本人所記曲譜只發布在“中國曲譜網”本人個人園地上，轉載本人所記曲譜時凡抹去和篡改本人記製譜信息者均為盜版           |
|                                                                                                                   |
|                                                   — 1/1 —                                                         |
+-------------------------------------------------------------------------------------------------------------------+
```

### 2.1 Complete Architectural Engraving Anatomy

| Element | Visual Specification (From `IMG_0171.png`) | Paper Layout & Interactive Digital Implementation |
| --- | --- | --- |
| **Catalog ID (Top-Left)** | `LPDC—JCR1341` in subtle italicized font at top-left corner | Non-intrusive score code / edition identifier, editable inline. |
| **Score Title (Centered)** | `望 春 風` in large traditional serif typography with wide tracking (`0.25em` letter spacing) | Double-click or caret to edit; auto-centered across page margins. |
| **Subtitle / Version Note** | `(根據韓寶儀閩南語演唱音頻記譜)` centered directly under title in medium serif | Version or audio source annotation; preserved in authentic wording. |
| **Credits Block (Top-Right)** | 3-line right-aligned stepped hierarchy:<br>• `鄧雨賢 詞` (Lyricist)<br>• `李臨秋 曲` (Composer)<br>• `嶺南印象 制譜` (Engraver/Transcriber) | Right-aligned metadata grid; clicking any line allows instant updates. |
| **Theory Header (Top-Left)** | `1 = E` (Key Signature), `4/4` (Fractional Time Signature), `♩ = 88` (Tempo Marking with musical note glyph) | Standard musical theory header; clicking any item opens a quick-pick modal (all in English UI). |
| **Parenthesized Prelude / Interlude** | `( 5· 5 6 5 3 | ... | 1 - - - )` spanning full measures with enclosing parentheses | Instrumental passage toggle: wraps measures in curved score parentheses and suppresses lyric rows. |
| **Upper Obbligato / Counterpoint Layer** | Measure 4 top layer: small notes `0 5 6 5 3 2 1 6̣ 5̣` above the sustain note `1 - - -` | Multi-voice rendering layer: displays auxiliary vocal ornaments or counter-melody above the primary melodic staff. |
| **Continuous Beams Engine** | Eighth notes (`_`), sixteenth notes (`=`), and dotted eighths connected via unified horizontal beam lines | Auto-beamer groups notes strictly by beats (e.g. 1 beat per beam group in 4/4) with clean SVG horizontal bands. |
| **Pitch & Octave Typography** | High octave dots centered precisely above digits (`5̇`, `1̇`, `2̇`); low octave dots placed below duration beams (`6̣`, `5̣`) | Dedicated musical monospace font with exact vertical bounding boxes to prevent overlapping dots and beams. |
| **Slurs & Arcs (Bézier Curves)** | Smooth arching curves over melismatic notes (e.g. over `2 3 2`, over `2 1`, over `1̇ 2̇`) | Dynamic SVG cubic Bézier curves computed automatically from start note head to end note head with clearance. |
| **Multi-Verse Lyric Rows** | Staggered vertical rows below each melodic line:<br>• Row 1: `1.3.` (Verse 1 & Verse 3 combination)<br>• Row 2: `2.` (Verse 2)<br>• Strict vertical center-alignment of syllables with notes | Multi-verse lyric engine: displays Verse 1, Verse 2, Verse 3 directly on the paper canvas with `Space`/`Tab` auto-advance. |
| **Volta Repeat Endings** | `┌ 1. 2. ────────────────┐` over first ending, followed by `:||`<br>`┌ 3. ────────────────────┐` over second ending, followed by `||` | Standard overhead Volta brackets with repeat playback engine supporting 1st/2nd cycle loop and 3rd ending jump. |
| **Footnote / Publisher Notice** | Multi-line engraving credits, community group references, and copyright protection notice at paper bottom | Formatted footnote block positioned before page footer divider. |
| **Pagination Footer** | Centered page indicator format: `— 1/1 —` | Dynamic page calculation supporting single-page and multi-page print layouts. |

---

## 3. Gap Analysis: Current vs. Target Architecture

| Dimension | Current State | Target Real Sheet |
| --- | --- | --- |
| **Primary Visual Interface** | **Card-Grid & Control Stack**: Measures wrapped inside rounded cards; notes wrapped in `rounded-xl min-w-[46px] border` with heavy shadows and colored background chips. | **Authentic Paper Canvas**: Genuine sheet manuscript look (A4 ratio, clean white/ivory paper, subtle depth shadow, publication-grade monochrome engraving). |
| **Chrome Overhead** | 6 horizontal bars upon entry (Top Nav + Song Metadata + Track Bar + Mode Switcher + Duration Bar + Section Rail), pushing actual score to the lower screen. | **Zero-Distraction Centered Score**: Minimalist top floating status bar; 90% of screen dedicated to sheet music, with controls consolidated into a floating dock. |
| **Beam Accuracy** | Underlines rendered as isolated `h-[2px] bg-current` per note, breaking eighth/sixteenth notes instead of forming continuous musical beams. | **Engraver Auto-Beaming Engine**: Smooth continuous horizontal beams shared across notes within the same beat group, matching published sheet standards. |
| **Editing Mental Model** | User must "Click note card → Move to bottom HUD → Select pitch → Select duration → Click next cell", resulting in high friction. | **Direct Sheet Caret**: Blinking cursor on the paper score; typing `5 - 3 2 1 |` outputs notation smoothly like a music typewriter. |
| **Lyric Input Experience** | Lyrics separated into individual card input boxes or requiring full-screen modal aligners. | **Stacked Multi-Verse Lyrics**: Direct on-sheet multi-row lyrics (Verse 1 / Verse 2 / POJ / Han-Lo), selectable and editable in place. |
| **Voltas & Repeat Endings** | Only basic measure tags; missing standard overhead Volta brackets (`┌ 1. 2. ──┐`). | **Standard Volta Bracket Rendering**: Visual bracket lines with repeat playback engine support jumping between 1st, 2nd, and 3rd endings. |
| **UI Language Consistency** | Mixed Chinese/English terms in control buttons and labels. | **100% English UI Text**: All interface controls, labels, modals, tooltips, and actions strictly in English. Song titles and lyrics preserved in original language. |

---

## 4. Target System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Taigi Composer Workspace                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Top Floating Utility Bar]  Song Title  •  Key  •  Time  •  BPM  •  [Play] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌───────────────────────────────────────────────────────────────────┐    │
│    │                        Virtual Sheet Paper                        │    │
│    │                                                                   │    │
│    │    LPDC-JCR1341               望  春  風                          │    │
│    │                                                                   │    │
│    │    1 = E  4/4                                                     │    │
│    │    ♩ = 88                                                         │    │
│    │                                                                   │    │
│    │    System 1:                                                      │    │
│    │    |  5·   5 6   5 3  |  3   2 1 6 -  |  5·   3 3   2 3 2  |      │    │
│    │       .    ___   ___         _____        .   ___   =====         │    │
│    │    1. 獨   夜無  伴      守  燈  下，  清   風對  面              │    │
│    │    2. 想   要郎  君      做  恁  婿，  意   愛在  心              │    │
│    │       [ Music Caret | ]                                           │    │
│    │                                                                   │    │
│    │    System 2: ...                                                  │    │
│    │                                                                   │    │
│    │                                   — 1/1 —                         │    │
│    └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [Floating Context Palette / Composer Dock]                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ [1-7] [0 Rest] [- Dash] [Octave •] [Duration /_] [Slur ~] [Verse 1/2] │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Core Module Responsibilities

1. **`SheetCanvas` (Sheet Score Viewport Container)**
   - Simulates physical paper dimensions (A4 portrait, landscape, and adaptive responsive width).
   - High-contrast publication-grade paper surface (`#FFFFFF` pure white or `#FAF9F5` warm ivory with subtle `shadow-xl border border-zinc-200`).
   - Smooth zoom engine (50% to 200%) and pinch-to-zoom gesture handling.

2. **`JianpuEngraver` (Notation Engraving & Auto-Beaming Engine)**
   - **Beat Alignment Engine**: Proportional horizontal space allocation based on time signature and note duration (e.g., quarter note = 1X, eighth note = 0.5X, whole note = 4X).
   - **Continuous Beamer**: Spans adjacent eighth, sixteenth, and thirty-second notes within beat groups into smooth continuous horizontal beams.
   - **Accidental & Articulation Layout**: Octave dots, accidentals (sharp/flat), rests, extension dashes, and grace notes.
   - **SVG Arc Layer**: Renders smooth Bézier curves for slurs, ties, and Volta ending brackets.

3. **`SheetCaretManager` (Direct On-Sheet Caret & Typing Controller)**
   - Manages active editing target: `{ measureIndex, noteIndex, lyricRowIndex, field: 'pitch' | 'lyric' | 'chord' }`.
   - Captures global keyboard events (number keys, numpad, arrow keys, shortcut keys) for zero-friction typing.
   - Spatial hit testing for click-to-edit (clicking above note selects pitch, clicking below selects lyrics).

4. **`FloatingScoreHud` (Unobtrusive Floating Context Palette)**
   - Lightweight, translucent floating dock anchored at the bottom center or edge.
   - Designed for touch devices (iPad/tablets) to provide one-tap access to pitch, octave, duration, slurs, and verse switching.
   - **Auto-Avoidance**: Dims or shifts upward when the caret enters the lower viewport so it never covers the active measure.

5. **UI Language Standards Enforcement**
   - All HUD buttons, menus, dialogs, settings, and helper text are strictly in English.
   - Song titles, lyrics, and metadata fields render the authentic song data (Traditional Chinese / Taiwanese Han-Lo / POJ romanization) exactly as composed.

---

## 5. Direct Interaction & Keyboard Mapping Matrix

To deliver a frictionless "typing on paper" experience, interaction mapping is structured as follows:

### 5.1 Keyboard Shortcuts & Caret Actions

| Key | Action | Visual Feedback on Sheet |
| --- | --- | --- |
| **`1` ~ `7`** | Input numbered pitch (Do, Re, Mi, Fa, Sol, La, Ti) | Number appears instantly at caret; audio tone plays immediately |
| **`0`** | Input musical rest | Inserts `0` with duration beams matching active duration |
| **`-` (Minus / Dash)** | Input extension dash (sustain beat) | Appends extension dash `-` and advances caret by 1 beat |
| **`.` (Period)** | Toggle dotted note duration | Dot `·` appears to the right of note; measure timing updates |
| **`/` or `_`** | Halve duration (Quarter -> 8th -> 16th -> 32nd) | Adds a continuous beam underline |
| **`*` or `Shift + +`** | Double duration (8th -> Quarter -> Half -> Whole) | Removes a beam or turns note into dash extension `-` |
| **`+` / `-`** or **`Ctrl + ↑ / ↓`** | Shift octave Up / Down | Adds or removes high/low octave dots (`1̇` or `1̣`) |
| **`#` / `b`** | Accidental sharp `♯` / flat `♭` | Renders accidental glyph to the top-left of the digit |
| **`S`** | Toggle slur to the next note | Draws smooth arched SVG slur over selected notes |
| **`T`** | Toggle tie to identical pitch note | Draws tie arc connecting notes |
| **`Backspace` / `Delete`** | Delete note or reset to rest | Advances/clears current slot |
| **`←` / `→`** | Move caret horizontally between notes | Caret hops between notes across barlines |
| **`↑` / `↓`** | Move caret vertically between notes and lyrics | Caret transitions from pitch to Verse 1 lyrics, then Verse 2 |
| **`Space` or `Tab`** | In lyric mode, advance to next note syllable | Enables continuous smooth typing for lyrics |

---

## 6. Visual & Typographic Specifications

To eliminate generic AI-generated card aesthetics and deliver genuine publication quality:

### 6.1 Colorimetry & Paper Texture
- **Sheet Paper Surface**: `#FFFFFF` (pure print white) or `#FAF9F5` (warm ivory manuscript paper); no saturated purple gradients or dark-mode glow effects.
- **Workspace Backdrop**: Subtle neutral gray `#F1F3F5` (light mode) or `#121316` (eye-comfort dark mode).
- **Engraved Ink Tone**: Primary notation in `#18181B` (95% carbon ink black), barlines in `#27272A`, ensuring sharp, print-ready contrast.
- **Active Caret & Highlight**: Refined amber `#D97706` or cobalt `#0284C7` for high visibility without compromising score legibility.

### 6.2 Typographic Hierarchy
- **Song Title Display**:
  - Fonts: `Noto Serif TC`, `Songti SC`, `SimSun`, `serif`
  - Style: Font-weight 700, letter-spacing `tracking-[0.25em]`, centered.
- **Musical Digits**:
  - Dedicated monospace musical font with clean x-height and distinct apertures (preventing `3` and `5` confusion at small sizes).
- **Lyric Typography**:
  - Han-Lo / Chinese characters: `Noto Sans TC`, `PingFang SC`, font-weight 500, upright.
  - Pe̍h-ōe-jī (POJ) / Romanization: `Charis SIL`, `Times New Roman`, italic font-weight 600, supporting full diacritical tone markings.
- **Application Interface UI**:
  - Clean English system font stack (`system-ui`, `Inter`, `sans-serif`) across all toolbars, buttons, dialogs, and panels.

### 6.3 Vertical Rhythm & System Geometry
Each score system is arranged on a strict vertical grid:

```
[System Top Margin]           12px
[Measure Numbers & Voltas]    16px (e.g. ┌ 1. 2. ─────┐ bracket layer)
[Chords & Annotations]        14px (Chords such as F, Dm, C7)
[Slurs Layer]                 10px (Clearance for slur arcs)
[Notation Line]               28px (Numbered digits 1-7, octave dots)
[Beam Lines Underneath]        8px (Single beam 2px / Double beam 2px + 2px gap)
[Lyric Line 1 (Verse 1)]      22px (First verse, prefixed with 1.)
[Lyric Line 2 (Verse 2)]      22px (Second verse, prefixed with 2.)
[System Bottom Divider]       24px (Blank paper buffer)
```

---

## 7. Phased Implementation Roadmap

To ensure existing features (audio playback, history undo/redo, MIDI export, synthesis) remain fully intact, a 5-phase rollout is defined:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Phase 1   │ ──> │   Phase 2   │ ──> │   Phase 3   │ ──> │   Phase 4   │ ──> │   Phase 5   │
│ Sheet Canvas│     │ Auto-Beams  │     │ Direct Caret│     │ Multi-Verse │     │ Vector Print│
│ & Chrome Red│     │ & SVG Slurs │     │ & Typewriter│     │ & Voltas    │     │ & PDF Export│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Phase 1: Virtual Sheet Canvas & Chrome Reduction
- **Objective**: Introduce `RealSheetCanvas` component, replacing 6 stacked DAW-style card layers with a centered sheet paper canvas.
- **Implementation**:
  1. Build a paper container matching A4 proportions with crisp margins and subtle drop shadows.
  2. Integrate song title, attributions, `1 = E` key, `4/4` time signature, and tempo directly into the score header with inline click-to-edit.
  3. Enforce English labels across all remaining navigation and action buttons.

### Phase 2: Continuous Beams & SVG Slurs Engine
- **Objective**: Render publication-grade continuous horizontal beams and smooth Bézier curve slurs.
- **Implementation**:
  1. Implement `calculateSystemBeams(measures, timeSignature)` to merge eighth and sixteenth notes within beats into continuous SVG beams.
  2. Implement `ScoreSvgOverlay` for slurs, ties, and prelude parentheses `( ... )`.

### Phase 3: Direct Sheet Caret & Music Typewriter
- **Objective**: Allow users to click directly on the sheet and type notes fluently with the keyboard.
- **Implementation**:
  1. Build `ScoreCaret` with keyboard and touch navigation.
  2. Implement `MusicKeyEngine`:
     - Keys `1-7` input pitch with immediate audio feedback.
     - `0` for rest, `-` for extension dash, `.` for dot, `/` for duration underline.
     - Automatic advance across measures when filled.
  3. Replace heavy bottom panels with the lightweight, English-labeled `FloatingScoreHud`.

### Phase 4: Multi-Verse Stacking & Voltas
- **Objective**: Support stacked verses (Verse 1, Verse 2, Verse 3) and repeat Volta ending brackets.
- **Implementation**:
  1. Expand data structure and renderer to display parallel vertical verse rows aligned under notes.
  2. Support vertical navigation between verse rows and note lines with `↑`/`↓` and `Space` word advance.
  3. Implement Volta repeat brackets (`┌ 1. 2. ──┐` and `┌ 3. ──┐`) with repeat playback loop integration.

### Phase 5: Vector Print & PDF Export
- **Objective**: Guarantee true WYSIWYG parity between on-screen editing and physical print / PDF output.
- **Implementation**:
  1. Configure `@media print` styles to automatically hide editing aids and floating HUDs, scaling cleanly to standard A4 paper.
  2. High-resolution SVG / PDF export with embedded font subsets and standard footer pagination `— 1/1 —`.

---

## 8. Data Compatibility & Migration Strategy

The refactoring is **100% backward-compatible** with existing `Song`, `Measure`, and `NumberedNotationNote` data models:
1. **Zero Breaking Changes**: All existing preset songs (e.g., "Bang Chhun-Hong / 望春風", "Hō-Iā-Hoe / 雨夜花") and user-saved songs in local storage continue to render seamlessly.
2. **Incremental Extensions**:
   - `Measure.voltaEnding?: number[]` (identifies which repeat cycle the measure belongs to, e.g., `[1, 2]` or `[3]`).
   - `NumberedNotationNote.lyricsByVerse?: { [verseIndex: number]: LyricSyllable }` (enables multi-verse rows while falling back cleanly to `note.lyric` if undefined).
3. **UI Language Uniformity**: All controls, dialogs, buttons, tooltips, and status messages throughout the application are strictly presented in English, while song data preserves original Han-Lo, Taiwanese lyrics, and POJ romanization intact.

---

## 9. Conclusion & Expected Impact

This proposal establishes a **Real-Sheet First** music authoring experience:
- **Zero Learning Curve**: Anyone familiar with physical songbooks can immediately understand key signatures, time signatures, and note positions without learning complex DAW track paradigms.
- **Doubled Authoring Speed**: With the direct score caret and keyboard typing engine, notation entry is fast and fluid.
- **Publication Grade Presentation**: The resulting sheet music achieves publication-level elegance on desktop screens, iPad tablets, and physical printouts.
- **Clear International UI with Preserved Cultural Repertoire**: A fully standardized English UI provides clean, intuitive accessibility, while song titles and lyrics remain authentically preserved in their native language.
