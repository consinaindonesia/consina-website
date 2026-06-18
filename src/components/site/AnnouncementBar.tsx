export function AnnouncementBar() {
  return (
    <div
      className="w-full px-4 py-2 text-center text-xs font-medium text-white"
      style={{ backgroundColor: "rgb(26, 58, 46)" }}
    >
      Free shipping on orders over Rp 500,000{" "}
      <a href="/catalog" className="underline underline-offset-2 hover:opacity-80">
        Pelajari
      </a>
    </div>
  );
}
