/**
 * Generates the derived position ("Nimziya-BDM") for every LER/BDM already on
 * the team. New leaders get theirs automatically on save; this covers the ones
 * created before that existed.
 *
 * Idempotent — safe to re-run, and needed once per environment:
 *   pnpm db:backfill-positions
 */
import { backfillLeaderPositions } from '../lib/leader-positions';

async function main() {
  const { created, skipped } = await backfillLeaderPositions();

  if (created.length === 0) {
    console.log(`Nothing to do — ${skipped} leader(s) already have a position.`);
  } else {
    console.log(`Created ${created.length} position(s):`);
    for (const name of created) console.log(`  + ${name}`);
    if (skipped > 0) console.log(`${skipped} leader(s) already had one.`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
