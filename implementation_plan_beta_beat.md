# Implementation Plan - Beta Beat "Samply-Style" Redesign

## Goal
Transform the current "Beta Beat" album player into a professional, "Samply-inspired" audio review tool. This involves improving the visual player, adding precise timestamped comments, and enhancing the overall playback experience without external costs.

## Core Features to Implement (Samply Clones)
1.  **"Master Player" Layout**: Instead of multiple small players, the modal will feature one large, high-fidelity waveform player at the top, with the playlist (tracks) below.
2.  **True Timestamped Comments**: 
    - Comments will capture the exact second of playback.
    - Clicking a comment will instantly jump the player to that specific moment.
    - Visual markers (simple dots) on the timeline for comments.
3.  **Seamless Navigation**: "Previous" and "Next" track buttons.
4.  **Lossless/Gapless Feel**: Preload visualizer and audio state for smoother transitions.

## Technical Changes

### 1. `beta.html` Structure
- Relocate the `#albumDetail` container to support a split view:
    - **Top Fixed Area**: Large Waveform, Transport Controls (Play, Prev, Next), Time Display.
    - **Bottom Scroll Area**: Track list, Comments list for current track.

### 2. `src/beta.js` Logic Refactoring
- **State Management**: Introduce `currentTrackIndex` state variables.
- **WaveSurfer Singleton**: Instead of creating 10+ WaveSurfer instances (one per track), we will use **ONE** high-performance instance that loads the active track. This drastically improves performance.
- **Comment Logic**:
    - Update `addComment()` to fetch `wavesurfer.getCurrentTime()`.
    - Update comment display to show timestamps (e.g., `1:24`).
    - Add `onclick` to comments to trigger `wavesurfer.setTime()`.

### 3. Visuals (`src/beta.css`)
- **Waveform Styling**: Use a gradient color for the waveform (Orange to Red) to mimic premium apps.
- **Player Controls**: Larger, accessible SVG icons for controls.
- **Input Area**: A "Chat-style" input at the bottom of the player for quick feedback during playback.

## Verification Checklist (Agent C)
- [ ] Smart Links section remains 100% untouched.
- [ ] "Owner" uploads still work correctly.
- [ ] No costs incurred (uses existing Firebase/Wavesurfer).
- [ ] "Tester" experience feels significantly more premium.

## Step-by-Step Execution
1.  **Refactor JS**: rewrite `window.openAlbum` to initialize the "Single Player" view.
2.  **Update CSS**: formatting the new player layout.
3.  **Enhance Logic**: Add timestamp capture and seeking.
