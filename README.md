# 🔨 Kollecta — Backend API

API REST Node.js pour la plateforme sénégalaise de dons et d'enchères.

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Compte Supabase (gratuit)
- Compte Cloudinary (gratuit)
- Compte Firebase (gratuit)

### Installation

```bash
# 1. Cloner le projet
git clone https://github.com/ton-compte/kollecta-backend.git
cd kollecta-backend

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# → Remplir les valeurs dans .env

# 4. Lancer les migrations (crée toutes les tables)
npm run migrate

# 5. Démarrer en développement
npm run dev
```

L'API sera disponible sur `http://localhost:5000`

---

## 📁 Structure du projet

```
kollecta-backend/
├── src/
│   ├── index.js              # Point d'entrée
│   ├── config/
│   │   ├── db.js             # PostgreSQL (Supabase)
│   │   ├── cloudinary.js     # Upload photos
│   │   └── firebase.js       # Notifications push
│   ├── controllers/
│   │   └── authController.js # Inscription, connexion, profil
│   ├── middleware/
│   │   ├── auth.js           # Vérification JWT
│   │   └── errorHandler.js   # Erreurs globales
│   ├── routes/
│   │   └── auth.js           # Routes /api/auth
│   ├── services/
│   │   ├── notifService.js   # Firebase FCM
│   │   └── jobWorker.js      # Cron jobs (48h, enchères)
│   ├── utils/
│   │   └── helpers.js        # JWT, WhatsApp links
│   └── db/
│       ├── migrate.js        # Script migration
│       └── migrations/
│           └── 001_init.sql  # Toutes les tables
├── .env.example
├── .gitignore
└── package.json
```

---

## 🔗 Endpoints Phase 1 — Auth

| Méthode | Route                  | Auth | Description               |
|---------|------------------------|------|---------------------------|
| GET     | /api/health            | ❌   | Santé de l'API            |
| POST    | /api/auth/inscription  | ❌   | Créer un compte           |
| POST    | /api/auth/connexion    | ❌   | Se connecter              |
| POST    | /api/auth/google       | ❌   | Connexion Google OAuth    |
| GET     | /api/auth/moi          | ✅   | Profil connecté           |
| PUT     | /api/auth/profil       | ✅   | Modifier son profil       |
| POST    | /api/auth/fcm-token    | ✅   | Enregistrer token push    |

### Exemple inscription

```bash
curl -X POST http://localhost:5000/api/auth/inscription \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Mbaye",
    "prenom": "Aminata",
    "whatsapp": "+221771234567",
    "password": "motdepasse123",
    "quartier": "Plateau",
    "ville": "Dakar"
  }'
```

**Réponse :**
```json
{
  "success": true,
  "message": "Compte créé avec succès. Bienvenue sur Kollecta !",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid...",
    "nom": "Mbaye",
    "prenom": "Aminata",
    "whatsapp": "+221771234567",
    "quartier": "Plateau",
    "ville": "Dakar",
    "note_moyenne": 0,
    "nb_dons": 0,
    "verifie": false
  }
}
```

---

## 🗄️ Base de données (Supabase)

Tables créées par la migration :
- `users` — utilisateurs
- `fcm_tokens` — tokens notifications push
- `dons` — annonces de dons
- `reservations` — réservations + flux 48h
- `encheres` — enchères
- `offres` — historique des offres
- `medias` — photos annonces
- `notifications` — alertes in-app
- `evaluations` — notes entre utilisateurs

---

## ⏰ Jobs cron

| Fréquence   | Job                                    |
|-------------|----------------------------------------|
| Toutes les heures | Vérifier délais 48h réservations |
| Tous les jours à minuit | Clôturer enchères expirées |
| Toutes les 6h | Clôturer dons expirés            |

---

## 📦 Phase 2 — Prochainement

- Don Service (CRUD dons + réservations)
- WhatsApp Link Service
- Media Service (upload photos)
- Routes `/api/dons` et `/api/notifications`

---

## 🧪 Tests

```bash
npm test
```

---

## 🚀 Déploiement (Render.com)

1. Créer un nouveau **Web Service** sur render.com
2. Connecter le repo GitHub
3. Build command : `npm install`
4. Start command : `npm start`
5. Ajouter les variables d'environnement depuis `.env.example`
6. Déployer !
