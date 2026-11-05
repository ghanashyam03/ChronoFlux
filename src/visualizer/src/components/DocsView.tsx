/**
 * @file DocsView.tsx
 * TIME 2.0 Three-Layer In-App Documentation Viewer.
 * Layer 1: Learn TIME 2.0 (Beginners)
 * Layer 2: Explore & Understand (Researchers & Astronomy Enthusiasts)
 * Layer 3: Developer Reference & SDK (Engineers)
 */

import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Search,
  Check,
  Copy,
  ChevronRight,
  Sun,
  Terminal,
  HelpCircle,
} from 'lucide-react';

interface DocsViewProps {
  readonly onOpenGlossary?: () => void;
  readonly onSwitchTab?: (tab: 'home' | 'explore' | 'visualize' | 'build' | 'docs') => void;
}

type DocLayer = 'layer1' | 'layer2' | 'layer3';

export const DocsView: React.FC<DocsViewProps> = ({ onOpenGlossary, onSwitchTab }) => {
  const [activeLayer, setActiveLayer] = useState<DocLayer>('layer1');
  const [activeSectionId, setActiveSectionId] = useState<string>('intro');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="docs-container" style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* 1. Header & Layer Selector */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '9999px', fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '8px' }}>
              <BookOpen size={13} />
              <span>TIME 2.0 Complete Knowledge Base</span>
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#f8fafc', margin: 0 }}>
              Documentation & Guides
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px', maxWidth: '720px' }}>
              Choose your depth: from plain-language beginner fundamentals to astronomical science models and strict TypeScript SDK integration.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onOpenGlossary && (
              <button
                onClick={onOpenGlossary}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <HelpCircle size={15} color="var(--accent-cyan)" />
                <span>Open Glossary</span>
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics..."
                style={{
                  padding: '8px 12px 8px 32px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  width: '200px',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Layer Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <button
            onClick={() => { setActiveLayer('layer1'); setActiveSectionId('intro'); }}
            style={{
              padding: '16px',
              background: activeLayer === 'layer1' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.5)',
              border: `1.5px solid ${activeLayer === 'layer1' ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
              borderRadius: '12px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sun size={18} color="var(--accent-cyan)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: activeLayer === 'layer1' ? 'var(--accent-cyan)' : '#f8fafc' }}>
                Layer 1: Learn TIME 2.0
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              For Beginners — Plain English explanations, visual concepts, and FAQ.
            </div>
          </button>

          <button
            onClick={() => { setActiveLayer('layer2'); setActiveSectionId('ephemeris'); }}
            style={{
              padding: '16px',
              background: activeLayer === 'layer2' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(15, 23, 42, 0.5)',
              border: `1.5px solid ${activeLayer === 'layer2' ? '#a855f7' : 'var(--border-color)'}`,
              borderRadius: '12px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Compass size={18} color="#c084fc" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: activeLayer === 'layer2' ? '#c084fc' : '#f8fafc' }}>
                Layer 2: Science & Architecture
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              For Researchers — Meeus/NOAA ephemeris, refraction, DST, and Allen algebra.
            </div>
          </button>

          <button
            onClick={() => { setActiveLayer('layer3'); setActiveSectionId('sdk-quickstart'); }}
            style={{
              padding: '16px',
              background: activeLayer === 'layer3' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(15, 23, 42, 0.5)',
              border: `1.5px solid ${activeLayer === 'layer3' ? '#22c55e' : 'var(--border-color)'}`,
              borderRadius: '12px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Terminal size={18} color="#4ade80" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: activeLayer === 'layer3' ? '#4ade80' : '#f8fafc' }}>
                Layer 3: Developer Reference & SDK
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              For Engineers — npm package, strict TypeScript APIs, Condition AST, and recipes.
            </div>
          </button>
        </div>
      </div>

      {/* 2. Main Documentation Body: Sidebar Navigation + Content Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Navigation Sidebar */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', position: 'sticky', top: '20px' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '12px' }}>
            {activeLayer === 'layer1' && 'Beginner Guide'}
            {activeLayer === 'layer2' && 'Science & Math'}
            {activeLayer === 'layer3' && 'SDK Reference'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {activeLayer === 'layer1' && (
              <>
                <button
                  onClick={() => setActiveSectionId('intro')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'intro' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: activeSectionId === 'intro' ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>1. What is TIME 2.0?</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('quick-steps')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'quick-steps' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: activeSectionId === 'quick-steps' ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>2. How to Use in 3 Steps</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('core-concepts')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'core-concepts' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: activeSectionId === 'core-concepts' ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>3. Plain-Language Concepts</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('faq')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'faq' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: activeSectionId === 'faq' ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>4. Frequently Asked Questions</span>
                  <ChevronRight size={14} />
                </button>
              </>
            )}

            {activeLayer === 'layer2' && (
              <>
                <button
                  onClick={() => setActiveSectionId('ephemeris')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'ephemeris' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                    color: activeSectionId === 'ephemeris' ? '#c084fc' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>1. Meeus / NOAA Ephemeris</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('refraction')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'refraction' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                    color: activeSectionId === 'refraction' ? '#c084fc' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>2. Atmospheric Refraction & Horizon</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('twilights')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'twilights' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                    color: activeSectionId === 'twilights' ? '#c084fc' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>3. Twilights vs Polar Regimes</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('dst')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'dst' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                    color: activeSectionId === 'dst' ? '#c084fc' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>4. Civil Calendar & DST Fallback</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('allen-algebra')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'allen-algebra' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                    color: activeSectionId === 'allen-algebra' ? '#c084fc' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>5. Allen Interval Algebra</span>
                  <ChevronRight size={14} />
                </button>
              </>
            )}

            {activeLayer === 'layer3' && (
              <>
                <button
                  onClick={() => setActiveSectionId('sdk-quickstart')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'sdk-quickstart' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                    color: activeSectionId === 'sdk-quickstart' ? '#4ade80' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>1. Installation & Quickstart</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('sdk-facade')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'sdk-facade' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                    color: activeSectionId === 'sdk-facade' ? '#4ade80' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>2. Time Facade API Reference</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('condition-ast')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'condition-ast' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                    color: activeSectionId === 'condition-ast' ? '#4ade80' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>3. Conditions AST & Resolver</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setActiveSectionId('migration')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: activeSectionId === 'migration' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                    color: activeSectionId === 'migration' ? '#4ade80' : 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>4. Migration from ChronoFlux</span>
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Panel */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '28px', color: '#e2e8f0', minHeight: '600px' }}>
          
          {/* LAYER 1 SECTIONS */}
          {activeLayer === 'layer1' && activeSectionId === 'intro' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Beginner Guide — Section 1
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                What is TIME 2.0 and why does it exist?
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '16px' }}>
                Standard clocks only tell you what time it is right now on a wall. But in the real physical world, time is continuous, geographical, and multifaceted:
              </p>
              <ul style={{ lineHeight: 1.8, fontSize: '0.95rem', color: '#cbd5e1', paddingLeft: '20px', marginBottom: '24px' }}>
                <li><strong>The Sun doesn't care about clocks:</strong> Sunrise and sunset change every day, at every latitude, and at every elevation.</li>
                <li><strong>Golden hour and twilight aren't fixed numbers:</strong> At the equator, twilight is brief; in the Arctic summer, twilight can last all night.</li>
                <li><strong>Human clocks make jumps:</strong> Daylight Saving Time causes clocks to jump forward (skipping an hour) or fall back (repeating an entire hour).</li>
                <li><strong>Modern apps need answers, not equations:</strong> Solar panels need to know when solar elevation exceeds 30°; photographers want golden hour on a weekend; flight plans need twilight times.</li>
              </ul>

              <div style={{ padding: '16px 20px', background: 'rgba(56, 189, 248, 0.08)', borderLeft: '4px solid var(--accent-cyan)', borderRadius: '6px', marginBottom: '24px' }}>
                <strong style={{ color: 'var(--accent-cyan)' }}>Single-sentence definition:</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: '#e2e8f0' }}>
                  <strong>TIME 2.0</strong> is a universal temporal engine that answers questions like <em>"When is the sun above 15° while the local clock is between 9 AM and 5 PM on a weekday?"</em> by calculating exact physical time intervals for any location on Earth.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                {onSwitchTab && (
                  <button
                    onClick={() => onSwitchTab('explore')}
                    style={{
                      padding: '10px 18px',
                      background: 'var(--accent-cyan)',
                      color: '#090d16',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Try Simple Explore Mode &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

          {activeLayer === 'layer1' && activeSectionId === 'quick-steps' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Beginner Guide — Section 2
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                How to use this tool in 3 simple steps
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '6px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>1</span>
                    <span>Pick Where You Are (Location)</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    Select a city or enter custom latitude and longitude coordinates. The engine uses this location to calculate the sun's position and the local timezone.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--solar-daylight)', fontWeight: 700, marginBottom: '6px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(251, 191, 36, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>2</span>
                    <span>Pick What You Care About (Conditions)</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    In <strong>Explore Mode</strong>, click an everyday question like "When is golden hour?" or "When is the sun highest today?". In <strong>Build Conditions</strong>, compose your own rules combining sun height and clock times.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontWeight: 700, marginBottom: '6px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>3</span>
                    <span>Get Exact Time Windows (Intervals)</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    The engine finds every time interval where all conditions are met. You can see the start time, end time, duration, and even copy the code to automate your app.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeLayer === 'layer1' && activeSectionId === 'core-concepts' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Beginner Guide — Section 3
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Plain-Language Concepts
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-cyan)', margin: '0 0 6px 0' }}>
                    What is a Time Interval?
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    A time interval is a continuous span of time with a clear start and end (for example, from 2:00 PM to 4:30 PM). TIME 2.0 uses <strong>half-open intervals</strong> written as <code>[start, end)</code>. The start is included, but the end is open. This mathematical standard guarantees that two adjacent intervals meet smoothly without any double-counting or gaps!
                  </p>
                </div>

                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--solar-daylight)', margin: '0 0 6px 0' }}>
                    What is Solar Elevation?
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    Solar elevation is how high the sun appears in the sky above the horizon, measured in degrees. When the sun is directly on the horizon, elevation is 0°. Directly overhead is +90°. Deep night is negative (e.g. -20°).
                  </p>
                </div>

                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#c084fc', margin: '0 0 6px 0' }}>
                    What are the Twilight Phases?
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    When the sun dips just below the horizon, scattered sunlight keeps the sky bright:
                  </p>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.7 }}>
                    <li><strong>Civil Twilight (0° to -6°):</strong> Plenty of light to read outdoors without artificial lighting.</li>
                    <li><strong>Nautical Twilight (-6° to -12°):</strong> The horizon is still faintly visible for ships at sea, and bright stars appear.</li>
                    <li><strong>Astronomical Twilight (-12° to -18°):</strong> The faintest glow before true, completely dark night.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeLayer === 'layer1' && activeSectionId === 'faq' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Beginner Guide — Section 4
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Frequently Asked Questions
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#f8fafc', margin: '0 0 6px 0' }}>
                    Why is solar noon different from 12:00 PM on my clock?
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    Clocks use standardized civil time zones that stretch across hundreds of miles. But solar noon is when the sun reaches its highest point in your exact sky. Because Earth's orbit is slightly elliptical and its axis is tilted, solar noon can differ from 12:00 PM by up to 16 minutes (known as the Equation of Time), plus whatever timezone offset offset your city has.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#f8fafc', margin: '0 0 6px 0' }}>
                    Does TIME 2.0 need an internet connection to run?
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    No! The core TIME 2.0 engine has <strong>zero production runtime dependencies</strong>. All astronomical algorithms and civil calendar arithmetic run locally in pure TypeScript, whether in your browser, in Node.js, or on edge servers.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#f8fafc', margin: '0 0 6px 0' }}>
                    What happens during Daylight Saving Time fall-back when 1:00 AM happens twice?
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    TIME 2.0 provides deterministic disambiguation policies! When resolving conditions across an ambiguous autumn transition, it produces valid physical intervals without dropping either the first or second physical occurrence.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* LAYER 2 SECTIONS */}
          {activeLayer === 'layer2' && activeSectionId === 'ephemeris' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Science & Architecture — Section 1
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Meeus / NOAA Astronomical Ephemeris Model
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.92rem', color: '#cbd5e1', marginBottom: '16px' }}>
                TIME 2.0 implements the rigorous Jean Meeus / NOAA solar position algorithm. This provides sub-arcminute accuracy (angular error &lt; 0.02° or ~1.2 arcminutes) across the era from 2000 BCE to 3000 CE.
              </p>

              <div style={{ padding: '16px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#c084fc', fontSize: '0.9rem' }}>Computational Pipeline:</h4>
                <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.7 }}>
                  <li><strong>Time Coordinate:</strong> Julian Day and Julian Century from TT / UT1 time scales.</li>
                  <li><strong>Geometric Mean Longitude:</strong> \(L_0 = 280.46646 + 36000.76983 \cdot T\).</li>
                  <li><strong>Mean Anomaly:</strong> \(M = 357.52911 + 35999.05029 \cdot T\).</li>
                  <li><strong>Equation of Center:</strong> Eccentricity correction to true solar longitude.</li>
                  <li><strong>Apparent Declination:</strong> Incorporating nutation and true obliquity of the ecliptic.</li>
                  <li><strong>Greenwich Hour Angle (GHA) & Equation of Time (EoT):</strong> Exact difference between apparent solar time and mean civil time.</li>
                </ol>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', borderLeft: '3px solid #c084fc', borderRadius: '4px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <strong>Important Distinction:</strong> Numerical condition solver tolerance (&lt; 10⁻⁵° root residual) measures mathematical convergence of the Brent-Dekker solver, while physical model uncertainty (± 0.025°) reflects ephemeris approximations and atmospheric variations.
              </div>
            </div>
          )}

          {activeLayer === 'layer2' && activeSectionId === 'refraction' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Science & Architecture — Section 2
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Atmospheric Refraction & Observer Elevation
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.92rem', color: '#cbd5e1', marginBottom: '16px' }}>
                As sunlight passes through Earth's atmosphere, it bends downward towards the observer, causing the sun to appear higher than its geometric position.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '0.9rem' }}>Bennett's Refraction Formula</h4>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    Standard atmospheric refraction at sea level (1010 hPa, 10°C):
                    <br />
                    <code>R = 1.02 / tan(h + 10.3 / (h + 5.11))</code> arcminutes.
                    <br />
                    At the horizon (\(h = 0^\circ\)), refraction lifts the solar disc by approximately <strong>34 arcminutes (0.5667°)</strong>.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '0.9rem' }}>Observer Elevation & Horizon Dip</h4>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    For an observer at altitude \(H\) meters above the local geoid:
                    <br />
                    <code>dip = 1.17 * sqrt(H)</code> arcminutes.
                    <br />
                    This lowers the apparent geometric horizon, causing earlier sunrises and later sunsets for mountain or airborne observers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeLayer === 'layer2' && activeSectionId === 'twilights' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Science & Architecture — Section 3
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Twilights vs Polar Regimes
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.92rem', color: '#cbd5e1', marginBottom: '16px' }}>
                In TIME 2.0, <strong>SolarPhase</strong> (instantaneous elevation zone) is strictly decoupled from <strong>PolarRegimeType</strong> (24-hour diurnal crossing regime).
              </p>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#f8fafc', fontSize: '0.95rem', marginBottom: '8px' }}>1. Instantaneous Solar Phase Thresholds</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '0.82rem' }}>
                  <div style={{ padding: '10px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '6px' }}>
                    <div style={{ color: 'var(--solar-daylight)', fontWeight: 700 }}>Daylight</div>
                    <div>&gt; -0.833°</div>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px' }}>
                    <div style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>Civil Twilight</div>
                    <div>-6° to -0.833°</div>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '6px' }}>
                    <div style={{ color: '#818cf8', fontWeight: 700 }}>Nautical Twilight</div>
                    <div>-12° to -6°</div>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '6px' }}>
                    <div style={{ color: '#c084fc', fontWeight: 700 }}>Astronomical</div>
                    <div>-18° to -12°</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ color: '#f8fafc', fontSize: '0.95rem', marginBottom: '8px' }}>2. Polar Regimes (24-Hour Classification)</h4>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0, lineHeight: 1.6 }}>
                  Near Earth's poles, the sun may never cross the horizon over a 24-hour period. TIME 2.0 classifies these into:
                  <strong> DIURNAL</strong> (standard sunrise/sunset),
                  <strong> MIDNIGHT_SUN</strong> (sun never sets, elevation &gt; -0.833°),
                  <strong> POLAR_NIGHT</strong> (sun never rises, elevation &lt; -18°), and
                  <strong> POLAR_TWILIGHT</strong> (continuous twilight without sunrise).
                </p>
              </div>
            </div>
          )}

          {activeLayer === 'layer2' && activeSectionId === 'dst' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Science & Architecture — Section 4
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Civil Calendar & Deterministic DST Disambiguation
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.92rem', color: '#cbd5e1', marginBottom: '16px' }}>
                Standard JavaScript <code>Date</code> has well-documented historical bugs with Daylight Saving Time transitions and dates before 1970. TIME 2.0 solves these through an IANA-compliant civil model.
              </p>

              <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '0.9rem' }}>Disambiguation Policies for Ambiguous Wall-Clock Instants</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.7 }}>
                  <li><strong>'earlier':</strong> Returns the first physical occurrence (before the clock setback).</li>
                  <li><strong>'later':</strong> Returns the second physical occurrence (after the clock setback).</li>
                  <li><strong>'compatible':</strong> Follows standard RFC 5545 / ISO conventions.</li>
                  <li><strong>'reject':</strong> Throws an explicit typed error if an ambiguous or nonexistent time is requested.</li>
                </ul>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}>
                <strong>Zero-Year & Pre-1970 Stability:</strong> Proleptic Gregorian 400-year cycle shifting guarantees exact leap-day arithmetic and offset computation for ancient historical dates (e.g. Year 0 / 1 BCE) without V8/SpiderMonkey engine inconsistencies.
              </div>
            </div>
          )}

          {activeLayer === 'layer2' && activeSectionId === 'allen-algebra' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Science & Architecture — Section 5
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Allen's Interval Algebra & Set Operations
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.92rem', color: '#cbd5e1', marginBottom: '16px' }}>
                TIME 2.0 implements James F. Allen's 13 definitive temporal interval relations (1983) to inspect relationships between any two physical intervals:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.82rem', marginBottom: '20px' }}>
                <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <strong style={{ color: '#c084fc' }}>BEFORE / AFTER</strong>
                  <div style={{ color: '#94a3b8' }}>A ends strictly before B begins.</div>
                </div>
                <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <strong style={{ color: '#c084fc' }}>MEETS / MET_BY</strong>
                  <div style={{ color: '#94a3b8' }}>A ends exactly where B begins.</div>
                </div>
                <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <strong style={{ color: '#c084fc' }}>OVERLAPS / OVERLAPPED_BY</strong>
                  <div style={{ color: '#94a3b8' }}>A starts before B, but they intersect.</div>
                </div>
                <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <strong style={{ color: '#c084fc' }}>STARTS / STARTED_BY</strong>
                  <div style={{ color: '#94a3b8' }}>A and B share the exact start instant.</div>
                </div>
                <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <strong style={{ color: '#c084fc' }}>DURING / CONTAINS</strong>
                  <div style={{ color: '#94a3b8' }}>A is strictly enclosed inside B.</div>
                </div>
                <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <strong style={{ color: '#c084fc' }}>EQUALS</strong>
                  <div style={{ color: '#94a3b8' }}>A and B have identical boundaries.</div>
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '6px', fontSize: '0.85rem' }}>
                All boolean compositions (<code>AND</code>, <code>OR</code>, <code>NOT</code>) are resolved into canonical, non-overlapping disjoint sets of half-open intervals via exact <code>IntervalSet</code> operations.
              </div>
            </div>
          )}

          {/* LAYER 3 SECTIONS */}
          {activeLayer === 'layer3' && activeSectionId === 'sdk-quickstart' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Developer Reference — Section 1
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Installation & Quickstart
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.92rem', color: '#cbd5e1', marginBottom: '16px' }}>
                Install the official package from npm. It has <strong>zero runtime dependencies</strong> and bundles full TypeScript declarations for Node, Deno, Bun, and modern browsers:
              </p>

              {/* Install Code Block */}
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <pre style={{ margin: 0, padding: '14px 18px', background: 'rgba(10, 15, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#a5f3fc', fontSize: '0.88rem', fontFamily: 'monospace' }}>
                  npm install time-2.0
                </pre>
                <button
                  onClick={() => handleCopyCode('install-cmd', 'npm install time-2.0')}
                  style={{ position: 'absolute', right: '10px', top: '10px', padding: '4px 8px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '4px', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                >
                  {copiedCodeId === 'install-cmd' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  <span>{copiedCodeId === 'install-cmd' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <h4 style={{ color: '#f8fafc', fontSize: '0.95rem', marginBottom: '8px' }}>Runnable TypeScript Quickstart:</h4>
              <div style={{ position: 'relative' }}>
                <pre style={{ margin: 0, padding: '16px', background: 'rgba(10, 15, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#cbd5e1', fontSize: '0.82rem', fontFamily: 'monospace', lineHeight: 1.6, overflowX: 'auto' }}>
{`import { Time, Conditions } from 'time-2.0';

// 1. Define an observer location (Tokyo, Japan)
const tokyo = Time.place({
  latitude: 35.6762,
  longitude: 139.6503,
  timeZoneId: 'Asia/Tokyo',
});

// 2. Define a search window (Next 24 hours)
const now = Time.now();
const window = Time.interval(now, Time.duration.ofHours(24));

// 3. Resolve when solar elevation > 15° during business hours
const result = Time.resolve({
  place: tokyo,
  within: window,
  where: Conditions.and(
    Conditions.solar.elevation.gte(15),
    Conditions.civil.hour.gte(9),
    Conditions.civil.hour.lt(17)
  ),
});

console.log(\`Found \${result.intervals.length} matching intervals\`);
for (const interval of result.intervals) {
  console.log(\`  Start: \${interval.start.toUtcIso()}\`);
  console.log(\`  End:   \${interval.end.toUtcIso()}\`);
  console.log(\`  Duration: \${interval.duration.toMinutes().toFixed(1)} mins\`);
}`}
                </pre>
                <button
                  onClick={() => handleCopyCode('quickstart-code', `import { Time, Conditions } from 'time-2.0';\n\nconst tokyo = Time.place({\n  latitude: 35.6762,\n  longitude: 139.6503,\n  timeZoneId: 'Asia/Tokyo',\n});\n\nconst now = Time.now();\nconst window = Time.interval(now, Time.duration.ofHours(24));\n\nconst result = Time.resolve({\n  place: tokyo,\n  within: window,\n  where: Conditions.and(\n    Conditions.solar.elevation.gte(15),\n    Conditions.civil.hour.gte(9),\n    Conditions.civil.hour.lt(17)\n  ),\n});`)}
                  style={{ position: 'absolute', right: '12px', top: '12px', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '4px', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                >
                  {copiedCodeId === 'quickstart-code' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  <span>{copiedCodeId === 'quickstart-code' ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
          )}

          {activeLayer === 'layer3' && activeSectionId === 'sdk-facade' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Developer Reference — Section 2
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Time Facade API Reference
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <code style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', fontWeight: 600 }}>Time.instant(iso | epochMs | bigint)</code>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Creates a physical <code>Instant</code> anchored by signed 64-bit nanoseconds (<code>epochNanoseconds: bigint</code>) since the Unix epoch.
                  </p>
                </div>

                <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <code style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', fontWeight: 600 }}>Time.place({`{ latitude, longitude, elevationMeters?, timeZoneId? }`})</code>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Constructs an immutable <code>Place</code> on the WGS84 ellipsoid with coordinate validation.
                  </p>
                </div>

                <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <code style={{ color: 'var(--solar-daylight)', fontSize: '0.9rem', fontWeight: 600 }}>Time.solar.position(place, instant)</code>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Calculates full instantaneous solar coordinates: elevation, azimuth, hour angle, declination, right ascension, and solar noon.
                  </p>
                </div>

                <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <code style={{ color: '#4ade80', fontSize: '0.9rem', fontWeight: 600 }}>Time.resolve({`{ place, within, where, policy? }`})</code>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Executes the continuous condition solver. Returns <code>{`{ intervals, allMatchingIntervals, report }`}</code> with mathematical convergence provenance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeLayer === 'layer3' && activeSectionId === 'condition-ast' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Developer Reference — Section 3
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Condition AST & Solver Operators
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.92rem', color: '#cbd5e1', marginBottom: '16px' }}>
                The Condition AST is a serializable, strongly typed tree representing temporal predicates. Conditions are never opaque closures; they are inspectable and optimizable:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <strong style={{ color: 'var(--accent-cyan)' }}>Solar Target Fields:</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                    <li><code>Conditions.solar.elevation</code> (deg)</li>
                    <li><code>Conditions.solar.azimuth</code> (deg, 0° = N)</li>
                    <li><code>Conditions.solar.declination</code> (deg)</li>
                  </ul>
                </div>

                <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <strong style={{ color: 'var(--solar-daylight)' }}>Civil Target Fields:</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                    <li><code>Conditions.civil.hour</code> (0..23)</li>
                    <li><code>Conditions.civil.minute</code> (0..59)</li>
                    <li><code>Conditions.civil.dayOfWeek</code> (1=Mon..7=Sun)</li>
                    <li><code>Conditions.civil.isWeekend</code> (boolean)</li>
                  </ul>
                </div>
              </div>

              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <strong style={{ color: '#4ade80' }}>Boolean Combinators:</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <code>Conditions.and(...conds)</code>, <code>Conditions.or(...conds)</code>, <code>Conditions.not(cond)</code>.
                </p>
              </div>
            </div>
          )}

          {activeLayer === 'layer3' && activeSectionId === 'migration' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Developer Reference — Section 4
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 16px 0' }}>
                Migrating from ChronoFlux to TIME 2.0
              </h2>
              <p style={{ lineHeight: 1.7, fontSize: '0.92rem', color: '#cbd5e1', marginBottom: '16px' }}>
                TIME 2.0 provides <strong>100% backwards compatibility</strong> with ChronoFlux. <code>ChronoFlux</code> is exported as an exact alias of <code>Time</code>:
              </p>

              <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '20px' }}>
                <pre style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}>
{`// Legacy ChronoFlux code:
import { ChronoFlux } from '@chronoflux/core';
const inst = ChronoFlux.instant('2026-06-21T12:00:00Z');

// Modern TIME 2.0 code:
import { Time } from 'time-2.0';
const inst = Time.instant('2026-06-21T12:00:00Z');

// Both work identically:
console.assert(ChronoFlux === Time); // true!`}
                </pre>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '6px', fontSize: '0.85rem', color: '#e2e8f0' }}>
                To migrate your dependencies, update your <code>package.json</code>:
                <br />
                <code>{'"dependencies": { "time-2.0": "^0.1.0" }'}</code>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DocsView;
