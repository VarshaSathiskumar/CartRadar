export interface GoogleSignInButtonProps {
  clientId: string;
  /** Called with the Google ID token once the user has picked an account. */
  onIdToken: (idToken: string) => void;
  onError: (message: string) => void;
}

/** Sign in with Google is only available in the browser for now; phones need a development build and extra setup. */
export function GoogleSignInButton(_props: GoogleSignInButtonProps) {
  return null;
}
