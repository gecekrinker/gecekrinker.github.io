// Tarayıcıda da çalışabilen (fs kullanmayan) yardımcılar
// "2026-10-13" -> "10/13/2026" (ana sayfadaki tarih formatıyla aynı)
export function formatDate(iso: string): string {
    const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : iso;
}
