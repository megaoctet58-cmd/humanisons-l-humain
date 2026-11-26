/** Structure générale : en-tête avec logo, contenu, mini-lecteur, navigation basse. */
import { useEffect, useState } from 'react';
import { useRoute, navigate, type Route } from './lib/router';
import { useData } from './services/store';
import { effectiveTheme, setTheme } from './services/preferences';
import { Logo } from './components/Logo';
import { Icon } from './components/Icon';
import { MiniPlayer } from './components/MiniPlayer';
import { ThemeChooser } from './components/ThemeChooser';
import { POST_TYPES } from './models/types';
import { Feed } from './pages/Feed';
import { Explore } from './pages/Explore';
import { Testify } from './pages/Testify';
import { Voices } from './pages/Voices';
import { MySpace } from './pages/MySpace';
import { Manifesto } from './pages/Manifesto';
import { Charter } from './pages/Charter';
import { About } from './pages/About';
import { PostPage } from './pages/PostPage';
import { Admin } from './pages/Admin';
import { cx } from './lib/util';
import * as repo from './services/repository';

const NAV = [
  { to: '/', key: '', label: 'Le fil', icon: 'feed' },
  { to: '/explorer', key: 'explorer', label: 'Explorer', icon: 'search' },
  { to: '/temoigner', key: 'temoigner', label: 'Témoigner', icon: 'pen' },
  { to: '/voix', key: 'voix', label: 'Les voix', icon: 'waves' },
  { to: '/mon-espace', key: 'mon-espace', label: 'Mon espace', icon: 'user' },
];

function Page({ route }: { route: Route }) {
  const [first, second] = route.segments;
  switch (first) {
    case undefined:
      return <Feed route={route} />;
    case 'explorer':
      return <Explore />;
    case 'temoigner':
      return <Testify key={route.query.toString()} route={route} />;
    case 'voix':
      return <Voices />;
    case 'mon-espace':
      return <MySpace />;
    case 'manifeste':
      return <Manifesto />;
    case 'charte':
      return <Charter />;
    case 'a-propos':
      return <About />;
    case 'publication':
      return <PostPage id={second ?? ''} />;
    case 'admin':
      return <Admin route={route} />;
    default:
      return (
        <section className="page center-text">
          <h1>Page introuvable</h1>
          <a className="btn" href="#/">
            Retour au fil
          </a>
        </section>
      );
  }
}

function TypePills({ route }: { route: Route }) {
  const current = route.query.get('type') ?? 'tout';
  const items = [{ id: 'tout', label: 'Tout' }, ...POST_TYPES.map((t) => ({ id: t.id, label: t.plural }))];
  return (
    <nav className="type-pills" aria-label="Filtrer par type de publication">
      {items.map((t) => (
        <a key={t.id} href={t.id === 'tout' ? '#/' : `#/?type=${t.id}`} className={cx('pill', current === t.id && 'is-on')} aria-current={current === t.id ? 'page' : undefined}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

export function App() {
  const route = useRoute();
  const { error } = useData();
  const [menu, setMenu] = useState(false);
  const [theme, setThemeState] = useState(effectiveTheme);
  const section = route.segments[0] ?? '';

  useEffect(() => {
    const on = () => setThemeState(effectiveTheme());
    window.addEventListener('hlh-theme', on);
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    mq?.addEventListener?.('change', on);
    return () => {
      window.removeEventListener('hlh-theme', on);
      mq?.removeEventListener?.('change', on);
    };
  }, []);

  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, [route.path]);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1C1C1C' : '#F2EFE9');
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <div className="app">
      <a className="skip" href="#contenu" onClick={(e) => (e.preventDefault(), document.getElementById('contenu')?.focus())}>
        Aller au contenu
      </a>
      <header className="header">
        <div className="header__bar">
          <button type="button" className="icon-btn" onClick={() => setMenu(true)} aria-label="Ouvrir le menu" aria-expanded={menu}>
            <Icon name="menu" size={22} />
          </button>
          <a href="#/" className="header__logo" aria-label="Humanisons l'humain — accueil, le fil">
            <Logo />
          </a>
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={22} />
          </button>
        </div>
        {section === '' && <TypePills route={route} />}
      </header>

      {menu && (
        <div className="drawer-backdrop" onClick={() => setMenu(false)}>
          <nav className="drawer" aria-label="Menu complémentaire" onClick={(e) => e.stopPropagation()}>
            <div className="drawer__head">
              <Logo compact />
              <button type="button" className="icon-btn" onClick={() => setMenu(false)} aria-label="Fermer le menu">
                <Icon name="close" />
              </button>
            </div>
            <a href="#/manifeste">
              <Icon name="book" size={18} /> Le manifeste
            </a>
            <a href="#/charte">
              <Icon name="sparkle" size={18} /> La charte éthique
            </a>
            <a href="#/a-propos">
              <Icon name="info" size={18} /> À propos, confidentialité et limites
            </a>
            <a href="#/admin">
              <Icon name="shield" size={18} /> {repo.isRemote ? 'Administration' : 'Administration (démo locale)'}
            </a>
            <div className="drawer__section">
              <p className="small muted">Thème</p>
              <ThemeChooser />
            </div>
            <p className="drawer__motto">Observer · Écouter · Questionner · Humaniser</p>
          </nav>
        </div>
      )}

      {error && (
        <p className="alert page" role="alert">
          {repo.isRemote ? <>Les publications n’ont pas pu être chargées. {error}</> : <>Le stockage local est indisponible : {error} Les contributions ne pourront pas être enregistrées.</>}
        </p>
      )}

      <main id="contenu" tabIndex={-1} className="main">
        <Page route={route} />
      </main>

      <MiniPlayer />

      <nav className="bottom-nav" aria-label="Navigation principale">
        {NAV.map((n) => (
          <a
            key={n.key}
            href={`#${n.to}`}
            className={cx('bottom-nav__item', n.key === 'temoigner' && 'bottom-nav__item--cta', section === n.key && 'is-on')}
            aria-current={section === n.key ? 'page' : undefined}
            onClick={(e) => {
              if (section === n.key && n.key === '') {
                e.preventDefault();
                navigate('/');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <span className="bottom-nav__icon">
              <Icon name={n.icon} size={n.key === 'temoigner' ? 22 : 20} />
            </span>
            <span className="bottom-nav__label">{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
