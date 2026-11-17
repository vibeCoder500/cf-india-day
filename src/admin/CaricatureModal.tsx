import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Costume, CustomLeader } from '../../shared/protocol';
import { COSTUMES, COSTUME_INFO, LIMITS, mediaUrl } from '../../shared/constants';
import { client } from '../lib/client';
import Button from '../components/Button';
import Caricature from '../components/Caricature';
import type { Actor } from '../components/Caricature';
import Modal from '../components/Modal';
import { DEFAULT_CARICATURE_OPTIONS, prepareLeaderPhoto, renderCaricature, selectLeaderFace } from './caricature';
import type { CaricatureOptions, CaricatureStyle, PreparedLeader, RenderedCaricature } from './caricature';

const STYLES: { id: CaricatureStyle; label: string; hint: string }[] = [
  { id: 'caricature', label: '🎭 Caricature', hint: 'Expressive comic pop + illustrated shading + ink outline' },
  { id: 'cartoon', label: '🎨 Clean Toon', hint: 'Illustrated cartoon shading + ink outline, exact proportions' },
  { id: 'cutout', label: '📸 Photo Cutout', hint: 'Natural levelled head cutout + cartoon ink outline' },
];

export interface CaricatureSaveResult {
  leader: CustomLeader;
  prepared?: PreparedLeader;
  options?: CaricatureOptions;
}

export default function CaricatureModal({
  initialLeader,
  initialPrepared,
  initialOptions,
  defaultCostume,
  onSave,
  onClose,
}: {
  initialLeader?: CustomLeader;
  initialPrepared?: PreparedLeader;
  initialOptions?: CaricatureOptions;
  defaultCostume: Costume;
  onSave: (res: CaricatureSaveResult) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialLeader?.name ?? initialPrepared?.suggestedName ?? '');
  const [costume, setCostume] = useState<Costume>(initialLeader?.costume ?? defaultCostume);
  const [prepared, setPrepared] = useState<PreparedLeader | undefined>(initialPrepared);
  const [opts, setOpts] = useState<CaricatureOptions>(() => ({
    ...(initialOptions ?? DEFAULT_CARICATURE_OPTIONS),
    handColor: initialLeader?.handColor ?? initialOptions?.handColor ?? initialPrepared?.detectedSkinHex,
    hairColor: initialOptions?.hairColor ?? initialPrepared?.detectedHairHex,
  }));
  const [rendered, setRendered] = useState<RenderedCaricature | null>(null);
  const [showBack, setShowBack] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const u of prevUrlsRef.current) URL.revokeObjectURL(u);
    };
  }, []);

  // Re-render caricature head whenever prepared photo or caricature sliders change.
  useEffect(() => {
    if (!prepared) return;
    let cancelled = false;
    setRendering(true);
    const timer = setTimeout(() => {
      renderCaricature(prepared, opts)
        .then((res) => {
          if (cancelled) {
            URL.revokeObjectURL(res.frontPreviewUrl);
            URL.revokeObjectURL(res.backPreviewUrl);
            return;
          }
          prevUrlsRef.current.push(res.frontPreviewUrl, res.backPreviewUrl);
          setRendered(res);
          setRendering(false);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to render caricature');
            setRendering(false);
          }
        });
    }, 45);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [prepared, opts]);

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setLoadingPhoto(true);
    try {
      const prep = await prepareLeaderPhoto(file);
      setPrepared(prep);
      if (!name.trim() && prep.suggestedName) setName(prep.suggestedName);
      setOpts((prev) => ({
        ...prev,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        handColor: prep.detectedSkinHex,
        hairColor: prep.detectedHairHex,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process leader photo');
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      let frontId = initialLeader?.frontId ?? '';
      let backId = initialLeader?.backId ?? '';
      const handColor = opts.handColor ?? rendered?.handColor ?? initialLeader?.handColor ?? '#b57a5f';

      if (rendered) {
        const [frontRes, backRes] = await Promise.all([
          client.uploadMedia(rendered.frontBlob),
          client.uploadMedia(rendered.backBlob),
        ]);
        frontId = frontRes.id;
        backId = backRes.id;
      }
      if (!frontId || !backId) {
        setError('Please choose a leader photo first');
        setSaving(false);
        return;
      }
      onSave({
        leader: {
          id: initialLeader?.id ?? '',
          name: name.trim().slice(0, LIMITS.leaderName),
          costume,
          frontId,
          backId,
          handColor,
        },
        prepared,
        options: opts,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload caricature');
      setSaving(false);
    }
  };

  const previewActor: Actor | null = rendered
    ? {
        id: 'preview',
        name: name || 'Leader',
        costume,
        front: rendered.frontPreviewUrl,
        back: rendered.backPreviewUrl,
        hand: opts.handColor ?? rendered.handColor,
      }
    : initialLeader
      ? {
          id: initialLeader.id || 'preview',
          name: name || initialLeader.name,
          costume,
          front: mediaUrl(initialLeader.frontId),
          back: mediaUrl(initialLeader.backId),
          hand: opts.handColor ?? initialLeader.handColor,
        }
      : null;

  return (
    <Modal title={initialLeader ? '🎭 Edit leader caricature' : '🎭 New leader caricature'} onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
        {/* Live animated bobblehead stage */}
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl bg-night/80 p-4 ring-1 ring-white/10">
          <div className="relative flex h-56 w-full items-center justify-center overflow-hidden">
            {previewActor ? (
              <div className="w-36">
                <Caricature actor={previewActor} back={showBack} className="cr-run cr-whee" />
              </div>
            ) : (
              <div className="text-center text-sm opacity-65">
                <p className="mb-2 text-4xl">📸</p>
                <p>Attach a leader photo to generate their animated caricature!</p>
              </div>
            )}
            {(loadingPhoto || rendering) && (
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-night/75 text-sm font-bold">
                {loadingPhoto ? '🧠 Detecting face & hair…' : '✨ Styling caricature…'}
              </div>
            )}
          </div>

          <div className="flex w-full flex-wrap justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowBack((v) => !v)}
              disabled={!previewActor}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20 disabled:opacity-40"
            >
              {showBack ? '👀 Show front' : '🔄 Check back silhouette'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingPhoto}
              className="rounded-lg bg-saffron/20 px-2.5 py-1 text-xs font-bold text-saffron hover:bg-saffron/30"
            >
              📷 {previewActor ? 'Change photo' : 'Choose photo'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          </div>
        </div>

        {/* Studio controls */}
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold tracking-wide uppercase opacity-75">Leader name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIMITS.leaderName}
              placeholder="e.g. Priya, Rahul, VP Eng"
              className="rounded-xl bg-white/10 px-3 py-2 text-sm outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron"
            />
          </label>

          <div>
            <p className="mb-1.5 text-xs font-bold tracking-wide uppercase opacity-75">Costume, prop & sound</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {COSTUMES.map((c) => {
                const info = COSTUME_INFO[c];
                const active = c === costume;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCostume(c)}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-xs font-bold transition ${
                      active ? 'bg-saffron text-night ring-2 ring-white' : 'bg-white/10 hover:bg-white/20'
                    }`}
                    title={info.prop}
                  >
                    <span className="text-base">{info.emoji}</span>
                    <span className="truncate">{info.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {prepared ? (
            <>
              {prepared.faces.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold opacity-75">Person in photo:</span>
                  {prepared.faces.map((_, fi) => (
                    <button
                      key={fi}
                      type="button"
                      onClick={() => {
                        const nextPrep = selectLeaderFace(prepared, fi);
                        setPrepared(nextPrep);
                        setOpts((o) => ({
                          ...o,
                          zoom: 1,
                          offsetX: 0,
                          offsetY: 0,
                          handColor: nextPrep.detectedSkinHex,
                          hairColor: nextPrep.detectedHairHex,
                        }));
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        prepared.faceIndex === fi ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      Face #{fi + 1}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <p className="mb-1.5 text-xs font-bold tracking-wide uppercase opacity-75">Caricature look</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setOpts((o) => ({ ...o, style: s.id }))}
                      title={s.hint}
                      className={`rounded-xl px-2 py-2 text-xs font-bold ${
                        opts.style === s.id ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {opts.style === 'caricature' && (
                <label className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold opacity-80">
                    <span>Comic exaggeration</span>
                    <span>{Math.round(opts.exaggeration * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(opts.exaggeration * 100)}
                    onChange={(e) => setOpts((o) => ({ ...o, exaggeration: Number(e.target.value) / 100 }))}
                    className="accent-saffron"
                  />
                </label>
              )}

              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold opacity-75">Head size ({opts.zoom.toFixed(2)}×)</span>
                  <input
                    type="range"
                    min={78}
                    max={130}
                    value={Math.round(opts.zoom * 100)}
                    onChange={(e) => setOpts((o) => ({ ...o, zoom: Number(e.target.value) / 100 }))}
                    className="accent-saffron"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold opacity-75">Left / Right</span>
                  <input
                    type="range"
                    min={-60}
                    max={60}
                    value={opts.offsetX}
                    onChange={(e) => setOpts((o) => ({ ...o, offsetX: Number(e.target.value) }))}
                    className="accent-saffron"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold opacity-75">Up / Down</span>
                  <input
                    type="range"
                    min={-60}
                    max={60}
                    value={opts.offsetY}
                    onChange={(e) => setOpts((o) => ({ ...o, offsetY: Number(e.target.value) }))}
                    className="accent-saffron"
                  />
                </label>
              </div>
            </>
          ) : (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-xs opacity-75">
              💡 Click <strong>Change photo</strong> to upload a new picture and fine-tune caricature exaggeration, zoom, and head alignment.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-bold opacity-85">
              <input
                type="color"
                value={opts.handColor ?? '#b57a5f'}
                onChange={(e) => setOpts((o) => ({ ...o, handColor: e.target.value }))}
                className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"
              />
              <span>Hand tone {costume === 'hero' ? '(Superhero wears red gloves)' : ''}</span>
            </label>
            {prepared && (
              <label className="flex items-center gap-2 text-xs font-bold opacity-85">
                <input
                  type="color"
                  value={opts.hairColor ?? prepared.detectedHairHex}
                  onChange={(e) => setOpts((o) => ({ ...o, hairColor: e.target.value }))}
                  className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"
                />
                <span>Back hair shade</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-100">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving || loadingPhoto || rendering || (!rendered && !initialLeader)}
        >
          {saving ? 'Uploading…' : initialLeader ? 'Save changes' : 'Add leader caricature'}
        </Button>
      </div>
    </Modal>
  );
}
