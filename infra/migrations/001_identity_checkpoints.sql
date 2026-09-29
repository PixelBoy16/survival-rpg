CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  login_name text NOT NULL UNIQUE CHECK (length(login_name) BETWEEN 3 AND 64),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled boolean NOT NULL DEFAULT false
);
CREATE TABLE characters (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 32),
  session_epoch bigint NOT NULL DEFAULT 0 CHECK (session_epoch >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id,name)
);
CREATE INDEX characters_by_account ON characters(account_id);
-- A versioned whole-character checkpoint is the single durable value record for this milestone.
-- Do not add a second independently authoritative inventory copy.
CREATE TABLE character_checkpoints (
  character_id uuid PRIMARY KEY REFERENCES characters(id),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE value_operations (
  character_id uuid NOT NULL REFERENCES characters(id),
  operation_id uuid NOT NULL,
  kind text NOT NULL CHECK (length(kind) BETWEEN 1 AND 64),
  request_hash text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id,operation_id)
);
CREATE TABLE value_ledger (
  id bigserial PRIMARY KEY,
  character_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (character_id,operation_id) REFERENCES value_operations(character_id,operation_id),
  UNIQUE (character_id,operation_id)
);
CREATE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Value ledger is append-only';
END;
$$;
CREATE TRIGGER value_ledger_immutable BEFORE UPDATE OR DELETE ON value_ledger
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
