#!/usr/bin/env node
/**
 * Ingest ICT solicitations from SAM.gov's BULK Contract Opportunities extract.
 *
 * WHY
 * ---
 * SAM.gov's search API enforces an ACCOUNT-level daily quota (two different keys
 * returned identical nextAccessTime values from two different source IPs). Paging
 * that API for a multi-day backfill exhausts the whole account's allowance before
 * anything is ingested, which left production with no new solicitations from
 * 2026-07-29 to 2026-08-09.
 *
 * The bulk extract is the channel SAM publishes for volume consumption. It is a
 * plain public download, no key and no quota:
 *   https://falextracts.s3.amazonaws.com/Contract%20Opportunities/datagov/ContractOpportunitiesFullCSV.csv
 *
 * WHAT THIS DOES, AND DELIBERATELY DOES NOT DO
 * --------------------------------------------
 * Inserts solicitation METADATA only: number, title, agency, office, posted date,
 * notice type, SAM link, contacts, and the extract row itself in noticeData.
 *
 * It records NO compliance determination. reviewRec is set to
 * 'Cannot Evaluate (Review Required)' and undetermined=true, because the bulk
 * extract contains no attachment links, and Section 508 requirements live in the
 * SOW/PWS/attachments rather than the short Description field. Analyzing the
 * description alone would produce confident "Section 508 Language Not Found"
 * verdicts that actually mean "the document that would contain it was never
 * read." A missing determination is recoverable; a wrong one gets acted on.
 *
 * Existing rows are left completely untouched, so nothing already analyzed is
 * overwritten.
 *
 * USAGE
 *   node ingest_bulk_ict.js --csv /path/to/filtered.json            # dry run
 *   node ingest_bulk_ict.js --csv /path/to/filtered.json --commit   # write
 */

const fs = require('fs');
// Absolute path: this script is run from /tmp inside the container, where a bare
// require('pg') cannot resolve against /opt/api/node_modules.
const { Client } = require(process.env.PG_MODULE_PATH || '/opt/api/node_modules/pg');

function arg (name, dflt) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : dflt;
}
const COMMIT = process.argv.includes('--commit');
const CSV_JSON = arg('--csv');

function dbUrl () {
  const v = JSON.parse(process.env.VCAP_SERVICES || '{}');
  const svc = Object.values(v).flat().find(s => s.credentials && s.credentials.uri);
  if (!svc) throw new Error('No bound database found in VCAP_SERVICES');
  return svc.credentials.uri;
}

(async () => {
  if (!CSV_JSON) { console.error('--csv <file.json> is required'); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(CSV_JSON, 'utf8'));
  console.log(`Loaded ${rows.length} ICT solicitations from extract`);

  const cl = new Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await cl.connect();

  // Which are genuinely new? Never touch an existing row.
  const solNums = rows.map(r => r['Sol#']).filter(Boolean);
  const existing = await cl.query(
    'SELECT "solNum" FROM solicitations WHERE "solNum" = ANY($1::text[])', [solNums]);
  const have = new Set(existing.rows.map(r => r.solNum));
  const fresh = rows.filter(r => r['Sol#'] && !have.has(r['Sol#']));

  console.log(`  already in database : ${have.size}`);
  console.log(`  new to insert       : ${fresh.length}`);

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing written. Sample of what would be inserted:');
    fresh.slice(0, 8).forEach(r => console.log(
      `  ${(r['Sol#'] || '').padEnd(22)} ${(r.PostedDate || '').slice(0, 10)}  ` +
      `naics=${(r.NaicsCode || '').padEnd(7)} ${(r.Title || '').slice(0, 46)}`));
    console.log('\nRe-run with --commit to insert.');
    await cl.end();
    return;
  }

  let inserted = 0, failed = 0;
  for (const r of fresh) {
    const contact = {
      primary: {
        name: r.PrimaryContactFullname || null,
        email: r.PrimaryContactEmail || null,
        phone: r.PrimaryContactPhone || null,
        title: r.PrimaryContactTitle || null
      }
    };
    try {
      await cl.query(
        `INSERT INTO solicitations
           ("solNum", title, agency, office, date, "noticeType", url, active,
            "numDocs", "reviewRec", undetermined, na_flag, "contactInfo",
            "noticeData", "searchText", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
         ON CONFLICT DO NOTHING`,
        [
          r['Sol#'],
          r.Title || null,
          r['Department/Ind.Agency'] || null,
          r.Office || null,
          r.PostedDate ? new Date(r.PostedDate) : null,
          r.Type || null,
          r.Link || null,
          String(r.Active).toLowerCase() === 'yes',
          0,
          // Explicitly NOT a verdict. Needs a real document-based review.
          'Cannot Evaluate (Review Required)',
          true,
          false,
          JSON.stringify(contact),
          JSON.stringify({ source: 'sam_bulk_extract', naicsCode: r.NaicsCode || null,
                           noticeId: r.NoticeId || null, baseType: r.BaseType || null,
                           classificationCode: r.ClassificationCode || null,
                           description: r.Description || null,
                           setAside: r.SetASide || null,
                           responseDeadLine: r.ResponseDeadLine || null }),
          `${r['Sol#'] || ''} ${r.Title || ''} ${r['Department/Ind.Agency'] || ''}`.slice(0, 2000)
        ]);
      inserted++;
      if (inserted % 100 === 0) console.log(`  inserted ${inserted}/${fresh.length}...`);
    } catch (e) {
      failed++;
      if (failed <= 5) console.error(`  FAILED ${r['Sol#']}: ${e.message}`);
    }
  }

  console.log(`\nDONE  inserted=${inserted}  failed=${failed}`);
  const tot = await cl.query('SELECT COUNT(*)::int n FROM solicitations');
  console.log(`solicitations table now: ${tot.rows[0].n}`);
  await cl.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
