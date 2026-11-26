/**
 * Administration LOCALE de démonstration.
 *
 * ⚠ Non sécurisée : elle n'est protégée par aucun mot de passe et fonctionne
 * uniquement sur les données de ce navigateur. Avant toute mise en ligne
 * publique, elle devra être placée derrière une authentification avec rôles
 * (fondateur, modérateurs) et des règles d'accès côté serveur.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  POST_TYPES,
  STATUS_LABELS,
  VERIFICATION_LABELS,
  displayAuthor,
  isPublic,
  typeLabel,
  type Category,
  type Post,
  type PostStatus,
  type PostType,
  type Report,
  type VerificationLevel,
} from '../models/types';
import { useData } from '../services/store';
import * as repo from '../services/repository';
import { storageEstimate } from '../services/db';
import { seedDemoData } from '../data/demo';
import { AudioPlayer } from '../components/AudioPlayer';
import { MediaImage } from '../components/MediaImage';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { cx, downloadBlob, formatBytes, formatDateTime, isSafeUrl, uid } from '../lib/util';
import { navigate, type Route } from '../lib/router';

type Tab = 'tableau' | 'contributions' | 'publications' | 'signalements' | 'categories' | 'parametres';
const PENDING: PostStatus[] = ['en_attente', 'en_verification', 'infos_demandees'];

function StatusBadge({ s }: { s: PostStatus }) {
  return <span className={cx('status', `status--${s}`)}>{STATUS_LABELS[s]}</span>;
}

/* ================================================================== */
/* Panneau d'examen d'une contribution / publication                   */
/* ================================================================== */

function Review({ post, onClose }: { post: Post; onClose: () => void }) {
  const { categories, categoryName } = useData();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(post);
  const [notes, setNotes] = useState(post.private.moderationNotes ?? '');
  const [message, setMessage] = useState(post.private.messageToAuthor ?? '');
  const [schedule, setSchedule] = useState('');
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setDraft(post);
    setNotes(post.private.moderationNotes ?? '');
    setMessage(post.private.messageToAuthor ?? '');
  }, [post]);
  useEffect(() => headRef.current?.focus(), [post.id]);

  const save = async (patch: Partial<Post>, msg: string) => {
    await repo.savePost({
      ...post,
      ...(edit ? { title: draft.title, text: draft.text, transcription: draft.transcription, categoryId: draft.categoryId, type: draft.type, reflection: draft.reflection } : {}),
      ...patch,
      private: { ...post.private, moderationNotes: notes.trim() || undefined, messageToAuthor: message.trim() || undefined, ...(patch.private ?? {}) },
    });
    setEdit(false);
    toast(msg);
  };

  const setStatus = (status: PostStatus, msg: string, extra: Partial<Post> = {}) => save({ status, ...extra }, msg);

  const publishNow = () => setStatus('publie', 'Publié dans le fil.', { publishedAt: new Date().toISOString(), scheduledAt: undefined });

  const proofs = post.private.proofs ?? [];

  return (
    <div className="review" data-testid="review-panel">
      <div className="review__head">
        <button type="button" className="back" onClick={onClose}>
          <Icon name="back" size={18} /> Retour à la liste
        </button>
        <StatusBadge s={post.status} />
      </div>
      <h2 ref={headRef} tabIndex={-1} className="review__title">
        {post.title || 'Sans titre'}
      </h2>
      <p className="muted small">
        {typeLabel(post.type)} · {categoryName(post.categoryId)} · {displayAuthor(post)}
        {post.anonymous && post.authorName ? ` (pseudonyme saisi : ${post.authorName})` : ''} · reçu le {formatDateTime(post.submittedAt ?? post.createdAt)}
        {post.demo && ' · exemple fictif'}
      </p>

      {post.private.withdrawalRequested && (
        <p className="alert">
          <strong>L’auteur demande le retrait.</strong> {post.private.withdrawalReason}
        </p>
      )}

      <div className="review__grid">
        <div className="review__content">
          {edit ? (
            <div className="block">
              <p className="muted small">Proposer des modifications. Les corrections importantes doivent être soumises à l’auteur avant publication.</p>
              <div className="grid-2">
                <label className="field">
                  <span>Type</span>
                  <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as PostType })}>
                    {POST_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Catégorie</span>
                  <select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Titre</span>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label className="field">
                <span>Texte</span>
                <textarea rows={6} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              </label>
              <label className="field">
                <span>Réflexion</span>
                <textarea rows={2} value={draft.reflection ?? ''} onChange={(e) => setDraft({ ...draft, reflection: e.target.value || undefined })} />
              </label>
              {post.audio && (
                <label className="field">
                  <span>Transcription</span>
                  <textarea rows={4} value={draft.transcription ?? ''} onChange={(e) => setDraft({ ...draft, transcription: e.target.value || undefined })} />
                </label>
              )}
              <div className="row-end">
                <button type="button" className="btn btn--ghost" onClick={() => (setEdit(false), setDraft(post))}>
                  Annuler
                </button>
                <button type="button" className="btn" onClick={() => save({}, 'Modifications enregistrées.')}>
                  Enregistrer les modifications
                </button>
              </div>
            </div>
          ) : (
            <>
              {post.type === 'paradoxe' && (
                <div className="paradox">
                  <div>
                    <p className="paradox__label">La promesse</p>
                    <p className="paradox__text">{post.promise}</p>
                  </div>
                  <div>
                    <p className="paradox__label paradox__label--real">La réalité</p>
                    <p className="paradox__text">{post.reality}</p>
                  </div>
                </div>
              )}
              {post.text ? <p className="prewrap">{post.text}</p> : <p className="muted">(Pas de texte écrit : témoignage vocal.)</p>}
              {post.reflection && (
                <blockquote className="reflection">
                  <span className="small muted">Réflexion personnelle</span>
                  <p className="prewrap">{post.reflection}</p>
                </blockquote>
              )}
              {post.audio && (
                <>
                  <p className="small">
                    <strong>Enregistrement original</strong> · {post.audio.source === 'micro' ? 'enregistré au micro' : post.audio.source === 'import' ? 'fichier importé' : 'démonstration'} ·{' '}
                    {formatBytes(post.audio.size)} ·{' '}
                    {post.audio.publishVoice ? <span>diffusion de la voix autorisée</span> : <strong>voix NON publiable : seule la transcription peut être publiée</strong>}
                  </p>
                  <AudioPlayer post={post} startOpen />
                </>
              )}
              {post.images.length > 0 && (
                <div className="card__images card__images--grid">
                  {post.images.map((m, i) => (
                    <MediaImage key={m.id} id={m.id} alt={`Image ${i + 1}`} className="card__img" />
                  ))}
                </div>
              )}
              {post.sources.length > 0 && (
                <div className="sources">
                  <p className="small muted">Sources à vérifier</p>
                  <ul>
                    {post.sources.map((s, i) => (
                      <li key={i}>
                        {isSafeUrl(s.url) ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                            {s.label || s.url}
                          </a>
                        ) : (
                          s.url
                        )}{' '}
                        <span className="muted small">{s.url}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEdit(true)}>
                <Icon name="edit" size={16} /> Modifier / proposer des corrections
              </button>
            </>
          )}
        </div>

        <aside className="review__side">
          <div className="private-box">
            <p className="private-box__title">
              <Icon name="shield" size={16} /> Informations privées
            </p>
            <p className="small">E-mail : {post.private.email ? <a href={`mailto:${post.private.email}`}>{post.private.email}</a> : <span className="muted">non fourni</span>}</p>
            <p className="small">
              Consentement publication : {post.consent.publication ? 'oui' : 'non'}
              {post.audio && <> · voix identifiable comprise : {post.consent.voiceIdentifiable ? 'oui' : 'non'}</>}
              {post.consent.at && <> · {formatDateTime(post.consent.at)}</>}
            </p>
            <p className="small">Justificatifs : {proofs.length === 0 && <span className="muted">aucun</span>}</p>
            {proofs.length > 0 && (
              <ul className="plain small">
                {proofs.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="linkish"
                      onClick={async () => {
                        const b = await repo.getMediaBlob(p.id);
                        if (b) downloadBlob(b, p.name ?? 'justificatif');
                      }}
                    >
                      <Icon name="download" size={14} /> {p.name ?? 'justificatif'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="field">
            <span>Niveau de vérification (affiché publiquement)</span>
            <select value={post.verification} onChange={(e) => save({ verification: e.target.value as VerificationLevel }, 'Niveau de vérification mis à jour.')}>
              {Object.entries(VERIFICATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Notes internes (jamais publiées)</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (post.private.moderationNotes ?? '') && save({}, 'Note interne enregistrée.')} data-testid="admin-notes" />
          </label>
          <label className="field">
            <span>Message à l’auteur (précisions, modifications proposées)</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>

          <div className="actions-stack">
            {PENDING.includes(post.status) || post.status === 'valide' || post.status === 'refuse' ? (
              <>
                <button type="button" className="btn btn--hope" onClick={publishNow} data-testid="approve-publish">
                  <Icon name="check" size={16} /> Valider et publier
                </button>
                {post.status !== 'valide' && (
                  <button type="button" className="btn btn--ghost" onClick={() => setStatus('valide', 'Contribution validée (non encore publiée).')}>
                    Valider sans publier
                  </button>
                )}
                {post.status !== 'en_verification' && (
                  <button type="button" className="btn btn--ghost" onClick={() => setStatus('en_verification', 'Passée en cours de vérification.')}>
                    Marquer « en cours de vérification »
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => (message.trim() ? setStatus('infos_demandees', 'Demande de précisions enregistrée.') : toast('Écrivez d’abord votre message à l’auteur.'))}
                >
                  Demander des précisions
                </button>
                {post.status !== 'refuse' && (
                  <button type="button" className="btn btn--danger" onClick={() => setStatus('refuse', 'Contribution refusée.')} data-testid="reject">
                    Refuser
                  </button>
                )}
              </>
            ) : null}
            {(post.status === 'publie' || post.status === 'programme') && (
              <button type="button" className="btn btn--ghost" onClick={() => setStatus('valide', 'Publication retirée du fil (dépubliée).')}>
                Dépublier
              </button>
            )}
            {post.status !== 'publie' && (
              <div className="schedule">
                <input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} aria-label="Date de publication programmée" />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={!schedule}
                  onClick={() => setStatus('programme', `Publication programmée le ${formatDateTime(new Date(schedule).toISOString())}.`, { scheduledAt: new Date(schedule).toISOString(), publishedAt: new Date(schedule).toISOString() })}
                >
                  Programmer
                </button>
              </div>
            )}
            {isPublic(post) && (
              <a className="btn btn--ghost" href={`#/publication/${post.id}`}>
                Voir dans le fil
              </a>
            )}
            {post.status !== 'archive' && (
              <button type="button" className="btn btn--ghost" onClick={() => setStatus('archive', 'Archivé.')}>
                Archiver
              </button>
            )}
            {post.status !== 'retire' && (
              <button type="button" className="btn btn--ghost" onClick={() => setStatus('retire', 'Retiré.')}>
                Retirer
              </button>
            )}
            <button
              type="button"
              className="btn btn--danger btn--ghost"
              onClick={async () => {
                if (!window.confirm('Supprimer définitivement cette publication et tous ses fichiers ?')) return;
                await repo.deletePost(post.id);
                toast('Supprimé définitivement.');
                onClose();
              }}
            >
              <Icon name="trash" size={16} /> Supprimer définitivement
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Liste                                                               */
/* ================================================================== */

function PostTable({ list, onOpen, empty }: { list: Post[]; onOpen: (id: string) => void; empty: string }) {
  const { categoryName } = useData();
  if (!list.length) return <p className="empty">{empty}</p>;
  return (
    <ul className="list">
      {list.map((p) => (
        <li key={p.id} className="list__item">
          <button type="button" className="list__main list__main--btn" onClick={() => onOpen(p.id)} data-testid="admin-item">
            <p className="list__title">
              {p.audio && <Icon name="mic" size={15} />} {p.title || 'Sans titre'}
            </p>
            <p className="muted small">
              {typeLabel(p.type)} · {categoryName(p.categoryId)} · {displayAuthor(p)} · {formatDateTime(p.submittedAt ?? p.updatedAt)}
              {p.demo && ' · exemple fictif'}
              {p.private.withdrawalRequested && ' · RETRAIT DEMANDÉ'}
            </p>
          </button>
          <div className="list__side">
            <StatusBadge s={p.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ================================================================== */
/* Catégories                                                          */
/* ================================================================== */

function Categories() {
  const { categories, posts } = useData();
  const toast = useToast();
  const [list, setList] = useState<Category[]>(categories);
  const [name, setName] = useState('');
  useEffect(() => setList(categories), [categories]);
  const commit = async (next: Category[]) => {
    setList(next);
    await repo.saveCategories(next);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  return (
    <div className="block">
      <ul className="list">
        {list.map((c, i) => {
          const used = posts.filter((p) => p.categoryId === c.id).length;
          return (
            <li key={c.id} className="list__item">
              <input
                className="inline-input"
                value={c.name}
                aria-label={`Nom de la catégorie ${i + 1}`}
                onChange={(e) => setList((l) => l.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                onBlur={() => commit(list)}
              />
              <div className="list__side">
                <span className="muted small">{used} publication{used > 1 ? 's' : ''}</span>
                <button type="button" className="icon-btn" aria-label="Monter" onClick={() => move(i, -1)} disabled={i === 0}>
                  <Icon name="chevronUp" size={16} />
                </button>
                <button type="button" className="icon-btn" aria-label="Descendre" onClick={() => move(i, 1)} disabled={i === list.length - 1}>
                  <Icon name="chevronDown" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Supprimer ${c.name}`}
                  onClick={() => {
                    if (used) return toast('Catégorie utilisée : déplacez d’abord ses publications.');
                    commit(list.filter((x) => x.id !== c.id));
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          commit([...list, { id: uid('cat'), name: name.trim(), order: list.length }]);
          setName('');
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie" aria-label="Nouvelle catégorie" />
        <button className="btn btn--sm" type="submit">
          <Icon name="plus" size={16} /> Ajouter
        </button>
      </form>
    </div>
  );
}

/* ================================================================== */
/* Paramètres et données                                               */
/* ================================================================== */

function SettingsPanel() {
  const { settings, posts } = useData();
  const toast = useToast();
  const [founderName, setFounderName] = useState(settings.founderName);
  const [maxMin, setMaxMin] = useState(settings.maxAudioSeconds / 60);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => setFounderName(settings.founderName), [settings.founderName]);
  const demoCount = posts.filter((p) => p.demo).length;

  return (
    <div className="block">
      <h3 className="h3">Paramètres</h3>
      <div className="grid-2">
        <label className="field">
          <span>Nom du fondateur (affiché sur ses publications)</span>
          <input value={founderName} onChange={(e) => setFounderName(e.target.value)} />
        </label>
        <label className="field">
          <span>Durée maximale d’un témoignage vocal (minutes)</span>
          <input type="number" min={1} max={30} value={maxMin} onChange={(e) => setMaxMin(Number(e.target.value))} />
        </label>
      </div>
      <button type="button" className="btn btn--sm" onClick={async () => (await repo.saveSettings({ founderName: founderName.trim() || 'Jérémy', maxAudioSeconds: Math.max(1, Math.min(30, maxMin)) * 60 }), toast('Paramètres enregistrés.'))}>
        Enregistrer
      </button>

      <h3 className="h3">Sauvegarde et exportation</h3>
      <p className="muted small">L’export contient toutes les données locales, y compris les fichiers audio et images, dans un fichier JSON.</p>
      <div className="row wrap">
        <button type="button" className="btn btn--ghost btn--sm" onClick={async () => downloadBlob(await repo.exportAll(), `hlh-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`)}>
          <Icon name="download" size={16} /> Exporter les données
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => importRef.current?.click()}>
          <Icon name="upload" size={16} /> Restaurer une sauvegarde
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !window.confirm('Restaurer cette sauvegarde remplacera toutes les données actuelles de ce navigateur. Continuer ?')) return;
            try {
              const n = await repo.importAll(f);
              toast(`${n} publications restaurées.`);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Restauration impossible.');
            }
          }}
        />
      </div>

      <h3 className="h3">Données de démonstration</h3>
      <p className="muted small">{demoCount} publication(s) fictive(s) marquée(s) « Exemple fictif ».</p>
      <div className="row wrap">
        <button type="button" className="btn btn--ghost btn--sm" disabled={!demoCount} onClick={async () => toast(`${await repo.removeDemoData()} exemple(s) supprimé(s).`)}>
          Supprimer les exemples fictifs
        </button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={demoCount > 0} onClick={async () => (await seedDemoData(), toast('Exemples fictifs recréés.'))}>
          Recréer les exemples
        </button>
        <button
          type="button"
          className="btn btn--danger btn--sm"
          onClick={async () => {
            if (!window.confirm('Effacer TOUTES les données locales (publications, voix, images, favoris) ? Cette action est irréversible.')) return;
            await repo.resetAll();
            await seedDemoData();
            await repo.markSeeded();
            toast('Données réinitialisées.');
          }}
        >
          Tout réinitialiser
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

export function Admin({ route }: { route: Route }) {
  const { posts, categoryName } = useData();
  const toast = useToast();
  const tab = (route.segments[1] as Tab | undefined) ?? 'tableau';
  const openId = route.query.get('id');
  const [reports, setReports] = useState<Report[]>([]);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});

  useEffect(() => {
    repo.listReports().then(setReports);
    storageEstimate().then(setStorage);
  }, [posts]);
  useEffect(() => repo.subscribe(() => repo.listReports().then(setReports)), []);

  const pending = useMemo(() => posts.filter((p) => PENDING.includes(p.status)).sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? '')), [posts]);
  const others = useMemo(
    () => posts.filter((p) => !PENDING.includes(p.status) && p.status !== 'brouillon').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [posts],
  );
  const withdrawals = posts.filter((p) => p.private.withdrawalRequested && p.status !== 'retire');
  const publicCount = posts.filter((p) => isPublic(p)).length;
  const audioCount = posts.filter((p) => p.audio && p.status !== 'brouillon').length;
  const contributors = new Set(posts.filter((p) => !p.byFounder && !p.demo && p.status !== 'brouillon').map((p) => p.private.email || p.authorName || p.id)).size;
  const openReports = reports.filter((r) => r.status === 'ouvert');

  const go = (t: Tab, id?: string) => navigate(`/admin/${t}${id ? `?id=${id}` : ''}`);
  const opened = openId ? posts.find((p) => p.id === openId) : undefined;

  const tabs: [Tab, string, number?][] = [
    ['tableau', 'Tableau de bord'],
    ['contributions', 'Contributions', pending.length],
    ['publications', 'Publications'],
    ['signalements', 'Signalements', openReports.length],
    ['categories', 'Catégories'],
    ['parametres', 'Paramètres et données'],
  ];

  return (
    <section className="page page--wide admin" data-testid="admin">
      <div className="admin-warning" role="note">
        <Icon name="shield" size={18} />
        <p>
          <strong>Administration locale de démonstration, non sécurisée.</strong> Aucun mot de passe ne la protège et elle ne gère que les données de ce navigateur. Elle sera placée
          derrière une authentification avec rôles avant toute mise en ligne publique.
        </p>
      </div>
      <div className="admin__head">
        <h1 className="page__title">Administration</h1>
        <a className="btn btn--sm" href="#/temoigner?mode=fondateur">
          <Icon name="plus" size={16} /> Nouvelle publication
        </a>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} className={cx('tab', tab === id && 'is-on')} onClick={() => go(id)}>
            {label}
            {n ? <span className="tab__n">{n}</span> : null}
          </button>
        ))}
      </div>

      {opened ? (
        <Review post={opened} onClose={() => go(tab)} />
      ) : (
        <>
          {tab === 'tableau' && (
            <>
              <div className="stats">
                <div className="stat">
                  <span className="stat__n">{publicCount}</span>
                  <span className="stat__l">publications en ligne</span>
                </div>
                <button type="button" className="stat stat--btn" onClick={() => go('contributions')}>
                  <span className="stat__n">{pending.length}</span>
                  <span className="stat__l">contributions en attente</span>
                </button>
                <div className="stat">
                  <span className="stat__n">{audioCount}</span>
                  <span className="stat__l">témoignages audio</span>
                </div>
                <div className="stat">
                  <span className="stat__n">{contributors}</span>
                  <span className="stat__l">contributeurs</span>
                </div>
                <button type="button" className="stat stat--btn" onClick={() => go('signalements')}>
                  <span className="stat__n">{openReports.length}</span>
                  <span className="stat__l">signalements ouverts</span>
                </button>
                <div className="stat">
                  <span className="stat__n">{formatBytes(storage.usage)}</span>
                  <span className="stat__l">
                    stockage utilisé{storage.quota ? ` sur ${formatBytes(storage.quota)}` : ''}
                    {storage.persisted ? ' · persistant' : ''}
                  </span>
                </div>
              </div>
              {withdrawals.length > 0 && (
                <>
                  <h2 className="h3">Demandes de retrait</h2>
                  <PostTable list={withdrawals} onOpen={(id) => go('contributions', id)} empty="" />
                </>
              )}
              <h2 className="h3">À examiner en priorité</h2>
              <PostTable list={pending.slice(0, 5)} onOpen={(id) => go('contributions', id)} empty="Aucune contribution en attente. Tout est à jour." />
            </>
          )}
          {tab === 'contributions' && <PostTable list={pending} onOpen={(id) => go('contributions', id)} empty="Aucune contribution en attente de modération." />}
          {tab === 'publications' && <PostTable list={others} onOpen={(id) => go('publications', id)} empty="Aucune publication." />}
          {tab === 'signalements' && (
            <ul className="list">
              {reports.length === 0 && <li className="empty">Aucun signalement.</li>}
              {reports.map((r) => {
                const p = posts.find((x) => x.id === r.postId);
                return (
                  <li key={r.id} className="list__item">
                    <div className="list__main">
                      <p className="list__title">{r.reason}</p>
                      <p className="muted small">
                        {p ? `« ${p.title} » (${categoryName(p.categoryId)})` : 'Publication supprimée'} · {formatDateTime(r.createdAt)}
                      </p>
                      {r.details && <p className="small">{r.details}</p>}
                    </div>
                    <div className="list__side">
                      <span className={cx('status', r.status === 'ouvert' ? 'status--en_attente' : 'status--archive')}>{r.status === 'ouvert' ? 'Ouvert' : r.status === 'traite' ? 'Traité' : 'Rejeté'}</span>
                      {p && (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => go('publications', p.id)}>
                          Examiner
                        </button>
                      )}
                      {r.status === 'ouvert' && (
                        <>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={async () => (await repo.saveReport({ ...r, status: 'traite' }), toast('Signalement traité.'))}>
                            Traité
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => repo.saveReport({ ...r, status: 'rejete' })}>
                            Rejeter
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {tab === 'categories' && <Categories />}
          {tab === 'parametres' && <SettingsPanel />}
        </>
      )}
    </section>
  );
}
