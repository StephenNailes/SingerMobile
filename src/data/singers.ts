export const genres = ["Pop", "R&B", "Rock", "Folk", "Theatre"] as const;
export type Genre = (typeof genres)[number];
export type SingerInput = {
  name: string;
  genre: Genre;
  hometown: string;
  bio: string;
  song: string;
  imageUrl: string;
  sourceUrl: string;
};
export type Singer = SingerInput & {
  id: number;
  favorite: number;
  createdAt: string;
  updatedAt: string;
};
export const emptySinger: SingerInput = {
  name: "",
  genre: "Pop",
  hometown: "",
  bio: "",
  song: "",
  imageUrl: "",
  sourceUrl: "",
};
export const seedSingers: SingerInput[] = [
  {
    ...emptySinger,
    name: "Gary Valenciano",
    genre: "Pop",
    bio: "Filipino singer and performer whose work spans pop and inspirational music, recordings, television, and live concerts.",
    sourceUrl: "https://www.garyv.com/about-gary-v",
  },
  {
    ...emptySinger,
    name: "Regine Velasquez",
    genre: "Pop",
    bio: "Filipino singer and actress known for her powerful vocals and a career spanning pop ballads, concerts, and screen performances.",
    sourceUrl: "https://music.apple.com/us/artist/regine-velasquez/32340032",
  },
  {
    ...emptySinger,
    name: "Lea Salonga",
    genre: "Theatre",
    bio: "Filipino singer and actress whose work spans musical theatre, concert stages, and the singing voices of Disney princesses Jasmine and Mulan.",
    sourceUrl: "https://www.leasalonga.com/about",
  },
  {
    ...emptySinger,
    name: "Sarah Geronimo",
    genre: "Pop",
    bio: "Filipino singer, actress, and performer with a career spanning pop recordings, concerts, television, and film.",
    sourceUrl: "https://sarah-geronimo.com/",
  },
  {
    ...emptySinger,
    name: "Moira dela Torre",
    genre: "Pop",
    bio: "Filipino singer-songwriter known for her expressive voice and heartfelt songs.",
    sourceUrl: "https://www.tatlerasia.com/people/moira-dela-torre",
  },
  {
    ...emptySinger,
    name: "Bamboo Mañalac",
    genre: "Rock",
    bio: "Filipino rock vocalist and solo recording artist, also known for his work with Rivermaya and the band Bamboo.",
    sourceUrl: "https://music.apple.com/us/artist/bamboo-manalac/324891781",
  },
];
export type FieldErrors = Partial<Record<keyof SingerInput, string>>;
export function validateSinger(input: SingerInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name.trim()) errors.name = "Enter the singer’s name.";
  if (input.name.trim().length > 80)
    errors.name = "Use 80 characters or fewer.";
  if (!genres.includes(input.genre))
    errors.genre = "Choose a genre from the list.";
  for (const [key, limit] of [
    ["hometown", 100],
    ["song", 120],
    ["bio", 2000],
  ] as const) {
    if (input[key].trim().length > limit)
      errors[key] = `Use ${limit} characters or fewer.`;
  }
  for (const key of ["imageUrl", "sourceUrl"] as const) {
    if (!input[key].trim()) continue;
    try {
      const url = new URL(input[key].trim());
      if (
        url.protocol !== "https:" ||
        !url.hostname ||
        url.username ||
        url.password ||
        input[key].length > 2000
      )
        throw new Error();
    } catch {
      errors[key] =
        "Enter a valid https:// link without a username or password.";
    }
  }
  return errors;
}
export function cleanSinger(input: SingerInput): SingerInput {
  const result = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value.trim()]),
  ) as SingerInput;
  const errors = validateSinger(result);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  return result;
}
