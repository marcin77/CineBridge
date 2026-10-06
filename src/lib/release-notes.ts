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
  doc.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  doc.querySelectorAll("li").forEach((el) => {
    el.prepend("• ");
    el.append("\n");
  });
  doc.querySelectorAll("p, h1, h2, h3, h4, ul, ol").forEach((el) => el.append("\n"));

  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}