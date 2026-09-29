import "./style.css";

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

// Prints the seating matrix with numbered rows and columns.
function displaySeatingMatrix(): void {
  console.info("Seat map (X = occupied, L = available, S = selected):");
  console.info(`     ${Array.from({ length: COLUMNS }, (_, index) => String(index + 1).padStart(1, " ")).join("  ")}`);
  seatingMatrix.forEach((row, rowIndex) => {
    const seats = row
      .map((seat) => seat === SEAT_TAKEN ? "X" : seat === SEAT_SELECTED ? "S" : "L")
      .join("  ");
    console.info(`${String(rowIndex + 1).padStart(2, " ")}   ${seats}`);
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
        <div class="grid grid-cols-[2rem_repeat(10,minmax(2rem,1fr))] items-center gap-2 sm:gap-3" aria-label="Row ${rowIndex + 1}">
          <span class="text-xs font-semibold text-slate-400">${String.fromCharCode(65 + rowIndex)}</span>
          ${row
            .map((seat, columnIndex) => {
              const taken = seat === SEAT_TAKEN;
              const isSelected = seat === SEAT_SELECTED;
              const seatNumber = columnIndex + 1;
              return `<button
                type="button"
                class="seat-button ${taken ? "seat-taken" : isSelected ? "seat-selected" : "seat-available"}"
                data-row="${rowIndex + 1}"
                data-column="${seatNumber}"
                aria-label="Row ${String.fromCharCode(65 + rowIndex)}, seat ${seatNumber}, ${taken ? "reserved" : isSelected ? "selected" : "available"}"
                aria-pressed="${isSelected}"
                ${taken ? "disabled" : ""}
              >${isSelected ? "✓" : seatNumber}</button>`;
            })
            .join("")}
        </div>`,
    )
    .join("");

  app.innerHTML = `
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header class="mb-8 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5h16v13H4zM8 5.5v13m8-13v13M4 9h4m8 0h4m-16 6h4m8 0h4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Venue operations</p>
            <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Seat manager</h1>
          </div>
        </div>
        <span class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">● Live seating</span>
      </header>

      <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-5 py-6 sm:px-8">
          <div class="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p class="text-sm font-medium text-slate-500">Main hall · General seating</p>
              <h2 class="mt-1 text-2xl font-bold tracking-tight text-slate-900">Choose your seats</h2>
              <p class="mt-2 text-sm text-slate-500">Choose available seats, then reserve your selection.</p>
            </div>
            <div class="flex gap-6">
              <div><p class="text-xs font-medium text-slate-500">Available</p><p id="available-count" class="mt-1 text-2xl font-bold text-slate-900">${available}</p></div>
              <div class="border-l border-slate-200 pl-4"><p class="text-xs font-medium text-slate-500">Selected</p><p id="selected-count" class="mt-1 text-2xl font-bold text-indigo-600">${selected}</p></div>
              <div class="border-l border-slate-200 pl-4"><p class="text-xs font-medium text-slate-500">Reserved</p><p id="occupied-count" class="mt-1 text-2xl font-bold text-slate-900">${occupied}</p></div>
            </div>
          </div>
        </div>

        <div class="px-3 py-8 sm:px-8 sm:py-10">
          <div class="mx-auto max-w-3xl">
            <div class="mx-auto mb-10 max-w-xl">
              <div class="screen-shape flex h-12 items-center justify-center rounded-t-[50%] border-t-4 border-indigo-400 bg-indigo-50 text-xs font-bold uppercase tracking-[0.25em] text-indigo-500">Stage</div>
              <div class="mx-auto h-3 w-[82%] rounded-b-full bg-linear-to-b from-indigo-100 to-transparent"></div>
            </div>
            <div class="space-y-3" role="group" aria-label="Seat map">${rows}</div>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-slate-600">
              <span class="flex items-center gap-2"><span class="legend-seat legend-available"></span>Available</span>
              <span class="flex items-center gap-2"><span class="legend-seat legend-selected">✓</span>Selected</span>
              <span class="flex items-center gap-2"><span class="legend-seat legend-taken"></span>Reserved</span>
            </div>
          </div>
        </div>

        <div class="flex min-h-16 flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8" aria-live="polite">
          <p id="reservation-message" class="text-sm text-slate-600">${statusMessage}</p>
          <button id="reserve-selected" type="button" class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none" ${selected === 0 ? "disabled" : ""}>Reserve ${selected} ${selected === 1 ? "seat" : "seats"}</button>
        </div>
      </section>
      <p class="mt-5 text-center text-xs text-slate-400">Rows A–H <span class="mx-2">·</span> 10 seats per row</p>
    </div>`;
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

render();
logRoomStatus("System ready. All seats are available.");

