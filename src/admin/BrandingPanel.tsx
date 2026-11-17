import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Branding, Costume, CustomLeader, TeamPhoto } from '../../shared/protocol';
import {
  COSTUMES,
  COSTUME_INFO,
  DEFAULT_APP_NAME,
  DEFAULT_BRANDING,
  LIMITS,
  SPLASH_TEXT,
  mediaUrl,
} from '../../shared/constants';
import { client, useGame } from '../lib/client';
import Button from '../components/Button';
import Caricature, { DEFAULT_ACTORS, actorFromLeader } from '../components/Caricature';
import MusicToggle from '../components/MusicToggle';
import PartyShow from '../components/PartyShow';
import { DEFAULT_PHOTOS } from '../components/PhotoReel';
import CaricatureModal from './CaricatureModal';
import type { CaricatureSaveResult } from './CaricatureModal';
import { DEFAULT_CARICATURE_OPTIONS, compressTeamPhoto, prepareLeaderPhoto, renderCaricature } from './caricature';
import type { CaricatureOptions, PreparedLeader } from './caricature';

type EditingState =
  | { mode: 'create' }
  | { mode: 'edit'; index: number; leader: CustomLeader };

function pickNextCostume(existing: CustomLeader[]): Costume {
  const used = new Set(existing.map((l) => l.costume));
  for (const c of COSTUMES) {
    if (!used.has(c)) return c;
  }
  return COSTUMES[existing.length % COSTUMES.length];
}

export default function BrandingPanel({ onNotice }: { onNotice?: (msg: string) => void }) {
  const saved = useGame((s) => s.branding);
  const [appName, setAppName] = useState(saved.appName);
  const [splashText, setSplashText] = useState(saved.splashText);
  const [dirtyText, setDirtyText] = useState(false);

  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [leaderBusy, setLeaderBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const batchLeaderInputRef = useRef<HTMLInputElement>(null);
  // Keeps in-memory source analysis keyed by frontId during this session so batch-created leaders can be fine-tuned immediately.
  const preparedCache = useRef(new Map<string, { prepared: PreparedLeader; options: CaricatureOptions }>());

  useEffect(() => {
    if (!dirtyText) {
      setAppName(saved.appName);
      setSplashText(saved.splashText);
    }
  }, [saved.appName, saved.splashText, dirtyText]);

  const effectiveTitles = () => ({
    appName: appName.trim() || DEFAULT_APP_NAME,
    splashText: splashText.trim() || SPLASH_TEXT,
  });

  const commitBranding = (patch: Partial<Branding>, toast?: string) => {
    const titles = effectiveTitles();
    const next: Branding = {
      appName: patch.appName ?? titles.appName,
      splashText: patch.splashText ?? titles.splashText,
      photos: patch.photos !== undefined ? patch.photos : saved.photos,
      leaders: patch.leaders !== undefined ? patch.leaders : saved.leaders,
    };
    client.send({ t: 'branding:save', branding: next });
    setDirtyText(false);
    if (toast) onNotice?.(toast);
  };

  const saveTitles = (e: FormEvent) => {
    e.preventDefault();
    const cleanApp = appName.trim();
    const cleanSplash = splashText.trim();
    if (!cleanApp || !cleanSplash) return;
    commitBranding({ appName: cleanApp, splashText: cleanSplash }, 'Branding titles saved ✓');
  };

  // ---------- Revolving Team Photos ----------

  const onUploadPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);

    const baseList: TeamPhoto[] = saved.photos === null ? [] : [...saved.photos];
    const roomLeft = LIMITS.photos - baseList.length;
    if (roomLeft <= 0) {
      setError(`Maximum of ${LIMITS.photos} team photos reached — remove some first.`);
      return;
    }
    const batch = files.slice(0, roomLeft);

    try {
      const uploaded: TeamPhoto[] = [];
      for (let i = 0; i < batch.length; i++) {
        setPhotoBusy(`Optimizing & uploading photo ${i + 1} of ${batch.length}…`);
        const webp = await compressTeamPhoto(batch[i]);
        const { id } = await client.uploadMedia(webp);
        uploaded.push({ id });
      }
      commitBranding({ photos: [...baseList, ...uploaded] }, `Uploaded ${uploaded.length} team photo${uploaded.length > 1 ? 's' : ''} ✓`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setPhotoBusy(null);
    }
  };

  const movePhoto = (index: number, dir: -1 | 1) => {
    if (!saved.photos) return;
    const j = index + dir;
    if (j < 0 || j >= saved.photos.length) return;
    const next = [...saved.photos];
    [next[index], next[j]] = [next[j], next[index]];
    commitBranding({ photos: next });
  };

  const removePhoto = (index: number) => {
    if (!saved.photos) return;
    const next = saved.photos.filter((_, i) => i !== index);
    commitBranding({ photos: next }, 'Photo removed');
  };

  // ---------- Leadership Caricatures ----------

  const onBatchUploadLeaders = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);

    const baseList: CustomLeader[] = saved.leaders === null ? [] : [...saved.leaders];
    const roomLeft = LIMITS.leaders - baseList.length;
    if (roomLeft <= 0) {
      setError(`Maximum of ${LIMITS.leaders} leader caricatures reached — remove one first.`);
      return;
    }
    const batch = files.slice(0, roomLeft);

    try {
      const working = [...baseList];
      for (let i = 0; i < batch.length; i++) {
        setLeaderBusy(`✨ Creating caricature ${i + 1} of ${batch.length}…`);
        const prepared = await prepareLeaderPhoto(batch[i]);
        const rendered = await renderCaricature(prepared, DEFAULT_CARICATURE_OPTIONS);
        URL.revokeObjectURL(rendered.frontPreviewUrl);
        URL.revokeObjectURL(rendered.backPreviewUrl);
        const [frontRes, backRes] = await Promise.all([
          client.uploadMedia(rendered.frontBlob),
          client.uploadMedia(rendered.backBlob),
        ]);
        preparedCache.current.set(frontRes.id, { prepared, options: { ...DEFAULT_CARICATURE_OPTIONS } });
        const costume = pickNextCostume(working);
        working.push({
          id: '',
          name: prepared.suggestedName,
          costume,
          frontId: frontRes.id,
          backId: backRes.id,
          handColor: rendered.handColor,
        });
      }
      commitBranding(
        { leaders: working },
        `Created ${batch.length} leader caricature${batch.length > 1 ? 's' : ''} ✨`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create caricature');
    } finally {
      setLeaderBusy(null);
    }
  };

  const onModalSave = (res: CaricatureSaveResult) => {
    if (res.prepared && res.options) {
      preparedCache.current.set(res.leader.frontId, { prepared: res.prepared, options: res.options });
    }
    const baseList: CustomLeader[] = saved.leaders === null ? [] : [...saved.leaders];
    if (editing?.mode === 'edit') {
      baseList[editing.index] = res.leader;
      commitBranding({ leaders: baseList }, 'Leader caricature updated ✓');
    } else {
      baseList.push(res.leader);
      commitBranding({ leaders: baseList }, 'Leader caricature added ✨');
    }
    setEditing(null);
  };

  const changeLeaderCostume = (index: number, costume: Costume) => {
    if (!saved.leaders) return;
    const next = saved.leaders.map((l, i) => (i === index ? { ...l, costume } : l));
    commitBranding({ leaders: next });
  };

  const moveLeader = (index: number, dir: -1 | 1) => {
    if (!saved.leaders) return;
    const j = index + dir;
    if (j < 0 || j >= saved.leaders.length) return;
    const next = [...saved.leaders];
    [next[index], next[j]] = [next[j], next[index]];
    commitBranding({ leaders: next });
  };

  const removeLeader = (index: number) => {
    if (!saved.leaders) return;
    const next = saved.leaders.filter((_, i) => i !== index);
    commitBranding({ leaders: next }, 'Leader removed');
  };

  const resetAllBranding = () => {
    if (!confirm('Reset the app title, revolving photos, and leader caricatures back to the built-in defaults?')) return;
    setDirtyText(false);
    setAppName(DEFAULT_BRANDING.appName);
    setSplashText(DEFAULT_BRANDING.splashText);
    client.send({ t: 'branding:reset' });
    onNotice?.('Reset to default branding ✓');
  };

  const isDefaultAll =
    saved.appName === DEFAULT_BRANDING.appName &&
    saved.splashText === DEFAULT_BRANDING.splashText &&
    saved.photos === null &&
    saved.leaders === null;

  const previewBranding: Branding = {
    appName: appName.trim() || DEFAULT_APP_NAME,
    splashText: splashText.trim() || SPLASH_TEXT,
    photos: saved.photos,
    leaders: saved.leaders,
  };

  const cleanLabel = appName.trim() || DEFAULT_APP_NAME;
  const splashPresets = [
    `Welcome to ${cleanLabel} 🥳🤩`,
    `Yayyyyyyyy, itssss ${cleanLabel} 🥳🤩`,
    `Let's gooo ${cleanLabel} 🚀🎉`,
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar + live splash preview launcher */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-saffron/15 p-4 ring-1 ring-saffron/35">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-extrabold text-saffron">🎨 Portal Branding & Caricatures</h2>
          <p className="text-sm opacity-85">
            Customize the title, revolving team photos, and AI-generated leader caricatures — changes go live across all phones, surveys, and the big screen immediately!
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setPreviewOpen(true)}>
            ▶ Preview Splash Show
          </Button>
          {!isDefaultAll && (
            <Button variant="ghost" onClick={resetAllBranding}>
              ↺ Reset all
            </Button>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-100 ring-1 ring-red-400/40">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="rounded px-2 py-0.5 hover:bg-white/10">
            ✕
          </button>
        </div>
      )}

      {/* 1. App Title & Splash Headline */}
      <form onSubmit={saveTitles} className="flex flex-col gap-3.5 rounded-2xl bg-white/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl font-bold">🏷️ App & Splash Title</h3>
          {dirtyText && <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-200">Unsaved edits</span>}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wide uppercase opacity-75">
            Event / App Title <span className="font-normal normal-case opacity-70">(shown on Lobby QR screen, browser tab, surveys & templates)</span>
          </span>
          <input
            value={appName}
            onChange={(e) => {
              setAppName(e.target.value);
              setDirtyText(true);
            }}
            maxLength={LIMITS.appName}
            placeholder="e.g. eDAP Offsite"
            className="rounded-xl bg-white/10 px-4 py-2.5 text-base font-semibold outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wide uppercase opacity-75">
            Revolving Splash Headline <span className="font-normal normal-case opacity-70">(waving 3-D text inside the revolving team photos)</span>
          </span>
          <input
            value={splashText}
            onChange={(e) => {
              setSplashText(e.target.value);
              setDirtyText(true);
            }}
            maxLength={LIMITS.splashText}
            placeholder="e.g. Welcome to eDAP Offsite 🥳🤩"
            className="rounded-xl bg-white/10 px-4 py-2.5 text-base font-semibold outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs opacity-65">Quick presets:</span>
          {splashPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setSplashText(preset.slice(0, LIMITS.splashText));
                setDirtyText(true);
              }}
              className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {dirtyText && (
            <Button
              variant="ghost"
              onClick={() => {
                setAppName(saved.appName);
                setSplashText(saved.splashText);
                setDirtyText(false);
              }}
            >
              Discard
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!appName.trim() || !splashText.trim() || !dirtyText}>
            Save titles
          </Button>
        </div>
      </form>

      {/* 2. Revolving Team Photos */}
      <section className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h3 className="font-display text-xl font-bold">📸 Revolving Team Photos</h3>
            <p className="text-xs opacity-70">
              {saved.photos === null
                ? `Currently using the ${DEFAULT_PHOTOS.length} built-in team photos. Upload more or replace them anytime!`
                : `${saved.photos.length}/${LIMITS.photos} custom team photo${saved.photos.length === 1 ? '' : 's'} revolving around the title.`}
            </p>
          </div>
          <Button
            variant="primary"
            disabled={photoBusy !== null || (saved.photos !== null && saved.photos.length >= LIMITS.photos)}
            onClick={() => photoInputRef.current?.click()}
          >
            {saved.photos === null ? '＋ Upload team photos' : '＋ Add photos'}
          </Button>
          <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={onUploadPhotos} className="hidden" />
          {saved.photos !== null && saved.photos.length > 0 && (
            <Button onClick={() => confirm('Remove all revolving photos so only the waving title is shown?') && commitBranding({ photos: [] }, 'Cleared photos')}>
              Clear all
            </Button>
          )}
          {saved.photos !== null && (
            <Button variant="ghost" onClick={() => commitBranding({ photos: null }, 'Restored default team photos ✓')}>
              ↺ Default photos
            </Button>
          )}
        </div>

        {photoBusy && (
          <p className="animate-pulse rounded-xl bg-saffron/20 px-3 py-2 text-sm font-bold text-saffron">{photoBusy}</p>
        )}

        {saved.photos === null ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {DEFAULT_PHOTOS.map((src, i) => (
              <div key={src} className="relative overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
                <img src={src} alt={`Built-in team photo ${i + 1}`} className="aspect-video w-full object-cover opacity-85" />
                <span className="absolute top-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold">Team {i + 1}</span>
              </div>
            ))}
          </div>
        ) : saved.photos.length === 0 ? (
          <p className="rounded-xl bg-black/20 p-4 text-center text-sm opacity-70">
            No revolving photos — only the waving headline will appear on the splash screen. Click <strong>＋ Add photos</strong> to attach team pics.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {saved.photos.map((p, i) => (
              <div key={p.id} className="group relative overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/15">
                <img src={mediaUrl(p.id)} alt={`Team photo ${i + 1}`} className="aspect-video w-full object-cover" />
                <div className="flex items-center justify-between bg-night/90 px-2 py-1 text-xs">
                  <span className="font-bold opacity-75">#{i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => movePhoto(i, -1)}
                      title="Move earlier"
                      className="rounded px-1.5 py-0.5 hover:bg-white/15 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={i === saved.photos!.length - 1}
                      onClick={() => movePhoto(i, 1)}
                      title="Move later"
                      className="rounded px-1.5 py-0.5 hover:bg-white/15 disabled:opacity-30"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      title="Remove photo"
                      className="rounded px-1.5 py-0.5 text-red-300 hover:bg-red-500/25"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Leadership Caricatures */}
      <section className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h3 className="font-display text-xl font-bold">🎭 Leadership Caricatures</h3>
            <p className="text-xs opacity-70">
              {saved.leaders === null
                ? `Currently showing the ${DEFAULT_ACTORS.length} built-in leader caricatures. Attach your leaders’ photos and we automatically cut out, level, and turn them into animated bobblehead caricatures!`
                : `${saved.leaders.length}/${LIMITS.leaders} custom leader caricature${saved.leaders.length === 1 ? '' : 's'} in the splash band & surprise zoomies.`}
            </p>
          </div>
          <Button
            variant="primary"
            disabled={leaderBusy !== null || (saved.leaders !== null && saved.leaders.length >= LIMITS.leaders)}
            onClick={() => batchLeaderInputRef.current?.click()}
          >
            ✨ Upload leader photos
          </Button>
          <input ref={batchLeaderInputRef} type="file" accept="image/*" multiple onChange={onBatchUploadLeaders} className="hidden" />
          <Button
            disabled={leaderBusy !== null || (saved.leaders !== null && saved.leaders.length >= LIMITS.leaders)}
            onClick={() => setEditing({ mode: 'create' })}
          >
            🎛️ Caricature studio
          </Button>
          {saved.leaders !== null && saved.leaders.length > 0 && (
            <Button onClick={() => confirm('Turn off all leader caricatures (hides the band and surprise zoomies)?') && commitBranding({ leaders: [] }, 'Hid leader caricatures')}>
              Hide all
            </Button>
          )}
          {saved.leaders !== null && (
            <Button variant="ghost" onClick={() => commitBranding({ leaders: null }, 'Restored default leaders ✓')}>
              ↺ Default leaders
            </Button>
          )}
        </div>

        {leaderBusy && (
          <p className="animate-pulse rounded-xl bg-saffron/20 px-3 py-2 text-sm font-bold text-saffron">{leaderBusy}</p>
        )}

        {saved.leaders === null ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {DEFAULT_ACTORS.map((actor) => {
              const info = COSTUME_INFO[actor.costume];
              return (
                <div key={actor.id} className="flex flex-col items-center gap-1 rounded-xl bg-black/30 p-2.5 ring-1 ring-white/10">
                  <div className="w-20 opacity-90">
                    <Caricature actor={actor} />
                  </div>
                  <span className="text-[11px] font-bold opacity-80">
                    {info.emoji} {actor.name} · {info.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : saved.leaders.length === 0 ? (
          <p className="rounded-xl bg-black/20 p-4 text-center text-sm opacity-70">
            No leader caricatures active. Click <strong>✨ Upload leader photos</strong> to turn your leaders’ pictures into animated caricatures!
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {saved.leaders.map((leader, i) => {
              const actor = actorFromLeader(leader, i);
              return (
                <div key={actor.id} className="flex flex-col items-center gap-2 rounded-2xl bg-black/35 p-3 ring-1 ring-white/15">
                  <div className="w-24">
                    <Caricature actor={actor} className="cr-run" />
                  </div>
                  <p className="max-w-full truncate text-sm font-bold">{leader.name || COSTUME_INFO[leader.costume].label}</p>
                  <select
                    aria-label="Leader costume"
                    value={leader.costume}
                    onChange={(e) => changeLeaderCostume(i, e.target.value as Costume)}
                    className="w-full rounded-lg bg-[#1d1440] px-2 py-1 text-xs font-bold ring-1 ring-white/15 outline-none focus:ring-saffron"
                  >
                    {COSTUMES.map((c) => (
                      <option key={c} value={c}>
                        {COSTUME_INFO[c].emoji} {COSTUME_INFO[c].label}
                      </option>
                    ))}
                  </select>
                  <div className="flex w-full items-center justify-between gap-1 pt-1 text-xs">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => moveLeader(i, -1)}
                        title="Move left"
                        className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={i === saved.leaders!.length - 1}
                        onClick={() => moveLeader(i, 1)}
                        title="Move right"
                        className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-30"
                      >
                        →
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing({ mode: 'edit', index: i, leader })}
                        className="rounded-lg bg-white/10 px-2 py-1 font-bold hover:bg-white/20"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLeader(i)}
                        title="Remove leader"
                        className="rounded-lg bg-red-500/20 px-2 py-1 font-bold text-red-200 hover:bg-red-500/35"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing && (
        <CaricatureModal
          initialLeader={editing.mode === 'edit' ? editing.leader : undefined}
          initialPrepared={editing.mode === 'edit' ? preparedCache.current.get(editing.leader.frontId)?.prepared : undefined}
          initialOptions={editing.mode === 'edit' ? preparedCache.current.get(editing.leader.frontId)?.options : undefined}
          defaultCostume={pickNextCostume(saved.leaders ?? [])}
          onSave={onModalSave}
          onClose={() => setEditing(null)}
        />
      )}

      {previewOpen && (
        <div role="dialog" aria-modal="true" aria-label="Splash preview" className="fixed inset-0 z-50 overflow-hidden bg-night">
          <PartyShow durationMs={10_000} onDone={() => undefined} big branding={previewBranding} />
          <MusicToggle className="fixed bottom-6 left-6 z-20 text-xl" />
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="fixed top-4 right-4 z-20 rounded-full bg-saffron px-5 py-2.5 font-display text-base font-extrabold text-night shadow-2xl"
          >
            ✕ Close preview
          </button>
        </div>
      )}
    </div>
  );
}
