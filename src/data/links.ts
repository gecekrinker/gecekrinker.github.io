import type { IconType } from "react-icons";
import { FaEnvelope, FaInstagram, FaPenNib, FaTelegram, FaYoutube } from "react-icons/fa";
import { SiMyanimelist } from "react-icons/si";

export type SocialLink = {
    id: string;
    label: string;
    handle: string;
    href: string;
    icon: IconType;
};

// Spotify profil linkini buraya yaz (şimdilik genel adres)
export const SPOTIFY_PROFILE = "https://open.spotify.com";

// Mail kartına tıklayınca varsayılan mail uygulaması bu adrese yeni bir mail açar.
const EMAIL = "keremradu@yahoo.com";

// Kart sırası (2 sütun): e-posta | myanimelist / youtube | instagram / bloglar | telegram
// Yeni kart eklemek = bir satır eklemek. Silmek = satırı silmek.
// href'i "#" olanlar yer tutucu, kendi hesaplarınla değiştir.
// href'i "/" ile başlayanlar sitenin kendi sayfasıdır (bloglar -> /blog).
export const socials: SocialLink[] = [
    { id: "mail",      label: "e-posta",     handle: "@keremradu", href: `mailto:${EMAIL}?subject=Merhaba`,       icon: FaEnvelope },
    { id: "mal",       label: "myanimelist", handle: "@keremradu", href: "https://myanimelist.net/profile/keremradu", icon: SiMyanimelist },
    { id: "youtube",   label: "youtube",     handle: "@keremradu", href: "https://www.youtube.com/@keremradu",   icon: FaYoutube },
    { id: "instagram", label: "instagram",   handle: "@keremradu", href: "https://www.instagram.com/keremradu",  icon: FaInstagram },
    { id: "blog",      label: "bloglar",     handle: "@keremradu", href: "/blog",                                icon: FaPenNib },
    { id: "telegram",  label: "telegram",    handle: "@keremradu", href: "https://t.me/keremradu",               icon: FaTelegram },
];
