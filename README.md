# TrustHome PH
A verified rental marketplace for homeowners, plus a single, always-updated catalog of bank-acquired properties.

## 📌 Overview
Renters and homebuyers in the Philippines often rely on informal, scam-prone channels — Facebook Marketplace, group chats, word of mouth — to find a room, house, or property, with no way to verify a listing is legitimate before sending a deposit. Meanwhile, banks each publish their own list of foreclosed/acquired properties in a different place and format, making them hard to browse in one spot. TrustHome PH solves both problems: homeowners list their own rentals directly and get a "Verified" badge after an ID/ownership check, renters search listings ranked by real booking history and ratings (not just recency), and buyers can browse a single curated catalog of bank-acquired properties instead of checking every bank's site separately.

## ✨ Features
- ID/ownership verification with a "Verified" listing badge
- Property listing management (create, edit, delete, with photos)
- Search and filter listings by location, price, and type
- Listing ranking based on completed bookings and average rating
- Conflict-free booking calendar (no double-booked dates)
- Post-rental ratings from both renter and homeowner
- Centralized, periodically-updated Bank-Acquired Properties catalog
- Admin dashboard for verification approval and catalog management

## 🛠️ Tech Stack
- **Frontend:** React
- **Backend:** Firebase (Cloud Functions where needed)
- **Database:** Firestore
- **Auth & Storage:** Firebase Authentication, Firebase Storage
- **Other tools:** Figma, Git & GitHub, VS Code, Firebase Hosting

## 📂 Project Structure
```
trusthome-ph/
├── public/                # Static assets
├── src/
│   ├── assets/             # Images, icons
│   ├── components/         # Reusable UI components
│   ├── pages/               # Home, ListingDetail, Booking, AdminDashboard, BankCatalog
│   ├── services/            # Firebase config & API calls (auth, firestore, storage)
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Helper functions (e.g. booking-conflict check, ranking sort)
│   ├── App.jsx
│   └── main.jsx
├── firebase.json          # Firebase Hosting/Functions config
├── firestore.rules         # Firestore security rules
├── .env.example             # Sample environment variables
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ and npm
- A Firebase project (Firestore, Authentication, and Storage enabled)
- Firebase CLI (`npm install -g firebase-tools`)
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/trusthome-ph.git

# Navigate into the project
cd trusthome-ph

# Install dependencies
npm install

# Copy the example env file and add your Firebase project keys
cp .env.example .env
```

### Running the App
```bash
# Start the local development server
npm start

# (Optional) Run Firebase emulators for Firestore/Auth locally
firebase emulators:start
```

## 👥 Team
| Name | Role |
|------|------|
| Rev Andrei Andresa | Scrum Master |
| Vien Melvic Laurente | Product Owner |
| Andrei Christopher Carillo | Developer |
| Justine James Prades | Developer |
| Robert Andrei Solpico | Developer |

## 📅 Sprint Progress
- [x] Sprint 0 — Ideation & Planning
- [ ] Sprint 1 — Design, environment setup, DB schema (v0.1)
- [ ] Sprint 2 — Auth + listing CRUD (v0.2)
- [ ] Sprint 3 — Booking calendar, verification, ranking, bank catalog, admin panel (v0.3 → v1.0)

## 📄 License
"This project is for academic purposes only."

## 🙏 Acknowledgments
Course: *[fill in your course name]*
Instructor/Panel: *[fill in instructor or panel name]*
Built with Firebase, React, and guidance from the team's capstone proposal framework.
