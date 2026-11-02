# Skylar Theatre · Cinema Seat Manager

A seat reservation tool for cinema staff, written in TypeScript. The theatre has 8 rows (A–H) of 10 seats each. Staff can select and reserve seats in three ways: by clicking the seat map, by clicking seats in a 3D view of the hall, or by typing commands in the browser console.

After every action, the console prints the updated seat map, seat totals, and the first pair of free seats side by side.

## How it works

All seating data lives in one two-dimensional array of numbers, `seatingMatrix[row][column]`:

| Value | Meaning   | Console symbol |
|-------|-----------|----------------|
| `0`   | Available | `L`            |
| `2`   | Selected  | `S`            |
| `1`   | Reserved  | `X`            |

The seat map, the 3D hall and the console all read from and write to this array, so they always show the same thing.

**Project rule:** no objects or classes are used for the seating data. Only the 2D array is used, and JSON is the format for any extra data.

## Tech stack

- **TypeScript** for all app logic
- **Vite** as the dev server and build tool
- **Three.js** for the 3D cinema hall
- **GSAP** for the hall's animations
- **Plain CSS** for styling (the Tailwind Vite plugin is installed from the starter template but not used)

## Getting started

You need Node.js 18 or newer.

```bash
npm install      # install dependencies
npm run start    # start the dev server
```

Open the address that Vite prints, usually `http://localhost:5173`.

Other commands:

| Command             | What it does                                  |
|---------------------|-----------------------------------------------|
| `npm run typecheck` | Checks the TypeScript code without running it |
| `npm run build`     | Type-checks and builds the site into `dist/`  |
| `npm run preview`   | Serves the built site from `dist/`            |

The dev server listens on `0.0.0.0`, so it also works in GitHub Codespaces. Port 5173 is forwarded automatically.

> The project runs in the browser only. `npm run console` (left over from the starter template) does not work, because `main.ts` uses the page and imports CSS.

## Console commands

Open the browser's DevTools console (`F12`, or `Cmd + Option + J` on Mac) on the running page. The command list prints when the page loads.

| Command                     | What it does                                                  |
|-----------------------------|---------------------------------------------------------------|
| `select("A10")`             | Selects one seat. Seat codes are row letter + seat number      |
| `select("B1 b2 B3 b4")`     | Selects several seats. Separate codes with spaces or commas; letters can be any case |
| `confirmReservation()`      | Reserves every selected seat                                  |
| `clearSelection()`          | Makes all selected seats available again                     |
| `showSeatMap()`             | Prints the current seat map                                   |
| `help()`                    | Prints the command list again                                 |

`select` is all-or-nothing: if any code is not a real seat or is already reserved, it selects nothing and says which codes were wrong.

Example output:

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

## Main components

```text
index.html      Page layout: 3D hall, seat manager panel, screen-reader status area
src/main.ts     Seating data, rules, seat map panel and console commands
src/hall.ts     3D cinema hall
src/style.css   Theme and layout
```

### `src/main.ts`: seat logic

| Function                       | Role                                                                 |
|--------------------------------|----------------------------------------------------------------------|
| `seatingMatrix`                | The 8 × 10 array that holds every seat's state                       |
| `getSeatCounts()`              | Returns the number of reserved, available and selected seats          |
| `findAdjacentAvailableSeats()` | Searches row by row and returns the first two side-by-side free seats, or `null` |
| `displaySeatingMatrix()`       | Prints the seat map to the console                                    |
| `logRoomStatus(message)`       | Prints an action message, the seat map, totals and the adjacent-seat result |
| `render()`                     | Rebuilds the seat panel (seat buttons, totals, status message, Reserve button) and keeps keyboard focus in place |
| `parseSeatCode(code)`          | Turns a code like `"b2"` into array positions, or `null` if it isn't a real seat |
| `select`, `confirmReservation`, `clearSelection`, `help` | The console commands |

Clicking a seat button switches it between available and selected. Reserved seats can't be clicked. The **Reserve** button reserves every selected seat.

### `src/hall.ts`: 3D hall

Draws the theatre with Three.js, with the same 8 × 10 seats coloured by their state. Clicking a seat in the hall presses the matching seat button in the panel, so the same rules apply. The file also handles:

- hover tooltips (press `Esc` to close them)
- the **Pause animations** button, which also follows the system's reduced-motion setting
- the **Dock panel beside the hall** layout switch

### Accessibility

- Every seat is a real button with a label such as "Row A, seat 3, available".
- Status changes are announced to screen readers.
- Keyboard focus stays in place when the panel redraws.
- Selected seats differ by shape as well as colour.

## Credits

Built on the [4Geeks Academy TypeScript starter template](https://github.com/4GeeksAcademy/typescript-hello).
