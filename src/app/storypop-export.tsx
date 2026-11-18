'use client';
import { useEffect, useRef, useState } from 'react';

const destination = 'https://storypop.fun';
export function StoryPopExport({ url, title }: { url: string; title: string }) {
  const [status, setStatus] = useState('');
  const [waiting, setWaiting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [url]);

  function send() {
    controller.current?.abort();
    const session = new AbortController();
    controller.current = session;
    const id = crypto.randomUUID();
    const studio = window.open(destination + '/creator-dashboard?tab=create#haggs=' + id, '_blank');
    if (!studio) { setStatus('Allow the StoryPop tab to open, then try again.'); return; }
    setWaiting(true);
    setStatus('Sign in and choose Import film in the StoryPop tab.');
    let sent = false;
    const finish = (message: string) => {
      session.abort();
      setWaiting(false);
      setStatus(message);
    };
    const timer = window.setTimeout(() => finish('Transfer timed out. Check the StoryPop tab before starting another export.'), 600000);
    session.signal.addEventListener('abort', () => clearTimeout(timer));
    window.addEventListener('message', async event => {
      if (event.origin !== destination || event.source !== studio || event.data?.id !== id) return;
      if (sent && event.data.type === 'haggs.imported') return finish('Film uploaded. Finish your episode in StoryPop.');
      if (event.data.type === 'haggs.failed') return finish('StoryPop could not import this film. Check the upload message there.');
      if (sent || event.data.type !== 'haggs.request') return;
      sent = true;
      try {
        setStatus('Transferring the finished MP4 to StoryPop…');
        const response = await fetch(url, { signal: session.signal });
        if (!response.ok) throw Error();
        const blob = await response.blob();
        if (!blob.size) throw Error();
        studio.postMessage({ type: 'haggs.film', id, title, blob }, destination);
      } catch {
        if (!session.signal.aborted) {
          studio.postMessage({ type: 'haggs.failed', id }, destination);
          finish('The finished MP4 could not be read. Open the render and try again.');
        }
      }
    }, { signal: session.signal });
  }
  return <span><button className="pill" disabled={waiting} onClick={send}>Export to StoryPop</button>{waiting && <button className="plain" onClick={() => { controller.current?.abort(); setWaiting(false); setStatus('Check StoryPop for any upload already in progress.'); }}>Close transfer</button>} <small role="status">{status}</small></span>;
}
