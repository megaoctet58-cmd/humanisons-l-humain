/**
 * Mon espace. En V0.1, il n'y a pas encore de vrais comptes : cet espace
 * regroupe ce qui a été créé SUR CET APPAREIL (contributions, brouillons,
 * favoris, préférences).
 */
import { useState } from 'react';
import { STATUS_LABELS, isPublic, typeLabel, type Post } from '../models/types';
import { useData } from '../services/store';
import * as repo from '../services/repository';
import { getPseudonym, setPseudonym } from '../services/preferences';
import { PostCard } from '../components/PostCard';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ThemeChooser } from '../components/ThemeChooser';
import { cx, formatDateTime } from '../lib/util';
import { navigate } from '../lib/router';

type Tab = 'contributions' | 'brouillons' | 'favoris' | 'profil';

function StatusBadge({ p }: { p: Post }) {
  return <span className={cx('status', `status--${p.status}`)}>{STATUS_LABELS[p.status]}</span>;
}

export function MySpace() {
  const { posts, favorites, categoryName } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('contributions');
  const [withdraw, setWithdraw] = useState<Post | null>(null);
  const [reason, setReason] = useState('');
  const [pseudo, setPseudo] = useState(getPseudonym);

  const mine = posts.filter((p) => p.mine).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const drafts = mine.filter((p) => p.status === 'brouillon');
  const contributions = mine.filter((p) => p.status !== 'brouillon');
  const favs = favorites.map((id) => posts.find((p) => p.id === id)).filter((p): p is Post => Boolean(p && isPublic(p)));

  const requestWithdrawal = async () => {
    if (!withdraw) return;
    try {
      await repo.requestWithdrawal(withdraw, reason.trim() || undefined);
      setWithdraw(null);
      setReason('');
      toast('Demande de retrait transmise à la modération.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Demande impossible pour le moment.');
    }
  };

  const tabs: [Tab, string, number?][] = [
    ['contributions', 'Mes contributions', contributions.length],
    ['brouillons', 'Brouillons', drafts.length],
    ['favoris', 'Favoris', favs.length],
    ['profil', 'Profil'],
  ];

  return (
    <section className="page">
      <h1 className="page__title">Mon espace</h1>
      <p className="notice">
        Les comptes ne sont pas encore disponibles. Cet espace rassemble ce que vous avez créé <strong>sur cet appareil</strong>, dans ce navigateur
        {repo.isRemote && <> : vos brouillons y restent, et vous y suivez les contributions envoyées d’ici</>}.
      </p>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} className={cx('tab', tab === id && 'is-on')} onClick={() => setTab(id)}>
            {label}
            {n !== undefined && <span className="tab__n">{n}</span>}
          </button>
        ))}
      </div>

      {tab === 'contributions' && (
        <ul className="list" data-testid="my-contributions">
          {contributions.length === 0 && <li className="empty">Vous n’avez encore rien envoyé. <a href="#/temoigner">Témoigner</a></li>}
          {contributions.map((p) => (
            <li key={p.id} className="list__item">
              <div className="list__main">
                <p className="list__title">{p.title}</p>
                <p className="muted small">
                  {typeLabel(p.type)} · {categoryName(p.categoryId)} · envoyé le {formatDateTime(p.submittedAt ?? p.createdAt)}
                  {p.audio && ' · avec la voix'}
                </p>
                {p.private.messageToAuthor && (
                  <p className="message-box">
                    <strong>Message de la modération :</strong> {p.private.messageToAuthor}
                  </p>
                )}
                {p.private.withdrawalRequested && <p className="small muted">Retrait demandé.</p>}
              </div>
              <div className="list__side">
                <StatusBadge p={p} />
                {isPublic(p) && (
                  <a className="btn btn--ghost btn--sm" href={`#/publication/${p.id}`}>
                    Voir
                  </a>
                )}
                {p.status === 'infos_demandees' && (
                  <button type="button" className="btn btn--sm" onClick={() => navigate(`/temoigner?modifier=${p.id}`)}>
                    Compléter
                  </button>
                )}
                {!p.private.withdrawalRequested && p.status !== 'retire' && p.status !== 'refuse' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setWithdraw(p)}>
                    Demander le retrait
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'brouillons' && (
        <ul className="list">
          {drafts.length === 0 && <li className="empty">Aucun brouillon.</li>}
          {drafts.map((p) => (
            <li key={p.id} className="list__item">
              <div className="list__main">
                <p className="list__title">{p.title || 'Sans titre'}</p>
                <p className="muted small">Modifié le {formatDateTime(p.updatedAt)}{p.audio && ' · enregistrement vocal joint'}</p>
              </div>
              <div className="list__side">
                <button type="button" className="btn btn--sm" onClick={() => navigate(`/temoigner?brouillon=${p.id}`)}>
                  Reprendre
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={async () => {
                    if (window.confirm('Supprimer définitivement ce brouillon et ses fichiers ?')) {
                      await repo.deletePost(p.id);
                      toast('Brouillon supprimé.');
                    }
                  }}
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'favoris' && (
        <div className="feed">
          {favs.length === 0 && <p className="empty">Aucun favori. Utilisez l’icône signet sur une publication pour la retrouver ici.</p>}
          {favs.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      {tab === 'profil' && (
        <div className="block">
          <label className="field">
            <span>Pseudonyme proposé par défaut</span>
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={60} />
          </label>
          <button type="button" className="btn btn--sm" onClick={() => (setPseudonym(pseudo), toast('Pseudonyme enregistré.'))}>
            Enregistrer
          </button>
          <h2 className="h3">Thème</h2>
          <ThemeChooser />
          <h2 className="h3">Vos données</h2>
          <p className="muted small">
            {repo.isRemote
              ? 'Vos brouillons, favoris et réactions restent uniquement dans ce navigateur. Une contribution n’est envoyée qu’au moment où vous la soumettez à la modération ; elle n’est visible de tous qu’après validation. Si vous effacez les données du site dans ce navigateur, vous ne pourrez plus suivre vos contributions ici (elles restent auprès de la modération).'
              : 'Tout est conservé localement dans ce navigateur (IndexedDB). Rien n’est envoyé sur Internet dans cette version. Effacer les données du site dans votre navigateur supprime aussi vos contributions.'}
          </p>
        </div>
      )}

      <Modal open={Boolean(withdraw)} title="Demander le retrait" onClose={() => setWithdraw(null)}>
        <p>Votre demande sera traitée par la modération. Vous n’avez pas à vous justifier.</p>
        <label className="field">
          <span>Message (facultatif)</span>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="row-end">
          <button type="button" className="btn btn--ghost" onClick={() => setWithdraw(null)}>
            Annuler
          </button>
          <button type="button" className="btn" onClick={requestWithdrawal}>
            Envoyer la demande
          </button>
        </div>
      </Modal>
    </section>
  );
}
