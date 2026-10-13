// MOCK DATA FOR DEMONSTRATIONS. Nothing here comes from a real Club Mahindra
// system: the member account, the resort availability and the references are
// invented so Meera can hold a realistic booking conversation with real dates.
// Replace buildDemoContext with calls to the real inventory and member APIs
// before using this agent with actual members.

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const BOOKING_WINDOW_DAYS = 120;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const RESORTS = [
  { code: "MUN", name: "Club Mahindra Munnar", place: "Munnar, Kerala", note: "tea gardens and cool hills" },
  { code: "COO", name: "Club Mahindra Madikeri", place: "Coorg, Karnataka", note: "coffee estates and misty valleys" },
  { code: "GOA", name: "Club Mahindra Varca Beach", place: "South Goa", note: "beachfront, good for families" },
  { code: "MAN", name: "Club Mahindra Manali", place: "Manali, Himachal Pradesh", note: "mountain views, snow in winter" },
  { code: "SHI", name: "Club Mahindra Mashobra", place: "Shimla, Himachal Pradesh", note: "pine forest, quiet hill stay" },
  { code: "UDA", name: "Club Mahindra Udaipur", place: "Udaipur, Rajasthan", note: "lakes and palaces" },
  { code: "JAI", name: "Club Mahindra Jaisalmer", place: "Jaisalmer, Rajasthan", note: "desert and fort, best in winter" },
  { code: "OOT", name: "Club Mahindra Derby Green", place: "Ooty, Tamil Nadu", note: "Nilgiri hills, colonial charm" },
  { code: "MAH", name: "Club Mahindra Sherwood", place: "Mahabaleshwar, Maharashtra", note: "short drive from Mumbai and Pune" },
  { code: "COR", name: "Club Mahindra Corbett", place: "Jim Corbett, Uttarakhand", note: "riverside, jungle safaris" },
];

const ROOMS = [
  { name: "Studio", sleeps: "up to three guests", soldOutChance: 0.18 },
  { name: "One Bedroom", sleeps: "up to four guests", soldOutChance: 0.26 },
  { name: "Two Bedroom", sleeps: "up to six guests", soldOutChance: 0.36 },
];

/** Days since the Unix epoch for the current date in India. */
const todayInIndia = (now: Date) => Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS);

const parts = (day: number) => {
  const date = new Date(day * DAY_MS);
  return {
    weekday: WEEKDAYS[date.getUTCDay()],
    date: date.getUTCDate(),
    month: MONTHS[date.getUTCMonth()],
    monthIndex: date.getUTCMonth(),
    year: date.getUTCFullYear(),
  };
};

const long = (day: number) => {
  const p = parts(day);
  return `${p.weekday} ${p.date} ${p.month} ${p.year}`;
};

const short = (day: number) => {
  const p = parts(day);
  return `${p.date} ${p.month}`;
};

/** Stable pseudo-random number in [0, 1) for a text key. */
const chance = (key: string) => {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
};

/** 20 December to 4 January: festive peak, outside the Ivory Key. */
const isFestivePeak = (day: number) => {
  const p = parts(day);
  return (p.monthIndex === 11 && p.date >= 20) || (p.monthIndex === 0 && p.date <= 4);
};

// Availability is decided per calendar week, keyed on absolute dates, so the
// same night gives the same answer on every call and on every day.
const isSoldOut = (resort: string, room: (typeof ROOMS)[number], day: number) => {
  const week = Math.floor((day + 3) / 7); // weeks run Monday to Sunday
  return chance(`${resort}|${room.name}|${week}`) < room.soldOutChance;
};

const ranges = (days: number[]) => {
  const out: string[] = [];
  for (let i = 0; i < days.length; ) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
    out.push(i === j ? `${short(days[i])}` : `${short(days[i])} to ${short(days[j])}`);
    i = j + 1;
  }
  return out;
};

export const buildDemoContext = (now = new Date()) => {
  const today = todayInIndia(now);
  const first = today + 1;
  const last = today + BOOKING_WINDOW_DAYS;
  const window: number[] = [];
  for (let day = first; day <= last; day++) window.push(day);

  const saturdays = window.filter((day) => parts(day).weekday === "Saturday").map(short);
  const peakNights = window.filter(isFestivePeak);

  // The member's existing booking: the first Friday at least three weeks out.
  let upcoming = today + 21;
  while (parts(upcoming).weekday !== "Friday") upcoming++;

  const inventory = RESORTS.map((resort) => {
    const rooms = ROOMS.map((room) => {
      const soldOut = window.filter((day) => isSoldOut(resort.code, room, day));
      return soldOut.length === 0
        ? `${room.name}: open on every night.`
        : `${room.name}: sold out on the nights of ${ranges(soldOut).join("; ")}.`;
    });
    return `- ${resort.name}, ${resort.place} (${resort.note}). Hold code ${resort.code}.\n  ${rooms.join("\n  ")}`;
  }).join("\n");

  return `DEMONSTRATION SYSTEM ACCESS
For this call you are connected to the member account and the resort inventory below. Treat this data as the live system: answer from it confidently, with exact dates, and never say you lack access to bookings, availability, or the member's account. If the caller asks directly whether this is a real booking system, say honestly that this is a demonstration environment.

TODAY
- Today is ${long(today)}, India time. Work out "tomorrow", "next weekend", "next month" and similar phrases from this date.
- Saturdays in the booking window: ${saturdays.join(", ")}.
- Always confirm dates back to the member with the weekday, for example "Friday the sixth of November to Monday the ninth". In a Hindi reply say the whole date in Hindi, for example "shukravaar, chhah November se somvaar, nau November tak", written in Devanagari.

MEMBER ACCOUNT
- The caller is a verified member. You do not know their name; use it only if they tell you.
- Plan: Keystone with the Ivory Key, fifteen year tenure.
- Holiday nights this membership year: seven. Used: two. Remaining: five.
- Upcoming booking: ${RESORTS[1].name}, ${RESORTS[1].place}, One Bedroom, three nights, check-in ${long(upcoming)}, check-out ${long(upcoming + 3)}. Booking reference C M four eight two one three. Status: confirmed.

BOOKING RULES
- Bookings can be made for check-in from ${long(first)} up to ${long(last)}. For later dates, say bookings open one hundred and twenty days ahead.
- A stay is between two and five nights, and cannot be longer than the member's remaining nights.
- Room types: Studio sleeps ${ROOMS[0].sleeps}, One Bedroom sleeps ${ROOMS[1].sleeps}, Two Bedroom sleeps ${ROOMS[2].sleeps}.
- Check-in is from two in the afternoon. Check-out is by ten in the morning.
- A stay is available when none of its nights is listed as sold out for that room type. The check-out day itself does not need to be open.${
    peakNights.length
      ? `\n- The festive peak, the nights of ${ranges(peakNights).join("; ")}, is outside the Ivory Key. The member can stay then only with the Ebony Key. Explain this plainly if they ask for those dates, and mention the Ebony Key once, without pushing. Never offer festive peak nights as an alternative; offer dates before or after the peak instead.`
      : ""
  }

RESORT AVAILABILITY
Every night from ${short(first)} to ${short(last)} is open unless listed as sold out.
${inventory}

WHAT YOU CAN DO ON THIS CALL
- Check availability: ask for the destination, then the dates, then the number of guests, one question at a time. Then state clearly whether the stay is available.
- If the dates are sold out, offer the nearest open dates at the same resort first, then a similar resort that is open on the requested dates. Offer at most two alternatives, and check every night of an alternative against the sold-out list before offering it.
- Place a hold: when the member agrees to a stay, confirm resort, room type, check-in, check-out and number of nights, then place a forty-eight hour hold. Give the hold reference as the letters H L D, the resort's hold code, and the check-in day and month as four digits, read out one character at a time. Say that the confirmation will arrive by SMS and email, and that the nights are deducted only when the booking is confirmed.
- Change or cancel the upcoming booking: confirm what the member wants, then say you have raised the request and that a Member Care executive will confirm within twenty-four hours. Do not say it is already changed or cancelled.
- Tell the member their remaining nights and upcoming booking when asked.
- You still cannot take payments, quote prices, or change the membership plan.`;
};
