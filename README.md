# Sensescape Explorer

A browser app for capturing how a place is perceived with all senses: a
30-second sound recording with its location, soundscape ratings based on
ISO/TS 12913, multisensory ratings, and the questions of the course project
groups. It runs on any phone in the browser.

Live: https://doutrespace.github.io/sensescapeR/

## How a measurement works

1. First use: information and consent, then three questions about the person
   (asked once per device). The device gets a random participant ID.
2. Recording (30 s) with position, review, optional photo, notes.
3. Main questionnaire: soundscape, further senses, context (passing by or
   staying, who answered, optional measuring point).
4. Choice of the project group, followed by that group's own questions. The
   measurement can also be saved without them.

Everything is stored in the browser of the phone. **Students should export
regularly** (Profile > Export > CSV): browsers may clear the storage of sites
that are not visited for some time.

## Collecting the data of all students

Every student exports **CSV** in the Profile tab and hands in the file. All
files have the same columns, one row per measurement.

```bash
npm run merge-exports -- path/to/folder-with-csv-files -o all.csv
```

The script stacks the files, keeps every measurement once (by `run_id`),
reports how many measurements each group has, and adds a `source_file`
column. Mixed app versions are fine: columns are matched by name.

- `run_id`: unique ID of the measurement.
- `participant_id` / `participant_code`: the person who answered.
- `collector_id`: the device that collected it (differs from
  `participant_id` when another person was interviewed).
- `group_id`: project group; its answers are in the columns
  `<group_id>__<question>`.
- `main_questionnaire_skipped`: 1 when the student took the shortcut from the
  notes straight to the project group; perception, senses and context columns
  are then usually empty.
- The **codebook** (Profile > Export > Codebook) explains every column: the
  question as asked, the type, and the meaning of the codes.

The level columns (`laeq`, ...) are in dBFS, i.e. relative to digital full
scale. Phones are not calibrated, so levels are comparable within one device
only and are not sound pressure levels.

## Changing or adding group questions

Each group is one file in `src/study/groups/`, taken from the questionnaire
the group handed in. Add the file to `src/study/groups/index.ts`.

- Groups are named by their topic only. Do not put student names into ids,
  labels or comments: the repository and the site are public, and the ids
  become column names in the data.
- Never change a group `id` or a question `key` once data has been
  collected: both are part of the column names.
- Change `QUESTIONNAIRE_VERSION` in `src/study/core.ts` whenever wording,
  scales or answer options change. It is stored with every measurement.
- `npm test` checks that the definitions are consistent and that every column
  is documented in the codebook.

## Central database

The course database (Supabase) is set up with `supabase/setup.sql`, and
anonymous sign-ins are on, so phones upload without student accounts. The
published site uploads only once it is built with the project's URL and
public key: set the repository secrets `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (Settings > Secrets and variables > Actions)
and publish again. Until then the data travels by CSV file.

To get all uploaded measurements, run this in the Supabase SQL editor and
download the result as CSV:

```sql
select export_row from public.recordings where export_row is not null order by recorded_at;
```

Then turn it into the study table with the same merge script:

```bash
npm run merge-exports -- downloaded-file.csv -o all.csv
```

The study columns (personal details, answers) can be read only in the
dashboard, never through the app's public key. Sound files and spectrograms
are in Storage > soundscapes, named by `run_id`.

## Development

```bash
npm install
npm run web          # development server
npm test             # unit tests
npm run build:web    # static site in dist/ (what GitHub Pages serves)
```

Pushing to `main` publishes the site.
