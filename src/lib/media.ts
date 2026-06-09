export async function signMediaUrl(path: string): Promise<string> {
  if (!path) return "";
  return path;
}

export async function signMany(paths: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(paths.filter(Boolean)));
  if (uniq.length === 0) return {};
  return Object.fromEntries(uniq.map((path) => [path, path]));
}

export function formatBRL(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildWhatsappLink(phone: string | null | undefined, message: string): string {
  if (!phone) return "#";
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
