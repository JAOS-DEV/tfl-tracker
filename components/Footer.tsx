export function Footer(): React.ReactElement {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <div className="mx-auto max-w-6xl space-y-2">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">
          Powered by TfL Open Data
        </p>
        <p>
          This is an independent project and is not affiliated with or endorsed
          by Transport for London.
        </p>
      </div>
    </footer>
  );
}
