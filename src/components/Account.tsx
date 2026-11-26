/**
 * Compte contributeur FACULTATIF (base partagée uniquement).
 * Sans compte, on peut toujours tout consulter et témoigner.
 * Avec un compte, « Mon espace » (contributions, brouillons, favoris, réactions)
 * se retrouve sur tous les appareils.
 */
import { useEffect, useState } from 'react';
import * as repo from '../services/repository';
import { useToast } from './Toast';
import { Icon } from './Icon';

export function useAuth(): repo.AuthState | null {
  const [auth, setAuth] = useState<repo.AuthState | null>(null);
  useEffect(() => {
    if (!repo.isRemote) return;
    const check = () => repo.getAuth().then(setAuth);
    check();
    return repo.subscribe(check);
  }, []);
  return auth;
}

export function AccountBox({ auth }: { auth: repo.AuthState | null }) {
  const toast = useToast();
  const [mode, setMode] = useState<'ferme' | 'connexion' | 'creation'>('ferme');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!repo.isRemote || !auth) return null;

  if (auth.userId) {
    return (
      <div className="notice account-box" data-testid="account-connected">
        <p>
          <Icon name="user" size={16} /> Connecté : <strong>{auth.email}</strong>. Vos contributions, brouillons, favoris et réactions vous suivent sur tous vos appareils.
        </p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => repo.signOut()} data-testid="account-logout">
          Se déconnecter
        </button>
      </div>
    );
  }

  if (mode === 'ferme') {
    return (
      <div className="notice account-box">
        <p>
          Cet espace rassemble ce que vous avez créé <strong>sur cet appareil</strong>. Avec un compte (facultatif et gratuit), vous le retrouvez sur tous vos appareils.
        </p>
        <div className="row wrap">
          <button type="button" className="btn btn--sm" onClick={() => setMode('creation')} data-testid="account-open-signup">
            Créer un compte
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMode('connexion')} data-testid="account-open-login">
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  const creation = mode === 'creation';
  return (
    <form
      className="block account-box"
      data-testid="account-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        if (creation && password.length < 8) return setError('Choisissez un mot de passe de 8 caractères au moins.');
        setBusy(true);
        try {
          await (creation ? repo.signUp(email, password) : repo.signIn(email, password));
          toast(creation ? 'Compte créé. Bienvenue !' : 'Connecté.');
          setMode('ferme');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Opération impossible.');
        } finally {
          setBusy(false);
          setPassword('');
        }
      }}
    >
      <h2 className="h3">{creation ? 'Créer un compte' : 'Se connecter'}</h2>
      {creation && (
        <p className="muted small">
          Votre adresse n’est jamais affichée publiquement. Ce que vous avez déjà fait sur cet appareil (contributions envoyées, brouillons, favoris) sera rattaché à votre compte.
          Voir la <a href="#/confidentialite">politique de confidentialité</a>.
        </p>
      )}
      <label className="field">
        <span>Adresse e-mail</span>
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="account-email" />
      </label>
      <label className="field">
        <span>Mot de passe{creation ? ' (8 caractères au moins)' : ''}</span>
        <input
          type="password"
          autoComplete={creation ? 'new-password' : 'current-password'}
          required
          minLength={creation ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="account-password"
        />
      </label>
      {error && (
        <p className="alert" role="alert" data-testid="account-error">
          {error}
        </p>
      )}
      <div className="row wrap">
        <button type="submit" className="btn" disabled={busy} data-testid="account-submit">
          {busy ? 'Un instant…' : creation ? 'Créer mon compte' : 'Se connecter'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => (setMode(creation ? 'connexion' : 'creation'), setError(''))}>
          {creation ? 'J’ai déjà un compte' : 'Créer un compte'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setMode('ferme')}>
          Annuler
        </button>
      </div>
      {!creation && <p className="muted small">Mot de passe oublié ? Écrivez à l’adresse indiquée dans les mentions légales.</p>}
    </form>
  );
}
