import type { PrismaClient } from "@prisma/client";

/** Generic appliance catalog seeded for every new tenant. */
export const GENERIC_APPLIANCES = [
  "Cooker",
  "Mixie",
  "Gas Stove",
  "Iron Box",
  "Kettle",
  "Microwave",
  "Table Top Grinder",
  "Sewing Machine",
  "Water Heater",
  "Induction Stove",
  "Pedestal Fan",
  "Table Fan",
  "Ceiling Fan",
  "Mosquito Bat",
] as const;

const GENERIC_BRANDS = [
  "Prestige",
  "Anantha",
  "Mithra",
  "Hawkins",
  "Ideal",
  "Pigeon",
  "Lakshmi",
  "Crompton",
  "Remi",
  "Polar",
  "TN",
  "Surya",
  "Butterfly",
  "Preethi",
  "Dekuk",
  "Vidiem",
  "Vguard",
  "Philips",
  "Bajaj",
  "Samsung",
  "LG",
  "Merrit",
  "Usha",
  "Singer",
  "Amirtha",
  "Sowbagya",
  "Hunter",
  "Others",
];

const GENERIC_COMPLAINTS = [
  "Not powering on",
  "Not heating",
  "Strange noise",
  "Water leakage",
  "Switch/cord issue",
  "General service",
  "Other",
];

const APPLIANCE_BRANDS: Record<string, string[]> = {
  Cooker: [
    "Prestige",
    "Anantha",
    "Mithra",
    "Hawkins",
    "Ideal",
    "Pigeon",
    "Lakshmi",
    "Others",
  ],
  Mixie: ["Preethi", "Prestige", "Butterfly", "Philips", "Others"],
  "Gas Stove": [
    "Surya",
    "Butterfly",
    "Preethi",
    "Dekuk",
    "Vidiem",
    "Prestige",
    "Others",
  ],
  "Iron Box": ["Preethi", "Bajaj", "Philips", "Crompton", "Others"],
  Kettle: ["Prestige", "Remi", "Preethi", "Pigeon", "Others"],
  Microwave: ["Bajaj", "Samsung", "LG", "Others"],
  "Table Top Grinder": ["Amirtha", "Sowbagya", "Lakshmi", "TN", "Others"],
  "Sewing Machine": ["Merrit", "Usha", "Singer", "Others"],
  "Water Heater": ["Vguard", "Bajaj", "Crompton", "Others"],
  "Induction Stove": [
    "Prestige",
    "Vguard",
    "Pigeon",
    "Philips",
    "Preethi",
    "Others",
  ],
  "Pedestal Fan": ["Crompton", "Remi", "Polar", "Others"],
  "Table Fan": ["Crompton", "Remi", "Polar", "TN", "Others"],
  "Ceiling Fan": ["Crompton", "Remi", "Polar", "Others"],
  "Mosquito Bat": ["Hunter", "Others"],
};

const APPLIANCE_COMPLAINTS: Record<string, string[]> = {
  Cooker: [
    "Not powering on",
    "Not heating",
    "Water leakage",
    "General service",
    "Other",
  ],
  Mixie: ["Not powering on", "Strange noise", "General service", "Other"],
  "Gas Stove": ["Not powering on", "Not heating", "General service", "Other"],
  "Iron Box": ["Not powering on", "Not heating", "General service", "Other"],
  Kettle: [
    "Not powering on",
    "Not heating",
    "Water leakage",
    "General service",
    "Other",
  ],
  Microwave: [
    "Not powering on",
    "Not heating",
    "Strange noise",
    "General service",
    "Other",
  ],
  "Table Top Grinder": [
    "Not powering on",
    "Strange noise",
    "General service",
    "Other",
  ],
  "Sewing Machine": [
    "Not powering on",
    "Strange noise",
    "General service",
    "Other",
  ],
  "Water Heater": [
    "Not powering on",
    "Not heating",
    "Water leakage",
    "General service",
    "Other",
  ],
  "Induction Stove": [
    "Not powering on",
    "Not heating",
    "General service",
    "Other",
  ],
  "Pedestal Fan": [
    "Not powering on",
    "Strange noise",
    "General service",
    "Other",
  ],
  "Table Fan": [
    "Not powering on",
    "Strange noise",
    "General service",
    "Other",
  ],
  "Ceiling Fan": [
    "Not powering on",
    "Strange noise",
    "General service",
    "Other",
  ],
  "Mosquito Bat": ["Not powering on", "General service", "Other"],
};

const APPLIANCE_ACCESSORIES: Record<string, string[]> = {
  Mixie: ["Jars", "Lid", "Coupler"],
  "Gas Stove": ["Burner", "Pan support", "Knobs"],
  Cooker: ["Gasket", "Weight", "Inner pot"],
  "Sewing Machine": ["Bobbin case", "Foot pedal", "Power cord"],
  "Table Top Grinder": ["Grinding stone", "Lid", "Lock clip"],
};

type Db = PrismaClient;

/** Seeds generic appliances / brands / complaints / accessories for a tenant. */
export async function seedGenericAppliances(db: Db, tenantId: string) {
  const allowed = new Set<string>(GENERIC_APPLIANCES);

  const lookups = [
    ...GENERIC_APPLIANCES.map((value) => ({
      tenantId,
      category: "appliance",
      value,
    })),
    ...GENERIC_BRANDS.map((value) => ({
      tenantId,
      category: "brand",
      value,
    })),
    ...GENERIC_COMPLAINTS.map((value) => ({
      tenantId,
      category: "complaint",
      value,
    })),
  ];

  const brands = Object.entries(APPLIANCE_BRANDS).flatMap(
    ([applianceType, list]) =>
      allowed.has(applianceType)
        ? list.map((brand) => ({ tenantId, applianceType, brand }))
        : []
  );

  const complaints = Object.entries(APPLIANCE_COMPLAINTS).flatMap(
    ([applianceType, list]) =>
      allowed.has(applianceType)
        ? list.map((complaint) => ({ tenantId, applianceType, complaint }))
        : []
  );

  const accessories = Object.entries(APPLIANCE_ACCESSORIES).flatMap(
    ([applianceType, list]) =>
      allowed.has(applianceType)
        ? list.map((accessory) => ({ tenantId, applianceType, accessory }))
        : []
  );

  await Promise.all([
    db.lookupOption.createMany({ data: lookups, skipDuplicates: true }),
    db.applianceBrand.createMany({ data: brands, skipDuplicates: true }),
    db.applianceComplaint.createMany({
      data: complaints,
      skipDuplicates: true,
    }),
    db.applianceAccessory.createMany({
      data: accessories,
      skipDuplicates: true,
    }),
  ]);
}
