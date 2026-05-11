-- ============================================================
-- KOLLECTA — Migration complète de la base de données
-- PostgreSQL / Supabase
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLE: users ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom             VARCHAR(80)  NOT NULL,
  prenom          VARCHAR(80)  NOT NULL,
  whatsapp        VARCHAR(20)  UNIQUE,
  email           VARCHAR(120) UNIQUE,
  password_hash   VARCHAR(255),
  google_id       VARCHAR(100) UNIQUE,
  quartier        VARCHAR(100),
  ville           VARCHAR(80)  DEFAULT 'Dakar',
  avatar_url      TEXT,
  note_moyenne    DECIMAL(2,1) DEFAULT 0.0,
  nb_dons         INTEGER      DEFAULT 0,
  nb_evaluations  INTEGER      DEFAULT 0,
  verifie         BOOLEAN      DEFAULT FALSE,
  actif           BOOLEAN      DEFAULT TRUE,
  cree_le         TIMESTAMP    DEFAULT NOW(),
  mis_a_jour_le   TIMESTAMP    DEFAULT NOW()
);

-- ── TABLE: fcm_tokens ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  plateforme  VARCHAR(10) CHECK (plateforme IN ('ios', 'android', 'web')),
  cree_le     TIMESTAMP DEFAULT NOW()
);

-- ── TABLE: dons ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dons (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proprietaire_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titre            VARCHAR(120) NOT NULL,
  description      TEXT,
  type             VARCHAR(20) CHECK (type IN ('nourriture', 'materiel')) NOT NULL,
  categorie        VARCHAR(60),
  quartier         VARCHAR(100),
  ville            VARCHAR(80) DEFAULT 'Dakar',
  quantite_total   INTEGER DEFAULT 1,
  quantite_dispo   INTEGER DEFAULT 1,
  statut           VARCHAR(20) DEFAULT 'actif'
                   CHECK (statut IN ('actif', 'cloture', 'supprime')),
  urgent           BOOLEAN DEFAULT FALSE,
  expire_le        TIMESTAMP,
  cree_le          TIMESTAMP DEFAULT NOW(),
  mis_a_jour_le    TIMESTAMP DEFAULT NOW()
);

-- ── TABLE: reservations ───────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  don_id                UUID NOT NULL REFERENCES dons(id) ON DELETE CASCADE,
  demandeur_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statut                VARCHAR(30) DEFAULT 'en_attente'
                        CHECK (statut IN (
                          'en_attente',
                          'contacte',
                          'confirme_proprio',
                          'confirme_demandeur',
                          'cloture',
                          'annule'
                        )),
  contact_le            TIMESTAMP,
  deadline_confirm      TIMESTAMP,
  confirme_proprio      BOOLEAN DEFAULT FALSE,
  confirme_demandeur    BOOLEAN DEFAULT FALSE,
  cree_le               TIMESTAMP DEFAULT NOW(),
  mis_a_jour_le         TIMESTAMP DEFAULT NOW(),
  UNIQUE (don_id, demandeur_id)
);

-- ── TABLE: encheres ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS encheres (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendeur_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titre                 VARCHAR(120) NOT NULL,
  description           TEXT,
  categorie             VARCHAR(60),
  quartier              VARCHAR(100),
  ville                 VARCHAR(80) DEFAULT 'Dakar',
  prix_depart           INTEGER NOT NULL CHECK (prix_depart > 0),
  offre_actuelle        INTEGER,
  meilleur_offrant_id   UUID REFERENCES users(id),
  nb_offres             INTEGER DEFAULT 0,
  statut                VARCHAR(20) DEFAULT 'a_venir'
                        CHECK (statut IN ('a_venir', 'en_cours', 'termine', 'annule')),
  debut_le              TIMESTAMP NOT NULL,
  fin_le                TIMESTAMP NOT NULL,
  cree_le               TIMESTAMP DEFAULT NOW(),
  mis_a_jour_le         TIMESTAMP DEFAULT NOW()
);

-- ── TABLE: offres ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offres (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enchere_id   UUID NOT NULL REFERENCES encheres(id) ON DELETE CASCADE,
  offreur_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  montant      INTEGER NOT NULL CHECK (montant > 0),
  cree_le      TIMESTAMP DEFAULT NOW()
);

-- ── TABLE: medias ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medias (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entite_type   VARCHAR(10) CHECK (entite_type IN ('don', 'enchere')) NOT NULL,
  entite_id     UUID NOT NULL,
  url           TEXT NOT NULL,
  public_id     TEXT,
  ordre         SMALLINT DEFAULT 0,
  cree_le       TIMESTAMP DEFAULT NOW()
);

-- ── TABLE: notifications ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(30) CHECK (type IN (
                'reservation',
                'contact',
                'confirmation_requise',
                'don_cloture',
                'don_supprime',
                'enchere_offre',
                'enchere_gagnant',
                'enchere_termine'
              )) NOT NULL,
  titre       VARCHAR(100) NOT NULL,
  message     TEXT NOT NULL,
  entite_id   UUID,
  lu          BOOLEAN DEFAULT FALSE,
  cree_le     TIMESTAMP DEFAULT NOW()
);

-- ── TABLE: evaluations ────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluateur_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evalue_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  don_id          UUID REFERENCES dons(id),
  note            SMALLINT NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire     TEXT,
  cree_le         TIMESTAMP DEFAULT NOW(),
  UNIQUE (evaluateur_id, don_id)
);

-- ── INDEX pour les performances ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_dons_statut       ON dons(statut);
CREATE INDEX IF NOT EXISTS idx_dons_type         ON dons(type);
CREATE INDEX IF NOT EXISTS idx_dons_proprietaire ON dons(proprietaire_id);
CREATE INDEX IF NOT EXISTS idx_dons_cree_le      ON dons(cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_resa_don          ON reservations(don_id);
CREATE INDEX IF NOT EXISTS idx_resa_demandeur    ON reservations(demandeur_id);
CREATE INDEX IF NOT EXISTS idx_resa_statut       ON reservations(statut);
CREATE INDEX IF NOT EXISTS idx_resa_deadline     ON reservations(deadline_confirm);
CREATE INDEX IF NOT EXISTS idx_encheres_statut   ON encheres(statut);
CREATE INDEX IF NOT EXISTS idx_encheres_fin      ON encheres(fin_le);
CREATE INDEX IF NOT EXISTS idx_offres_enchere    ON offres(enchere_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user       ON notifications(user_id, lu);
CREATE INDEX IF NOT EXISTS idx_medias_entite     ON medias(entite_type, entite_id);

-- ── TRIGGER: mis_a_jour_le automatique ───────────────────
CREATE OR REPLACE FUNCTION update_mis_a_jour_le()
RETURNS TRIGGER AS $$
BEGIN
  NEW.mis_a_jour_le = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_mis_a_jour_le();

CREATE TRIGGER trg_dons_updated
  BEFORE UPDATE ON dons
  FOR EACH ROW EXECUTE FUNCTION update_mis_a_jour_le();

CREATE TRIGGER trg_reservations_updated
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_mis_a_jour_le();

CREATE TRIGGER trg_encheres_updated
  BEFORE UPDATE ON encheres
  FOR EACH ROW EXECUTE FUNCTION update_mis_a_jour_le();
