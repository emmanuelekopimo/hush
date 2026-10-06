import { createAvatar } from "@dicebear/core";
import { notionistsNeutral } from "@dicebear/collection";

/** Generated locally as an SVG data URI. No external image requests. */
export function avatarUri(seed: string): string {
  return createAvatar(notionistsNeutral, { seed, backgroundColor: ["e8e8e8"], radius: 50 }).toDataUri();
}
