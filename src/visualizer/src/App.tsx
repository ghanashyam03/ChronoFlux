/**
 * @file App.tsx
 * TIME 2.0 Universal Temporal Engine & Diagnostic Console root application.
 * Integrates 5 top-level views: Home, Explore (Simple), Visualize (Advanced),
 * Build Conditions, and 3-Layer Docs, plus the contextual Glossary modal.
 */

import React, { useState } from 'react';
import { useTemporalState } from './state/useTemporalState.js';
import { Header } from './components/Header.js';
import { HomeView } from './components/HomeView.js';
import { ExploreView } from './components/ExploreView.js';
import { ConditionBuilderView } from './components/ConditionBuilderView.js';
import { DocsView } from './components/DocsView.js';
import { SolarCurve } from './components/SolarCurve.js';
import { RibbonView } from './components/RibbonView.js';
import { PlanetaryGlobe } from './components/PlanetaryGlobe.js';
import { StateReadout } from './components/StateReadout.js';
import { QueryConsole } from './components/QueryConsole.js';
import { GlossaryModal } from './components/GlossaryModal.js';
import type { AppTab, UserMode } from './types.js';

export const App: React.FC = () => {
  const temporalState = useTemporalState();
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [userMode, setUserMode] = useState<UserMode>('simple');
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* 1. Global Navigation & Temporal Controls Header */}
      <Header
        state={temporalState}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userMode={userMode}
        onUserModeChange={setUserMode}
        onOpenGlossary={() => setIsGlossaryOpen(true)}
      />

      {/* 2. Main Content Area Switcher */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* TAB 1: HOME VIEW */}
        {activeTab === 'home' && (
          <HomeView
            onNavigate={setActiveTab}
            onSelectLocation={temporalState.selectLocationPreset}
            onOpenGlossary={() => setIsGlossaryOpen(true)}
          />
        )}

        {/* TAB 2: EXPLORE (SIMPLE MODE) */}
        {activeTab === 'explore' && (
          <ExploreView
            onNavigateToVisualizer={() => {
              setUserMode('advanced');
              setActiveTab('visualize');
            }}
            onOpenGlossary={() => setIsGlossaryOpen(true)}
          />
        )}

        {/* TAB 3: VISUALIZE (ADVANCED DIAGNOSTIC CONSOLE) */}
        {activeTab === 'visualize' && (
          <div className="dashboard-grid" style={{ flex: 1, padding: '20px 24px' }}>
            {/* Left / Primary Column */}
            <section className="primary-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SolarCurve state={temporalState} />
              <RibbonView state={temporalState} />
              <QueryConsole state={temporalState} />
            </section>

            {/* Right / Secondary Column */}
            <section className="secondary-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <PlanetaryGlobe state={temporalState} />
              <StateReadout state={temporalState} />
            </section>
          </div>
        )}

        {/* TAB 4: BUILD CONDITIONS */}
        {activeTab === 'build' && (
          <ConditionBuilderView
            onOpenGlossary={() => setIsGlossaryOpen(true)}
          />
        )}

        {/* TAB 5: DOCUMENTATION & GUIDES */}
        {activeTab === 'docs' && (
          <DocsView
            onOpenGlossary={() => setIsGlossaryOpen(true)}
            onSwitchTab={setActiveTab}
          />
        )}
      </main>

      {/* 3. Global Contextual Glossary Modal */}
      <GlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />
    </div>
  );
};

export default App;
