import { forwardRef } from 'react';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRightLeft,
  ChevronRight,
  Download,
  FileCode2,
  Layers,
  Maximize,
  PanelLeft,
  Presentation,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useSettings } from '../settings';
import { Popover } from './Popover';
import { ThemePicker } from './ThemePicker';

function Sep() {
  return <span className="tb-sep" aria-hidden />;
}

/** Icon shortcuts under the menu bar, plus where you are: All files › file › route. */
export const Toolbar = forwardRef<HTMLInputElement, {
  fileFilter: string | null;
  drillTitle: string | null;
  onShowAllFiles: () => void;
  onBack: () => void;
  search: string;
  setSearch: (s: string) => void;
  onExport: () => void;
  onReset: () => void;
  onFit: () => void;
}>(function Toolbar(props, searchRef) {
  const s = useSettings();
  const fileName = props.fileFilter?.replace(/^uploaded\//, '');

  return (
    <div className="toolbar" role="toolbar" aria-label="Shortcuts">
      <div className="tb-left">
        <button
          className={`tb-btn ${s.showExplorer ? 'on' : ''}`}
          onClick={() => s.setShowExplorer(!s.showExplorer)}
          title="Explorer (E)"
          aria-label="Toggle explorer"
          aria-pressed={s.showExplorer}
        >
          <PanelLeft size={16} />
        </button>
        <nav className="breadcrumb" aria-label="Location">
          {props.drillTitle ? (
            <button className="crumb" onClick={props.onBack} title="Back to overview (Esc)">
              <ArrowLeft size={14} /> Overview
            </button>
          ) : (
            <button className={`crumb ${props.fileFilter ? '' : 'current'}`} onClick={props.onShowAllFiles} title="Show all files">
              <Layers size={14} /> All files
            </button>
          )}
          {props.fileFilter && !props.drillTitle && (
            <>
              <ChevronRight size={14} className="muted" />
              <span className="crumb current" title={props.fileFilter}>
                <FileCode2 size={14} /> {fileName}
                <button className="crumb-clear" onClick={props.onShowAllFiles} aria-label="Show all files" title="Show all files">
                  <X size={12} />
                </button>
              </span>
            </>
          )}
          {props.drillTitle && (
            <>
              <ChevronRight size={14} className="muted" />
              <span className="crumb current">{props.drillTitle}</span>
            </>
          )}
        </nav>
      </div>

      <div className="seg view-switch" role="radiogroup" aria-label="Detail level">
        <button role="radio" aria-checked={s.view === 'executive'} className={s.view === 'executive' ? 'on' : ''} onClick={() => s.setView('executive')} title="Executive view (V)">
          Executive
        </button>
        <button role="radio" aria-checked={s.view === 'technical'} className={s.view === 'technical' ? 'on' : ''} onClick={() => s.setView('technical')} title="Technical view (V)">
          Technical
        </button>
      </div>

      <div className="tb-right">
        <label className="search" title="Search (/)">
          <Search size={14} aria-hidden />
          <input ref={searchRef} placeholder="Search routes, systems…" value={props.search} onChange={(e) => props.setSearch(e.target.value)} aria-label="Search" />
        </label>
        <button
          className="tb-btn"
          onClick={() => s.setDirection(s.direction === 'LR' ? 'TB' : 'LR')}
          title={s.direction === 'LR' ? 'Layout: left → right (L)' : 'Layout: top → bottom (L)'}
          aria-label="Toggle layout direction"
        >
          {s.direction === 'LR' ? <ArrowRightLeft size={16} /> : <ArrowDownUp size={16} />}
        </button>
        <Popover button={<SlidersHorizontal size={16} />} label="Display options">
          <div className="menu">
            <div className="menu-title">Show</div>
            <label className="check">
              <input type="checkbox" checked={s.showSystems} onChange={(e) => s.setShowSystems(e.target.checked)} />
              External systems
            </label>
            <label className="check">
              <input type="checkbox" checked={s.showInternal} onChange={(e) => s.setShowInternal(e.target.checked)} />
              Internal steps (log, bean, dynamic…)
            </label>
            <label className="check">
              <input type="checkbox" checked={s.groupByFile} onChange={(e) => s.setGroupByFile(e.target.checked)} disabled={!!props.drillTitle} />
              Group routes by file
            </label>
            <label className="check">
              <input type="checkbox" checked={s.showMinimap} onChange={(e) => s.setShowMinimap(e.target.checked)} />
              Minimap
            </label>
            <label className="check">
              <input type="checkbox" checked={s.showLegend} onChange={(e) => s.setShowLegend(e.target.checked)} />
              Legend
            </label>
          </div>
        </Popover>
        <Sep />
        <button className="tb-btn" onClick={props.onFit} title="Fit to screen (0)" aria-label="Fit to screen">
          <Maximize size={16} />
        </button>
        <button className="tb-btn" onClick={props.onReset} title="Reset layout (forget moved cards)" aria-label="Reset layout">
          <RotateCcw size={16} />
        </button>
        <ThemePicker />
        <Sep />
        <button className="tb-btn" onClick={props.onExport} title="Export PNG…" aria-label="Export PNG">
          <Download size={16} />
        </button>
        <button className="tb-btn" onClick={() => s.setPresentation(true)} title="Presentation mode (P)" aria-label="Presentation mode">
          <Presentation size={16} />
        </button>
      </div>
    </div>
  );
});
