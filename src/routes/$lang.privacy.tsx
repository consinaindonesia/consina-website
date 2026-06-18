import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$lang/privacy")({
  head: ({ params }) => {
    const isEn = params.lang === "en";
    const title = isEn ? "Privacy Policy — Consina" : "Kebijakan Privasi — Consina";
    const description = isEn
      ? "How Consina collects, uses, and protects your personal data."
      : "Bagaimana Consina mengumpulkan, menggunakan, dan melindungi data pribadi Anda.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: PrivacyPage,
});

function PrivacyPage() {
  const { lang } = Route.useParams();
  const isEn = lang === "en";
  const t = isEn ? en : id;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <div className="mb-8 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900">
        <strong>{t.draftLabel}</strong> {t.draftNote}
      </div>

      <h1 className="text-3xl font-black tracking-tight text-primary sm:text-4xl">
        {t.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t.lastUpdated}: 2026-06-02
      </p>

      <div className="prose prose-sm sm:prose mt-8 max-w-none">
        {t.sections.map((s) => (
          <section key={s.heading} className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-primary">
              {s.heading}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {s.body}
            </p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">{t.contact}</p>
    </main>
  );
}

type Copy = {
  draftLabel: string;
  draftNote: string;
  title: string;
  lastUpdated: string;
  contact: string;
  sections: { heading: string; body: string }[];
};

const en: Copy = {
  draftLabel: "DRAFT — pending legal review.",
  draftNote: "This template must be reviewed and finalized by qualified legal counsel before publication.",
  title: "Privacy Policy",
  lastUpdated: "Last updated",
  contact: "For privacy questions, contact privacy@consina.cloud.",
  sections: [
    {
      heading: "1. Data we collect",
      body: "[TODO — legal] List the personal data we collect (name, email, phone, city, inquiry messages, order details, IP/user agent for security).",
    },
    {
      heading: "2. Why we collect it",
      body: "[TODO — legal] Describe the lawful basis and purpose for each category (responding to inquiries, fulfilling orders, fraud prevention, internal analytics).",
    },
    {
      heading: "3. Sharing",
      body: "[TODO — legal] List sub-processors (e.g. payment provider, shipping carriers, email infrastructure) and the data shared with each.",
    },
    {
      heading: "4. Retention",
      body: "Inquiry data is retained for up to 3 years from creation, after which personal fields are automatically anonymized. Audit logs are retained for 2 years and then archived.",
    },
    {
      heading: "5. Your rights",
      body: "You may request access to, a portable copy of, or deletion of your personal data at any time by emailing privacy@consina.cloud. We will verify your identity by email before acting on the request.",
    },
    {
      heading: "6. Cookies",
      body: "We use only essential cookies (session, language preference) until you consent to additional cookies via the banner shown on your first visit. Your choice is stored for 12 months.",
    },
    {
      heading: "7. Contact",
      body: "[TODO — legal] Insert the data controller's legal name, registered address, and DPO contact.",
    },
  ],
};

const id: Copy = {
  draftLabel: "DRAF — menunggu peninjauan hukum.",
  draftNote: "Templat ini harus ditinjau dan difinalisasi oleh penasihat hukum yang berkualifikasi sebelum dipublikasikan.",
  title: "Kebijakan Privasi",
  lastUpdated: "Terakhir diperbarui",
  contact: "Untuk pertanyaan privasi, hubungi privacy@consina.cloud.",
  sections: [
    {
      heading: "1. Data yang kami kumpulkan",
      body: "[TODO — hukum] Sebutkan data pribadi yang kami kumpulkan (nama, email, telepon, kota, pesan permintaan, detail pesanan, IP/user agent untuk keamanan).",
    },
    {
      heading: "2. Mengapa kami mengumpulkannya",
      body: "[TODO — hukum] Jelaskan dasar hukum dan tujuan setiap kategori (menanggapi permintaan, memenuhi pesanan, pencegahan penipuan, analitik internal).",
    },
    {
      heading: "3. Berbagi data",
      body: "[TODO — hukum] Sebutkan sub-prosesor (mis. penyedia pembayaran, kurir pengiriman, infrastruktur email) dan data yang dibagikan ke masing-masing.",
    },
    {
      heading: "4. Retensi",
      body: "Data permintaan disimpan hingga 3 tahun sejak dibuat, setelah itu kolom data pribadi dianonimkan secara otomatis. Log audit disimpan 2 tahun lalu diarsipkan.",
    },
    {
      heading: "5. Hak Anda",
      body: "Anda dapat meminta akses, salinan portabel, atau penghapusan data pribadi Anda kapan saja dengan mengirim email ke privacy@consina.cloud. Kami akan memverifikasi identitas Anda lewat email sebelum memproses permintaan.",
    },
    {
      heading: "6. Cookie",
      body: "Kami hanya menggunakan cookie esensial (sesi, preferensi bahasa) sampai Anda menyetujui cookie tambahan melalui banner pada kunjungan pertama. Pilihan Anda disimpan selama 12 bulan.",
    },
    {
      heading: "7. Kontak",
      body: "[TODO — hukum] Cantumkan nama hukum pengendali data, alamat terdaftar, dan kontak DPO.",
    },
  ],
};