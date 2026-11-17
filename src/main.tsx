import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './app/router';
import { supabase } from './sync/supabase';
import './styles/tokens.css';

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

// Arriving from an account confirmation email: let Supabase read the sign-in
// from the address before the app's routing changes it.
if (/access_token=|error_description=|[?&]code=/.test(location.hash + location.search)) {
  const client = supabase();
  if (client) void client.auth.getSession().finally(render);
  else render();
} else {
  render();
}
