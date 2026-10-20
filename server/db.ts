import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://cartradar@127.0.0.1:5433/cartradar',
});

/** Creates the tables on first run; safe to call on every start. */
export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name          text,
      mobile        text NOT NULL UNIQUE,
      email         text NOT NULL UNIQUE,
      created_at    timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      id          bigserial PRIMARY KEY,
      mobile      text NOT NULL,
      email       text NOT NULL,
      code_hash   text NOT NULL,
      attempts    integer NOT NULL DEFAULT 0,
      expires_at  timestamptz NOT NULL,
      consumed_at timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS login_codes_mobile_idx ON login_codes (mobile, created_at);
    CREATE INDEX IF NOT EXISTS login_codes_email_idx ON login_codes (email, created_at);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
  `);
}
