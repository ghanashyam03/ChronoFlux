/**
 * @file GlossaryModal.tsx
 * Accessible contextual glossary explaining technical terms in plain English.
 */

import React, { useState } from 'react';
import { X, Search, BookOpen, Compass } from 'lucide-react';
import { GLOSSARY_TERMS } from '../state/presets.js';

interface GlossaryModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initialCategory?: 'all' | 'solar' | 'civil' | 'intervals' | 'engine';
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'all',
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'solar' | 'civil' | 'intervals' | 'engine'>(
    initialCategory
  );
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredTerms = GLOSSARY_TERMS.filter((item) => {
    const matchesCat = category === 'all' || item.category === category;
    const matchesSearch =
      search.trim() === '' ||
      item.term.toLowerCase().includes(search.toLowerCase()) ||
      item.simpleExplanation.toLowerCase().includes(search.toLowerCase()) ||
      item.detailedExplanation.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-title"
    >
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="glossary-title" className="text-xl font-semibold text-slate-100 tracking-tight">
                TIME 2.0 Plain-Language Glossary
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Understand everyday concepts, astronomical terms, and computational principles.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close glossary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search concepts, terms, or definitions..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'solar', label: 'Sun & Sky' },
              { id: 'civil', label: 'Clock & Timezone' },
              { id: 'intervals', label: 'Intervals' },
              { id: 'engine', label: 'Engine' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  category === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Glossary Terms List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredTerms.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Compass className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No terms match your search query.</p>
            </div>
          ) : (
            filteredTerms.map((termItem) => {
              const isExpanded = expandedTerm === termItem.term;
              return (
                <div
                  key={termItem.term}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-100">{termItem.term}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700/60">
                          {termItem.category}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                        {termItem.simpleExplanation}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedTerm(isExpanded ? null : termItem.term)}
                      className="px-2.5 py-1 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/10 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isExpanded ? 'Less' : 'Deep Dive'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed font-mono bg-slate-900/60 p-3 rounded-lg">
                      <strong className="text-indigo-300 block mb-1">Technical & Mathematical Specification:</strong>
                      {termItem.detailedExplanation}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>TIME 2.0 Architectural Glossary</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
