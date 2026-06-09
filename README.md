# My Creative Hub

Personal hub built with TanStack Start, React, and Turso, ready for Netlify.

## Services

- Turso/libSQL stores profiles, links, pages, items, image data, and admin credentials.
- Admin passwords are stored only as salted `scrypt` hashes.

## Environment

Copy `.env.example` to `.env` and configure:

```env
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
SESSION_SECRET=
```

`TURSO_AUTH_TOKEN` and `SESSION_SECRET` are server-only. `SESSION_SECRET` encrypts
the login cookie; it is not the admin password. Use a random value with at least
32 characters and keep the same value between deploys.

## Database setup

Apply the Turso schema:

```bash
npm run db:migrate
```

Create the first admin, or change its email/password:

```bash
npm run db:create-admin
```

The password is requested interactively and stored only as a hash in Turso.

## Development

```bash
npm install
npm run dev
```

## Netlify

Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `SESSION_SECRET` in Netlify.
The build command and server output are defined in `netlify.toml`.
