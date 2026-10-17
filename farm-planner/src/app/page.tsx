'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  Leaf,
  Map,
  Plus,
  Search,
  Sprout,
  Wheat,
  X,
} from 'lucide-react';
import type { FarmData, Harvest, Planting, Plot } from '@/lib/farm-store';

type View = 'overview' | 'plots' | 'plantings' | 'harvests';
type ModalMode = 'plot' | 'planting' | 'harvest' | null;

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] =
  [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'plots', label: 'Field map', icon: Map },
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

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const endpoint =
      modal === 'plot'
        ? '/api/plots'
        : modal === 'planting'
          ? '/api/plantings'
          : '/api/harvests';
    setSaving(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? 'The record could not be saved.');
      await loadFarm();
      setNotice(
        modal === 'plot'
          ? 'Plot added to your field map.'
          : modal === 'planting'
            ? 'Planting added to the schedule.'
            : 'Harvest saved to the log.',
      );
      setModal(null);
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
    (planting) => planting.status === 'ready',
  );
  const upcomingPlantings = [...currentPlantings].sort((a, b) =>
    a.expectedHarvest.localeCompare(b.expectedHarvest),
  );
  const totalArea = farm.plots.reduce((sum, plot) => sum + plot.area, 0);
  const harvestedWeight = farm.harvests
    .filter((harvest) => harvest.unit === 'kg')
    .reduce((sum, harvest) => sum + harvest.quantity, 0);
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

  return (
    <div className="app-shell">
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
          <ChevronRight size={15} />
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
          <span className="profile-dots">···</span>
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
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Search crops or harvest notes"
                placeholder="Search your farm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button
              className="icon-button notification-button"
              title="Notifications"
              aria-label="Notifications"
            >
              <span className="notification-dot" />
              <Clock3 size={18} />
            </button>
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

        <div className="mobile-nav" aria-label="Farm sections">
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
        </div>

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
          {error && (
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
                  detail={`${farm.harvests.length} logged harvests`}
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
                        Field map{' '}
                        <span className="heading-count">
                          {farm.plots.length} plots
                        </span>
                      </h2>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setView('plots')}
                    >
                      Full map <ChevronRight size={15} />
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
                />
              </section>
            </>
          )}

          {view === 'plots' && (
            <section className="section-block full-section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">LAND & ASSIGNMENTS</div>
                  <h2>All field plots</h2>
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
                </div>
                {farm.plots.map((plot) => {
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
                    </div>
                  );
                })}
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
                </div>
                {filteredPlantings.map((planting) => (
                  <div className="table-row planting-columns" key={planting.id}>
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
                          planting.status === 'ready'
                            ? 'Ready'
                            : planting.status === 'harvested'
                              ? 'Harvested'
                              : 'Growing'
                        }
                        tone={
                          planting.status === 'ready'
                            ? 'gold'
                            : planting.status === 'harvested'
                              ? 'neutral'
                              : 'green'
                        }
                      />
                    </span>
                  </div>
                ))}
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
                  <strong>{harvestedWeight.toFixed(1)} kg</strong> recorded by
                  weight
                </span>
              </div>
              <HarvestTable
                harvests={filteredHarvests}
                plantings={farm.plantings}
                plots={farm.plots}
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
          mode={modal}
          farm={farm}
          freePlots={freePlots}
          selectedPlotId={selectedPlotId}
          availablePlantings={currentPlantings}
          saving={saving}
          onClose={() => {
            setModal(null);
            setError('');
          }}
          onSubmit={saveRecord}
        />
      )}
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
        <span className="map-label-dot" /> MEADOW FARM <span>·</span> NORTH
        FIELD
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
  const isReady = planting.status === 'ready' || remaining <= 0;
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

function HarvestTable({
  harvests,
  plantings,
  plots,
}: {
  harvests: Harvest[];
  plantings: Planting[];
  plots: Plot[];
}) {
  return (
    <div className="harvest-table">
      <div className="table-head harvest-columns">
        <span>Crop</span>
        <span>Plot</span>
        <span>Harvest date</span>
        <span>Yield</span>
        <span>Notes</span>
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
  availablePlantings,
  saving,
  onClose,
  onSubmit,
}: {
  mode: Exclude<ModalMode, null>;
  farm: FarmData;
  freePlots: Plot[];
  selectedPlotId: string | null;
  availablePlantings: Planting[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const title =
    mode === 'plot'
      ? 'Add a field plot'
      : mode === 'planting'
        ? 'Schedule a planting'
        : 'Log a harvest';
  const subtitle =
    mode === 'plot'
      ? 'Add a space to your farm map.'
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
          {mode === 'plot' && (
            <>
              <label>
                Plot name
                <input
                  name="name"
                  placeholder="e.g. Orchard edge"
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
                    required
                  />
                </label>
                <label>
                  Soil type
                  <select name="soil" defaultValue="Loam">
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
              {freePlots.length === 0 ? (
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
                      defaultValue={selectedPlotId ?? freePlots[0].id}
                      required
                    >
                      {freePlots.map((plot) => (
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
                        required
                        autoFocus
                      />
                    </label>
                    <label>
                      Variety
                      <input
                        name="variety"
                        placeholder="e.g. Bright Lights"
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
                        defaultValue={todayString()}
                        required
                      />
                    </label>
                    <label>
                      Expected harvest
                      <input
                        name="expectedHarvest"
                        type="date"
                        defaultValue={dateOffsetString(55)}
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
              {availablePlantings.length === 0 ? (
                <p className="empty-state">
                  There are no active crops to harvest yet.
                </p>
              ) : (
                <>
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
                  <div className="form-row">
                    <label>
                      Quantity
                      <input
                        name="quantity"
                        type="number"
                        min="0.1"
                        step="0.1"
                        placeholder="2.5"
                        required
                        autoFocus
                      />
                    </label>
                    <label>
                      Unit
                      <select name="unit" defaultValue="kg">
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
                      defaultValue={todayString()}
                      required
                    />
                  </label>
                  <label>
                    Notes <span className="optional-label">OPTIONAL</span>
                    <input
                      name="notes"
                      placeholder="Quality, condition, or anything to remember"
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
                (mode === 'planting' && freePlots.length === 0) ||
                (mode === 'harvest' && availablePlantings.length === 0)
              }
            >
              {saving
                ? 'Saving…'
                : mode === 'plot'
                  ? 'Add plot'
                  : mode === 'planting'
                    ? 'Add to schedule'
                    : 'Save harvest'}
              <ChevronRight size={15} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
