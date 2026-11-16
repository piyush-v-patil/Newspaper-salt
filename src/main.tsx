import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './app/router';
import './styles/tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
