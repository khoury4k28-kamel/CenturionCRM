import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const greg = await prisma.user.upsert({
    where: { email: "greg@centurion.example" },
    update: {},
    create: {
      email: "greg@centurion.example",
      name: "Greg",
      role: "OWNER",
    },
  });

  await prisma.user.upsert({
    where: { email: "assistant@centurion.example" },
    update: {},
    create: {
      email: "assistant@centurion.example",
      name: "Assistant",
      role: "MEMBER",
    },
  });

  // Demo rows so the spread view isn't empty on first boot. Mirrors the structure
  // of the real Centurion sheet: ACTIVES + IN ESCROW sections, yellow-flagged rows.
  const samples = [
    {
      address: "1270 Michigan Ave",
      city: "Beaumont",
      state: "CA",
      zip: "92223",
      stage: "LISTED",
      agreedPrice: 300_000,
      listPrice: 369_900,
      acceptanceDate: new Date("2026-04-29"),
      expirationDate: new Date("2026-06-28"),
      termOfAgreement: "60 DAYS",
      amountOwed: 0,
      weOwn: false,
      flaggedForReview: true,
      notes: "",
    },
    {
      address: "10450 Wilshire Blvd #2A",
      city: "Los Angeles",
      state: "CA",
      zip: "90024",
      stage: "LISTED",
      agreedPrice: 1_000_000,
      listPrice: 1_199_000,
      acceptanceDate: new Date("2026-04-24"),
      expirationDate: new Date("2026-06-08"),
      termOfAgreement: "45 DAYS",
      amountOwed: 0,
      weOwn: false,
      flaggedForReview: true,
      notes: "",
    },
    {
      address: "8960 Crescent Dr",
      city: "Los Angeles",
      state: "CA",
      zip: "90046",
      stage: "LISTED",
      agreedPrice: 1_540_000,
      listPrice: 1_699_000,
      acceptanceDate: new Date("2026-04-22"),
      expirationDate: new Date("2026-06-06"),
      termOfAgreement: "45 DAYS",
      amountOwed: 1_260_000,
      weOwn: false,
      flaggedForReview: false,
      notes: "",
    },
    {
      address: "80852 Hwy 140",
      city: "Lakeview",
      state: "CA",
      zip: "97639",
      stage: "LISTED",
      agreedPrice: 100_000,
      listPrice: 149_900,
      acceptanceDate: new Date("2025-04-03"),
      expirationDate: new Date("2025-08-01"),
      termOfAgreement: "",
      amountOwed: null,
      weOwn: true,
      flaggedForReview: false,
      notes: "Cash - $169,900., OWC $199,900.",
    },
    {
      address: "201 Jefferson",
      city: "Taft",
      state: "CA",
      zip: "93268",
      stage: "IN_ESCROW",
      agreedPrice: 70_000,
      listPrice: 99_900,
      acceptanceDate: new Date("2025-04-21"),
      expirationDate: new Date("2026-03-31"),
      termOfAgreement: "60 DAYS",
      amountOwed: 41_000,
      weOwn: false,
      flaggedForReview: false,
      notes: "Out of court. Extension 5/10/26.",
    },
    {
      address: "124 E 18th St",
      city: "San Bernardino",
      state: "CA",
      zip: "92404",
      stage: "IN_ESCROW",
      agreedPrice: 320_000,
      listPrice: 379_900,
      acceptanceDate: new Date("2026-04-10"),
      expirationDate: new Date("2026-05-25"),
      termOfAgreement: "45 DAYS",
      amountOwed: 113_000,
      weOwn: false,
      flaggedForReview: true,
      notes: "",
    },
  ];

  for (const s of samples) {
    const existing = await prisma.deal.findFirst({
      where: { property: { address: s.address } },
    });
    if (existing) continue;
    await prisma.deal.create({
      data: {
        stage: s.stage,
        agreedPrice: s.agreedPrice,
        listPrice: s.listPrice,
        acceptanceDate: s.acceptanceDate,
        expirationDate: s.expirationDate,
        termOfAgreement: s.termOfAgreement,
        amountOwed: s.amountOwed ?? undefined,
        weOwn: s.weOwn,
        flaggedForReview: s.flaggedForReview,
        notes: s.notes,
        agreementType: "PURCHASE",
        source: "Fast Track for Elite",
        createdBy: { connect: { id: greg.id } },
        property: {
          create: {
            address: s.address,
            city: s.city,
            state: s.state,
            zip: s.zip,
          },
        },
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
