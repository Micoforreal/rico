import { NextResponse } from "next/server";
import { writeMemory } from "@/lib/memory";
import { DEMO_USERS } from "@/lib/config";

const SEED_DATA = {
  "user-ada": [
    "2026-10-01: User asked to find Maya's unpaid invoice; searched Gmail and found nothing.",
    "2026-10-02: User asked to check for Maya's invoice again; found it attached to a new email, amount is $450.",
    "2026-10-02: User asked me to remind them about Maya's $450 invoice on Friday.",
    "2026-10-03: Inbox digest — 21 promos, flagged Joshua Collins message about the design contract; user had it read aloud.",
    "2026-10-03: User asked for a summary of the design contract from Joshua Collins.",
    "2026-10-04: User asked to draft a reply to Joshua Collins accepting the contract terms.",
    "2026-10-05: User asked if there are any new emails from Maya; there were none.",
    "2026-10-05: User mentioned they are going on vacation next week to Hawaii.",
    "2026-10-06: User asked for the weather in Hawaii; it's sunny and 82°F.",
    "2026-10-06: User asked to remind them to pack sunscreen.",
    "2026-10-07: User asked to check flight status; flight is on time.",
    "2026-10-07: User asked to send a quick note to Maya saying they will pay the invoice after the vacation."
  ],
  "user-tunde": [
    "2026-10-01: Daniel received an email from a recruiter at TechCorp.",
    "2026-10-01: Daniel asked to draft a polite decline to the TechCorp recruiter.",
    "2026-10-02: Daniel realized they forgot to send the reply to the recruiter.",
    "2026-10-02: Sent reply to TechCorp recruiter declining the offer on Daniel's behalf.",
    "2026-10-03: Daniel asked to find the latest AWS bill; found it, $120.50.",
    "2026-10-04: Daniel asked to draft an email to the team about the AWS bill.",
    "2026-10-04: Sent email to team re: AWS bill on Daniel's behalf.",
    "2026-10-05: Inbox digest — 15 promos, 2 flagged (1 from mom, 1 from landlord).",
    "2026-10-05: Daniel asked to read the email from mom.",
    "2026-10-06: Daniel asked to draft a reply to mom saying they will call this weekend.",
    "2026-10-06: Sent reply to mom on Daniel's behalf.",
    "2026-10-07: Daniel asked to remind them to pay the landlord on the 1st."
  ],
  "user-alex": [
    "2026-10-01: User asked for a good chocolate chip cookie recipe.",
    "2026-10-01: User noted that the cookie recipe needs more salt, maybe 1 tsp instead of 1/2 tsp.",
    "2026-10-02: User asked to remind them about Sarah's birthday on Oct 10.",
    "2026-10-03: User asked what they should get Sarah for her birthday; suggested a book.",
    "2026-10-03: User decided to get Sarah a Kindle instead of a book.",
    "2026-10-04: User asked for a summary of the latest AI news.",
    "2026-10-05: User asked for the cookie recipe again, reminding me to include the extra salt.",
    "2026-10-05: User said the cookies turned out great.",
    "2026-10-06: User asked to draft a birthday message for Sarah.",
    "2026-10-06: User liked the birthday message and saved it.",
    "2026-10-07: User asked if they have any reminders coming up; reminded them about Sarah's birthday.",
    "2026-10-07: User asked to add 'buy wrapping paper' to their to-do list."
  ]
};

export async function POST() {
  try {
    for (const demoUser of DEMO_USERS) {
      const userId = demoUser.id;
      const memories = SEED_DATA[userId as keyof typeof SEED_DATA];

      // Write each seed memory to Walrus.
      // writeMemory already dedupes via semantic distance — if a memory is already
      // present it will be skipped, so re-seeding is safe to call multiple times.
      for (const memory of memories) {
        await writeMemory(userId, memory);
        // Small delay to preserve chronological ordering in Walrus write-timestamps
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return NextResponse.json({ success: true, message: "Demo data seeded successfully." });
  } catch (err) {
    console.error("[seed] error", err);
    return NextResponse.json(
      { error: "seed failed", detail: String(err) },
      { status: 500 }
    );
  }
}
