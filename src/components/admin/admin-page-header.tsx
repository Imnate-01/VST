export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="border-b pb-7">
      <h1 className="text-4xl font-bold leading-tight">{title}</h1>
      <p className="mt-1 text-lg text-muted-foreground">{description}</p>
    </header>
  );
}
