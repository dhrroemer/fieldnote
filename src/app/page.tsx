'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  Map,
  Pencil,
  Plus,
  Search,
  Send,
  Sprout,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import type { FarmData, Harvest, Planting, Plot } from '@/lib/farm-store';

type View = 'overview' | 'plots' | 'plantings' | 'harvests';
type ModalMode = 'plot' | 'planting' | 'harvest' | null;
type EditingRecord = {
  type: Exclude<ModalMode, null>;
  record: Plot | Planting | Harvest;
};
type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
};

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] =
  [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'plots', label: 'Plot board', icon: Map },
    { id: 'plantings', label: 'Planting plan', icon: CalendarDays },
    { id: 'harvests', label: 'Harvest log', icon: ClipboardList },
  ];

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateOffsetString(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isValidDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatDate(value: string, includeWeekday = false) {
  return new Intl.DateTimeFormat('en', {
    weekday: includeWeekday ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function daysUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date(`${todayString()}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getPlantingStatus(planting: Planting): Planting['status'] {
  if (planting.status === 'harvested') return 'harvested';
  return planting.status === 'ready' || daysUntil(planting.expectedHarvest) <= 0
    ? 'ready'
    : 'growing';
}

function getPlotName(plotId: string, plots: Plot[]) {
  return plots.find((plot) => plot.id === plotId)?.name ?? 'Unassigned plot';
}

function getSeason() {
  const month = new Date().getMonth();
  const season =
    month >= 2 && month <= 4
      ? 'Spring'
      : month >= 5 && month <= 7
        ? 'Summer'
        : month >= 8 && month <= 10
          ? 'Autumn'
          : 'Winter';
  return `${season} ${new Date().getFullYear()}`;
}

export default function Home() {
  const [farm, setFarm] = useState<FarmData | null>(null);
  const [view, setView] = useState<View>('overview');
  const [modal, setModal] = useState<ModalMode>(null);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [editing, setEditing] = useState<EditingRecord | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantSending, setAssistantSending] = useState(false);
  const assistantEndRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadFarm() {
    const response = await fetch('/api/farm');
    if (!response.ok) throw new Error('Farm data could not be loaded.');
    setFarm((await response.json()) as FarmData);
  }

  useEffect(() => {
    fetch('/api/farm')
      .then((response) => {
        if (!response.ok) throw new Error('Farm data could not be loaded.');
        return response.json() as Promise<FarmData>;
      })
      .then(setFarm)
      .catch(() =>
        setError('Could not connect to the farm store. Refresh to try again.'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (assistantOpen) {
      assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [assistantMessages, assistantOpen, assistantSending]);

  async function askAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = assistantInput.trim();
    if (!message || assistantSending) return;
    setAssistantInput('');
    setAssistantMessages((current) => [...current, { role: 'user', content: message }]);
    setAssistantSending(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: assistantMessages
            .filter((item) => !item.error)
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      const result = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? 'De assistent kon niet antwoorden.');
      setAssistantMessages((current) => [
        ...current,
        { role: 'assistant', content: result.answer ?? '' },
      ]);
    } catch (assistantError) {
      setAssistantMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            assistantError instanceof Error
              ? assistantError.message
              : 'De assistent kon niet antwoorden.',
          error: true,
        },
      ]);
    } finally {
      setAssistantSending(false);
    }
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    if (modal === 'planting') {
      const plantedOn = String(payload.plantedOn ?? '');
      const expectedHarvest = String(payload.expectedHarvest ?? '');
      if (
        !isValidDateValue(plantedOn) ||
        !isValidDateValue(expectedHarvest) ||
        expectedHarvest < plantedOn
      ) {
        setError('Choose valid dates and set harvest on or after planting.');
        return;
      }
    }
    if (modal === 'harvest' && !isValidDateValue(String(payload.harvestedOn ?? ''))) {
      setError('Choose a valid harvest date.');
      return;
    }
    const endpoint =
      modal === 'plot'
        ? '/api/plots'
        : modal === 'planting'
          ? '/api/plantings'
          : '/api/harvests';
            const editingRecord = editing?.type === modal ? editing.record : null;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: editingRecord ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ...(editingRecord ? { id: editingRecord.id } : {}),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? 'The record could not be saved.');
      await loadFarm();
      setNotice(
        editingRecord
          ? 'Record updated.'
          : modal === 'plot'
            ? 'Plot added to your plot board.'
            : modal === 'planting'
              ? 'Planting added to the schedule.'
              : 'Harvest saved to the log.',
      );
      setModal(null);
      setEditing(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The record could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(type: Exclude<ModalMode, null>, id: string) {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    const endpoint =
      type === 'plot'
        ? '/api/plots'
        : type === 'planting'
          ? '/api/plantings'
          : '/api/harvests';
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'The record could not be deleted.');
      await loadFarm();
      setNotice(
        type === 'plot'
          ? 'Plot deleted.'
          : type === 'planting'
            ? 'Planting deleted.'
            : 'Harvest deleted.',
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'The record could not be deleted.',
      );
    }
  }

  function editRecord(type: Exclude<ModalMode, null>, record: Plot | Planting | Harvest) {
    setEditing({ type, record });
    setModal(type);
    setNotice('');
    setError('');
  }

  if (!farm) {
    return (
      <main className="loading-screen" aria-live="polite">
        <span className="loading-mark">
          <Sprout size={22} />
        </span>
        <span>
          {error ||
            (loading ? 'Opening the farm book...' : 'Farm data unavailable')}
        </span>
      </main>
    );
  }

  const occupiedPlotIds = new Set(
    farm.plantings
      .filter((planting) => planting.status !== 'harvested')
      .map((planting) => planting.plotId),
  );
  const freePlots = farm.plots.filter((plot) => !occupiedPlotIds.has(plot.id));
  const currentPlantings = farm.plantings.filter(
    (planting) => planting.status !== 'harvested',
  );
  const readyPlantings = currentPlantings.filter(
    (planting) => getPlantingStatus(planting) === 'ready',
  );
  const upcomingPlantings = [...currentPlantings].sort((a, b) =>
    a.expectedHarvest.localeCompare(b.expectedHarvest),
  );
  const totalArea = farm.plots.reduce((sum, plot) => sum + plot.area, 0);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const seasonStartYear = currentMonth === 11 ? currentYear : currentYear - 1;
  const seasonRange =
    currentMonth >= 2 && currentMonth <= 4
      ? [`${currentYear}-03-01`, `${currentYear}-06-01`]
      : currentMonth >= 5 && currentMonth <= 7
        ? [`${currentYear}-06-01`, `${currentYear}-09-01`]
        : currentMonth >= 8 && currentMonth <= 10
          ? [`${currentYear}-09-01`, `${currentYear}-12-01`]
          : [`${seasonStartYear}-12-01`, `${seasonStartYear + 1}-03-01`];
  const harvestedWeight = farm.harvests
    .filter(
      (harvest) =>
        harvest.unit === 'kg' &&
        harvest.harvestedOn >= seasonRange[0] &&
        harvest.harvestedOn < seasonRange[1],
    )
    .reduce((sum, harvest) => sum + harvest.quantity, 0);
  const seasonHarvestCount = farm.harvests.filter(
    (harvest) =>
      harvest.harvestedOn >= seasonRange[0] &&
      harvest.harvestedOn < seasonRange[1],
  ).length;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredPlots = farm.plots.filter((plot) =>
    `${plot.name} ${plot.soil}`.toLowerCase().includes(normalizedSearch),
  );
  const filteredPlantings = farm.plantings.filter((planting) =>
    `${planting.crop} ${planting.variety} ${getPlotName(planting.plotId, farm.plots)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredHarvests = farm.harvests.filter((harvest) =>
    `${harvest.crop} ${harvest.notes} ${harvest.unit}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const searchResults = normalizedSearch
    ? [
        ...farm.plots
          .filter((plot) =>
            `${plot.name} ${plot.soil}`.toLowerCase().includes(normalizedSearch),
          )
          .map((plot) => ({
            id: plot.id,
            title: plot.name,
            detail: `${plot.area} m² · ${plot.soil}`,
            view: 'plots' as View,
          })),
        ...farm.plantings
          .filter((planting) =>
            `${planting.crop} ${planting.variety} ${getPlotName(planting.plotId, farm.plots)}`
              .toLowerCase()
              .includes(normalizedSearch),
          )
          .map((planting) => ({
            id: planting.id,
            title: `${planting.crop} · ${planting.variety}`,
            detail: getPlotName(planting.plotId, farm.plots),
            view: 'plantings' as View,
          })),
        ...farm.harvests
          .filter((harvest) =>
            `${harvest.crop} ${harvest.notes} ${harvest.unit}`
              .toLowerCase()
              .includes(normalizedSearch),
          )
          .map((harvest) => ({
            id: harvest.id,
            title: harvest.crop,
            detail: `${harvest.quantity} ${harvest.unit} · ${formatDate(harvest.harvestedOn)}`,
            view: 'harvests' as View,
          })),
      ].slice(0, 8)
    : [];
  const alerts = upcomingPlantings
    .filter(
      (planting) =>
        getPlantingStatus(planting) === 'ready' ||
        daysUntil(planting.expectedHarvest) <= 7,
    )
    .slice(0, 5);

  return (
    <div
      className="app-shell"
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element && target.closest('.search-control'))) {
          setSearchOpen(false);
        }
        if (!(target instanceof Element && target.closest('.notification-wrap'))) {
          setNotificationsOpen(false);
        }
      }}
    >
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={() => setView('overview')}
        >
          <span className="brand-mark">
            <Sprout size={21} strokeWidth={2.1} />
          </span>
          <span className="brand-copy">
            <strong>fieldnote</strong>
            <small>YOUR FARM, IN SEASON</small>
          </span>
        </a>
        <div className="farm-switcher">
          <span className="farm-avatar">M</span>
          <span>
            <strong>Meadow Farm</strong>
            <small>Smallholding</small>
          </span>
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav className="main-nav" aria-label="Farm sections">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'selected' : ''}`}
              onClick={() => {
                setView(id);
                setNotice('');
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'harvests' && (
                <span className="nav-count">{farm.harvests.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-season">
          <span className="season-icon">
            <Leaf size={17} />
          </span>
          <div>
            <small>IN THE FIELD</small>
            <strong>{getSeason()}</strong>
            <span>{currentPlantings.length} crops growing</span>
          </div>
        </div>
        <div className="profile">
          <span className="profile-avatar">SL</span>
          <span>
            <strong>Sam Lewis</strong>
            <small>Farm manager</small>
          </span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Meadow Farm</span>
            <ChevronRight size={14} />
            <strong>
              {navigation.find((item) => item.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            <div className="search-control">
              <label className="search-box">
                <Search size={16} />
                <input
                  role="combobox"
                  aria-label="Search plots, plantings, and harvests"
                  aria-expanded={searchOpen && Boolean(search)}
                  aria-controls="farm-search-results"
                  placeholder="Search your farm"
                  value={search}
                  onFocus={() => {
                    setSearchOpen(true);
                    setNotificationsOpen(false);
                  }}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchOpen(true);
                    setNotificationsOpen(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearchOpen(false);
                  }}
                />
                {search && (
                  <button
                    type="button"
                    className="search-clear"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
              {searchOpen && search && (
                <div
                  id="farm-search-results"
                  className="search-results"
                  role="listbox"
                  aria-label="Farm search results"
                >
                  {searchResults.length ? (
                    searchResults.map((result) => (
                      <button
                        type="button"
                        key={`${result.view}-${result.id}`}
                        role="option"
                        aria-selected="false"
                        onClick={() => {
                          setView(result.view);
                          setSearchOpen(false);
                        }}
                      >
                        <strong>{result.title}</strong>
                        <span>{result.detail}</span>
                      </button>
                    ))
                  ) : (
                    <p>No matching farm records.</p>
                  )}
                </div>
              )}
            </div>
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                title="Harvest alerts"
                aria-label={`Harvest alerts${alerts.length ? `, ${alerts.length} items` : ''}`}
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setSearchOpen(false);
                }}
              >
                {alerts.length > 0 && <span className="notification-dot" />}
                <Bell size={18} />
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="popover-heading">
                    <strong>Harvest alerts</strong>
                    <span>{alerts.length}</span>
                  </div>
                  {alerts.length ? (
                    alerts.map((planting) => (
                      <button
                        type="button"
                        key={planting.id}
                        onClick={() => {
                          setView('plantings');
                          setSearch(planting.crop);
                          setNotificationsOpen(false);
                        }}
                      >
                        <strong>{planting.crop}</strong>
                        <span>
                          {getPlantingStatus(planting) === 'ready'
                            ? 'Ready to pick'
                            : `Expected ${formatDate(planting.expectedHarvest)}`}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p>No crops are due in the next 7 days.</p>
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <span className="today-label">
              {new Intl.DateTimeFormat('en', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              }).format(new Date())}
            </span>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Farm sections">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? 'selected' : ''}
              onClick={() => setView(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="content-wrap">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" /> FIELD JOURNAL{' '}
                <span className="eyebrow-line" /> {getSeason().toUpperCase()}
              </div>
              <h1>
                {view === 'overview'
                  ? 'Farm overview'
                  : navigation.find((item) => item.id === view)?.label}
              </h1>
              <p className="page-subtitle">
                A clear view of what’s growing, what’s ready, and what comes
                next.
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button button-secondary"
                onClick={() => setModal('plot')}
              >
                <Plus size={16} /> Add a plot
              </button>
              <button
                className="button button-primary"
                onClick={() => {
                  setSelectedPlotId(null);
                  setModal('planting');
                }}
                disabled={freePlots.length === 0}
              >
                <Sprout size={16} /> Plan planting
              </button>
            </div>
          </section>

          {notice && (
            <div className="notice-bar" role="status">
              <Check size={16} />
              {notice}
              <button onClick={() => setNotice('')} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
          {error && !modal && (
            <div className="error-bar" role="alert">
              {error}
              <button onClick={() => setError('')} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}

          {view === 'overview' && (
            <>
              <section className="metrics-row" aria-label="Farm summary">
                <Metric
                  label="GROWING NOW"
                  value={String(currentPlantings.length).padStart(2, '0')}
                  detail={`${farm.plots.length} plots in rotation`}
                  icon={<Sprout size={17} />}
                />
                <Metric
                  label="READY TO PICK"
                  value={String(readyPlantings.length).padStart(2, '0')}
                  detail={
                    readyPlantings.length
                      ? 'A good day to harvest'
                      : 'Nothing ready just yet'
                  }
                  icon={<Wheat size={17} />}
                  accent="gold"
                />
                <Metric
                  label="HARVESTED THIS SEASON"
                  value={`${harvestedWeight.toFixed(1)} kg`}
                  detail={`${seasonHarvestCount} logged this season`}
                  icon={<ArrowDownRight size={17} />}
                  accent="coral"
                />
                <Metric
                  label="TOTAL GROWING SPACE"
                  value={`${totalArea} m²`}
                  detail={`${freePlots.length} plots available`}
                  icon={<Map size={17} />}
                />
              </section>

              <section className="harvest-banner">
                <div className="banner-icon">
                  <Wheat size={20} />
                </div>
                <div className="banner-copy">
                  <span>FIELD NOTE / TODAY</span>
                  <strong>
                    {readyPlantings.length
                      ? `${readyPlantings.length} crop${readyPlantings.length === 1 ? ' is' : 's are'} ready for harvest`
                      : 'Your next harvest is on its way'}
                  </strong>
                  <small>
                    {readyPlantings.length
                      ? readyPlantings
                          .map(
                            (planting) =>
                              `${planting.crop} · ${getPlotName(planting.plotId, farm.plots)}`,
                          )
                          .join('    /    ')
                      : upcomingPlantings[0]
                        ? `${upcomingPlantings[0].crop} is up next · ${formatDate(upcomingPlantings[0].expectedHarvest)}`
                        : 'Schedule a planting to begin your next crop cycle.'}
                  </small>
                </div>
                <button
                  className="banner-action"
                  onClick={() =>
                    setModal(readyPlantings.length ? 'harvest' : 'planting')
                  }
                >
                  <span>
                    {readyPlantings.length ? 'Log a harvest' : 'Plan a crop'}
                  </span>
                  <ArrowUpRight size={16} />
                </button>
                <div className="banner-grain" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </section>

              <div className="dashboard-grid">
                <section className="section-block field-section">
                  <div className="section-heading">
                    <div>
                      <div className="section-kicker">YOUR LAND</div>
                      <h2>
                        Plot board{' '}
                        <span className="heading-count">
                          {farm.plots.length} plots
                        </span>
                      </h2>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setView('plots')}
                    >
                      View all <ChevronRight size={15} />
                    </button>
                  </div>
                  <FieldMap
                    plots={farm.plots}
                    plantings={farm.plantings}
                    onSelectPlot={(plotId) => {
                      if (occupiedPlotIds.has(plotId)) return;
                      setSelectedPlotId(plotId);
                      setModal('planting');
                      setNotice('');
                    }}
                  />
                  <div className="map-legend">
                    <span>
                      <i className="legend-swatch occupied" />
                      Growing
                    </span>
                    <span>
                      <i className="legend-swatch resting" />
                      Available
                    </span>
                    <span className="map-total">
                      {totalArea} m² in cultivation
                    </span>
                  </div>
                </section>

                <section className="section-block schedule-section">
                  <div className="section-heading">
                    <div>
                      <div className="section-kicker">UP NEXT</div>
                      <h2>Harvest schedule</h2>
                    </div>
                    <button
                      className="round-link"
                      title="Open planting plan"
                      aria-label="Open planting plan"
                      onClick={() => setView('plantings')}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="schedule-list">
                    {upcomingPlantings.slice(0, 5).map((planting, index) => (
                      <ScheduleItem
                        key={planting.id}
                        planting={planting}
                        plotName={getPlotName(planting.plotId, farm.plots)}
                        index={index}
                      />
                    ))}
                    {upcomingPlantings.length === 0 && (
                      <p className="empty-state">
                        No crops in the schedule yet.
                      </p>
                    )}
                  </div>
                  <button
                    className="schedule-footer"
                    onClick={() => setView('plantings')}
                  >
                    View planting plan <ChevronRight size={15} />
                  </button>
                </section>
              </div>

              <section className="section-block harvest-section">
                <div className="section-heading">
                  <div>
                    <div className="section-kicker">RECENT ACTIVITY</div>
                    <h2>Latest harvests</h2>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setView('harvests')}
                  >
                    All harvests <ChevronRight size={15} />
                  </button>
                </div>
                <HarvestTable
                  harvests={farm.harvests.slice(0, 4)}
                  plantings={farm.plantings}
                  plots={farm.plots}
                  onEdit={(record) => editRecord('harvest', record)}
                  onDelete={(id) => deleteRecord('harvest', id)}
                />
              </section>
            </>
          )}

          {view === 'plots' && (
            <section className="section-block full-section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">LAND & ASSIGNMENTS</div>
                  <h2>All plots</h2>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => setModal('plot')}
                >
                  <Plus size={16} /> Add a plot
                </button>
              </div>
              <FieldMap
                plots={farm.plots}
                plantings={farm.plantings}
                expanded
              />
              <div className="map-legend">
                <span>
                  <i className="legend-swatch occupied" />
                  Growing
                </span>
                <span>
                  <i className="legend-swatch resting" />
                  Available
                </span>
                <span className="map-total">{totalArea} m² total</span>
              </div>
              <div className="plot-table">
                <div className="table-head plot-columns">
                  <span>Plot</span>
                  <span>Soil</span>
                  <span>Area</span>
                  <span>Assignment</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {filteredPlots.map((plot) => {
                  const crop = farm.plantings.find(
                    (planting) =>
                      planting.plotId === plot.id &&
                      planting.status !== 'harvested',
                  );
                  return (
                    <div className="table-row plot-columns" key={plot.id}>
                      <strong>{plot.name}</strong>
                      <span>{plot.soil}</span>
                      <span>{plot.area} m²</span>
                      <span>
                        {crop ? `${crop.crop} · ${crop.variety}` : 'Unassigned'}
                      </span>
                      <span>
                        <StatusPill
                          label={crop ? 'Growing' : 'Available'}
                          tone={crop ? 'green' : 'neutral'}
                        />
                      </span>
                      <RecordActions
                        label={plot.name}
                        onEdit={() => editRecord('plot', plot)}
                        onDelete={() => deleteRecord('plot', plot.id)}
                        deleteDisabled={farm.plantings.some(
                          (planting) => planting.plotId === plot.id,
                        )}
                        deleteReason="This plot has planting history."
                      />
                    </div>
                  );
                })}
                {filteredPlots.length === 0 && (
                  <p className="empty-state">No plots match your search.</p>
                )}
              </div>
            </section>
          )}

          {view === 'plantings' && (
            <section className="section-block full-section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">CROP CYCLE</div>
                  <h2>Planting schedule</h2>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setSelectedPlotId(null);
                    setModal('planting');
                  }}
                  disabled={freePlots.length === 0}
                >
                  <Plus size={16} /> Schedule planting
                </button>
              </div>
              <div className="planting-table">
                <div className="table-head planting-columns">
                  <span>Crop & variety</span>
                  <span>Assigned plot</span>
                  <span>Planted</span>
                  <span>Expected harvest</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {filteredPlantings.map((planting) => {
                  const status = getPlantingStatus(planting);
                  return (
                    <div
                      className="table-row planting-columns"
                      key={planting.id}
                    >
                      <div className="crop-cell">
                        <span className="crop-avatar">
                          {planting.crop.slice(0, 1)}
                        </span>
                        <span>
                          <strong>{planting.crop}</strong>
                          <small>{planting.variety}</small>
                        </span>
                      </div>
                      <span>{getPlotName(planting.plotId, farm.plots)}</span>
                      <span>{formatDate(planting.plantedOn)}</span>
                      <span>{formatDate(planting.expectedHarvest)}</span>
                      <span>
                        <StatusPill
                          label={
                            status === 'ready'
                              ? 'Ready'
                              : status === 'harvested'
                                ? 'Harvested'
                                : 'Growing'
                          }
                          tone={
                            status === 'ready'
                              ? 'gold'
                              : status === 'harvested'
                                ? 'neutral'
                                : 'green'
                          }
                        />
                      </span>
                      <RecordActions
                        label={`${planting.crop} planting`}
                        onEdit={() => editRecord('planting', planting)}
                        onDelete={() => deleteRecord('planting', planting.id)}
                        deleteDisabled={farm.harvests.some(
                          (harvest) => harvest.plantingId === planting.id,
                        )}
                        deleteReason="This planting has harvest history."
                      />
                    </div>
                  );
                })}
                {filteredPlantings.length === 0 && (
                  <p className="empty-state">No plantings match your search.</p>
                )}
              </div>
            </section>
          )}

          {view === 'harvests' && (
            <section className="section-block full-section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">YIELD RECORD</div>
                  <h2>Harvest log</h2>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => setModal('harvest')}
                  disabled={currentPlantings.length === 0}
                >
                  <Plus size={16} /> Log a harvest
                </button>
              </div>
              <div className="harvest-summary">
                <span>
                  <strong>{farm.harvests.length}</strong> logged harvests
                </span>
                <span>
                  <strong>{harvestedWeight.toFixed(1)} kg</strong> harvested
                  this season
                </span>
              </div>
              <HarvestTable
                harvests={filteredHarvests}
                plantings={farm.plantings}
                plots={farm.plots}
                onEdit={(record) => editRecord('harvest', record)}
                onDelete={(id) => deleteRecord('harvest', id)}
              />
            </section>
          )}

          <footer className="page-footer">
            <span>
              FIELDNOTE <i /> GROW WITH INTENTION
            </span>
            <span>Season data stays on this device</span>
          </footer>
        </div>
      </main>

      {modal && (
        <FarmModal
          key={`${modal}-${editing?.record.id ?? 'new'}`}
          mode={modal}
          farm={farm}
          freePlots={freePlots}
          selectedPlotId={selectedPlotId}
          editing={editing?.type === modal ? editing.record : null}
          error={error}
          availablePlantings={currentPlantings}
          saving={saving}
          onClose={() => {
            setModal(null);
            setEditing(null);
            setError('');
          }}
          onSubmit={saveRecord}
        />
      )}
      {assistantOpen && (
        <section className="assistant-panel" aria-label="Fieldnote AI-assistent">
          <header className="assistant-header">
            <span className="assistant-avatar"><Bot size={18} /></span>
            <span>
              <strong>Fieldnote assistent</strong>
              <small>Lokaal verbonden met Ollama</small>
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Sluit assistent"
              onClick={() => setAssistantOpen(false)}
            >
              <X size={17} />
            </button>
          </header>
          <div className="assistant-messages" aria-live="polite">
            {assistantMessages.length === 0 ? (
              <div className="assistant-welcome">
                <strong>Waar kan ik je mee helpen?</strong>
                <p>Ik kijk mee met de actuele percelen, plantingen en oogsten.</p>
                <div>
                  {[
                    'Welke gewassen zijn bijna klaar?',
                    'Welke percelen zijn nog vrij?',
                    'Vat mijn recente oogsten samen.',
                  ].map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => setAssistantInput(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              assistantMessages.map((item, index) => (
                <div
                  className={`assistant-message ${item.role}${item.error ? ' error' : ''}`}
                  key={`${item.role}-${index}`}
                >
                  {item.content}
                </div>
              ))
            )}
            {assistantSending && (
              <div className="assistant-thinking" role="status">
                <LoaderCircle size={15} /> Bezig met nadenken…
              </div>
            )}
            <div ref={assistantEndRef} />
          </div>
          <form className="assistant-compose" onSubmit={askAssistant}>
            <textarea
              aria-label="Bericht aan de assistent"
              placeholder="Stel een vraag over je boerderij…"
              rows={2}
              maxLength={2000}
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              className="assistant-send"
              aria-label="Verstuur bericht"
              disabled={!assistantInput.trim() || assistantSending}
            >
              <Send size={16} />
            </button>
          </form>
          <p className="assistant-privacy">Je farmgegevens blijven lokaal.</p>
        </section>
      )}
      <button
        type="button"
        className={`assistant-launcher${assistantOpen ? ' open' : ''}`}
        aria-label={assistantOpen ? 'Sluit assistent' : 'Open AI-assistent'}
        title={assistantOpen ? 'Sluit assistent' : 'Open AI-assistent'}
        onClick={() => setAssistantOpen((open) => !open)}
      >
        {assistantOpen ? <X size={20} /> : <Bot size={21} />}
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  accent = 'green',
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="metric">
      <div className={`metric-icon ${accent}`}>{icon}</div>
      <div className="metric-label">{label}</div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}

function FieldMap({
  plots,
  plantings,
  expanded = false,
  onSelectPlot,
}: {
  plots: Plot[];
  plantings: Planting[];
  expanded?: boolean;
  onSelectPlot?: (plotId: string) => void;
}) {
  return (
    <div className={`field-map ${expanded ? 'expanded' : ''}`}>
      <div className="map-compass">
        <span>N</span>
        <ArrowUpRight size={13} />
      </div>
      <div className="field-grid">
        {plots.map((plot, index) => {
          const crop = plantings.find(
            (planting) =>
              planting.plotId === plot.id && planting.status !== 'harvested',
          );
          const cropClass = crop
            ? `crop-${crop.crop.toLowerCase()}`
            : 'crop-empty';
          return (
            <button
              type="button"
              key={plot.id}
              className={`field-plot ${crop ? 'is-growing' : 'is-resting'} ${cropClass}`}
              onClick={() => onSelectPlot?.(plot.id)}
              title={`${plot.name}: ${crop ? crop.crop : 'available'}`}
            >
              <span className="plot-number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="plot-crop-mark" aria-hidden="true">
                {crop ? (
                  <>
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </>
                ) : (
                  <Plus size={15} />
                )}
              </span>
              <strong>{plot.name}</strong>
              <small>{crop ? crop.crop : `${plot.area} m² · available`}</small>
            </button>
          );
        })}
      </div>
      <div className="map-path" aria-hidden="true" />
      <div className="map-label">
        <span className="map-label-dot" /> PLOT BOARD <span>·</span>
        SCHEMATIC · NOT TO SCALE
      </div>
    </div>
  );
}

function ScheduleItem({
  planting,
  plotName,
  index,
}: {
  planting: Planting;
  plotName: string;
  index: number;
}) {
  const remaining = daysUntil(planting.expectedHarvest);
  const isReady = getPlantingStatus(planting) === 'ready';
  return (
    <div className={`schedule-item ${isReady ? 'is-ready' : ''}`}>
      <div className={`schedule-date ${isReady ? 'ready-date' : ''}`}>
        <strong>
          {formatDate(planting.expectedHarvest).split(' ')[1].replace(',', '')}
        </strong>
        <span>{formatDate(planting.expectedHarvest).split(' ')[0]}</span>
      </div>
      <div className="schedule-line" />
      <div className="schedule-info">
        <strong>
          {planting.crop}
          <span className="schedule-variety"> · {planting.variety}</span>
        </strong>
        <small>
          {plotName} <i />{' '}
          {isReady
            ? 'Ready to pick'
            : remaining === 1
              ? 'In 1 day'
              : `In ${remaining} days`}
        </small>
      </div>
      <span className={`schedule-status ${isReady ? 'ready' : ''}`}>
        {isReady ? 'READY' : index === 0 ? 'SOON' : 'GROWING'}
      </span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`status-pill ${tone}`}>
      <i />
      {label}
    </span>
  );
}

function RecordActions({
  label,
  onEdit,
  onDelete,
  deleteDisabled = false,
  deleteReason,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
  deleteReason?: string;
}) {
  return (
    <div className="record-actions">
      <button
        type="button"
        className="icon-button"
        title={`Edit ${label}`}
        aria-label={`Edit ${label}`}
        onClick={onEdit}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className="icon-button"
        title={deleteDisabled ? deleteReason : `Delete ${label}`}
        aria-label={deleteDisabled ? deleteReason : `Delete ${label}`}
        onClick={onDelete}
        disabled={deleteDisabled}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function HarvestTable({
  harvests,
  plantings,
  plots,
  onEdit,
  onDelete,
}: {
  harvests: Harvest[];
  plantings: Planting[];
  plots: Plot[];
  onEdit: (harvest: Harvest) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="harvest-table">
      <div className="table-head harvest-columns">
        <span>Crop</span>
        <span>Plot</span>
        <span>Harvest date</span>
        <span>Yield</span>
        <span>Notes</span>
        <span>Actions</span>
      </div>
      {harvests.map((harvest) => {
        const planting = plantings.find(
          (item) => item.id === harvest.plantingId,
        );
        return (
          <div className="table-row harvest-columns" key={harvest.id}>
            <div className="crop-cell">
              <span className="crop-avatar harvest-avatar">
                <Wheat size={15} />
              </span>
              <span>
                <strong>{harvest.crop}</strong>
                <small>{planting?.variety ?? 'Crop'}</small>
              </span>
            </div>
            <span>{planting ? getPlotName(planting.plotId, plots) : '—'}</span>
            <span>{formatDate(harvest.harvestedOn)}</span>
            <strong className="yield-value">
              {harvest.quantity} {harvest.unit}
            </strong>
            <span className="harvest-notes">{harvest.notes || '—'}</span>
            <RecordActions
              label={`${harvest.crop} harvest`}
              onEdit={() => onEdit(harvest)}
              onDelete={() => onDelete(harvest.id)}
            />
          </div>
        );
      })}
      {harvests.length === 0 && (
        <p className="empty-state">No harvests match your search.</p>
      )}
    </div>
  );
}

function FarmModal({
  mode,
  farm,
  freePlots,
  selectedPlotId,
  editing,
  error,
  availablePlantings,
  saving,
  onClose,
  onSubmit,
}: {
  mode: Exclude<ModalMode, null>;
  farm: FarmData;
  freePlots: Plot[];
  selectedPlotId: string | null;
  editing: Plot | Planting | Harvest | null;
  error: string;
  availablePlantings: Planting[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const editingPlot = mode === 'plot' && editing && 'area' in editing ? editing : null;
  const editingPlanting =
    mode === 'planting' && editing && 'expectedHarvest' in editing
      ? editing
      : null;
  const editingHarvest =
    mode === 'harvest' && editing && 'quantity' in editing ? editing : null;
  const plotChoices = editingPlanting
    ? farm.plots.filter(
        (plot) =>
          plot.id === editingPlanting.plotId ||
          freePlots.some((freePlot) => freePlot.id === plot.id),
      )
    : freePlots;
  const title = editing
    ? mode === 'plot'
      ? 'Edit a field plot'
      : mode === 'planting'
        ? 'Edit a planting'
        : 'Edit a harvest'
    : mode === 'plot'
      ? 'Add a field plot'
      : mode === 'planting'
        ? 'Schedule a planting'
        : 'Log a harvest';
  const subtitle = editing
    ? 'Update the details for this farm record.'
    : mode === 'plot'
      ? 'Add a space to your plot board.'
      : mode === 'planting'
        ? 'Assign a crop to an available plot.'
        : 'Record the yield from a growing crop.';
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <span className="modal-icon">
            {mode === 'plot' ? (
              <Map size={19} />
            ) : mode === 'planting' ? (
              <Sprout size={19} />
            ) : (
              <Wheat size={19} />
            )}
          </span>
          <button
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
          <span className="section-kicker">FIELD JOURNAL</span>
          <h2 id="modal-title">{title}</h2>
          <p>{subtitle}</p>
        </div>
        <form onSubmit={onSubmit} className="modal-form">
          {error && <p className="form-error" role="alert">{error}</p>}
          {mode === 'plot' && (
            <>
              <label>
                Plot name
                <input
                  name="name"
                  placeholder="e.g. Orchard edge"
                  defaultValue={editingPlot?.name}
                  required
                  autoFocus
                />
              </label>
              <div className="form-row">
                <label>
                  Area (m²)
                  <input
                    name="area"
                    type="number"
                    min="1"
                    step="0.5"
                    placeholder="24"
                    defaultValue={editingPlot?.area}
                    required
                  />
                </label>
                <label>
                  Soil type
                  <select name="soil" defaultValue={editingPlot?.soil ?? 'Loam'}>
                    <option>Loam</option>
                    <option>Sandy loam</option>
                    <option>Clay loam</option>
                    <option>Rich loam</option>
                    <option>Compost mix</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {mode === 'planting' && (
            <>
              {plotChoices.length === 0 ? (
                <p className="empty-state">
                  Every plot is currently assigned. Harvest a crop or add a plot
                  to make room.
                </p>
              ) : (
                <>
                  <label>
                    Available plot
                    <select
                      name="plotId"
                      defaultValue={selectedPlotId ?? editingPlanting?.plotId ?? plotChoices[0].id}
                      required
                    >
                      {plotChoices.map((plot) => (
                        <option key={plot.id} value={plot.id}>
                          {plot.name} · {plot.area} m²
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-row">
                    <label>
                      Crop
                      <input
                        name="crop"
                        placeholder="e.g. Chard"
                        defaultValue={editingPlanting?.crop}
                        required
                        autoFocus
                      />
                    </label>
                    <label>
                      Variety
                      <input
                        name="variety"
                        placeholder="e.g. Bright Lights"
                        defaultValue={editingPlanting?.variety}
                        required
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Planting date
                      <input
                        name="plantedOn"
                        type="date"
                        defaultValue={editingPlanting?.plantedOn ?? todayString()}
                        required
                      />
                    </label>
                    <label>
                      Expected harvest
                      <input
                        name="expectedHarvest"
                        type="date"
                        min={editingPlanting?.plantedOn ?? todayString()}
                        defaultValue={editingPlanting?.expectedHarvest ?? dateOffsetString(55)}
                        required
                      />
                    </label>
                  </div>
                </>
              )}
            </>
          )}
          {mode === 'harvest' && (
            <>
              {availablePlantings.length === 0 && !editingHarvest ? (
                <p className="empty-state">
                  There are no active crops to harvest yet.
                </p>
              ) : (
                <>
                  {editingHarvest ? (
                    <label>
                      Crop
                      <input value={editingHarvest.crop} readOnly />
                    </label>
                  ) : (
                    <label>
                      Crop
                      <select name="plantingId" required>
                        {[...availablePlantings]
                          .sort((a, b) =>
                            a.expectedHarvest.localeCompare(b.expectedHarvest),
                          )
                          .map((planting) => (
                            <option key={planting.id} value={planting.id}>
                              {planting.crop} ·{' '}
                              {getPlotName(planting.plotId, farm.plots)}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div className="form-row">
                    <label>
                      Quantity
                      <input
                        name="quantity"
                        type="number"
                        min="0.1"
                        step="0.1"
                        placeholder="2.5"
                        defaultValue={editingHarvest?.quantity}
                        required
                        autoFocus
                      />
                    </label>
                    <label>
                      Unit
                      <select name="unit" defaultValue={editingHarvest?.unit ?? 'kg'}>
                        <option value="kg">kg</option>
                        <option value="bunches">Bunches</option>
                        <option value="items">Items</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Harvest date
                    <input
                      name="harvestedOn"
                      type="date"
                      defaultValue={editingHarvest?.harvestedOn ?? todayString()}
                      required
                    />
                  </label>
                  <label>
                    Notes <span className="optional-label">OPTIONAL</span>
                    <input
                      name="notes"
                      placeholder="Quality, condition, or anything to remember"
                      defaultValue={editingHarvest?.notes}
                    />
                  </label>
                </>
              )}
            </>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={
                saving ||
                (mode === 'planting' && plotChoices.length === 0) ||
                (mode === 'harvest' && availablePlantings.length === 0 && !editingHarvest)
              }
            >
              {saving
                ? 'Saving…'
                : mode === 'plot'
                  ? editing ? 'Save plot' : 'Add plot'
                  : mode === 'planting'
                    ? editing ? 'Save planting' : 'Add to schedule'
                    : editing ? 'Save harvest' : 'Save harvest'}
              <ChevronRight size={15} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
