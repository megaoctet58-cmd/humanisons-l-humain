/** Carte d'une publication dans le fil (et page dédiée en mode « full »). */
import { useState } from 'react';
import { REACTIONS, VERIFICATION_LABELS, displayAuthor, publicDate, typeLabel, type Post } from '../models/types';
import { useData } from '../services/store';
import * as repo from '../services/repository';
import { AudioPlayer } from './AudioPlayer';
import { Icon } from './Icon';
import { MediaImage } from './MediaImage';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { cx, formatDate, isSafeUrl } from '../lib/util';
import { navigate, postUrl } from '../lib/router';

const REPORT_REASONS = [
  'Propos injurieux, harcèlement ou haine',
  'Données personnelles d’un tiers',
  'Enregistrement non autorisé d’un tiers',
  'Information fausse ou manipulée',
  'Publicité déguisée',
  'Autre raison',
];

/** Explication honnête du statut de vérification. */
function verificationNote(p: Post): string | null {
  if (p.demo) return 'Exemple fictif créé pour la démonstration du prototype.';
  if (p.type === 'temoignage') return 'Témoignage accepté par la modération. Il exprime une expérience personnelle et n’est pas présenté comme un fait vérifié.';
  if (p.type === 'actualite' || p.verification !== 'non_verifie') return `Vérification : ${VERIFICATION_LABELS[p.verification]}.`;
  if (p.type === 'reflexion') return 'Opinion personnelle de son auteur.';
  return null;
}

export function PostCard({ post, full = false }: { post: Post; full?: boolean }) {
  const { categoryName, favorites, reactions } = useData();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const isFav = favorites.includes(post.id);
  const mine = reactions[post.id] ?? [];
  const hope = post.type === 'espoir';
  const showVoice = post.audio && post.audio.publishVoice;
  const note = verificationNote(post);

  const share = async () => {
    setMenu(false);
    const url = postUrl(post.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: `${post.title} — Humanisons l'humain`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Lien copié dans le presse-papiers.');
    } catch {
      /* partage annulé */
    }
  };

  const fav = async () => {
    const now = await repo.toggleFavorite(post.id);
    toast(now ? 'Ajouté à vos favoris.' : 'Retiré de vos favoris.');
  };

  const sendReport = async () => {
    await repo.addReport(post.id, reason, details.trim() || undefined);
    setReporting(false);
    setDetails('');
    toast('Merci. Votre signalement sera examiné par une personne.');
  };

  return (
    <article className={cx('card', hope && 'card--hope', full && 'card--full')} data-testid="post-card" data-post-id={post.id}>
      <header className="card__head">
        <span className="avatar" aria-hidden="true">
          <Icon name="user" size={18} />
        </span>
        <div className="card__who">
          <span className="card__author">
            {displayAuthor(post)}
            {post.byFounder && <span className="badge badge--founder">Fondateur</span>}
          </span>
          <span className="card__sub">
            {typeLabel(post.type)} · <time dateTime={publicDate(post)}>{formatDate(publicDate(post))}</time>
          </span>
        </div>
        <div className="card__menu">
          <button type="button" className="icon-btn" aria-label="Plus d’actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Icon name="more" />
          </button>
          {menu && (
            <div className="popover" role="menu" onMouseLeave={() => setMenu(false)}>
              {!full && (
                <button role="menuitem" type="button" onClick={() => navigate(`/publication/${post.id}`)}>
                  <Icon name="eye" size={16} /> Ouvrir la publication
                </button>
              )}
              <button role="menuitem" type="button" onClick={share}>
                <Icon name="share" size={16} /> Partager
              </button>
              <button role="menuitem" type="button" onClick={() => (setMenu(false), setReporting(true))}>
                <Icon name="flag" size={16} /> Signaler
              </button>
            </div>
          )}
        </div>
      </header>

      <p className={cx('kicker', hope && 'kicker--hope')}>
        {categoryName(post.categoryId)}
        {post.demo && <span className="badge badge--demo">Exemple fictif</span>}
      </p>

      <h2 className="card__title">
        {full ? post.title : <a href={`#/publication/${post.id}`}>{post.title}</a>}
      </h2>

      {post.type === 'paradoxe' && (post.promise || post.reality) && (
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

      {post.text && <p className={cx('card__text prewrap', !full && 'clamp')}>{post.text}</p>}

      {post.images.length > 0 && (
        <div className={cx('card__images', post.images.length > 1 && 'card__images--grid')}>
          {post.images.map((img, i) => (
            <MediaImage key={img.id} id={img.id} alt={`Image ${i + 1} de la publication « ${post.title} »`} className="card__img" />
          ))}
        </div>
      )}

      {showVoice && <AudioPlayer post={post} />}

      {post.audio && !post.audio.publishVoice && post.transcription && (
        <div className="player player--text-only">
          <p className="player__label">
            <Icon name="mic" size={16} /> Transcription d’un témoignage vocal
          </p>
          <p className="small muted">À la demande de son auteur, la voix n’est pas diffusée.</p>
          <p className="prewrap">{post.transcription}</p>
        </div>
      )}

      {post.reflection && (
        <blockquote className="reflection">
          <span className="small muted">Réflexion personnelle</span>
          <p className="prewrap">{post.reflection}</p>
        </blockquote>
      )}

      {post.sources.length > 0 && (
        <div className="sources">
          <p className="small muted">Sources</p>
          <ul>
            {post.sources.map((s, i) => (
              <li key={i}>
                {isSafeUrl(s.url) ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                    <Icon name="link" size={14} /> {s.label || new URL(s.url).hostname}
                  </a>
                ) : (
                  <span>{s.label || s.url}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {note && <p className="verification small">{note}</p>}

      <footer className="card__foot">
        <div className="reactions" role="group" aria-label="Réactions empathiques">
          {REACTIONS.map((r) => {
            const on = mine.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                className={cx('chip', on && 'is-on')}
                aria-pressed={on}
                onClick={() => repo.toggleReaction(post.id, r.id)}
              >
                <Icon name={r.icon} size={15} filled={on && r.icon !== 'hand'} /> {r.label}
              </button>
            );
          })}
        </div>
        <div className="card__actions">
          <button type="button" className={cx('icon-btn', isFav && 'is-on')} onClick={fav} aria-pressed={isFav} aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} title="Favoris">
            <Icon name="bookmark" filled={isFav} />
          </button>
          <button type="button" className="icon-btn" onClick={share} aria-label="Partager" title="Partager">
            <Icon name="share" />
          </button>
          <button type="button" className="icon-btn" onClick={() => setReporting(true)} aria-label="Signaler" title="Signaler">
            <Icon name="flag" />
          </button>
        </div>
      </footer>

      <Modal open={reporting} title="Signaler cette publication" onClose={() => setReporting(false)}>
        <p className="muted small">Votre signalement est anonyme. Il sera lu par une personne, pas par un algorithme.</p>
        <fieldset className="radios">
          <legend className="sr-only">Motif</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className="radio">
              <input type="radio" name={`reason-${post.id}`} checked={reason === r} onChange={() => setReason(r)} /> {r}
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span>Précisions (facultatif)</span>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} />
        </label>
        <div className="row-end">
          <button type="button" className="btn btn--ghost" onClick={() => setReporting(false)}>
            Annuler
          </button>
          <button type="button" className="btn" onClick={sendReport}>
            Envoyer le signalement
          </button>
        </div>
      </Modal>
    </article>
  );
}
