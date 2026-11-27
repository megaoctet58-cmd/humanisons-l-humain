/**
 * Témoigner : formulaire de contribution.
 * Écrire, enregistrer sa voix, ou les deux. Brouillons locaux. Envoi à la modération.
 * En mode « fondateur » (depuis l'administration), permet aussi de publier directement.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { POST_TYPES, type MediaRef, type Post, type PostType, type SourceLink } from '../models/types';
import { useData } from '../services/store';
import * as repo from '../services/repository';
import { getPseudonym, setPseudonym } from '../services/preferences';
import { isAutomaticTranscriptionAvailable, transcriptionEngine, type TranscriptionProgress } from '../services/transcription';
import { Recorder, LocalPreview, type AudioDraft } from '../components/Recorder';
import { PostCard } from '../components/PostCard';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { navigate, type Route } from '../lib/router';
import { cx, formatBytes, isSafeUrl, uid } from '../lib/util';

type Mode = 'ecrire' | 'voix' | 'les_deux';

interface ImageItem {
  key: string;
  ref?: MediaRef; // déjà enregistrée
  file?: File; // nouvelle
  url: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 4;

export function Testify({ route }: { route: Route }) {
  const { categories, settings, posts } = useData();
  const toast = useToast();
  const founder = route.query.get('mode') === 'fondateur';
  const draftId = route.query.get('brouillon') ?? route.query.get('modifier');
  const existing = useMemo(() => (draftId ? posts.find((p) => p.id === draftId) : undefined), [draftId, posts]);

  const [id] = useState(() => draftId ?? uid('p'));
  const [loadedFrom, setLoadedFrom] = useState<string>();
  const [mode, setMode] = useState<Mode>('les_deux');
  const [type, setType] = useState<PostType>('temoignage');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [text, setText] = useState('');
  const [reflection, setReflection] = useState('');
  const [promise, setPromise] = useState('');
  const [reality, setReality] = useState('');
  const [authorName, setAuthorName] = useState(() => (founder ? settings.founderName : getPseudonym()));
  const [anonymous, setAnonymous] = useState(false);
  const [email, setEmail] = useState('');
  const [audio, setAudio] = useState<AudioDraft | null>(null);
  const [audioRef, setAudioRef] = useState<MediaRef | null>(null); // audio déjà stocké (brouillon)
  const [publishVoice, setPublishVoice] = useState(true);
  const [transcription, setTranscription] = useState('');
  const [autoTranscribed, setAutoTranscribed] = useState(false);
  const [transcribing, setTranscribing] = useState<TranscriptionProgress | null>(null);
  const [transcribeError, setTranscribeError] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [sources, setSources] = useState<SourceLink[]>([]);
  const [proofs, setProofs] = useState<(MediaRef | File)[]>([]);
  const [consentPub, setConsentPub] = useState(false);
  const [consentVoice, setConsentVoice] = useState(false);
  const [consentThirdParty, setConsentThirdParty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState<'moderation' | 'publie' | null>(null);

  useEffect(() => {
    if (founder) setAuthorName(settings.founderName);
  }, [founder, settings.founderName]);

  // Compte connecté : l'adresse du compte est proposée comme e-mail privé de contact.
  useEffect(() => {
    if (!repo.isRemote || founder || draftId) return;
    repo.getAuth().then((a) => a.email && setEmail((cur) => cur || a.email!));
  }, [founder, draftId]);

  // Chargement d'un brouillon existant.
  useEffect(() => {
    if (!existing || loadedFrom === existing.id) return;
    setLoadedFrom(existing.id);
    setType(existing.type);
    setTitle(existing.title);
    setCategoryId(existing.categoryId);
    setText(existing.text);
    setReflection(existing.reflection ?? '');
    setPromise(existing.promise ?? '');
    setReality(existing.reality ?? '');
    setAuthorName(existing.authorName ?? '');
    setAnonymous(existing.anonymous);
    setEmail(existing.private.email ?? '');
    setTranscription(existing.transcription ?? '');
    setAutoTranscribed(existing.transcriptionSource === 'automatique');
    setSources(existing.sources);
    setProofs(existing.private.proofs ?? []);
    setConsentPub(existing.consent.publication);
    setConsentVoice(existing.consent.voiceIdentifiable);
    setMode(existing.audio ? (existing.text ? 'les_deux' : 'voix') : 'ecrire');
    Promise.all(existing.images.map(async (r) => ({ key: r.id, ref: r, url: (await repo.mediaUrl(r.id)) ?? '' }))).then(setImages);
    if (existing.audio) {
      const a = existing.audio;
      setAudioRef(a);
      setPublishVoice(a.publishVoice);
      repo.getMediaBlob(a.id).then((blob) => {
        if (blob) setAudio({ blob, mime: a.mime, name: a.name ?? 'audio', duration: a.duration, peaks: a.peaks, source: a.source === 'import' ? 'import' : 'micro' });
      });
    }
  }, [existing, loadedFrom]);

  useEffect(() => {
    if (!categoryId && categories.length) setCategoryId(type === 'espoir' ? categories.find((c) => /espoir/i.test(c.name))?.id ?? categories[0].id : categories[0].id);
  }, [categories, categoryId, type]);

  const wantsText = mode !== 'voix';
  const wantsVoice = mode !== 'ecrire';

  /* -------------------------- images -------------------------- */
  const addImages = (files: FileList | null) => {
    if (!files) return;
    const next: ImageItem[] = [];
    const errs: string[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) errs.push(`« ${f.name} » n’est pas une image.`);
      else if (f.size > MAX_IMAGE_BYTES) errs.push(`« ${f.name} » dépasse ${formatBytes(MAX_IMAGE_BYTES)}.`);
      else next.push({ key: uid('img'), file: f, url: URL.createObjectURL(f) });
    }
    setImages((cur) => [...cur, ...next].slice(0, MAX_IMAGES));
    if (images.length + next.length > MAX_IMAGES) errs.push(`${MAX_IMAGES} images au maximum.`);
    setErrors(errs);
  };

  /* -------------------------- validation -------------------------- */
  const validate = (forSubmit: boolean): string[] => {
    const e: string[] = [];
    if (!title.trim()) e.push('Donnez un titre à votre contribution.');
    if (!forSubmit) return e;
    if (!categoryId) e.push('Choisissez une catégorie.');
    if (wantsText && !text.trim() && type !== 'paradoxe') e.push('Écrivez votre texte.');
    if (type === 'paradoxe' && (!promise.trim() || !reality.trim())) e.push('Pour un paradoxe, renseignez la promesse et la réalité.');
    if (wantsVoice && !audio) e.push('Enregistrez votre voix ou importez un fichier audio (ou choisissez « Écrire »).');
    if (wantsVoice && audio && !publishVoice && !transcription.trim()) e.push('Vous avez choisi de ne publier que la transcription : saisissez-la.');
    if (type === 'actualite' && !sources.some((s) => isSafeUrl(s.url))) e.push('Une actualité doit être accompagnée d’au moins une source consultable (lien https).');
    if (sources.some((s) => s.url.trim() && !isSafeUrl(s.url.trim()))) e.push('Un des liens de source n’est pas une adresse web valide (https://…).');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.push('L’adresse e-mail ne semble pas valide.');
    if (founder) return e; // Le fondateur publie sous sa propre responsabilité.
    if (!consentPub) e.push('Confirmez votre accord pour la publication après modération.');
    if (wantsVoice && audio && publishVoice && !consentVoice) e.push('Confirmez avoir compris qu’une voix peut permettre de vous reconnaître.');
    if (wantsVoice && audio && !consentThirdParty) e.push('Confirmez que l’enregistrement ne contient pas la voix d’autres personnes sans leur accord.');
    return e;
  };

  /* -------------------------- enregistrement -------------------------- */
  const persist = async (status: Post['status']): Promise<Post> => {
    const now = new Date().toISOString();
    // Médias : on enregistre les nouveaux fichiers, on supprime ceux retirés.
    const keptImages: MediaRef[] = [];
    for (const img of images) keptImages.push(img.ref ?? (await repo.saveMedia(img.file!, img.file!.name)));
    const oldImages = existing?.images ?? [];
    for (const old of oldImages) if (!keptImages.some((k) => k.id === old.id)) await repo.deleteMedia(old.id);

    let audioInfo: Post['audio'];
    const useAudio = wantsVoice && audio;
    if (useAudio) {
      const sameAsStored = audioRef && existing?.audio && audio.blob.size === existing.audio.size;
      const ref = sameAsStored ? audioRef : await repo.saveMedia(audio.blob, audio.name);
      if (audioRef && !sameAsStored) await repo.deleteMedia(audioRef.id);
      audioInfo = { ...ref, mime: audio.mime, name: audio.name, size: audio.blob.size, duration: audio.duration, peaks: audio.peaks, original: true, source: audio.source, publishVoice };
    } else if (audioRef) {
      await repo.deleteMedia(audioRef.id);
    }

    const proofRefs: MediaRef[] = [];
    for (const p of proofs) proofRefs.push(p instanceof File ? await repo.saveMedia(p, p.name) : p);

    const cleanSources = sources.filter((s) => s.url.trim()).map((s) => ({ label: s.label.trim(), url: s.url.trim() }));
    const post: Post = {
      id,
      type,
      title: title.trim(),
      categoryId,
      text: wantsText ? text.trim() : '',
      reflection: reflection.trim() || undefined,
      promise: type === 'paradoxe' ? promise.trim() : undefined,
      reality: type === 'paradoxe' ? reality.trim() : undefined,
      authorName: anonymous ? undefined : authorName.trim() || undefined,
      anonymous,
      byFounder: founder || existing?.byFounder,
      images: keptImages,
      audio: audioInfo,
      transcription: transcription.trim() || undefined,
      transcriptionSource: transcription.trim() ? (autoTranscribed ? 'automatique' : 'manuelle') : undefined,
      sources: cleanSources,
      verification: existing?.verification ?? (type === 'actualite' ? 'a_documenter' : 'non_verifie'),
      status,
      consent: { publication: founder || consentPub, voiceIdentifiable: founder || consentVoice, at: founder || consentPub ? now : undefined },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      submittedAt: status === 'en_attente' ? now : existing?.submittedAt,
      publishedAt: status === 'publie' ? now : existing?.publishedAt,
      mine: !founder,
      private: { ...(existing?.private ?? {}), email: email.trim() || undefined, proofs: proofRefs },
    };
    if (!founder && !anonymous && authorName.trim()) setPseudonym(authorName);
    return repo.savePost(post);
  };

  const saveDraft = async () => {
    const e = validate(false);
    setErrors(e);
    if (e.length) return;
    setSaving(true);
    try {
      await persist('brouillon');
      toast(repo.isRemote && (await repo.getAuth()).userId ? 'Brouillon enregistré (sur cet appareil et dans votre compte).' : 'Brouillon enregistré sur cet appareil.');
      if (!draftId) navigate(`/temoigner?brouillon=${id}${founder ? '&mode=fondateur' : ''}`);
    } catch (err) {
      setErrors([`Enregistrement impossible : ${err instanceof Error ? err.message : err}`]);
    } finally {
      setSaving(false);
    }
  };

  const submit = async (ev: FormEvent, publishNow = false) => {
    ev.preventDefault();
    const e = validate(true);
    setErrors(e);
    if (e.length) {
      document.getElementById('form-errors')?.focus();
      return;
    }
    setSaving(true);
    try {
      await persist(publishNow ? 'publie' : 'en_attente');
      setSent(publishNow ? 'publie' : 'moderation');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setErrors([`Envoi impossible : ${err instanceof Error ? err.message : err}`]);
    } finally {
      setSaving(false);
    }
  };

  const previewPost: Post = useMemo(
    () => ({
      id: 'apercu',
      type,
      title: title || 'Sans titre',
      categoryId,
      text: wantsText ? text : '',
      reflection: reflection || undefined,
      promise,
      reality,
      authorName: anonymous ? undefined : authorName,
      anonymous,
      byFounder: founder,
      images: [],
      sources: sources.filter((s) => s.url),
      verification: 'non_verifie',
      status: 'brouillon',
      consent: { publication: false, voiceIdentifiable: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: {},
    }),
    [type, title, categoryId, wantsText, text, reflection, promise, reality, anonymous, authorName, founder, sources],
  );

  if (sent) {
    return (
      <section className="page narrow center-text" data-testid="submit-confirmation">
        <div className="done-mark" aria-hidden="true">
          <Icon name="check" size={34} />
        </div>
        {sent === 'moderation' ? (
          <>
            <h1>Merci. Votre voix a été transmise.</h1>
            <p className="lead">
              Votre contribution est <strong>en attente de modération</strong>. Elle ne sera pas publiée immédiatement : une personne va la lire, l’écouter et
              l’examiner avant toute publication.
            </p>
            <p className="muted small">
              {repo.isRemote
                ? 'Vous pouvez suivre son statut dans « Mon espace » (depuis cet appareil, ou depuis tous vos appareils si vous êtes connecté à votre compte).'
                : 'Prototype V0.1 : la modération se fait localement, sur cet appareil. Vous pouvez suivre le statut dans « Mon espace ».'}
            </p>
          </>
        ) : (
          <h1>Publication mise en ligne dans le fil.</h1>
        )}
        <div className="row-center wrap">
          <a className="btn" href="#/mon-espace">
            Suivre dans Mon espace
          </a>
          {(!repo.isRemote || sent === 'publie') && (
            <a className="btn btn--ghost" href="#/admin">
              {repo.isRemote ? 'Retour à l’administration' : 'Ouvrir l’administration locale'}
            </a>
          )}
          <a className="btn btn--ghost" href="#/">
            Retour au fil
          </a>
        </div>
      </section>
    );
  }

  const thisTypeInfo = POST_TYPES.find((t) => t.id === type);

  return (
    <section className="page narrow">
      <h1 className="page__title">{founder ? 'Nouvelle publication (fondateur)' : existing?.status === 'brouillon' ? 'Reprendre mon brouillon' : 'Témoigner'}</h1>
      {!founder && (
        <p className="lead">
          Votre contribution sera <strong>lue par une personne avant toute publication</strong>. Rien n’est publié automatiquement.
        </p>
      )}

      <form onSubmit={(e) => submit(e)} noValidate className="form">
        <fieldset className="block">
          <legend>Comment souhaitez-vous témoigner ?</legend>
          <div className="segmented" role="radiogroup">
            {(
              [
                ['ecrire', 'Écrire', 'pen'],
                ['voix', 'Ma voix', 'mic'],
                ['les_deux', 'Les deux', 'waves'],
              ] as const
            ).map(([m, label, icon]) => (
              <label key={m} className={cx('segmented__opt', mode === m && 'is-on')}>
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                <Icon name={icon} size={18} /> {label}
              </label>
            ))}
          </div>
          <p className="voice-hint" data-testid="voice-hint">
            <Icon name="mic" size={14} />
            <span>
              Votre voix dit ce que les mots taisent. Une hésitation, une colère contenue, un silence : l'intonation transmet ce que vous avez ressenti mieux qu'un texte.
              N'ayez pas peur de parler comme vous êtes, c'est justement ce qui rend votre témoignage humain.
            </span>
          </p>
        </fieldset>

        <fieldset className="block">
          <legend>Votre contribution</legend>
          <div className="grid-2">
            <label className="field">
              <span>Type de publication</span>
              <select value={type} onChange={(e) => setType(e.target.value as PostType)} data-testid="field-type">
                {POST_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <small className="muted">{thisTypeInfo?.description}</small>
            </label>
            <label className="field">
              <span>Catégorie</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Ex. : À quel moment suis-je devenu un simple chiffre ?" required data-testid="field-title" />
          </label>

          {type === 'paradoxe' && (
            <div className="grid-2">
              <label className="field">
                <span>La promesse</span>
                <textarea rows={2} value={promise} onChange={(e) => setPromise(e.target.value)} placeholder="Le discours, la valeur affichée…" />
              </label>
              <label className="field">
                <span>La réalité</span>
                <textarea rows={2} value={reality} onChange={(e) => setReality(e.target.value)} placeholder="Ce qui est réellement constaté…" />
              </label>
            </div>
          )}

          {wantsText && (
            <label className="field">
              <span>{type === 'temoignage' ? 'Votre témoignage' : 'Texte principal'}</span>
              <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} placeholder="Racontez, avec vos mots." data-testid="field-text" />
              <small className="muted">{text.length} / 8000</small>
            </label>
          )}
          <label className="field">
            <span>
              Réflexion personnelle <em className="muted">(facultatif)</em>
            </span>
            <textarea rows={2} value={reflection} onChange={(e) => setReflection(e.target.value)} maxLength={1500} placeholder="Qu’est-ce que cela vous inspire ?" />
          </label>
        </fieldset>

        {wantsVoice && (
          <fieldset className="block">
            <legend>Votre voix</legend>
            <Recorder maxSeconds={settings.maxAudioSeconds} value={audio} onChange={setAudio} />
            {audio && (
              <>
                <div className="notice">
                  <Icon name="info" size={18} />
                  <p>Une voix peut permettre de reconnaître une personne, même sous pseudonyme. Vous pouvez choisir de ne publier que la transcription : l’audio restera alors réservé à la modération.</p>
                </div>
                <div className="radios">
                  <label className="radio">
                    <input type="radio" name="voice" checked={publishVoice} onChange={() => setPublishVoice(true)} /> Publier ma voix (après modération)
                  </label>
                  <label className="radio">
                    <input type="radio" name="voice" checked={!publishVoice} onChange={() => setPublishVoice(false)} /> Transmettre ma voix à la modération seulement, et publier uniquement la transcription
                  </label>
                </div>
                <label className="field">
                  <span>
                    Transcription {publishVoice && <em className="muted">(facultatif, recommandé pour l’accessibilité)</em>}
                  </span>
                  <textarea rows={4} value={transcription} onChange={(e) => setTranscription(e.target.value)} maxLength={12000} placeholder="Retranscrivez ce que vous dites dans l’enregistrement." data-testid="field-transcription" />
                  <small className="muted">
                    {isAutomaticTranscriptionAvailable()
                      ? 'Vous pouvez l’écrire vous-même ou demander une transcription automatique, à relire et corriger. Elle ne remplace jamais votre enregistrement.'
                      : 'La transcription automatique n’est pas disponible sur ce navigateur : saisie manuelle. Elle ne remplace jamais votre enregistrement.'}
                  </small>
                </label>
                {isAutomaticTranscriptionAvailable() && audio && (
                  <div className="transcribe" data-testid="auto-transcribe">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={Boolean(transcribing)}
                      data-testid="auto-transcribe-button"
                      onClick={async () => {
                        if (transcription.trim() && !window.confirm('Remplacer la transcription actuelle par une transcription automatique ?')) return;
                        setTranscribeError('');
                        setTranscribing({ phase: 'preparation' });
                        try {
                          const text = await transcriptionEngine.transcribe(audio.blob, setTranscribing);
                          if (!text) throw new Error('Aucune parole reconnue dans l’enregistrement.');
                          setTranscription(text);
                          setAutoTranscribed(true);
                          toast('Transcription proposée : relisez-la et corrigez-la si besoin.');
                        } catch (err) {
                          setTranscribeError(err instanceof Error ? err.message : 'Transcription impossible.');
                        } finally {
                          setTranscribing(null);
                        }
                      }}
                    >
                      <Icon name="sparkle" size={16} />{' '}
                      {!transcribing
                        ? 'Transcrire automatiquement'
                        : transcribing.phase === 'telechargement'
                        ? `Téléchargement du modèle… ${Math.round(transcribing.percent ?? 0)} %`
                        : transcribing.phase === 'transcription'
                        ? 'Transcription en cours…'
                        : 'Préparation…'}
                    </button>
                    <small className="muted">
                      Gratuit, réalisé dans votre navigateur : votre voix ne quitte pas l’appareil. La première fois, un modèle d’environ 120 Mo est téléchargé (Wi-Fi conseillé),
                      puis gardé en mémoire. Comptez environ le temps de l’enregistrement.
                    </small>
                    {transcribeError && (
                      <p className="alert small" role="alert" data-testid="auto-transcribe-error">
                        {transcribeError}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </fieldset>
        )}

        <fieldset className="block">
          <legend>Images, liens et sources</legend>
          <div className="thumbs">
            {images.map((img) => (
              <div className="thumb" key={img.key}>
                <img src={img.url} alt="" />
                <button type="button" className="icon-btn thumb__remove" aria-label="Retirer cette image" onClick={() => setImages((l) => l.filter((x) => x.key !== img.key))}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="thumb thumb--add">
                <Icon name="image" />
                <span className="small">Ajouter une image</span>
                <input type="file" accept="image/*" multiple hidden onChange={(e) => (addImages(e.target.files), (e.target.value = ''))} />
              </label>
            )}
          </div>
          <p className="muted small">Ne publiez pas de visages ou d’informations permettant d’identifier des tiers sans leur accord.</p>

          <div className="sources-edit">
            {sources.map((s, i) => (
              <div className="source-row" key={i}>
                <input placeholder="Titre de la source" value={s.label} onChange={(e) => setSources((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label={`Titre de la source ${i + 1}`} />
                <input placeholder="https://…" type="url" value={s.url} onChange={(e) => setSources((l) => l.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} aria-label={`Adresse de la source ${i + 1}`} />
                <button type="button" className="icon-btn" aria-label="Retirer cette source" onClick={() => setSources((l) => l.filter((_, j) => j !== i))}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSources((l) => [...l, { label: '', url: '' }])}>
              <Icon name="plus" size={16} /> Ajouter un lien ou une source
            </button>
          </div>
        </fieldset>

        <fieldset className="block">
          <legend>Qui témoigne ?</legend>
          {founder ? (
            <p className="muted">Publié au nom de : <strong>{settings.founderName}</strong> (modifiable dans les paramètres de l’administration).</p>
          ) : (
            <>
              <label className="check">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Publier de façon anonyme
              </label>
              {!anonymous && (
                <label className="field">
                  <span>Nom ou pseudonyme</span>
                  <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={60} placeholder="Ex. : Camille" />
                </label>
              )}
              <label className="field">
                <span>
                  Adresse e-mail privée <em className="muted">(facultatif)</em>
                </span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Pour que la modération puisse vous recontacter" autoComplete="email" />
                <small className="muted">Jamais affichée publiquement. Utilisée uniquement pour la modération.</small>
              </label>
            </>
          )}
          <details className="details">
            <summary>Joindre des justificatifs privés (facultatif)</summary>
            <p className="muted small">Documents visibles uniquement par la modération (ex. : courrier reçu). Ils ne sont jamais publiés.</p>
            <ul className="plain">
              {proofs.map((p, i) => (
                <li key={i} className="row">
                  <Icon name="file" size={16} /> {p instanceof File ? p.name : p.name ?? 'justificatif'}
                  <button type="button" className="icon-btn" aria-label="Retirer" onClick={() => setProofs((l) => l.filter((_, j) => j !== i))}>
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => {
                const fs = Array.from(e.target.files ?? []).filter((f) => f.size <= MAX_IMAGE_BYTES);
                setProofs((l) => [...l, ...fs]);
                e.target.value = '';
              }}
            />
          </details>
        </fieldset>

        {!founder && (
          <fieldset className="block">
            <legend>Consentement</legend>
            <label className="check">
              <input type="checkbox" checked={consentPub} onChange={(e) => setConsentPub(e.target.checked)} data-testid="consent-publication" />
              J’accepte que ma contribution soit examinée puis, si elle est validée, publiée sur Humanisons l’humain, selon les{' '}
              <a href="#/cgu" target="_blank" rel="noopener">conditions d’utilisation</a> et la{' '}
              <a href="#/confidentialite" target="_blank" rel="noopener">politique de confidentialité</a>. Je pourrai demander son retrait à tout moment.
            </label>
            {audio && publishVoice && (
              <label className="check">
                <input type="checkbox" checked={consentVoice} onChange={(e) => setConsentVoice(e.target.checked)} data-testid="consent-voice" />
                Je comprends que ma voix peut permettre de me reconnaître, et j’accepte sa diffusion.
              </label>
            )}
            {audio && (
              <label className="check">
                <input type="checkbox" checked={consentThirdParty} onChange={(e) => setConsentThirdParty(e.target.checked)} data-testid="consent-third-party" />
                L’enregistrement ne contient pas la voix d’autres personnes sans leur accord.
              </label>
            )}
          </fieldset>
        )}

        {errors.length > 0 && (
          <div className="alert" id="form-errors" tabIndex={-1} role="alert" data-testid="form-errors">
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setPreview(true)}>
            <Icon name="eye" size={16} /> Prévisualiser
          </button>
          <button type="button" className="btn btn--ghost" onClick={saveDraft} disabled={saving} data-testid="save-draft">
            Enregistrer le brouillon
          </button>
          {founder ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={(e) => submit(e as unknown as FormEvent, false)} disabled={saving}>
                Placer en modération
              </button>
              <button type="button" className="btn" onClick={(e) => submit(e as unknown as FormEvent, true)} disabled={saving}>
                Publier dans le fil
              </button>
            </>
          ) : (
            <button type="submit" className="btn" disabled={saving} data-testid="submit-moderation">
              {saving ? 'Envoi…' : 'Envoyer à la modération'}
            </button>
          )}
        </div>
      </form>

      <Modal open={preview} title="Aperçu de votre contribution" onClose={() => setPreview(false)}>
        <p className="muted small">Voici comment elle apparaîtrait dans le fil, une fois validée.</p>
        <div className="preview-wrap">
          <PostCard post={previewPost} full />
          {wantsVoice && audio && <LocalPreview draft={audio} />}
        </div>
      </Modal>
    </section>
  );
}
