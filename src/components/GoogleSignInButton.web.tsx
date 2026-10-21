import { createElement, useEffect, useRef } from 'react';
import type { GoogleSignInButtonProps } from './GoogleSignInButton';

interface GoogleIdentity {
  initialize(config: { client_id: string; callback: (response: { credential?: string }) => void }): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptLoaded: Promise<void> | undefined;

const identity = () => (window as unknown as { google?: { accounts: { id: GoogleIdentity } } }).google?.accounts.id;

/** Loads Google's sign-in script once, however many times the button mounts. */
function loadScript(): Promise<void> {
  scriptLoaded ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoaded = undefined;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return scriptLoaded;
}

/** Google's own "Continue with Google" button. It hands back a signed ID token, which Supabase verifies with Google. */
export function GoogleSignInButton({ clientId, onIdToken, onError }: GoogleSignInButtonProps) {
  const host = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onIdToken, onError });
  handlers.current = { onIdToken, onError };

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        const google = identity();
        if (cancelled || !google || !host.current) return;
        google.initialize({
          client_id: clientId,
          callback: (response) => (response.credential ? handlers.current.onIdToken(response.credential) : handlers.current.onError('Google did not return a sign-in token')),
        });
        google.renderButton(host.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 300 });
      })
      .catch((e: unknown) => handlers.current.onError(e instanceof Error ? e.message : 'Could not load Google sign-in'));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return createElement('div', { ref: host, style: { display: 'flex', justifyContent: 'center', minHeight: 44 } });
}
