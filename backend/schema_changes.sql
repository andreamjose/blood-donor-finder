-- backend/schema_changes.sql
-- Run in the Supabase SQL editor. Safe to re-run.

-- Location columns (radius matching)
ALTER TABLE donors    ADD COLUMN IF NOT EXISTS area      varchar;
ALTER TABLE donors    ADD COLUMN IF NOT EXISTS latitude  double precision;
ALTER TABLE donors    ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS latitude  double precision;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS longitude double precision;

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id           serial PRIMARY KEY,
  user_id      integer NOT NULL REFERENCES users(id),
  category     varchar NOT NULL,
  subject      varchar NOT NULL,
  status       varchar DEFAULT 'Open',
  user_unread  boolean DEFAULT false,
  admin_unread boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id         serial PRIMARY KEY,
  ticket_id  integer NOT NULL REFERENCES support_tickets(id),
  sender     varchar NOT NULL,  -- 'user' or 'admin'
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Donation camps
CREATE TABLE IF NOT EXISTS camps (
  id serial PRIMARY KEY,
  hospital_id integer NOT NULL REFERENCES hospitals(id),
  title varchar NOT NULL,
  venue varchar NOT NULL,
  city varchar NOT NULL,
  camp_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 1000),
  notes text,
  status varchar NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Cancelled')),
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS camp_bookings (
  id serial PRIMARY KEY,
  camp_id integer NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  donor_id integer NOT NULL REFERENCES donors(id),
  status varchar NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked', 'Cancelled', 'Attended', 'NoShow')),
  booked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (camp_id, donor_id)
);