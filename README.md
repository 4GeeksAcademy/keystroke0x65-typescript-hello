<div align="center">

# 🎬 Skylar Theatre

**Cinema Seat Manager**

A seat reservation tool for cinema staff. Select and reserve seats from a seat map, a 3D view of the hall, or the browser console.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.160-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![GSAP](https://img.shields.io/badge/GSAP-3.13-88CE02?logo=greensock&logoColor=white)](https://gsap.com/)
[![Accessibility](https://img.shields.io/badge/a11y-keyboard_%26_screen_reader-2E7D32)](#-accessibility)

[Getting started](#-getting-started) · [Console commands](#-console-commands) · [Project structure](#-project-structure)

</div>

---

## 📑 Table of contents

- [Features](#-features)
- [How it works](#-how-it-works)
- [Tech stack](#-tech-stack)
- [Getting started](#-getting-started)
- [Console commands](#-console-commands)
- [Project structure](#-project-structure)
- [Accessibility](#-accessibility)
- [Credits](#-credits)

## ✨ Features

- 🪑 **8 × 10 seat map** with rows A–H and seats 1–10
- 🎥 **3D cinema hall** that stays in sync with the seat map
- 💻 **Console commands** so staff can select and reserve seats by typing
- 🔍 **Free-pair search** that finds the first two available seats side by side
- 📋 **Status log** after every action: seat map, totals and the next free pair
- ♿ **Accessible**: works with a keyboard and screen readers, and respects reduced motion

## 🧠 How it works

All seating data lives in a single two-dimensional array of numbers, `seatingMatrix[row][column]`:

| Value | Meaning | Console symbol |
| --- | --- | --- |
| `0` | Available | `L` |
| `2` | Selected | `S` |
| `1` | Reserved | `X` |

The seat map, the 3D hall and the console all read from and write to this one array, so they always agree.

> [!IMPORTANT]
> **Project rule:** no objects or classes are used for the seating data. Only the 2D array is used, and JSON is the format for any extra data.

## 🛠 Tech stack

| Tool | Used for |
| --- | --- |
| **TypeScript** | All app logic |
| **Vite** | Dev server and build tool |
| **Three.js** | The 3D cinema hall |
| **GSAP** | The hall's animations |
| **CSS** | Styling, using custom properties for the theme |

## 🚀 Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer

### Install and run

```bash
npm install      # install dependencies
npm run start    # start the dev server
```

Then open the address that Vite prints, usually **<http://localhost:5173>**.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run start` | Starts the dev server with live reload |
| `npm run typecheck` | Checks the TypeScript code without running it |
| `npm run build` | Type-checks and builds the site into `dist/` |
| `npm run preview` | Serves the built site from `dist/` |

> [!TIP]
> The dev server listens on `0.0.0.0`, so it also works in **GitHub Codespaces**. Port 5173 is forwarded automatically.

> [!WARNING]
> The project runs in the browser only. `npm run console` (left over from the starter template) does not work, because `main.ts` uses the page and imports CSS.

## 💻 Console commands

Open the browser's DevTools console (`F12`, or `Cmd + Option + J` on Mac) on the running page. The command list prints when the page loads.

| Command | What it does |
| --- | --- |
| `select("A10")` | Selects one seat. Seat codes are row letter + seat number |
| `select("B1 b2 B3 b4")` | Selects several seats. Separate codes with spaces or commas; letters can be any case |
| `confirmReservation()` | Reserves every selected seat |
| `clearSelection()` | Makes all selected seats available again |
| `showSeatMap()` | Prints the current seat map |
| `help()` | Prints the command list again |

> [!NOTE]
> `select` is **all-or-nothing**: if any code is not a real seat or is already reserved, it selects nothing and says which codes were wrong.

<details>
<summary><b>Example output</b></summary>

```text
Seat map (X = occupied, L = available, S = selected):
    1  2  3  4  5  6  7  8  9  10
A   L  L  L  L  L  L  L  L  L  S   1
B   S  S  L  L  L  L  L  L  L  L   2
...
Seat totals: 0 reserved, 3 selected, 77 available.
Seats A10, B1, B2 selected and ready to reserve.
Type confirmReservation() to reserve.
```

</details>

## 📁 Project structure

```text
.
├── index.html       # Page layout: 3D hall, seat manager panel, screen-reader status area
└── src/
    ├── main.ts      # Seating data, rules, seat map panel and console commands
    ├── hall.ts      # 3D cinema hall
    └── style.css    # Theme and layout
```

<details>
<summary><b><code>src/main.ts</code>: seat logic</b></summary>

<br>

| Function | Role |
| --- | --- |
| `seatingMatrix` | The 8 × 10 array that holds every seat's state |
| `getSeatCounts()` | Returns the number of reserved, available and selected seats |
| `findAdjacentAvailableSeats()` | Searches row by row and returns the first two side-by-side free seats, or `null` |
| `displaySeatingMatrix()` | Prints the seat map to the console |
| `logRoomStatus(message)` | Prints an action message, the seat map, totals and the adjacent-seat result |
| `render()` | Rebuilds the seat panel (seat buttons, totals, status message, Reserve button) and keeps keyboard focus in place |
| `parseSeatCode(code)` | Turns a code like `"b2"` into array positions, or `null` if it isn't a real seat |
| `select`, `confirmReservation`, `clearSelection`, `help` | The console commands |

Clicking a seat button switches it between available and selected. Reserved seats can't be clicked. The **Reserve** button reserves every selected seat.

</details>

<details>
<summary><b><code>src/hall.ts</code>: 3D hall</b></summary>

<br>

Draws the theatre with Three.js, with the same 8 × 10 seats coloured by their state. Clicking a seat in the hall presses the matching seat button in the panel, so the same rules apply. It also handles:

- hover tooltips (press `Esc` to close them)
- the **Pause animations** button, which also follows the system's reduced-motion setting
- the **Dock panel beside the hall** layout switch

</details>

## ♿ Accessibility

- Every seat is a real button with a label such as *"Row A, seat 3, available"*.
- Status changes are announced to screen readers.
- Keyboard focus stays in place when the panel redraws.
- Selected seats differ by shape as well as colour.

## 🙏 Credits

Built on the [4Geeks Academy TypeScript starter template](https://github.com/4GeeksAcademy/typescript-hello).
