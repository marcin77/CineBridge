export type ReleaseNotes =
  | string
  | { version: string; note: string | null }[]
  | null
  | undefined;

export function releaseNotesToText(notes: ReleaseNotes): string {
  if (!notes) return "";
  const raw =
    typeof notes === "string" ? notes : notes.map((n) => n.note ?? "").join("\n");

  const doc = new DOMParser().parseFromString(raw, "text/html");
  doc.querySelectorAll("br").forEach((el) => el.replaceWith("\n\n"));
  doc.querySelectorAll("li").forEach((el) => {
    el.prepend("• ");
    el.append("\n\n");
  });
  doc.querySelectorAll("p, h1, h2, h3, h4, ul, ol").forEach((el) => el.append("\n\n"));

  const text = doc.body.textContent ?? "";

  return text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}