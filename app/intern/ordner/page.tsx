import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SESSION_COOKIE } from '@/lib/auth';
import { getMyFolders } from '@/lib/queries';
import CreateFolderForm from '@/components/CreateFolderForm';

export const dynamic = 'force-dynamic';

export default async function FoldersPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) redirect('/login');

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    redirect('/login');
  }

  const folders = await getMyFolders(session.accessToken);

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[720px]">
        <Link
          href="/intern"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Zurück zum internen Bereich
        </Link>

        <h1 className="mb-2 font-display text-[32px] font-bold">Eigene Ordner</h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          Beiträge zusätzlich zur automatischen Einordnung frei gruppieren —
          z. B. nach Einsatz, Veranstaltung oder Anlass.
        </p>

        <CreateFolderForm />

        {folders.length === 0 ? (
          <p className="text-[13px] text-ink-2">Noch keine Ordner angelegt.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {folders.map((folder) => (
              <Link
                key={folder.id}
                href={`/intern/ordner/${folder.id}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition-colors hover:border-line-strong"
              >
                <span className="flex items-center gap-2.5 text-[13.5px] font-medium">
                  <i className="ti ti-folder text-[16px] text-ink-2" aria-hidden="true" />
                  {folder.name}
                </span>
                <span className="font-mono text-[11px] text-ink-3">
                  {folder.postCount} Beitrag{folder.postCount === 1 ? '' : 'e'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
