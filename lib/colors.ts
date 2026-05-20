// Fixed palette assigned to TeamMembers on first sign-in. Mirrors the Mālama
// PM palette so the visual feel matches across the two apps.
export const TEAM_COLOR_PALETTE = [
  "#e05252",
  "#d97a5a",
  "#c4a24c",
  "#5b9bd5",
  "#9b6dd7",
  "#00D47E",
  "#e06b9e",
  "#3b9e8f",
  "#7c8db5",
  "#c75a9b",
];

export function getRandomColor(): string {
  return TEAM_COLOR_PALETTE[Math.floor(Math.random() * TEAM_COLOR_PALETTE.length)];
}
