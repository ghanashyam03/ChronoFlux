/**
 * @file Header.tsx
 * TIME 2.0 Top Navigation Bar & Global Temporal Controller.
 * Supports 5 navigation tabs, Simple vs Advanced mode switch,
 * contextual Glossary trigger, presets, and live simulation controls.
 */

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  MapPin,
  Calendar,
  Clock,
  Compass,
  Home,
  Sliders,
  BookOpen,
  HelpCircle,
  Eye,
  Sparkles,
} from 'lucide-react';
import type { TemporalStateHook } from '../state/useTemporalState.js';
import { LOCATION_PRESETS, DATE_PRESETS } from '../state/presets.js';
import { formatUtcIso, formatCivilDateTime } from '../utils/timeline.js';
import type { PlaybackSpeed, SearchWindowDuration, AppTab, UserMode } from '../types.js';

interface HeaderProps {
  readonly state: TemporalStateHook;
  readonly activeTab: AppTab;
  readonly onTabChange: (tab: AppTab) => void;
  readonly userMode: UserMode;
  readonly onUserModeChange: (mode: UserMode) => void;
  readonly onOpenGlossary: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  activeTab,
  onTabChange,
  userMode,
  onUserModeChange,
  onOpenGlossary,
}) => {
  const {
    activeInstant,
    selectedPlace,
    selectedLocationPreset,
    searchWindowDuration,
    isPlaying,
    playbackSpeed,
    togglePlay,
    stepBackward,
    stepForward,
    resetToNow,
    selectLocationPreset,
    setActiveInstant,
    setSearchWindowDuration,
    setPlaybackSpeed,
  } = state;

  return (
    <header className="header-bar" style={{ display: 'flex', flexDirection: 'column', gap: '0px', padding: 0 }}>
      {/* Upper Bar: Brand, Navigation Tabs, Mode Switch & Glossary */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(9, 13, 22, 0.95)',
          backdropFilter: 'blur(12px)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Brand */}
        <div
          onClick={() => onTabChange('home')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          title="TIME 2.0 Home"
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              color: '#090d16',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.35)',
            }}
          >
            T2
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                TIME 2.0
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                ENGINE
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1 }}>
              Universal Temporal Engine
            </div>
          </div>
        </div>

        {/* 5 Main Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(15, 23, 42, 0.6)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={() => onTabChange('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'home' ? 600 : 500,
              color: activeTab === 'home' ? '#38bdf8' : '#94a3b8',
              background: activeTab === 'home' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Home size={14} />
            <span>Home</span>
          </button>

          <button
            onClick={() => {
              onTabChange('explore');
              onUserModeChange('simple');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'explore' ? 600 : 500,
              color: activeTab === 'explore' ? '#fbbf24' : '#94a3b8',
              background: activeTab === 'explore' ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={14} />
            <span>Explore (Simple)</span>
          </button>

          <button
            onClick={() => {
              onTabChange('visualize');
              onUserModeChange('advanced');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'visualize' ? 600 : 500,
              color: activeTab === 'visualize' ? '#c084fc' : '#94a3b8',
              background: activeTab === 'visualize' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Eye size={14} />
            <span>Visualize (Advanced)</span>
          </button>

          <button
            onClick={() => onTabChange('build')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'build' ? 600 : 500,
              color: activeTab === 'build' ? '#4ade80' : '#94a3b8',
              background: activeTab === 'build' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Sliders size={14} />
            <span>Build Conditions</span>
          </button>

          <button
            onClick={() => onTabChange('docs')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'docs' ? 600 : 500,
              color: activeTab === 'docs' ? '#38bdf8' : '#94a3b8',
              background: activeTab === 'docs' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <BookOpen size={14} />
            <span>Docs</span>
          </button>
        </nav>

        {/* Mode Switch & Glossary Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Mode Switch: Simple / Advanced */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '2px',
            }}
          >
            <button
              onClick={() => {
                onUserModeChange('simple');
                if (activeTab === 'visualize') onTabChange('explore');
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: userMode === 'simple' ? 700 : 500,
                color: userMode === 'simple' ? '#090d16' : '#94a3b8',
                background: userMode === 'simple' ? '#fbbf24' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Simple Mode
            </button>
            <button
              onClick={() => {
                onUserModeChange('advanced');
                if (activeTab === 'explore') onTabChange('visualize');
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: userMode === 'advanced' ? 700 : 500,
                color: userMode === 'advanced' ? '#090d16' : '#94a3b8',
                background: userMode === 'advanced' ? '#c084fc' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Advanced Mode
            </button>
          </div>

          {/* Glossary Button */}
          <button
            onClick={onOpenGlossary}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              color: '#38bdf8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Open Plain-Language Glossary"
          >
            <HelpCircle size={14} />
            <span>Glossary</span>
          </button>
        </div>
      </div>

      {/* Lower Bar: Location / Date Presets, Playback Simulation & Telemetry Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 24px',
          background: 'rgba(15, 23, 42, 0.85)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Location & Date Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} color="var(--accent-cyan)" />
            <select
              className="preset-select"
              value={selectedLocationPreset?.id ?? 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  selectLocationPreset(e.target.value);
                }
              }}
              title="Select observer reference location"
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            >
              {LOCATION_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}, {preset.country}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="var(--solar-daylight)" />
            <select
              className="preset-select"
              value=""
              onChange={(e) => {
                const found = DATE_PRESETS.find((p) => p.id === e.target.value);
                if (found) {
                  setActiveInstant(found.instant);
                }
              }}
              title="Jump to astronomical epoch preset"
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            >
              <option value="" disabled>
                Astronomical Epochs...
              </option>
              {DATE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Temporal Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className="btn-icon"
            onClick={() => stepBackward(3600)}
            title="Step backward 1 hour (-1h)"
            style={{
              padding: '5px 8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            <SkipBack size={13} />
          </button>

          <button
            className={`btn-icon ${isPlaying ? 'active' : ''}`}
            onClick={togglePlay}
            title={isPlaying ? 'Pause animation' : 'Play animation'}
            style={{
              padding: '5px 12px',
              background: isPlaying ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${isPlaying ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '6px',
              color: isPlaying ? 'var(--accent-cyan)' : '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            className="btn-icon"
            onClick={() => stepForward(3600)}
            title="Step forward 1 hour (+1h)"
            style={{
              padding: '5px 8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            <SkipForward size={13} />
          </button>

          <button
            className="btn-icon"
            onClick={resetToNow}
            title="Reset to current wall-clock instant"
            style={{
              padding: '5px 8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
          </button>

          {/* Speed Selector */}
          <select
            className="speed-select"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value) as PlaybackSpeed)}
            title="Simulation speed multiplier"
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '4px 6px',
              fontSize: '0.75rem',
            }}
          >
            <option value={1}>1×</option>
            <option value={60}>60× (1m/s)</option>
            <option value={600}>600× (10m/s)</option>
            <option value={3600}>3600× (1h/s)</option>
            <option value={86400}>86400× (1d/s)</option>
          </select>

          {/* Search Window Duration */}
          <select
            className="window-select"
            value={searchWindowDuration}
            onChange={(e) => setSearchWindowDuration(e.target.value as SearchWindowDuration)}
            title="Search window width"
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '4px 6px',
              fontSize: '0.75rem',
            }}
          >
            <option value="24h">Window: 24h</option>
            <option value="48h">Window: 48h</option>
            <option value="7d">Window: 7 Days</option>
          </select>
        </div>

        {/* Active Time Readout Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
            }}
          >
            <Clock size={12} color="var(--text-muted)" />
            <span style={{ color: '#94a3b8' }}>UTC:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{formatUtcIso(activeInstant)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
            }}
          >
            <Compass size={12} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--accent-cyan)' }}>Local:</span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
              {formatCivilDateTime(activeInstant, selectedPlace.timeZoneId)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
