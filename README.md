# BrainDumpz

**Live Demo:** [https://braindumpz.netlify.app/](https://braindumpz.netlify.app/)

BrainDumpz is a high-quality, production-ready, lightweight mental wellness web application specifically designed for students preparing for high-stakes exams (JEE, NEET, UPSC, CAT, GATE, etc.). It helps students track their mental health, recognize burnout patterns, and manage their emotional well-being without overwhelming them with another complicated system to maintain.

## Features

- **Calendar-Based Tracking:** Select any day to review past check-ins or log new data, keeping a steady visual timeline of your mental wellness journey.
- **Brain Dump Journaling:** A safe space to unload thoughts, worries, wins, and frustrations. It includes lightweight AI keyword detection that provides simple, gentle recommendations based on common emotional triggers.
- **Mood Tracker:** Quickly log your daily mood and visualize your emotional history.
- **Wellness Check-in:** Log critical recovery metrics—Study Hours, Sleep Hours, Water Intake, and Exercise—to automatically generate a daily Wellness Score.
- **Dashboard & Trends:** Visualizes your performance using lightweight charts over 7, 14, or 30-day periods.
- **Burnout Radar:** A proactive system that scans your recent logs to detect warning signs (e.g., clustered stress, low sleep, heavy study load) and provides actionable recovery advice.
- **Emergency Reset Mode:** A dedicated space featuring a 60-second breathing exercise, positive affirmations, and a quick recovery checklist for moments of acute panic or overwhelming stress.

## Technical Architecture

BrainDumpz is built with strict adherence to simplicity, speed, and resilience. 

- **Zero-Build, Vanilla Stack:** The application is built using pure HTML, CSS, and JavaScript. No heavy frameworks (like React or Next.js), build pipelines, or package managers are required.
- **Static Deployment Ready:** Can be hosted immediately on GitHub Pages, Vercel, Netlify, or simply opened locally in any modern browser.
- **Local Storage Engine:** Data persistence is handled entirely via browser `localStorage`. No backend infrastructure, databases, or authentication required. The application runs entirely client-side, ensuring complete data privacy for the user.
- **Chart.js:** Utilizes a lightweight, bundled version of Chart.js (`chart.umd.min.js`) for fast, responsive data visualizations.

## Code Quality & Resilience

- **Defensive Programming:** The entire application is wrapped in safe execution blocks. If `localStorage` hits quota limits or `Chart.js` fails to load, the application degrades gracefully rather than crashing.
- **Strict Input Validation:** Form values are aggressively sanitized to prevent XSS attacks, and numeric calculations are strictly clamped to logical ranges (e.g., max 24 hours of sleep) to maintain data integrity.
- **O(N) Performance Optimizations:** Rendering loops and data lookups are heavily optimized to ensure instant UI updates even with thousands of daily logs.
- **Accessibility:** Uses semantic HTML, `aria-label` tags, and high-contrast glassmorphic UI elements for screen reader and keyboard accessibility.

## How to Run

1. Clone or download this repository.
2. Open `index.html` in any modern web browser.
3. *That's it.* No `npm install`, no servers to start.

## Manual & Automated Testing

### Automated Test Suite (Zero-Install)
To fulfill code quality and test coverage requirements without introducing build tools or dependencies like Jest/Cypress, this repository includes a custom **Vanilla JS Test Runner**.

1. Open `test.html` in your browser.
2. The page will immediately run a suite of Unit and Integration tests.
3. It will simulate DOM interactions (creating entries, editing entries, checking emergency reset functionality) and validate the core algorithms (Wellness calculations, Burnout Radar).
4. Results are printed cleanly on the screen as `PASS` or `FAIL`.

### Manual Testing
The `app.js` file contains a detailed block at the very bottom explaining how to manually verify the application's defensive architecture, including simulating catastrophic browser storage failures and testing the journaling sanitization routines.
