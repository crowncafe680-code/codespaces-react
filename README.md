# GitHub Codespaces ♥️ React

Welcome to your shiny new Codespace running React! We've got everything fired up and running for you to explore React.

You've got a blank canvas to work on from a git perspective as well. There's a single initial commit with the what you're seeing right now - where you go from here is up to you!

Everything you do here is contained within this one codespace. There is no repository on GitHub yet. If and when you’re ready you can click "Publish Branch" and we’ll create your repository and push up your project. If you were just exploring then and have no further need for this code then you can simply delete your codespace and it's gone forever.

This project was bootstrapped for you with [Vite](https://vitejs.dev/).

## Available Scripts

In the project directory, you can run:

### `npm start`

We've already run this for you in the `Codespaces: server` terminal window below. If you need to stop the server for any reason you can just run `npm start` again to bring it back online.

Runs the app in the development mode.\
Open [http://localhost:3000/](http://localhost:3000/) in the built-in Simple Browser (`Cmd/Ctrl + Shift + P > Simple Browser: Show`) to view your running application.

The page will reload automatically when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Learn More

You can learn more in the [Vite documentation](https://vitejs.dev/guide/).

To learn Vitest, a Vite-native testing framework, go to [Vitest documentation](https://vitest.dev/guide/)

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://sambitsahoo.com/blog/vite-code-splitting-that-works.html](https://sambitsahoo.com/blog/vite-code-splitting-that-works.html)

### Analyzing the Bundle Size

This section has moved here: [https://github.com/btd/rollup-plugin-visualizer#rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer#rollup-plugin-visualizer)

### Making a Progressive Web App

This section has moved here: [https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf](https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf)

### Advanced Configuration

This section has moved here: [https://vitejs.dev/guide/build.html#advanced-base-options](https://vitejs.dev/guide/build.html#advanced-base-options)

### Deployment

This section has moved here: [https://vitejs.dev/guide/build.html](https://vitejs.dev/guide/build.html)

### Troubleshooting

This section has moved here: [https://vitejs.dev/guide/troubleshooting.html](https://vitejs.dev/guide/troubleshooting.html)

## React starter and restaurant app

The original React starter is restored at the browser root (`/`). The restaurant app remains available at `/restaurant`.

The browser-root app is installable as a Progressive Web App (PWA) in Chrome and includes an offline app shell. Serve it over HTTPS (for example, through the Codespaces forwarded HTTPS URL), open it in Chrome, then use the install icon in the address bar or Chrome menu → “Install app” / “Add to home screen”.

Restaurant tables are initialized and migrated to exactly 30 numbered tables (`T1`–`T30`). Existing statuses for those tables are retained.

## Restaurant app authentication and data

When Supabase is configured, the restaurant app authenticates with Supabase email/password accounts. The app then reads the signed-in user's active `employees` profile to determine their role; it does not offer public account registration. The profile table is protected by row-level security in `supabase/schema.sql`.

To enable authentication:

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. In Supabase Authentication, create the owner account and keep public sign-ups disabled.
3. Add the owner profile in the SQL Editor, replacing the sample name and email with the account you created:

   ```sql
   insert into public.employees (id, full_name, role)
   select id, 'Restaurant Owner', 'owner'
   from auth.users
   where lower(email) = lower('owner@example.com')
   on conflict (id) do update
     set full_name = excluded.full_name, role = excluded.role, active = true;
   ```

4. Add `VITE_SUPABASE_URL` and the Supabase **publishable/anon** key as build environment variables (or put them in an ignored `.env.local` for local development). Never put a service-role key in the browser app.
5. Create each staff account through Supabase Authentication and add its `employees` row with the intended role. The app will reject authenticated users without an active employee profile.

Production builds fail closed and show a configuration message if Supabase is not configured. The four-digit PIN gate is only available during local development without Supabase.

Authentication is enabled independently of data synchronization: restaurant records are still saved to this browser's `localStorage` and are **not yet synchronized between devices**. The existing SQL schema defines normalized business tables, but this client has not yet been migrated to use them.

Managers can add, edit, and remove inventory items; removing an item requires zero stock and no active menu recipe to reference it. Purchase, expense, and waste entries can be cancelled from their respective history lists, with stock adjustments applied to purchases and waste. Managers can remove menu items (past invoices retain their saved item details), while cashiers can remove items from the current cart.
