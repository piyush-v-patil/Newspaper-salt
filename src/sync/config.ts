/**
 * The Supabase project this build syncs with. Both values are meant to be
 * public: they sit in every copy of the app, and the database's own rules
 * (see supabase/schema.sql) are what keep each person's data private.
 * A build can override them with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 */
const PROJECT_URL = 'https://cxhvfcjnvfoggpoalzdq.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_P-h7FeUKiGz5p8ombp95Ig_KTJ1iO1m';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || PROJECT_URL;
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || PUBLISHABLE_KEY;
export const syncConfigured = SUPABASE_URL !== '' && SUPABASE_KEY !== '';

/** Where the link in a confirmation email leads: the web app (the Windows app has no web address of its own). */
export const WEB_APP_URL = 'https://piyush-v-patil.github.io/Newspaper-salt/';
