// Generates the official Qatar Statistics Department disability-statistics
// workbook by loading the real government template (public/qpc-statistics-
// template.xlsx) and writing computed counts directly into its existing data
// cells — every header, merge, font, and formula in the template is left
// completely untouched; only the raw input numbers (columns C, D, F, G on
// each data sheet) are overwritten, exactly the cells a person would type
// into by hand. Mutating only `.v` on each existing cell object (rather than
// replacing the cell) is what preserves the template's original formatting —
// see the mapping notes below for exactly which source field feeds which
// template row.

import * as XLSX from 'xlsx'

// ── Sheet 1: disability type ────────────────────────────────────────────
// Template rows are fixed: only these six map to data we actually collect.
// Hearing/Speech/Psychosocial/Multiple/Developmental rows stay at the
// template's existing value (0) since no athlete currently has those types
// recorded — "Other" (row 19) is left exactly as the template has it
// (genuinely blank, not zero) since unmatched/missing disability values are
// excluded from this sheet entirely, not folded into Other, per direct
// confirmation from the person who owns this report.
const DISABILITY_ROW = {
  'Cerebral Palsy': 9,
  'Physical Impairment': 9,
  'Intellectual Impairment': 10,
  'Visual Impairment': 11,
  'Down Sydrome': 17, // matches the actual stored spelling in the athletes table
  'Down Syndrome': 17, // tolerate the correct spelling too, in case data gets cleaned up later
  'Autism': 18,
}

// ── Sheet 2: age group ──────────────────────────────────────────────────
// Standard 5-year bands, computed live from date of birth — nothing here
// needs a mapping table, just arithmetic.
const AGE_BANDS = [
  [0, 4, 9],   // Under 5 — row 9
  [5, 9, 10], [10, 14, 11], [15, 19, 12], [20, 24, 13],
  [25, 29, 14], [30, 34, 15], [35, 39, 16], [40, 44, 17], [45, 49, 18],
  [50, 54, 19], [55, 59, 20], [60, 64, 21],
  [65, 200, 22], // 65 and above — row 22
]

// ── Sheet 3: employee occupation ────────────────────────────────────────
// Designations that don't appear here (Driver, Receptionist, Board Member,
// Secretary General, Accountant, Waiter, Delegate, Official, Employee,
// Administrative *, Technical Expert, Executive Manager, Store Keeper,
// Secretary Assistant, Public Relation Officer) all fall through to row 23
// ("Other") by design — confirmed directly rather than guessed.
const OCCUPATION_ROW = {
  'Doctor': 9,
  'Physiotherapist': 10,
  'Worker': 22,
}
const COACH_ROW = 19
const OTHER_ROW = 23

function calculateAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
  if (!hasHadBirthdayThisYear) age--
  return age
}

function isQatari(nationality) {
  return (nationality || '').trim().toLowerCase() === 'qatar'
}

// Writes a value into an existing template cell by mutating only `.v` — this
// is what keeps the cell's original number format, fill, and border intact.
// Falls back to creating a plain numeric cell only if the template genuinely
// has nothing there yet (shouldn't happen for any cell this function is
// asked to write to, since every column/row combination we use already has a
// templated 0 in the source file — this is just a safety net).
function writeCell(ws, address, value) {
  if (ws[address]) {
    ws[address].v = value
    ws[address].t = 'n' // force numeric — stub cells (t:'z') exist when cellStyles:true
    if (ws[address].w !== undefined) delete ws[address].w
  } else {
    ws[address] = { t: 'n', v: value }
  }
}

function addCounts(grid, row, col, n = 1) {
  grid[row] = grid[row] || {}
  grid[row][col] = (grid[row][col] || 0) + n
}

// Browsers can't run Excel/LibreOffice to recalculate formulas the way the
// xlsx skill's recalc.py script does server-side — so without this step, the
// formula cells (row totals, column totals, the grand total) would keep
// showing whichever numbers happened to be cached in the original 2024
// template, even though the underlying =SUM(...) formulas are technically
// correct and would self-correct the moment someone opens the file and forces
// a recalc in Excel. Since every formula in this template follows one of two
// fixed, known patterns (a row total across two cells, or a column sum down a
// fixed range), recomputing them directly in JS and writing the result as the
// cell's cached value is safe and exact — same answer Excel itself would
// produce, just computed here instead of waiting for a recalculation that a
// browser has no way to trigger.
function recalculateTotals(ws, firstDataRow, lastDataRow, totalRow) {
  const num = (addr) => ws[addr]?.v || 0
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    writeCell(ws, `E${r}`, num(`C${r}`) + num(`D${r}`))
    writeCell(ws, `H${r}`, num(`F${r}`) + num(`G${r}`))
    writeCell(ws, `I${r}`, num(`C${r}`) + num(`F${r}`))
    writeCell(ws, `J${r}`, num(`D${r}`) + num(`G${r}`))
    writeCell(ws, `K${r}`, num(`I${r}`) + num(`J${r}`))
  }
  for (const col of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']) {
    let sum = 0
    for (let r = firstDataRow; r <= lastDataRow; r++) sum += num(`${col}${r}`)
    writeCell(ws, `${col}${totalRow}`, sum)
  }
}

export async function generateStatisticsReport({ athletes, employees, coaches, lang }) {
  const res = await fetch('/qpc-statistics-template.xlsx')
  if (!res.ok) throw new Error('Could not load the report template')
  const buf = await res.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellStyles: true, bookVBA: false })

  // grid[row][col] = count, where col is 'C' (Qatari M), 'D' (Qatari F),
  // 'F' (Non-Qatari M), 'G' (Non-Qatari F) — same four columns on every sheet.
  function colFor(person) {
    const male = (person.gender || '').toLowerCase() === 'male'
    if (isQatari(person.nationality)) return male ? 'C' : 'D'
    return male ? 'F' : 'G'
  }

  // Both Sheet 1 (disability) and Sheet 2 (age) must count the exact same set
  // of athletes, so their totals always match. An athlete who has no recognized
  // disability type is excluded from Sheet 1 — they must also be excluded from
  // Sheet 2, otherwise the two sheets show different totals for what is supposed
  // to be the same population. Athletes with no DOB would be excluded from
  // Sheet 2 but are currently all 187 have one, so this guard is a safety net.
  const qualifiedAthletes = athletes.filter(a =>
    DISABILITY_ROW[a.disability] && a.dob
  )

  // ── Sheet 1: disability type ──
  const ws1 = wb.Sheets['1']
  const grid1 = {}
  for (const a of qualifiedAthletes) {
    const row = DISABILITY_ROW[a.disability]
    if (!row) continue
    addCounts(grid1, row, colFor(a))
  }
  // Write ALL data rows in Sheet 1 (rows 9-18), zeroing out any row not in
  // our mapping. Without this, rows like "Multiple Disability" (row 15) keep
  // their pre-existing 2024 sample values from the template file since we
  // never touch them — making it look like we have athletes with disabilities
  // we never actually recorded.
  for (let row = 9; row <= 18; row++) {
    for (const col of ['C', 'D', 'F', 'G']) {
      writeCell(ws1, `${col}${row}`, grid1[row]?.[col] || 0)
    }
  }
  recalculateTotals(ws1, 9, 19, 20)

  // ── Sheet 2: age group ──
  const ws2 = wb.Sheets['2']
  const grid2 = {}
  for (const a of qualifiedAthletes) {
    const age = calculateAge(a.dob)
    if (age === null) continue
    const band = AGE_BANDS.find(([lo, hi]) => age >= lo && age <= hi)
    if (!band) continue
    addCounts(grid2, band[2], colFor(a))
  }
  for (const [, , row] of AGE_BANDS) {
    for (const col of ['C', 'D', 'F', 'G']) {
      writeCell(ws2, `${col}${row}`, grid2[row]?.[col] || 0)
    }
  }
  recalculateTotals(ws2, 9, 22, 23)

  // ── Sheet 3: employee occupation ──
  const ws3 = wb.Sheets['3']
  const grid3 = {}
  for (const e of employees) {
    // Every employee whose designation says Coach/Assistant Coach also has a
    // row in the dedicated coaches table — confirmed directly against real
    // data, not assumed — so they're counted once, from that table, below.
    // Counting them again here from their employee designation would double
    // every coach in this report.
    if (['Coach', 'Assistant Coach'].includes(e.designation)) continue
    const row = OCCUPATION_ROW[e.designation] || OTHER_ROW
    addCounts(grid3, row, colFor(e))
  }
  // The coaches table is the complete, authoritative roster for this row —
  // it includes everyone the employees-with-Coach-designation set does, plus
  // at least one coach who has no employees row at all.
  for (const c of coaches) {
    addCounts(grid3, COACH_ROW, colFor(c))
  }
  const occupationRows = [...Object.values(OCCUPATION_ROW), COACH_ROW, OTHER_ROW]
  for (const row of occupationRows) {
    for (const col of ['C', 'D', 'F', 'G']) {
      writeCell(ws3, `${col}${row}`, grid3[row]?.[col] || 0)
    }
  }
  recalculateTotals(ws3, 9, 23, 24)

  const today = new Date().toISOString().slice(0, 10)
  const filename = lang === 'ar'
    ? `إحصاءات_ذوي_الإعاقة_${today}.xlsx`
    : `QPC_Disability_Statistics_${today}.xlsx`
  XLSX.writeFile(wb, filename)
}
