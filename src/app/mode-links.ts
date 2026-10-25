export type ModeGroup = "Photos" | "Video";
export type ModeLink = { href: string; label: string };

/** The tabs under the header on every Photos page and every Video page, so each page offers the same set. */
export function modeLinks(group: ModeGroup, canEdit: boolean): ModeLink[] {
  if (group === "Video") {
    return [
      { href: "/video", label: "Make a clip" },
      { href: "/series", label: "Series" },
      { href: "/recreate", label: "Recreate an edit" },
      { href: "/found", label: "Found footage" },
      { href: "/doctor", label: "Sizzle doctor" },
      { href: "/sprites", label: "Sprite sheet" },
    ];
  }
  return [
    { href: "/photos", label: "Make" },
    ...(canEdit ? [{ href: "/edit", label: "Edit a photo" }] : []),
    { href: "/characters", label: "Characters" },
    { href: "/locations", label: "Locations" },
    { href: "/accessories", label: "Accessories" },
    { href: "/comic", label: "Comic strip" },
    { href: "/ads", label: "Ads" },
  ];
}
