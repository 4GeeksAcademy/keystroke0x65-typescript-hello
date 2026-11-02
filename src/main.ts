import "./style.css";
import { initHall } from "./hall";

const ROWS = 8;
const COLUMNS = 10;
const SEAT_TAKEN = 1;
const SEAT_AVAILABLE = 0;
const SEAT_SELECTED = 2;

const seatingMatrix: number[][] = Array.from({ length: ROWS }, () =>
  Array(COLUMNS).fill(SEAT_AVAILABLE),
);
const app = document.querySelector<HTMLElement>("#app");
let statusMessage = "Choose available seats, then reserve your selection.";
// Last status read out to screen readers, so the starting message isn't announced on page load.
let announcedMessage = statusMessage;

// Mirrors the seat matrix in the 3D hall; a click in the hall presses the matching seat button so the same rules apply.
const hall = initHall({
  rows: ROWS,
  columns: COLUMNS,
  getSeat: (index) => {
    const seat = seatingMatrix[Math.floor(index / COLUMNS)][index % COLUMNS];
    return seat === SEAT_TAKEN ? "res" : seat === SEAT_SELECTED ? "sel" : "open";
  },
  clickSeat: (index) => {
    app
      ?.querySelector<HTMLButtonElement>(`.seat-button[data-row="${Math.floor(index / COLUMNS) + 1}"][data-column="${(index % COLUMNS) + 1}"]`)
      ?.click();
  },
});

// Counts occupied, available, and selected seats and returns the totals in that order.
function getSeatCounts(): [number, number, number] {
  const occupied = seatingMatrix.flat().filter((seat) => seat === SEAT_TAKEN).length;
  const selected = seatingMatrix.flat().filter((seat) => seat === SEAT_SELECTED).length;
  const available = seatingMatrix.flat().filter((seat) => seat === SEAT_AVAILABLE).length;
  return [occupied, available, selected];
}

// Returns the first pair of available seats next to each other in the same row.
function findAdjacentAvailableSeats(): [number, number, number] | null {
  for (let rowIndex = 0; rowIndex < ROWS; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < COLUMNS - 1; columnIndex += 1) {
      if (
        seatingMatrix[rowIndex][columnIndex] === SEAT_AVAILABLE &&
        seatingMatrix[rowIndex][columnIndex + 1] === SEAT_AVAILABLE
      ) {
        return [rowIndex, columnIndex, columnIndex + 1];
      }
    }
  }
  return null;
}

// Prints the seating matrix with lettered rows on the left and row numbers on the right.
function displaySeatingMatrix(): void {
  console.info("Seat map (X = occupied, L = available, S = selected):");
  console.info(`    ${Array.from({ length: COLUMNS }, (_, index) => String(index + 1).padStart(1, " ")).join("  ")}`);
  seatingMatrix.forEach((row, rowIndex) => {
    const seats = row
      .map((seat) => seat === SEAT_TAKEN ? "X" : seat === SEAT_SELECTED ? "S" : "L")
      .join("  ");
    console.info(`${String.fromCharCode(65 + rowIndex)}   ${seats}   ${rowIndex + 1}`);
  });
}

// Logs the action, current seat map, counts, and first adjacent available pair for staff.
function logRoomStatus(actionMessage: string): void {
  const [occupied, available, selected] = getSeatCounts();
  console.info(`Cinema seating update: ${actionMessage}`);
  displaySeatingMatrix();
  console.info(`Seat totals: ${occupied} reserved, ${selected} selected, ${available} available.`);

  const adjacentSeats = findAdjacentAvailableSeats();
  if (adjacentSeats) {
    const [rowIndex, firstColumn, secondColumn] = adjacentSeats;
    console.info(
      `Adjacent available seats found: Row ${String.fromCharCode(65 + rowIndex)}, seats ${firstColumn + 1} and ${secondColumn + 1}.`,
    );
  } else {
    console.info("No horizontally adjacent available seats found.");
  }
}

// Builds the seat map and updates the page with current seat counts and status.
function render(): void {
  if (!app) return;

  const [occupied, available, selected] = getSeatCounts();
  const rows = seatingMatrix
    .map(
      (row, rowIndex) => `
        <span class="row-label" aria-hidden="true">${String.fromCharCode(65 + rowIndex)}</span>
        ${row
          .map((seat, columnIndex) => {
            const taken = seat === SEAT_TAKEN;
            const isSelected = seat === SEAT_SELECTED;
            const seatNumber = columnIndex + 1;
            return `<button
              type="button"
              class="seat-button seat"
              data-state="${taken ? "res" : isSelected ? "sel" : "open"}"
              data-row="${rowIndex + 1}"
              data-column="${seatNumber}"
              aria-label="Row ${String.fromCharCode(65 + rowIndex)}, seat ${seatNumber}, ${taken ? "reserved" : isSelected ? "selected" : "available"}"
              ${taken ? "disabled" : `aria-pressed="${isSelected}"`}
            >${seatNumber}</button>`;
          })
          .join("")}`,
    )
    .join("");
  // Colours the status line: red for a rejected seat or selection, gold once every seat is reserved.
  const statusTone = /^(Reservation unavailable|Nothing was selected)/.test(statusMessage)
    ? " warn"
    : available === 0 && selected === 0
      ? " full"
      : "";

  // Remembers which control had keyboard focus, because rebuilding the panel would otherwise drop it.
  const focused = document.activeElement instanceof HTMLElement && app.contains(document.activeElement)
    ? document.activeElement
    : null;
  const focusSelector = focused?.matches(".seat-button")
    ? `.seat-button[data-row="${focused.dataset.row}"][data-column="${focused.dataset.column}"]`
    : focused?.id
      ? `#${focused.id}`
      : null;

  app.innerHTML = `
    <div class="panel-head">
      <div>
        <p class="kicker">Main hall · General seating</p>
        <h2>Choose your seats</h2>
        <p class="lede">Choose available seats, then reserve your selection.</p>
      </div>
      <dl class="stats" aria-label="Seat totals">
        <div><dt>Available</dt><dd id="available-count">${available}</dd></div>
        <div><dt>Selected</dt><dd id="selected-count" class="is-selected">${selected}</dd></div>
        <div><dt>Reserved</dt><dd id="occupied-count" class="is-reserved">${occupied}</dd></div>
      </dl>
    </div>

    <div class="map">
      <div class="stage-label" aria-hidden="true">Stage</div>
      <p id="seat-map-help" class="sr-only">Row A is closest to the stage. Press a seat to select it, press it again to unselect it, then use the Reserve button. Reserved seats can't be selected.</p>
      <div class="seats" role="group" aria-label="Seat map, rows A to H, seats 1 to 10" aria-describedby="seat-map-help">${rows}</div>
      <ul class="legend" aria-label="Seat colour key">
        <li><span class="swatch" aria-hidden="true"></span>Available</li>
        <li><span class="swatch sel" aria-hidden="true"></span>Selected</li>
        <li><span class="swatch res" aria-hidden="true"></span>Reserved</li>
      </ul>
    </div>

    <div class="panel-foot">
      <p id="reservation-message" class="status${statusTone}" tabindex="-1">${statusMessage}</p>
      <button id="reserve-selected" type="button" class="reserve" ${selected === 0 ? "disabled" : ""}>Reserve ${selected} ${selected === 1 ? "seat" : "seats"}</button>
    </div>`;

  // Puts focus back on the same control; if it is now disabled (e.g. after reserving), focus moves to the status message.
  let focusMovedToStatus = false;
  if (focusSelector) {
    const target = app.querySelector<HTMLElement>(focusSelector);
    if (target && !(target instanceof HTMLButtonElement && target.disabled)) {
      target.focus();
    } else {
      app.querySelector<HTMLElement>("#reservation-message")?.focus();
      focusMovedToStatus = true;
    }
  }

  // Announces new status messages to screen readers from a live region outside the rebuilt panel.
  const announcer = document.querySelector("#seat-announcer");
  if (announcer && statusMessage !== announcedMessage) {
    announcer.textContent = focusMovedToStatus ? "" : statusMessage;
    announcedMessage = statusMessage;
  }
  hall.sync();
}

// Handles seat selection and reservation button clicks, updating the matrix and display.
app?.addEventListener("click", (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  if (target.matches("#reserve-selected")) {
    let reserved = 0;
    seatingMatrix.forEach((row, rowIndex) => {
      row.forEach((seat, columnIndex) => {
        if (seat === SEAT_SELECTED) {
          seatingMatrix[rowIndex][columnIndex] = SEAT_TAKEN;
          reserved += 1;
        }
      });
    });
    statusMessage = `Reservation confirmed: ${reserved} ${reserved === 1 ? "seat has" : "seats have"} been reserved.`;
    logRoomStatus(statusMessage);
    render();
    return;
  }

  if (!target.matches(".seat-button")) return;

  const rowNumber = Number(target.dataset.row);
  const columnNumber = Number(target.dataset.column);
  const seat = seatingMatrix[rowNumber - 1]?.[columnNumber - 1];
  if (seat === SEAT_TAKEN) {
    const seatName = `${String.fromCharCode(64 + rowNumber)}${columnNumber}`;
    statusMessage = `Reservation unavailable: seat ${seatName} is already reserved.`;
    console.warn(statusMessage);
    render();
    return;
  }

  seatingMatrix[rowNumber - 1][columnNumber - 1] = seat === SEAT_SELECTED ? SEAT_AVAILABLE : SEAT_SELECTED;
  const seatName = `${String.fromCharCode(64 + rowNumber)}${columnNumber}`;
  statusMessage = seat === SEAT_SELECTED
    ? `Seat ${seatName} removed from your selection.`
    : `Seat ${seatName} selected and ready to reserve.`;
  logRoomStatus(statusMessage);
  render();
});

// Prints the Skylar Theatre welcome banner once when the app starts.
function printWelcomeBanner(): void {
  console.info(String.raw`
+===============================================================+
|                                                               |
|                      W E L C O M E   T O                      |
|                                                               |
|        ____    _  __ __   __  _          _      ____          |
|       / ___|  | |/ / \ \ / / | |        / \    |  _ \         |
|       \___ \  | ' /   \ V /  | |       / _ \   | |_) |        |
|        ___) | | . \    | |   | |___   / ___ \  |  _ <         |
|       |____/  |_|\_\   |_|   |_____| /_/   \_\ |_| \_\        |
|                                                               |
|    _____   _   _   _____      _      _____   ____    _____    |
|   |_   _| | | | | | ____|    / \    |_   _| |  _ \  | ____|   |
|     | |   | |_| | |  _|     / _ \     | |   | |_) | |  _|     |
|     | |   |  _  | | |___   / ___ \    | |   |  _ <  | |___    |
|     |_|   |_| |_| |_____| /_/   \_\   |_|   |_| \_\ |_____|   |
|                                                               |
|          *  C I N E M A   S E A T   M A N A G E R  *          |
|                                                               |
+===============================================================+`);
}

printWelcomeBanner();
render();
logRoomStatus("System ready. All seats are available.");

// Converts a seat code like "A10" or "b2" into matrix indexes, or null if it is not a real seat.
function parseSeatCode(code: string): [number, number] | null {
  const match = /^([a-z])(\d{1,2})$/i.exec(code);
  if (!match) return null;
  const rowIndex = match[1].toUpperCase().charCodeAt(0) - 65;
  const columnIndex = Number(match[2]) - 1;
  if (rowIndex >= ROWS || columnIndex < 0 || columnIndex >= COLUMNS) return null;
  return [rowIndex, columnIndex];
}

// Prints the seat map and totals first, then the command result last (one sentence per line) so it sits right above the console input.
function logConsoleResult(message: string, isProblem = false): void {
  const [occupied, available, selected] = getSeatCounts();
  displaySeatingMatrix();
  console.info(`Seat totals: ${occupied} reserved, ${selected} selected, ${available} available.`);
  const formattedMessage = message.replace(/([.!?])\s+/g, "$1\n");
  if (isProblem) {
    console.warn(formattedMessage);
  } else {
    console.info(formattedMessage);
  }
}

// Selects the seats typed in the console only if every seat is valid and available, otherwise selects none.
function select(seatCodes: string): void {
  const validSeats: [string, number, number][] = [];
  const reservedSeats: string[] = [];
  const invalidSeats: string[] = [];

  seatCodes.split(/[\s,]+/).filter(Boolean).forEach((code) => {
    const seatName = code.toUpperCase();
    const position = parseSeatCode(code);
    if (!position) {
      invalidSeats.push(seatName);
      return;
    }
    const [rowIndex, columnIndex] = position;
    if (seatingMatrix[rowIndex][columnIndex] === SEAT_TAKEN) {
      reservedSeats.push(seatName);
      return;
    }
    validSeats.push([seatName, rowIndex, columnIndex]);
  });

  const problems: string[] = [];
  if (reservedSeats.length > 0) {
    problems.push(`Not available, already reserved: ${reservedSeats.join(", ")}.`);
  }
  if (invalidSeats.length > 0) {
    problems.push(`Not valid seats (rows A–${String.fromCharCode(64 + ROWS)}, seats 1–${COLUMNS}): ${invalidSeats.join(", ")}.`);
  }

  if (problems.length > 0) {
    statusMessage = `Nothing was selected. ${problems.join(" ")} Please try again with available seats.`;
    render();
    logConsoleResult(statusMessage, true);
    return;
  }
  if (validSeats.length === 0) {
    logConsoleResult('No seats entered. Example: select("A10 b2")', true);
    return;
  }

  validSeats.forEach(([, rowIndex, columnIndex]) => {
    seatingMatrix[rowIndex][columnIndex] = SEAT_SELECTED;
  });
  const seatNames = validSeats.map(([seatName]) => seatName);
  const seatWord = seatNames.length === 1 ? "Seat" : "Seats";
  statusMessage = `${seatWord} ${seatNames.join(", ")} selected and ready to reserve. Type confirmReservation() to reserve.`;
  render();
  logConsoleResult(statusMessage);
}

// Reserves every selected seat from the console, matching the UI reserve button, and syncs the UI.
function confirmReservation(): void {
  let reserved = 0;
  seatingMatrix.forEach((row, rowIndex) => {
    row.forEach((seat, columnIndex) => {
      if (seat === SEAT_SELECTED) {
        seatingMatrix[rowIndex][columnIndex] = SEAT_TAKEN;
        reserved += 1;
      }
    });
  });
  if (reserved === 0) {
    logConsoleResult('No seats selected yet. Choose seats first, for example: select("A10 b2")', true);
    return;
  }
  statusMessage = `Reservation confirmed: ${reserved} ${reserved === 1 ? "seat has" : "seats have"} been reserved.`;
  render();
  logConsoleResult(statusMessage);
}

// Returns all selected seats to available and syncs the UI.
function clearSelection(): void {
  seatingMatrix.forEach((row, rowIndex) => {
    row.forEach((seat, columnIndex) => {
      if (seat === SEAT_SELECTED) seatingMatrix[rowIndex][columnIndex] = SEAT_AVAILABLE;
    });
  });
  statusMessage = "Selection cleared.";
  render();
  logConsoleResult(statusMessage);
}

// Prints the console commands available to the user.
function help(): void {
  console.info(
    [
      "Seat manager console commands:",
      '  select("A10")          select one seat (letters are not case sensitive)',
      '  select("B1 b2 B3 b4")  select several seats at once',
      "  confirmReservation()   reserve all selected seats",
      "  clearSelection()       unselect all selected seats",
      "  showSeatMap()          print the current seat map",
      "  help()                 show these instructions again",
    ].join("\n"),
  );
}

// Exposes the console commands on the page so they can be typed in the browser DevTools console.
Object.assign(window, { select, confirmReservation, clearSelection, showSeatMap: displaySeatingMatrix, help });
help();

