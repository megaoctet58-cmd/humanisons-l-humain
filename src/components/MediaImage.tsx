/** Image stockée sur l'appareil ou dans la base partagée. */
import { useEffect, useState } from 'react';
import * as repo from '../services/repository';

export function MediaImage({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    repo.mediaUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!url) return <div className={`${className ?? ''} img-placeholder`} aria-hidden="true" />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
