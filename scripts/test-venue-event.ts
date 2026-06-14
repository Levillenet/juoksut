// Aja: bun run scripts/test-venue-event.ts
import { isVenueForEvent } from "../src/lib/planner-defaults";

let pass = 0;
let fail = 0;
function check(label: string, got: boolean, want: boolean) {
  if (got === want) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label} — sai ${got}, odotettiin ${want}`);
  }
}

console.log("Pitää olla false:");
check("high_jump  / T14 800m", isVenueForEvent("high_jump", "T14 800m"), false);
check("high_jump  / T14 100m", isVenueForEvent("high_jump", "T14 100m"), false);
check("pole_vault / T14 800m", isVenueForEvent("pole_vault", "T14 800m"), false);
check("jump_pit   / T14 800m", isVenueForEvent("jump_pit", "T14 800m"), false);
check("shot_ring  / T14 800m", isVenueForEvent("shot_ring", "T14 800m"), false);
check("track_straight / T14 800m", isVenueForEvent("track_straight", "T14 800m"), false);
check("track_straight / T14 400m aidat", isVenueForEvent("track_straight", "T14 400m aidat"), false);

console.log("\nPitää olla true:");
check("high_jump  / T14 Korkeus", isVenueForEvent("high_jump", "T14 Korkeus"), true);
check("pole_vault / T14 Seiväs", isVenueForEvent("pole_vault", "T14 Seiväs"), true);
check("jump_pit   / T14 Pituus", isVenueForEvent("jump_pit", "T14 Pituus"), true);
check("jump_pit   / T14 Kolmiloikka", isVenueForEvent("jump_pit", "T14 Kolmiloikka"), true);
check("track_oval / T14 800m", isVenueForEvent("track_oval", "T14 800m"), true);
check("track_straight / T14 60m", isVenueForEvent("track_straight", "T14 60m"), true);
check("track_oval / T14 60m", isVenueForEvent("track_oval", "T14 60m"), true);
check("track_straight / T11 60m aidat", isVenueForEvent("track_straight", "T11 60m aidat"), true);
check("track_oval / T17 400m aidat", isVenueForEvent("track_oval", "T17 400m aidat"), true);

console.log(`\n${pass} ok / ${fail} virhe`);
if (fail > 0) process.exit(1);
