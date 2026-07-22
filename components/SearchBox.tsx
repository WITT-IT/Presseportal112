export default function SearchBox({
  defaultValue,
  gewerkId,
}: {
  defaultValue?: string;
  gewerkId?: string;
}) {
  return (
    <form action="/bildarchiv" method="get" className="relative mb-6">
      {gewerkId && <input type="hidden" name="gewerk" value={gewerkId} />}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Suche nach Ort, Alarmcode oder Stichwort …"
        className="w-full rounded-md border border-line-strong bg-white py-3 pl-4 pr-24 text-[14px] outline-none focus:border-ink"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1.5 rounded-md bg-ink px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-black"
      >
        Suchen
      </button>
    </form>
  );
}
