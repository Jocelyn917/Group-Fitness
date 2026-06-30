# Group Fitness / PulsePal

PulsePal is now a multi-user-style social fitness app. It works immediately in local demo mode without Supabase, and can be upgraded to real cloud sync with Supabase. Users can sign up, create goals, track completions, view a social feed, like and comment on goals, manage friends, receive notifications, earn badges, and maintain streaks.

## What is included

- Supabase Authentication for sign up, login, logout, and persistent sessions
- Supabase database tables for profiles, goals, likes, comments, friendships, notifications, badges, and user badges
- Row Level Security policies for ownership, visibility, likes, comments, friendships, and notifications
- Goal creation modal with category, visibility, suggestions, edit, delete, and completion controls
- Grouped social feed with like/comment interactions
- Friends page with search, requests, accept/decline, and remove friend actions
- Profile page with stats, streak, badges, and friend count
- Notification center with read/unread state
- Weekly completion chart, current streak, recent activity, and dark mode

## Running without Supabase

No setup is required. Leave `src/supabase-config.js` as-is and open the app. Sign up/login will work in local demo mode, with accounts and goals saved in the current browser.

Local mode is great for demos, but it is not a real shared database across devices or classmates. For real multi-user sync, use Supabase below.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run the contents of `supabase-schema.sql`.
3. Copy `src/supabase-config.js` and replace the placeholders with your project URL and anon key:

```js
export const SUPABASE_URL = "https://your-project.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-key";
```

4. In Supabase Authentication settings, configure your site URL and email confirmation preferences.

## Run locally

The app can run directly from `index.html` because it uses browser import maps. For a Vite workflow:

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.
