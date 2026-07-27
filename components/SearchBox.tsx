export default function SearchBox({
  defaultValue,
  gewerkId,
  dark = false,
}: {
  defaultValue?: string;
  gewerkId?: string;
  dark?: boolean;
}) {
  return (
    <form action="/bildarchiv" method="get" className="relative mb-6">
      {gewerkId && <input type="hidden" name="gewerk" value={gewerkId} />}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Suche nach Ort, Alarmcode oder Stichwort …"
        className={
          dark
            ? 'w-full rounded-md border border-white/15 bg-white/[0.06] py-3 pl-4 pr-24 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-white/35'
            : 'w-full rounded-md border border-line-strong bg-white py-3 pl-4 pr-24 text-[14px] outline-none focus:border-ink'
        }
      />
      <button
        type="submit"
        className={
          dark
            ? 'absolute right-1.5 top-1.5 rounded-md bg-amber px-4 py-1.5 text-[12.5px] font-semibold text-void hover:bg-amber-bright'
            : 'absolute right-1.5 top-1.5 rounded-md bg-ink px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-black'
        }
      >
        Suchen
      </button>
    </form>
  );
}
