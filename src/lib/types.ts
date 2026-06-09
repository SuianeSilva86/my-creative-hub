export interface Profile {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  whatsapp: string | null;
}

export interface PageRow {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "gallery" | "shop";
}

export interface LinkRow {
  id: string;
  user_id: string;
  title: string;
  icon: string | null;
  kind: "external" | "page";
  url: string | null;
  page_id: string | null;
  position: number;
  is_active: boolean;
}

export interface ItemRow {
  id: string;
  page_id: string;
  user_id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  price_cents: number | null;
  position: number;
}
