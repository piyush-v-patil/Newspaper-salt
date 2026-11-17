import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './app/router';
import { supabase } from './sync/supabase';
import { BASE } from './app/appPath';
import './styles/tokens.css';

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

// A confirmation link that failed (used already, or expired): keep the reason
// for Settings → Account & sync to explain, and go there.
const failed = new URLSearchParams(location.hash.slice(1)).get('error_description');
if (failed) {
  try {
    sessionStorage.setItem('pi-auth-error', failed);
  } catch {
    /* the explanation is a nicety */
  }
  history.replaceState(null, '', `${BASE}settings?section=account`);
}

// Arriving from an account confirmation email: let Supabase read the sign-in
// from the address before the app's routing changes it.
if (!failed && /access_token=|error_description=|[?&]code=/.test(location.hash + location.search)) {
  const client = supabase();
  if (client) void client.auth.getSession().finally(render);
  else render();
} else {
  render();
}
