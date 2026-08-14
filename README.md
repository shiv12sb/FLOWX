# Smart Traffic Command & Intelligent Routing System

A professional Smart City traffic command center for monitoring, coordinating, and intelligently routing traffic across multiple planning authority jurisdictions.

## Problem Statement

Uneven distribution of traffic over planning authorities' jurisdictions leads to localized congestion, inefficient routing, delayed emergency response, and poor cross-authority coordination.

## Project Objective

Build an intelligent transportation system command center that:

- Monitors live traffic across jurisdictions in real time
- Balances traffic load between planning authorities
- Provides smart routing recommendations
- Coordinates emergency and ambulance priority corridors
- Integrates weather, signals, and analytics into a unified operations dashboard

## Current Phase

**Phase 1 — Project Foundation**

This phase delivers the frontend foundation only: HTML5, CSS3, and vanilla JavaScript. No backend, database, maps, AI, or real-time data is implemented.

## Technologies Used (Phase 1)

| Technology | Purpose |
|---|---|
| HTML5 | Semantic page structure |
| CSS3 | Design system, layout, responsive styles |
| Vanilla JavaScript | Navigation, mobile menu, UI interactions |

## Folder Structure

```
smart-traffic-command-center/
├── index.html                  # Entry redirect to dashboard
├── pages/
│   ├── dashboard.html          # Main operations dashboard
│   ├── traffic.html            # Live traffic (placeholder)
│   ├── routing.html            # Smart routing (placeholder)
│   ├── signals.html            # Signal control (placeholder)
│   ├── emergency.html          # Emergency coordination (placeholder)
│   ├── weather.html            # Weather integration (placeholder)
│   ├── ambulance.html          # Ambulance routing (placeholder)
│   ├── authorities.html        # Authority coordination (placeholder)
│   ├── analytics.html          # Analytics & reporting (placeholder)
│   ├── alerts.html             # Alert system (placeholder)
│   └── settings.html           # System settings (placeholder)
├── css/
│   ├── variables.css           # Design tokens
│   ├── global.css              # Reset, typography, base styles
│   ├── layout.css              # Sidebar, topbar, main layout
│   ├── components.css          # Cards, KPIs, badges, navigation
│   └── responsive.css          # Tablet and mobile breakpoints
├── js/
│   ├── app.js                  # Application entry point
│   ├── navigation.js             # Sidebar and mobile menu
│   └── utils.js                # Utility helpers
├── assets/
│   ├── images/
│   ├── icons/
│   └── animations/
├── docs/
│   └── architecture.md         # Planned future architecture
└── README.md
```

## How to Run Locally

No build step or dependencies are required.

### Option 1 — Open directly

1. Navigate to the project folder.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
3. You will be redirected to `pages/dashboard.html`.

### Option 2 — Local HTTP server (recommended)

Using Python:

```bash
cd smart-traffic-command-center
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

Using Node.js (if installed):

```bash
npx serve .
```

Using VS Code / Cursor Live Server extension:

1. Open the project folder.
2. Right-click `index.html` → **Open with Live Server**.

## 18-Phase Roadmap

| Phase | Focus |
|---|---|
| **1** | **Project Foundation (HTML/CSS/JS layout)** ← *Current* |
| 2 | Backend API foundation (Node.js/Express) |
| 3 | Database schema and data models |
| 4 | Live traffic monitoring and map integration |
| 5 | Traffic signal control system |
| 6 | Smart routing engine |
| 7 | Emergency response coordination |
| 8 | Weather integration and impact analysis |
| 9 | Ambulance priority routing |
| 10 | Multi-authority coordination |
| 11 | Traffic analytics and reporting |
| 12 | Alert and notification system |
| 13 | System configuration and settings |
| 14 | AI/ML traffic automation |
| 15 | Real-time WebSocket communication |
| 16 | Authentication and role-based access |
| 17 | PWA and mobile deployment |
| 18 | Production deployment and Android APK |

## Current Limitations

- **Demo mode only** — All KPI values are labelled DEMO DATA and are not real traffic metrics.
- **No backend** — No API, database, or server-side logic.
- **No maps** — Geographic visualization is placeholder content only.
- **No real-time data** — No WebSockets or live data feeds.
- **No AI/ML** — No traffic predictions or intelligent recommendations.
- **No authentication** — User profile area is a UI placeholder.
- **Static navigation** — Sidebar HTML is duplicated across pages (will be templated in a future phase).

## Traffic Color Convention (Reserved)

These colors are defined in CSS variables for future phases:

| Color | Meaning |
|---|---|
| Green (`--traffic-green`) | Available road capacity |
| Orange (`--traffic-orange`) | High traffic / approaching capacity |
| Red (`--traffic-red`) | Road over capacity |

## License

Hackathon project — for demonstration and development purposes.
