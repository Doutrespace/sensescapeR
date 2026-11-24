#!/usr/bin/env node
/**
 * Merge the CSV exports of many phones into one data table.
 *
 * Every student exports "CSV" in the app (Profile tab) and hands in the
 * file. Put all files into one folder and run:
 *
 *   node scripts/merge-exports.mjs path/to/folder
 *   node scripts/merge-exports.mjs a.csv b.csv -o all.csv
 *   npm run merge-exports -- path/to/folder
 *
 * The result has one row per measurement. A measurement that appears in
 * several files (a student exported twice) is kept once, identified by its
 * `run_id`. Columns are the union of all files, so exports made with an
 * older or newer version of the app can be mixed.
 *
 * Downloads from the central database work as well: a CSV or JSON file with
 * the column `export_row` (see supabase/setup.sql) is unpacked into the same
 * table.
 *
 * No dependencies; needs Node 18 or newer.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const BOM = '﻿';

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

/** RFC 4180 parser: quoted cells may contain commas, quotes ("") and line breaks. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const input = text.startsWith(BOM) ? text.slice(1) : text;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') {
        index++;
      }
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop completely empty lines (e.g. a trailing line break).
  return rows.filter((entry) => entry.some((value) => value !== ''));
}

function cellText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** One measurement as { header, cells } from an `export_row` JSON object. */
function fromExportRow(value) {
  const record = typeof value === 'string' ? JSON.parse(value) : value;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null;
  }
  const header = Object.keys(record);
  return { header, cells: header.map((column) => cellText(record[column])) };
}

/**
 * Reads one input file into a list of { header, cells }.
 * Accepts app exports (CSV) and database downloads (CSV or JSON with an
 * `export_row` column).
 */
function readMeasurements(file) {
  const text = readFileSync(file, 'utf8');

  if (file.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text.startsWith(BOM) ? text.slice(1) : text);
    const list = Array.isArray(parsed) ? parsed : parsed.recordings ?? [];
    return list
      .map((entry) => fromExportRow(entry?.export_row ?? entry?.study ?? entry))
      .filter(Boolean);
  }

  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) {
    return [];
  }

  const exportRowIndex = header.indexOf('export_row');
  if (exportRowIndex >= 0 && !header.includes('run_id')) {
    return rows.slice(1)
      .map((cells) => (cells[exportRowIndex] ? fromExportRow(cells[exportRowIndex]) : null))
      .filter(Boolean);
  }

  return rows.slice(1).map((cells) => ({ header, cells }));
}

function toCsvCell(value) {
  const text = value ?? '';
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function collectFiles(inputs) {
  const files = [];
  for (const input of inputs) {
    const path = resolve(input);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      fail(`"${input}" does not exist.`);
    }

    if (stats.isDirectory()) {
      for (const name of readdirSync(path).sort()) {
        if (/\.(csv|json)$/i.test(name)) {
          files.push(join(path, name));
        }
      }
    } else {
      files.push(path);
    }
  }
  return files;
}

function countBy(rows, column) {
  const counts = new Map();
  for (const row of rows) {
    const key = row.get(column) || '(empty)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function main() {
  const args = process.argv.slice(2);
  let output = 'sensescape_all.csv';
  const inputs = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '-o' || arg === '--output') {
      output = args[++index] ?? fail('-o needs a file name.');
    } else if (arg === '-h' || arg === '--help') {
      console.log('Usage: node scripts/merge-exports.mjs <folder or csv files...> [-o merged.csv]');
      return;
    } else {
      inputs.push(arg);
    }
  }

  if (inputs.length === 0) {
    fail('Give a folder with the exported CSV files, or the files themselves. See --help.');
  }

  const outputPath = resolve(output);
  const files = collectFiles(inputs).filter((file) => file !== outputPath);
  if (files.length === 0) {
    fail('No CSV or JSON files found.');
  }

  const columns = [];
  const knownColumns = new Set();
  const merged = new Map();
  let rowsRead = 0;
  let duplicates = 0;
  let conflicting = 0;
  const skipped = [];

  for (const file of files) {
    let measurements;
    try {
      measurements = readMeasurements(file);
    } catch (error) {
      skipped.push(`${basename(file)} (unreadable: ${error.message})`);
      continue;
    }

    if (measurements.length === 0 || !measurements[0].header.includes('run_id')) {
      skipped.push(basename(file));
      continue;
    }

    for (const { header, cells } of measurements) {
      for (const column of header) {
        if (!knownColumns.has(column)) {
          knownColumns.add(column);
          columns.push(column);
        }
      }

      rowsRead++;
      const row = new Map(header.map((column, index) => [column, cells[index] ?? '']));
      row.set('source_file', basename(file));
      const runId = row.get('run_id');
      if (!runId) {
        continue;
      }

      const existing = merged.get(runId);
      if (existing) {
        duplicates++;
        const differs = header.some((column) => (existing.get(column) ?? '') !== (row.get(column) ?? ''));
        if (differs) {
          conflicting++;
          // Keep the version that was saved or exported later.
          if ((row.get('saved_at') ?? '') >= (existing.get('saved_at') ?? '')) {
            merged.set(runId, row);
          }
        }
        continue;
      }
      merged.set(runId, row);
    }
  }

  const rows = [...merged.values()].sort((a, b) =>
    (a.get('recorded_at') ?? '').localeCompare(b.get('recorded_at') ?? ''));
  const outputColumns = [...columns, 'source_file'];
  const lines = [
    outputColumns.map(toCsvCell).join(','),
    ...rows.map((row) => outputColumns.map((column) => toCsvCell(row.get(column))).join(',')),
  ];
  writeFileSync(outputPath, `${BOM}${lines.join('\r\n')}\r\n`, 'utf8');

  console.log(`Files read:            ${files.length - skipped.length}`);
  if (skipped.length > 0) {
    console.log(`Files skipped:         ${skipped.length} (no measurements with run_id: ${skipped.join(', ')})`);
  }
  console.log(`Rows read:             ${rowsRead}`);
  console.log(`Duplicate rows:        ${duplicates}${conflicting > 0 ? ` (${conflicting} with different content; the later one was kept)` : ''}`);
  console.log(`Measurements written:  ${rows.length}`);
  console.log(`Participants:          ${new Set(rows.map((row) => row.get('participant_id'))).size}`);
  console.log(`Columns:               ${outputColumns.length}`);
  console.log('');
  console.log('Measurements per project group:');
  for (const [group, count] of countBy(rows, 'group_id')) {
    console.log(`  ${group.padEnd(22)} ${count}`);
  }
  console.log('');
  console.log(`Written to ${outputPath}`);
}

// Run only when called directly, so the parser can be imported for tests.
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main();
}
